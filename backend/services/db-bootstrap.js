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
    });

    const classStats = await seedClassificationCatalog(db, {
      indDb: IND_DB || {},
      industryMeta: INDUSTRY_META || {},
      ruleVersion: RULE_SCHEMA_VERSION || '2026.2-audit',
      force: false,
    });

    const gisStats = await seedGisLayers(db, {
      sensitiveZones: VIETNAM_SENSITIVE_ZONES || [],
      industrialParks: VIETNAM_INDUSTRIAL_PARKS || [],
      force: false,
    });

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
