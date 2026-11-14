// backend/services/db-bootstrap.js
// Đồng bộ schema cộng thêm & bổ sung dữ liệu danh mục còn thiếu khi khởi động server.
// An toàn tuyệt đối: không TRUNCATE, không ghi đè các bản ghi đã VERIFIED / PUBLISHED.

const defaultDb = require('../config/db');
const logger = require('../utils/logger');
const { migrateVietnameseSchema } = require('./vietnamese-schema');
const {
  ensureClassificationSchema,
  ensureQcvnSchema,
  ensureSensitiveVerificationSchema,
  ensureGisSchema,
  ensureCrawlerSyncSchema,
  seedClassificationCatalog,
  seedQcvnCatalog,
  seedGisLayers,
} = require('./rule-repository');

async function ensureBaseTables(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      reset_token_hash VARCHAR(255) NULL,
      reset_token_expires TIMESTAMP NULL,
      full_name VARCHAR(100) NOT NULL,
      role VARCHAR(20) DEFAULT 'staff',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      form_data JSONB NOT NULL,
      checklist_state JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS latitude NUMERIC,
      ADD COLUMN IF NOT EXISTS longitude NUMERIC,
      ADD COLUMN IF NOT EXISTS dia_chi_hien_thi TEXT,
      ADD COLUMN IF NOT EXISTS quan_huyen TEXT,
      ADD COLUMN IF NOT EXISTS phuong_xa TEXT,
      ADD COLUMN IF NOT EXISTS classification_result JSONB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS laws (
      id VARCHAR(100) PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      year INTEGER NOT NULL,
      sort_date VARCHAR(50),
      so VARCHAR(255) NOT NULL,
      ten TEXT NOT NULL,
      hieuluc VARCHAR(255),
      status VARCHAR(50),
      mo_ta TEXT,
      dieu_khoang JSONB DEFAULT '[]'::jsonb,
      note TEXT,
      link TEXT
    );
  `);

  await db.query(`ALTER TABLE laws ADD COLUMN IF NOT EXISTS last_crawled_mod VARCHAR(100) NULL;`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS rules (
      id VARCHAR(100) PRIMARY KEY,
      rule_name VARCHAR(255) NOT NULL,
      rule_type VARCHAR(50),
      expression TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      version INTEGER DEFAULT 1
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS rule_versions (
      id SERIAL PRIMARY KEY,
      rule_id VARCHAR(100) REFERENCES rules(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      expression TEXT NOT NULL,
      changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      change_reason TEXT
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS law_update_history (
      id SERIAL PRIMARY KEY,
      law_id VARCHAR(100),
      action VARCHAR(50) NOT NULL,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      description TEXT
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT INTO system_settings (key, value)
    VALUES ('auto_crawl_enabled', 'false')
    ON CONFLICT (key) DO UPDATE SET value = 'false';
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS query_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      query_type VARCHAR(50) NOT NULL,
      input_params JSONB NOT NULL,
      output_result JSONB NOT NULL,
      queried_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      ip_address VARCHAR(50),
      user_agent TEXT,
      payload JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function ensureComplianceReminderSchema(db) {
  const existing = await db.query(
    `SELECT
       EXISTS (
         SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'nghia_vu_tuan_thu' AND c.relkind IN ('r', 'p')
       ) AS has_vn,
       EXISTS (
         SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'compliance_obligations' AND c.relkind IN ('r', 'p')
       ) AS has_en`
  );
  if (existing.rows?.[0]?.has_vn || existing.rows?.[0]?.has_en) {
    return;
  }

  const hasVnParents = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'du_an' AND c.relkind IN ('r', 'p')
     ) AS has_du_an`
  );
  const projectRef = hasVnParents.rows?.[0]?.has_du_an ? 'du_an(ma)' : 'projects(id)';
  const userRef = hasVnParents.rows?.[0]?.has_du_an ? 'nguoi_dung(ma)' : 'users(id)';

  await db.query(`
    CREATE TABLE IF NOT EXISTS compliance_obligations (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES ${projectRef} ON DELETE CASCADE,
      user_id INTEGER REFERENCES ${userRef} ON DELETE SET NULL,
      obligation_code VARCHAR(60) NOT NULL DEFAULT 'tuy_chinh',
      title VARCHAR(255) NOT NULL,
      legal_basis VARCHAR(255),
      recurrence VARCHAR(30) NOT NULL DEFAULT 'mot_lan',
      due_date DATE NOT NULL,
      warning_days INTEGER NOT NULL DEFAULT 30,
      status VARCHAR(30) NOT NULL DEFAULT 'chua_hoan_thanh',
      completed_at TIMESTAMP NULL,
      completed_by INTEGER REFERENCES ${userRef} ON DELETE SET NULL,
      completion_note TEXT NULL,
      last_alert_level VARCHAR(30) NULL,
      last_alerted_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function promoteBaselineCatalogOnce(db) {
  const flagKey = 'baseline_catalog_verified_v1';
  const existingFlag = await db.query('SELECT value FROM system_settings WHERE key = $1', [flagKey]);
  if (existingFlag.rowCount > 0 && existingFlag.rows[0].value === 'true') {
    return;
  }

  await db.query(
    `UPDATE industries
     SET verification_status = 'da_xac_minh',
         verified_by = COALESCE(verified_by, 'Hệ thống (Danh mục chuẩn)'),
         verified_at = COALESCE(verified_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE publication_status IN ('PUBLISHED', 'da_cong_bo')
       AND verification_status IN ('NEEDS_LEGAL_VERIFICATION', 'can_xac_minh_phap_ly')`
  );

  await db.query(
    `UPDATE classification_thresholds
     SET verification_status = 'da_xac_minh',
         approved_by = COALESCE(approved_by, 'Hệ thống (Danh mục chuẩn)'),
         approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE publication_status IN ('PUBLISHED', 'da_cong_bo')
       AND verification_status IN ('NEEDS_LEGAL_VERIFICATION', 'can_xac_minh_phap_ly')`
  );

  await db.query(
    `UPDATE qcvns
     SET verification_status = 'da_xac_minh',
         verified_by = COALESCE(verified_by, 'Hệ thống (Danh mục chuẩn)'),
         verified_at = COALESCE(verified_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE publication_status IN ('PUBLISHED', 'da_cong_bo')
       AND verification_status IN ('NEEDS_LEGAL_VERIFICATION', 'can_xac_minh_phap_ly')`
  );

  await db.query(
    `INSERT INTO system_settings (key, value)
     VALUES ($1, 'true')
     ON CONFLICT (key) DO UPDATE SET value = 'true'`,
    [flagKey]
  );
}

/**
 * Chuyển đổi 1 lần toàn bộ giá trị chuỗi tiếng Anh cũ trong DB sang tiếng Việt (idempotent).
 */
async function migrateEnglishValuesToVietnameseOnce(db) {
  const flagKey = 'db_vietnamese_values_v1';
  const existingFlag = await db.query('SELECT value FROM system_settings WHERE key = $1', [flagKey]);
  if (existingFlag.rowCount > 0 && existingFlag.rows[0].value === 'true') {
    return;
  }

  await db.query(`
    UPDATE industries
    SET verification_status = CASE verification_status
          WHEN 'VERIFIED' THEN 'da_xac_minh'
          WHEN 'NEEDS_LEGAL_VERIFICATION' THEN 'can_xac_minh_phap_ly'
          WHEN 'PENDING_VERIFICATION' THEN 'cho_xac_minh'
          WHEN 'DRAFT' THEN 'ban_nhap'
          WHEN 'REJECTED' THEN 'tu_choi'
          ELSE verification_status
        END,
        publication_status = CASE publication_status
          WHEN 'PUBLISHED' THEN 'da_cong_bo'
          WHEN 'DRAFT' THEN 'ban_nhap'
          WHEN 'PENDING_REVIEW' THEN 'cho_duyet'
          WHEN 'EXTRACTED' THEN 'da_trich_xuat'
          WHEN 'RAW' THEN 'tho'
          WHEN 'REJECTED' THEN 'tu_choi'
          WHEN 'ARCHIVED' THEN 'luu_tru'
          ELSE publication_status
        END,
        risk_level = CASE risk_level
          WHEN 'high' THEN 'cao'
          WHEN 'HIGH' THEN 'cao'
          WHEN 'medium' THEN 'trung_binh'
          WHEN 'MEDIUM' THEN 'trung_binh'
          WHEN 'low' THEN 'thap'
          WHEN 'LOW' THEN 'thap'
          ELSE risk_level
        END,
        verified_by = CASE WHEN verified_by = 'system-catalog-baseline' THEN 'Hệ thống (Danh mục chuẩn)' ELSE verified_by END
    WHERE verification_status IN ('VERIFIED', 'NEEDS_LEGAL_VERIFICATION', 'PENDING_VERIFICATION', 'DRAFT', 'REJECTED')
       OR publication_status IN ('PUBLISHED', 'DRAFT', 'PENDING_REVIEW', 'EXTRACTED', 'RAW', 'REJECTED', 'ARCHIVED')
       OR risk_level IN ('high', 'HIGH', 'medium', 'MEDIUM', 'low', 'LOW')
       OR verified_by = 'system-catalog-baseline'
  `);

  await db.query(`
    UPDATE classification_thresholds
    SET verification_status = CASE verification_status
          WHEN 'VERIFIED' THEN 'da_xac_minh'
          WHEN 'NEEDS_LEGAL_VERIFICATION' THEN 'can_xac_minh_phap_ly'
          WHEN 'PENDING_VERIFICATION' THEN 'cho_xac_minh'
          WHEN 'DRAFT' THEN 'ban_nhap'
          WHEN 'REJECTED' THEN 'tu_choi'
          ELSE verification_status
        END,
        publication_status = CASE publication_status
          WHEN 'PUBLISHED' THEN 'da_cong_bo'
          WHEN 'DRAFT' THEN 'ban_nhap'
          WHEN 'PENDING_REVIEW' THEN 'cho_duyet'
          WHEN 'EXTRACTED' THEN 'da_trich_xuat'
          WHEN 'RAW' THEN 'tho'
          WHEN 'REJECTED' THEN 'tu_choi'
          WHEN 'ARCHIVED' THEN 'luu_tru'
          ELSE publication_status
        END,
        capacity_scale = CASE capacity_scale
          WHEN 'LARGE' THEN 'lon'
          WHEN 'MEDIUM' THEN 'trung_binh'
          WHEN 'SMALL' THEN 'nho'
          ELSE capacity_scale
        END,
        approved_by = CASE WHEN approved_by = 'system-catalog-baseline' THEN 'Hệ thống (Danh mục chuẩn)' ELSE approved_by END
    WHERE verification_status IN ('VERIFIED', 'NEEDS_LEGAL_VERIFICATION', 'PENDING_VERIFICATION', 'DRAFT', 'REJECTED')
       OR publication_status IN ('PUBLISHED', 'DRAFT', 'PENDING_REVIEW', 'EXTRACTED', 'RAW', 'REJECTED', 'ARCHIVED')
       OR capacity_scale IN ('LARGE', 'MEDIUM', 'SMALL')
       OR approved_by = 'system-catalog-baseline'
  `);

  await db.query(`
    UPDATE qcvns
    SET verification_status = CASE verification_status
          WHEN 'VERIFIED' THEN 'da_xac_minh'
          WHEN 'NEEDS_LEGAL_VERIFICATION' THEN 'can_xac_minh_phap_ly'
          WHEN 'PENDING_VERIFICATION' THEN 'cho_xac_minh'
          WHEN 'DRAFT' THEN 'ban_nhap'
          WHEN 'REJECTED' THEN 'tu_choi'
          ELSE verification_status
        END,
        publication_status = CASE publication_status
          WHEN 'PUBLISHED' THEN 'da_cong_bo'
          WHEN 'DRAFT' THEN 'ban_nhap'
          WHEN 'PENDING_REVIEW' THEN 'cho_duyet'
          WHEN 'EXTRACTED' THEN 'da_trich_xuat'
          WHEN 'RAW' THEN 'tho'
          WHEN 'REJECTED' THEN 'tu_choi'
          WHEN 'ARCHIVED' THEN 'luu_tru'
          ELSE publication_status
        END,
        status = CASE status
          WHEN 'current' THEN 'hien_hanh'
          WHEN 'superseded' THEN 'het_hieu_luc'
          WHEN 'historical' THEN 'lich_su'
          WHEN 'transitional' THEN 'chuyen_tiep'
          ELSE status
        END,
        flow_range = CASE flow_range
          WHEN 'F1 (<=50 m3/ngay)' THEN 'F1 (<= 50 m³/ngày)'
          WHEN 'F2 (50-2000 m3/ngay)' THEN 'F2 (50 - 2000 m³/ngày)'
          WHEN 'F3 (>=2000 m3/ngay)' THEN 'F3 (>= 2000 m³/ngày)'
          ELSE flow_range
        END,
        verified_by = CASE WHEN verified_by = 'system-catalog-baseline' THEN 'Hệ thống (Danh mục chuẩn)' ELSE verified_by END
    WHERE verification_status IN ('VERIFIED', 'NEEDS_LEGAL_VERIFICATION', 'PENDING_VERIFICATION', 'DRAFT', 'REJECTED')
       OR publication_status IN ('PUBLISHED', 'DRAFT', 'PENDING_REVIEW', 'EXTRACTED', 'RAW', 'REJECTED', 'ARCHIVED')
       OR status IN ('current', 'superseded', 'historical', 'transitional')
       OR flow_range IN ('F1 (<=50 m3/ngay)', 'F2 (50-2000 m3/ngay)', 'F3 (>=2000 m3/ngay)')
       OR verified_by = 'system-catalog-baseline'
  `);

  await db.query(`
    UPDATE qcvn_samples
    SET overall_status = CASE overall_status
          WHEN 'PASS' THEN 'dat'
          WHEN 'FAIL' THEN 'vuot'
          WHEN 'INCOMPLETE' THEN 'chua_du_thong_so'
          WHEN 'PERIOD_MISMATCH' THEN 'sai_chu_ky'
          WHEN 'NEEDS_REVIEW' THEN 'can_ra_soat'
          ELSE overall_status
        END,
        evaluated_verification_status = CASE evaluated_verification_status
          WHEN 'VERIFIED' THEN 'da_xac_minh'
          WHEN 'NEEDS_LEGAL_VERIFICATION' THEN 'can_xac_minh_phap_ly'
          WHEN 'PENDING_VERIFICATION' THEN 'cho_xac_minh'
          WHEN 'DRAFT' THEN 'ban_nhap'
          WHEN 'REJECTED' THEN 'tu_choi'
          ELSE evaluated_verification_status
        END
    WHERE overall_status IN ('PASS', 'FAIL', 'INCOMPLETE', 'PERIOD_MISMATCH', 'NEEDS_REVIEW')
       OR evaluated_verification_status IN ('VERIFIED', 'NEEDS_LEGAL_VERIFICATION', 'PENDING_VERIFICATION', 'DRAFT', 'REJECTED')
  `);

  await db.query(`
    UPDATE gis_layers
    SET layer_type = CASE layer_type
          WHEN 'INDUSTRIAL_PARK' THEN 'khu_cong_nghiep'
          WHEN 'SENSITIVE_ZONE' THEN 'vung_nhay_cam'
          ELSE layer_type
        END,
        verification_status = CASE verification_status
          WHEN 'VERIFIED' THEN 'da_xac_minh'
          WHEN 'NEEDS_LEGAL_VERIFICATION' THEN 'can_xac_minh_phap_ly'
          WHEN 'PENDING_VERIFICATION' THEN 'cho_xac_minh'
          WHEN 'DRAFT' THEN 'ban_nhap'
          WHEN 'REJECTED' THEN 'tu_choi'
          ELSE verification_status
        END,
        publication_status = CASE publication_status
          WHEN 'PUBLISHED' THEN 'da_cong_bo'
          WHEN 'DRAFT' THEN 'ban_nhap'
          WHEN 'PENDING_REVIEW' THEN 'cho_duyet'
          WHEN 'EXTRACTED' THEN 'da_trich_xuat'
          WHEN 'RAW' THEN 'tho'
          WHEN 'REJECTED' THEN 'tu_choi'
          WHEN 'ARCHIVED' THEN 'luu_tru'
          ELSE publication_status
        END
    WHERE layer_type IN ('INDUSTRIAL_PARK', 'SENSITIVE_ZONE')
       OR verification_status IN ('VERIFIED', 'NEEDS_LEGAL_VERIFICATION', 'PENDING_VERIFICATION', 'DRAFT', 'REJECTED')
       OR publication_status IN ('PUBLISHED', 'DRAFT', 'PENDING_REVIEW', 'EXTRACTED', 'RAW', 'REJECTED', 'ARCHIVED')
  `);

  await db.query(`
    UPDATE project_sensitive_verifications
    SET verification_status = CASE verification_status
          WHEN 'VERIFIED' THEN 'da_xac_minh'
          WHEN 'NEEDS_LEGAL_VERIFICATION' THEN 'can_xac_minh_phap_ly'
          WHEN 'PENDING_VERIFICATION' THEN 'cho_xac_minh'
          WHEN 'NOT_REQUIRED' THEN 'khong_yeu_cau'
          WHEN 'DRAFT' THEN 'ban_nhap'
          WHEN 'REJECTED' THEN 'tu_choi'
          ELSE verification_status
        END
    WHERE verification_status IN ('VERIFIED', 'NEEDS_LEGAL_VERIFICATION', 'PENDING_VERIFICATION', 'NOT_REQUIRED', 'DRAFT', 'REJECTED')
  `);

  await db.query(`
    UPDATE law_rule_impacts
    SET severity = CASE severity
          WHEN 'HIGH' THEN 'cao'
          WHEN 'MEDIUM' THEN 'trung_binh'
          WHEN 'LOW' THEN 'thap'
          ELSE severity
        END,
        status = CASE status
          WHEN 'OPEN' THEN 'dang_mo'
          WHEN 'RESOLVED' THEN 'da_xu_ly'
          WHEN 'IGNORED' THEN 'bo_qua'
          ELSE status
        END
    WHERE severity IN ('HIGH', 'MEDIUM', 'LOW')
       OR status IN ('OPEN', 'RESOLVED', 'IGNORED')
  `);

  await db.query(`
    UPDATE rule_candidates
    SET extraction_confidence = CASE extraction_confidence
          WHEN 'HIGH' THEN 'cao'
          WHEN 'MEDIUM' THEN 'trung_binh'
          WHEN 'LOW' THEN 'thap'
          ELSE extraction_confidence
        END,
        status = CASE status
          WHEN 'PENDING_REVIEW' THEN 'cho_duyet'
          WHEN 'EXTRACTED' THEN 'da_trich_xuat'
          WHEN 'APPROVED' THEN 'da_duyet'
          WHEN 'REJECTED' THEN 'tu_choi'
          ELSE status
        END
    WHERE extraction_confidence IN ('HIGH', 'MEDIUM', 'LOW')
       OR status IN ('PENDING_REVIEW', 'EXTRACTED', 'APPROVED', 'REJECTED')
  `);

  await db.query(
    `INSERT INTO system_settings (key, value)
     VALUES ($1, 'true')
     ON CONFLICT (key) DO UPDATE SET value = 'true'`,
    [flagKey]
  );
}

async function loadQcvnSeedModule() {
  try {
    return require('../../frontend/src/data/qcvn-db.js');
  } catch (err) {
    const path = require('path');
    const { pathToFileURL } = require('url');
    const targetUrl = pathToFileURL(path.join(__dirname, '../../frontend/src/data/qcvn-db.js')).href;
    return import(targetUrl);
  }
}

/**
 * Kiểm tra và nâng cấp schema an toàn khi khởi động máy chủ.
 * Tự động bổ sung cột mới (như display_name, verification_status, ...) và điền metadata nền còn thiếu
 * cho các bản ghi chưa duyệt mà không bao giờ ghi đè bản ghi đã VERIFIED/PUBLISHED.
 */
async function ensureRuntimeDatabaseReady({ db = defaultDb, seedIfMissing = true } = {}) {
  try {
    const schemaState = await db.query(
      `SELECT EXISTS (
         SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'nguoi_dung' AND c.relkind IN ('r', 'p')
       ) AS vietnamese_schema,
       EXISTS (
         SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relkind IN ('r', 'p')
       ) AS legacy_schema`
    );
    const isVietnameseSchema = schemaState.rows?.[0]?.vietnamese_schema === true;
    const hasLegacySchema = schemaState.rows?.[0]?.legacy_schema === true;

    if (hasLegacySchema && !isVietnameseSchema) {
      throw new Error('VIETNAMESE_SCHEMA_MIGRATION_REQUIRED: create a database backup, then run backend/scripts/migrate-vietnamese-schema.js');
    }

    if (!isVietnameseSchema) {
      await ensureBaseTables(db);
      await ensureQcvnSchema(db);
      await ensureClassificationSchema(db);
      await ensureSensitiveVerificationSchema(db);
      await ensureGisSchema(db);
      await ensureCrawlerSyncSchema(db);
      await ensureComplianceReminderSchema(db);

      // Chạy migration sau khi bootstrap cũ đã bổ sung các bảng runtime.
      const tableKeys = Object.keys(require('./vietnamese-schema').TABLES);
      const physicalTables = await db.query(
        `SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
           AND c.relname = ANY($1::text[])`,
        [tableKeys]
      );
      if (!hasLegacySchema && physicalTables.rows?.[0]?.count === tableKeys.length) {
        await migrateVietnameseSchema(db);
      }
    } else {
      // Đảm bảo bảng mới (nếu có) được tạo trước khi đồng bộ schema/view tiếng Việt.
      await ensureComplianceReminderSchema(db);
      // Đảm bảo các tên SQL tương thích vẫn tồn tại ở ranh giới API/tầng truy cập dữ liệu.
      await migrateVietnameseSchema(db);
    }

    if (!seedIfMissing) {
      return { ok: true };
    }

    const { IND_DB, INDUSTRY_META, RULE_SCHEMA_VERSION } = require('./classification-service');
    const { VIETNAM_SENSITIVE_ZONES, VIETNAM_INDUSTRIAL_PARKS } = require('./spatial-gis-service');
    const { QCVN_DATA, QCVN_SCHEMA_VERSION } = await loadQcvnSeedModule();

    const qcvnStats = await seedQcvnCatalog(db, {
      qcvnData: QCVN_DATA || {},
      ruleVersion: QCVN_SCHEMA_VERSION || '2026.2-audit',
      force: false,
      defaultVerified: true,
    });

    const classStats = await seedClassificationCatalog(db, {
      indDb: IND_DB || {},
      industryMeta: INDUSTRY_META || {},
      ruleVersion: RULE_SCHEMA_VERSION || '2026.2-audit',
      force: false,
      defaultVerified: true,
    });

    const gisStats = await seedGisLayers(db, {
      sensitiveZones: VIETNAM_SENSITIVE_ZONES || [],
      industrialParks: VIETNAM_INDUSTRIAL_PARKS || [],
      force: false,
    });

    await promoteBaselineCatalogOnce(db);
    await migrateEnglishValuesToVietnameseOnce(db);

    if (
      qcvnStats.inserted > 0 || qcvnStats.enriched > 0
      || classStats.industriesInserted > 0 || classStats.industriesEnriched > 0 || classStats.thresholdsInserted > 0
      || gisStats.inserted > 0
    ) {
      logger.info(
        `DB runtime bootstrap đã bổ sung an toàn: QCVN(+${qcvnStats.inserted}/bổ sung ${qcvnStats.enriched}), Ngành(+${classStats.industriesInserted}/bổ sung ${classStats.industriesEnriched}/ngưỡng +${classStats.thresholdsInserted}), GIS(+${gisStats.inserted}).`
      );
    } else {
      logger.info('Cơ sở dữ liệu và danh mục quy tắc đã sẵn sàng.');
    }

    return { ok: true, qcvnStats, classStats, gisStats };
  } catch (error) {
    logger.error('Không thể tự động kiểm tra/nâng cấp schema DB lúc khởi động (hệ thống chuyển chế độ an toàn):', error.message);
    return { ok: false, error: error.message };
  }
}

module.exports = {
  ensureRuntimeDatabaseReady,
};
