// backend/services/rule-repository.js
// Repository quản lý Schema Migration an toàn, Seed không ghi đè dữ liệu đã duyệt,
// và nạp rule runtime từ PostgreSQL (chỉ đọc bản ghi hợp lệ, loại bỏ DRAFT/PENDING_REVIEW/REJECTED).

const defaultDb = require('../config/db');

const EXCLUDED_PUBLICATION_STATUSES = new Set([
  'DRAFT',
  'PENDING_REVIEW',
  'EXTRACTED',
  'RAW',
  'REJECTED',
  'ARCHIVED',
]);

function isActivePublicationStatus(status) {
  if (!status) return true;
  return !EXCLUDED_PUBLICATION_STATUSES.has(String(status).trim().toUpperCase());
}

function parseJsonSafe(val, fallback) {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return val;
}

function formatDateOnly(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    const m = val.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function slugifyId(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

/**
 * Migration cộng thêm cho hệ thống phân loại (không chạy TRUNCATE, không làm mất dữ liệu cũ)
 */
async function ensureClassificationSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS industries (
      code VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      risk_level VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS legal_appendices (
      id VARCHAR(100) PRIMARY KEY,
      law_id VARCHAR(100) REFERENCES laws(id) ON DELETE SET NULL,
      appendix_name VARCHAR(255),
      item_number VARCHAR(50),
      content_summary TEXT
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS classification_thresholds (
      id SERIAL PRIMARY KEY,
      industry_code VARCHAR(50) REFERENCES industries(code) ON DELETE CASCADE,
      min_value DECIMAL(15,2) NOT NULL,
      max_value DECIMAL(15,2),
      unit VARCHAR(50),
      project_group VARCHAR(10),
      legal_doc_required VARCHAR(20),
      appendix_id VARCHAR(100) REFERENCES legal_appendices(id) ON DELETE SET NULL
    );
  `);

  await client.query(`
    ALTER TABLE industries
      ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS capacity_label TEXT,
      ADD COLUMN IF NOT EXISTS unit VARCHAR(100),
      ADD COLUMN IF NOT EXISTS note TEXT,
      ADD COLUMN IF NOT EXISTS audit_note TEXT,
      ADD COLUMN IF NOT EXISTS process_stages_meta JSONB,
      ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'NEEDS_LEGAL_VERIFICATION',
      ADD COLUMN IF NOT EXISTS publication_status VARCHAR(30) DEFAULT 'PUBLISHED',
      ADD COLUMN IF NOT EXISTS rule_version VARCHAR(50) DEFAULT '2026.2-audit',
      ADD COLUMN IF NOT EXISTS source_document TEXT,
      ADD COLUMN IF NOT EXISTS verified_by VARCHAR(100),
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);

  await client.query(`
    ALTER TABLE classification_thresholds
      ADD COLUMN IF NOT EXISTS process_stage VARCHAR(100) DEFAULT '',
      ADD COLUMN IF NOT EXISTS operator VARCHAR(10) DEFAULT '>=',
      ADD COLUMN IF NOT EXISTS capacity_scale VARCHAR(20),
      ADD COLUMN IF NOT EXISTS tq VARCHAR(30),
      ADD COLUMN IF NOT EXISTS historical_tq VARCHAR(30),
      ADD COLUMN IF NOT EXISTS phu_luc VARCHAR(255),
      ADD COLUMN IF NOT EXISTS legal_ref TEXT,
      ADD COLUMN IF NOT EXISTS law_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS effective_from DATE,
      ADD COLUMN IF NOT EXISTS effective_to DATE,
      ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'NEEDS_LEGAL_VERIFICATION',
      ADD COLUMN IF NOT EXISTS publication_status VARCHAR(30) DEFAULT 'PUBLISHED',
      ADD COLUMN IF NOT EXISTS tier_order INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rule_version VARCHAR(50) DEFAULT '2026.2-audit',
      ADD COLUMN IF NOT EXISTS source_ref TEXT,
      ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100),
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS is_active_version BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS superseded_at DATE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);
}

/**
 * Migration cộng thêm cho bảng qcvns & qcvn_samples
 */
async function ensureQcvnSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS qcvns (
      id VARCHAR(100) PRIMARY KEY,
      ten VARCHAR(255) NOT NULL,
      ap_dung TEXT,
      tham_so JSONB NOT NULL
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS qcvn_samples (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(100) NOT NULL,
      sub_type VARCHAR(100) NOT NULL,
      values JSONB NOT NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      trang_thai_tong_quat VARCHAR(40),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(`
    ALTER TABLE qcvns
      ADD COLUMN IF NOT EXISTS standard_code VARCHAR(100),
      ADD COLUMN IF NOT EXISTS standard_version VARCHAR(50),
      ADD COLUMN IF NOT EXISTS status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS source_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS column_code VARCHAR(30),
      ADD COLUMN IF NOT EXISTS flow_range VARCHAR(50),
      ADD COLUMN IF NOT EXISTS effective_from DATE,
      ADD COLUMN IF NOT EXISTS effective_to DATE,
      ADD COLUMN IF NOT EXISTS mandatory_for_all_from DATE,
      ADD COLUMN IF NOT EXISTS replaces JSONB,
      ADD COLUMN IF NOT EXISTS transition_rules JSONB,
      ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'NEEDS_LEGAL_VERIFICATION',
      ADD COLUMN IF NOT EXISTS publication_status VARCHAR(30) DEFAULT 'PUBLISHED',
      ADD COLUMN IF NOT EXISTS source_document TEXT,
      ADD COLUMN IF NOT EXISTS rule_version VARCHAR(50) DEFAULT '2026.2-audit',
      ADD COLUMN IF NOT EXISTS verified_by VARCHAR(100),
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS published_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);

  await client.query(`
    ALTER TABLE qcvn_samples
      ALTER COLUMN trang_thai_tong_quat TYPE VARCHAR(40);
  `);

  await client.query(`
    ALTER TABLE qcvn_samples
      ADD COLUMN IF NOT EXISTS overall_status VARCHAR(40),
      ADD COLUMN IF NOT EXISTS evaluation_details JSONB,
      ADD COLUMN IF NOT EXISTS evaluated_rule_version VARCHAR(50),
      ADD COLUMN IF NOT EXISTS evaluated_verification_status VARCHAR(50);
  `);
}

function inferQcvnMetadata(id, qcvn) {
  let standardCode = qcvn.standardCode || null;
  let standardVersion = qcvn.standardVersion || null;
  let sourceType = qcvn.sourceType || null;
  let columnCode = qcvn.columnCode || null;
  let flowRange = qcvn.flowRange || null;

  if (!sourceType) {
    if (id.startsWith('qcvn40_')) sourceType = 'nuoc_thai_cn';
    else if (id.startsWith('qcvn14_')) sourceType = 'nuoc_thai_sh';
    else if (id.startsWith('qcvn08_')) sourceType = 'nuoc_mat';
    else if (id.startsWith('qcvn09')) sourceType = 'nuoc_ngam';
    else if (id.startsWith('qcvn05_')) sourceType = 'khong_khi';
    else if (id.startsWith('qcvn19_')) sourceType = 'khi_thai';
    else if (id.startsWith('qcvn03_')) sourceType = 'dat';
  }

  if (!standardCode && qcvn.ten) {
    const codeMatch = String(qcvn.ten).match(/QCVN\s+[0-9A-Za-z\-]+:[0-9]{4}\/[A-ZĐ]+/i);
    if (codeMatch) standardCode = codeMatch[0];
  }
  if (!standardVersion && standardCode) {
    const verMatch = standardCode.match(/:([0-9]{4})/);
    if (verMatch) standardVersion = verMatch[1];
  }
  if (!columnCode) {
    if (/_a(?:_|$)/.test(id)) columnCode = 'A';
    else if (/_b(?:_|$)/.test(id)) columnCode = 'B';
    else if (/_c(?:_|$)/.test(id)) columnCode = 'C';
    else if (/_d(?:_|$)/.test(id)) columnCode = 'D';
    else if (/_a1$/.test(id)) columnCode = 'A1';
    else if (/_a2$/.test(id)) columnCode = 'A2';
    else if (/_b1$/.test(id)) columnCode = 'B1';
    else if (/_b2$/.test(id)) columnCode = 'B2';
  }
  if (!flowRange) {
    if (id.endsWith('_f1')) flowRange = 'F1 (<=50 m3/ngay)';
    else if (id.endsWith('_low')) flowRange = 'F2 (50-2000 m3/ngay)';
    else if (id.endsWith('_high')) flowRange = 'F3 (>=2000 m3/ngay)';
  }

  return {
    standardCode,
    standardVersion,
    status: qcvn.status || 'current',
    sourceType,
    columnCode,
    flowRange,
    effectiveFrom: qcvn.effectiveFrom || null,
    effectiveTo: qcvn.effectiveTo || null,
    mandatoryForAllFrom: qcvn.mandatoryForAllFrom || null,
    replaces: qcvn.replaces || null,
    transitionRules: qcvn.transitionRules || null,
    verificationStatus: qcvn.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION',
    sourceDocument: qcvn.ap_dung || null,
  };
}

/**
 * Seed QCVN an toàn & idempotent:
 * - Không bao giờ chạy TRUNCATE.
 * - Không ghi đè bản ghi đã VERIFIED / có verified_by hoặc đang ở luồng duyệt khác ngoài cập nhật metadata thiếu khi chưa duyệt.
 */
async function seedQcvnCatalog(client, { qcvnData = {}, ruleVersion = '2026.2-audit', force = false } = {}) {
  await ensureQcvnSchema(client);

  let inserted = 0;
  let enriched = 0;
  let skippedVerified = 0;

  for (const id of Object.keys(qcvnData)) {
    const qcvn = qcvnData[id];
    const meta = inferQcvnMetadata(id, qcvn);
    const checkRes = await client.query(
      'SELECT id, standard_code, verification_status, publication_status, verified_by FROM qcvns WHERE id = $1',
      [id]
    );

    if (checkRes.rowCount === 0) {
      await client.query(
        `INSERT INTO qcvns (
          id, ten, ap_dung, tham_so,
          standard_code, standard_version, status, source_type, column_code, flow_range,
          effective_from, effective_to, mandatory_for_all_from, replaces, transition_rules,
          verification_status, publication_status, source_document, rule_version, published_at, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, 'PUBLISHED', $17, $18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )`,
        [
          id,
          qcvn.ten,
          qcvn.ap_dung || null,
          JSON.stringify(qcvn.tham_so || []),
          meta.standardCode,
          meta.standardVersion,
          meta.status,
          meta.sourceType,
          meta.columnCode,
          meta.flowRange,
          meta.effectiveFrom,
          meta.effectiveTo,
          meta.mandatoryForAllFrom,
          meta.replaces ? JSON.stringify(meta.replaces) : null,
          meta.transitionRules ? JSON.stringify(meta.transitionRules) : null,
          meta.verificationStatus,
          meta.sourceDocument,
          ruleVersion,
        ]
      );
      inserted++;
      continue;
    }

    const existing = checkRes.rows[0];
    const isLocked = existing.verification_status === 'VERIFIED'
      || Boolean(existing.verified_by)
      || EXCLUDED_PUBLICATION_STATUSES.has(String(existing.publication_status || '').toUpperCase());

    if (isLocked) {
      skippedVerified++;
      continue;
    }

    // Chỉ bổ sung metadata bị thiếu từ schema cũ (standard_code IS NULL) hoặc khi có cờ force (vẫn không chạm bản đã VERIFIED)
    if (force || !existing.standard_code) {
      await client.query(
        `UPDATE qcvns
         SET ten = COALESCE(NULLIF($1, ''), ten),
             ap_dung = COALESCE($2, ap_dung),
             tham_so = CASE WHEN $3::boolean THEN $4::jsonb ELSE tham_so END,
             standard_code = COALESCE($5, standard_code),
             standard_version = COALESCE($6, standard_version),
             status = COALESCE($7, status),
             source_type = COALESCE($8, source_type),
             column_code = COALESCE($9, column_code),
             flow_range = COALESCE($10, flow_range),
             effective_from = COALESCE($11, effective_from),
             effective_to = COALESCE($12, effective_to),
             mandatory_for_all_from = COALESCE($13, mandatory_for_all_from),
             replaces = COALESCE($14::jsonb, replaces),
             transition_rules = COALESCE($15::jsonb, transition_rules),
             verification_status = COALESCE(verification_status, $16),
             source_document = COALESCE($17, source_document),
             rule_version = COALESCE($18, rule_version),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $19`,
        [
          qcvn.ten,
          qcvn.ap_dung || null,
          force,
          JSON.stringify(qcvn.tham_so || []),
          meta.standardCode,
          meta.standardVersion,
          meta.status,
          meta.sourceType,
          meta.columnCode,
          meta.flowRange,
          meta.effectiveFrom,
          meta.effectiveTo,
          meta.mandatoryForAllFrom,
          meta.replaces ? JSON.stringify(meta.replaces) : null,
          meta.transitionRules ? JSON.stringify(meta.transitionRules) : null,
          meta.verificationStatus,
          meta.sourceDocument,
          ruleVersion,
          id,
        ]
      );
      enriched++;
    }
  }

  return { inserted, enriched, skippedVerified };
}

/**
 * Seed danh mục ngành & toàn bộ ngưỡng (bao gồm cả industry.t và industry.processRules).
 * Không chạy TRUNCATE, không ghi đè bản ghi VERIFIED / có approved_by.
 */
async function seedClassificationCatalog(client, { indDb = {}, industryMeta = {}, ruleVersion = '2026.2-audit', force = false } = {}) {
  await ensureClassificationSchema(client);

  const lawsRes = await client.query('SELECT id FROM laws');
  const existingLawIds = new Set(lawsRes.rows.map(r => r.id));

  let industriesInserted = 0;
  let industriesEnriched = 0;
  let thresholdsInserted = 0;
  let skippedVerified = 0;

  for (const code of Object.keys(indDb)) {
    const industry = indDb[code];
    const meta = industryMeta[code] || {};
    const displayName = meta.name || industry.lbl.replace(/\s*\(.*\)\s*$/, '').trim() || code;
    const unitMatch = industry.lbl ? industry.lbl.match(/\((.*)\)/) : null;
    const unit = unitMatch ? unitMatch[1] : '';
    const processStagesMeta = meta.processStages ? JSON.stringify(meta.processStages) : null;
    const indVerification = industry.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION';

    const existingIndRes = await client.query(
      'SELECT code, display_name, verification_status, publication_status FROM industries WHERE code = $1',
      [code]
    );

    if (existingIndRes.rowCount === 0) {
      await client.query(
        `INSERT INTO industries (
          code, name, risk_level, display_name, capacity_label, unit, note, audit_note,
          process_stages_meta, verification_status, publication_status, rule_version, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PUBLISHED', $11, CURRENT_TIMESTAMP)`,
        [
          code,
          displayName,
          'medium',
          displayName,
          industry.lbl || '',
          unit,
          industry.note || null,
          industry.auditNote || null,
          processStagesMeta,
          indVerification,
          ruleVersion,
        ]
      );
      industriesInserted++;
    } else {
      const existingInd = existingIndRes.rows[0];
      const indLocked = existingInd.verification_status === 'VERIFIED'
        || EXCLUDED_PUBLICATION_STATUSES.has(String(existingInd.publication_status || '').toUpperCase());

      if (!indLocked && (force || !existingInd.display_name)) {
        await client.query(
          `UPDATE industries
           SET name = COALESCE($1, name),
               display_name = COALESCE($1, display_name),
               capacity_label = COALESCE($2, capacity_label),
               unit = COALESCE($3, unit),
               note = COALESCE($4, note),
               audit_note = COALESCE($5, audit_note),
               process_stages_meta = COALESCE($6::jsonb, process_stages_meta),
               rule_version = COALESCE($7, rule_version),
               updated_at = CURRENT_TIMESTAMP
           WHERE code = $8`,
          [displayName, industry.lbl || '', unit, industry.note || null, industry.auditNote || null, processStagesMeta, ruleVersion, code]
        );
        industriesEnriched++;
      }
    }

    // Chuẩn bị danh sách bucket: '' (tiers mặc định) và từng key trong processRules
    const buckets = [];
    if (Array.isArray(industry.t) && industry.t.length > 0) {
      buckets.push({ processStage: '', tiers: industry.t });
    }
    if (industry.processRules && typeof industry.processRules === 'object') {
      for (const [stageKey, stageTiers] of Object.entries(industry.processRules)) {
        if (Array.isArray(stageTiers) && stageTiers.length > 0) {
          buckets.push({ processStage: stageKey, tiers: stageTiers });
        }
      }
    }

    for (const bucket of buckets) {
      const stage = bucket.processStage;
      const existingTiersRes = await client.query(
        `SELECT id, tq, verification_status, publication_status, approved_by
         FROM classification_thresholds
         WHERE industry_code = $1 AND COALESCE(process_stage, '') = $2`,
        [code, stage]
      );

      const hasLockedRow = existingTiersRes.rows.some(
        r => r.verification_status === 'VERIFIED'
          || Boolean(r.approved_by)
          || EXCLUDED_PUBLICATION_STATUSES.has(String(r.publication_status || '').toUpperCase())
      );

      if (hasLockedRow) {
        skippedVerified++;
        continue;
      }

      const needsLegacyUpgrade = existingTiersRes.rowCount > 0
        && existingTiersRes.rows.every(r => !r.tq);

      if (existingTiersRes.rowCount > 0 && !force && !needsLegacyUpgrade) {
        continue;
      }

      if (existingTiersRes.rowCount > 0 && (force || needsLegacyUpgrade)) {
        // Chỉ xóa các dòng chưa VERIFIED của đúng bucket đang nâng cấp/force-seed (không TRUNCATE toàn bảng)
        await client.query(
          `DELETE FROM classification_thresholds
           WHERE industry_code = $1
             AND COALESCE(process_stage, '') = $2
             AND COALESCE(verification_status, 'NEEDS_LEGAL_VERIFICATION') <> 'VERIFIED'
             AND approved_by IS NULL`,
          [code, stage]
        );
      }

      for (let i = 0; i < bucket.tiers.length; i++) {
        const tier = bucket.tiers[i];
        const stageSlug = stage || 'default';
        const appendixId = `app_${code}_${stageSlug}_${i}`;
        const plParts = (tier.phu_luc || '').split(',');
        const appendixName = plParts[0] ? plParts[0].trim() : 'Phụ lục chưa rõ';
        const itemNumber = plParts.slice(1).join(',').trim();

        let candidateLawId = null;
        if (tier.ref) {
          if (tier.ref.includes('08/2022')) candidateLawId = 'nd_08_2022';
          else if (tier.ref.includes('2020')) candidateLawId = 'luat_bvmt_2020';
          else if (tier.ref.includes('49/2026')) candidateLawId = 'vbhn_49_2026';
        }
        const safeLawId = candidateLawId && existingLawIds.has(candidateLawId) ? candidateLawId : null;

        await client.query(
          `INSERT INTO legal_appendices (id, law_id, appendix_name, item_number, content_summary)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
             law_id = COALESCE(EXCLUDED.law_id, legal_appendices.law_id),
             appendix_name = EXCLUDED.appendix_name,
             item_number = EXCLUDED.item_number,
             content_summary = EXCLUDED.content_summary`,
          [
            appendixId,
            safeLawId,
            appendixName,
            itemNumber,
            `Ngưỡng phân loại ${displayName} (${stageSlug}): ${tier.verificationStatus || 'NEEDS_LEGAL_VERIFICATION'}`,
          ]
        );

        const maxValue = i > 0 ? bucket.tiers[i - 1].min : null;
        const projectGroup = tier.projectGroup
          || (tier.hs === 'DTM' && tier.tq === 'cap_bo' ? 'Nhóm I' : tier.hs === 'DTM' ? 'Nhóm II' : tier.hs === 'GPMT' ? 'Nhóm III' : 'Nhóm IV');

        await client.query(
          `INSERT INTO classification_thresholds (
            industry_code, process_stage, min_value, max_value, operator, unit,
            capacity_scale, project_group, legal_doc_required, tq, historical_tq,
            phu_luc, legal_ref, law_id, effective_from, effective_to,
            verification_status, publication_status, tier_order, rule_version, source_ref, appendix_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16,
            $17, 'PUBLISHED', $18, $19, $20, $21
          )`,
          [
            code,
            stage,
            tier.min,
            maxValue,
            tier.operator || '>=',
            unit,
            tier.capacityScale || null,
            projectGroup,
            tier.hs,
            tier.tq,
            tier.historicalTq || null,
            tier.phu_luc || null,
            tier.ref || null,
            safeLawId,
            tier.effectiveFrom || null,
            tier.effectiveTo || null,
            tier.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION',
            i,
            ruleVersion,
            tier.ref || null,
            appendixId,
          ]
        );
        thresholdsInserted++;
      }
    }
  }

  return { industriesInserted, industriesEnriched, thresholdsInserted, skippedVerified };
}

/**
 * Nạp danh mục ngành nghề & ngưỡng phân loại runtime từ PostgreSQL.
 * Loại bỏ các bản ghi DRAFT / PENDING_REVIEW / REJECTED / ARCHIVED.
 * Nếu DB lỗi hoặc rỗng -> trả ruleSource: 'FALLBACK_UNVERIFIED'.
 */
async function loadClassificationCatalog({ db = defaultDb } = {}) {
  try {
    const indRes = await db.query(
      `SELECT code, name, display_name, capacity_label, unit, note, audit_note,
              process_stages_meta, verification_status, publication_status, rule_version
       FROM industries
       ORDER BY code`
    );

    const thrRes = await db.query(
      `SELECT id, industry_code, process_stage, min_value, max_value, operator, unit,
              capacity_scale, project_group, legal_doc_required, tq, historical_tq,
              phu_luc, legal_ref, law_id, effective_from, effective_to,
              verification_status, publication_status, tier_order, rule_version, source_ref, approved_by, approved_at,
              is_active_version, superseded_at
       FROM classification_thresholds
       ORDER BY industry_code, COALESCE(process_stage, ''), tier_order ASC, min_value DESC`
    );

    if (!indRes || !Array.isArray(indRes.rows) || indRes.rows.length === 0) {
      return { ok: false, ruleSource: 'FALLBACK_UNVERIFIED', catalog: null, error: 'EMPTY_INDUSTRIES_TABLE' };
    }

    const catalog = {};
    for (const row of indRes.rows) {
      if (!isActivePublicationStatus(row.publication_status)) continue;
      const processStagesMeta = parseJsonSafe(row.process_stages_meta, null);
      catalog[row.code] = {
        code: row.code,
        name: row.display_name || row.name || row.code,
        lbl: row.capacity_label || (row.unit ? `${row.display_name || row.name} (${row.unit})` : (row.display_name || row.name)),
        unit: row.unit || '',
        note: row.note || '',
        auditNote: row.audit_note || '',
        processStagesMeta,
        verificationStatus: row.verification_status === 'VERIFIED' ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION',
        ruleVersion: row.rule_version || '2026.2-audit',
        t: [],
        processRules: null,
      };
    }

    const thresholdsByIndustry = new Map();
    for (const tr of (thrRes?.rows || [])) {
      if (!isActivePublicationStatus(tr.publication_status)) continue;
      if (tr.is_active_version === false) continue;
      if (!catalog[tr.industry_code]) continue;
      if (!thresholdsByIndustry.has(tr.industry_code)) {
        thresholdsByIndustry.set(tr.industry_code, []);
      }
      thresholdsByIndustry.get(tr.industry_code).push(tr);
    }

    for (const [code, rows] of thresholdsByIndustry.entries()) {
      const ind = catalog[code];
      const byStage = new Map();
      for (const r of rows) {
        const stage = r.process_stage || '';
        if (!byStage.has(stage)) byStage.set(stage, []);
        byStage.get(stage).push({
          id: r.id,
          min: parseFloat(r.min_value),
          max: r.max_value !== null && r.max_value !== undefined ? parseFloat(r.max_value) : null,
          operator: r.operator || '>=',
          projectGroup: r.project_group,
          capacityScale: r.capacity_scale,
          hs: r.legal_doc_required,
          tq: r.tq,
          historicalTq: r.historical_tq || null,
          phu_luc: r.phu_luc || '—',
          ref: r.legal_ref || r.source_ref || '',
          lawId: r.law_id || null,
          effectiveFrom: formatDateOnly(r.effective_from),
          effectiveTo: formatDateOnly(r.effective_to),
          verificationStatus: r.verification_status === 'VERIFIED' ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION',
          ruleVersion: r.rule_version || ind.ruleVersion,
          approvedBy: r.approved_by || null,
          approvedAt: r.approved_at || null,
          tierOrder: r.tier_order ?? 0,
        });
      }

      const sortTiers = arr => arr.sort((a, b) => {
        if ((a.tierOrder ?? 0) !== (b.tierOrder ?? 0)) return (a.tierOrder ?? 0) - (b.tierOrder ?? 0);
        return b.min - a.min;
      });

      if (byStage.has('')) {
        ind.t = sortTiers(byStage.get(''));
      }

      const stageKeys = Array.from(byStage.keys()).filter(k => k !== '');
      if (stageKeys.length > 0) {
        ind.processRules = {};
        for (const sk of stageKeys) {
          ind.processRules[sk] = sortTiers(byStage.get(sk));
        }
      }
    }

    if (Object.keys(catalog).length === 0) {
      return { ok: false, ruleSource: 'FALLBACK_UNVERIFIED', catalog: null, error: 'NO_PUBLISHED_INDUSTRIES' };
    }

    return { ok: true, ruleSource: 'DATABASE', catalog };
  } catch (error) {
    return {
      ok: false,
      ruleSource: 'FALLBACK_UNVERIFIED',
      catalog: null,
      error: error.message || 'DB_LOAD_FAILED',
    };
  }
}

/**
 * Nạp danh mục QCVN runtime từ PostgreSQL (đầy đủ metadata + trạng thái duyệt).
 */
async function loadQcvnCatalog({ db = defaultDb } = {}) {
  try {
    const result = await db.query(
      `SELECT id, ten, ap_dung, tham_so,
              standard_code, standard_version, status, source_type, column_code, flow_range,
              effective_from, effective_to, mandatory_for_all_from, replaces, transition_rules,
              verification_status, publication_status, source_document, rule_version,
              verified_by, verified_at, published_at
       FROM qcvns
       ORDER BY id`
    );

    if (!result || !Array.isArray(result.rows) || result.rows.length === 0) {
      return { ok: false, ruleSource: 'FALLBACK_UNVERIFIED', catalog: {}, error: 'EMPTY_QCVNS_TABLE' };
    }

    const catalog = {};
    for (const row of result.rows) {
      if (!isActivePublicationStatus(row.publication_status)) continue;
      catalog[row.id] = {
        id: row.id,
        ten: row.ten,
        ap_dung: row.ap_dung,
        tham_so: parseJsonSafe(row.tham_so, []),
        standardCode: row.standard_code || null,
        standardVersion: row.standard_version || null,
        status: row.status || null,
        sourceType: row.source_type || null,
        columnCode: row.column_code || null,
        flowRange: row.flow_range || null,
        effectiveFrom: formatDateOnly(row.effective_from),
        effectiveTo: formatDateOnly(row.effective_to),
        mandatoryForAllFrom: formatDateOnly(row.mandatory_for_all_from),
        replaces: parseJsonSafe(row.replaces, null),
        transitionRules: parseJsonSafe(row.transition_rules, null),
        verificationStatus: row.verification_status === 'VERIFIED' ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION',
        publicationStatus: row.publication_status || 'PUBLISHED',
        sourceDocument: row.source_document || null,
        ruleVersion: row.rule_version || '2026.2-audit',
        verifiedBy: row.verified_by || null,
        verifiedAt: row.verified_at || null,
        publishedAt: row.published_at || null,
      };
    }

    if (Object.keys(catalog).length === 0) {
      return { ok: false, ruleSource: 'FALLBACK_UNVERIFIED', catalog: {}, error: 'NO_PUBLISHED_QCVNS' };
    }

    return { ok: true, ruleSource: 'DATABASE', catalog };
  } catch (error) {
    return {
      ok: false,
      ruleSource: 'FALLBACK_UNVERIFIED',
      catalog: {},
      error: error.message || 'DB_LOAD_FAILED',
    };
  }
}

const SENSITIVE_FLAG_KEYS = ['kt', 'nt', 'dt', 'rung', 'di_san', 'lua', 'dd', 'bao_ton', 'bg'];

function normalizeSensitiveFlags(flags = {}) {
  const out = {};
  for (const key of SENSITIVE_FLAG_KEYS) {
    out[key] = Boolean(flags && flags[key]);
  }
  return out;
}

function normalizeSensitiveDetails(details = {}) {
  if (!details || typeof details !== 'object') {
    return {
      insideCoreProtectedZone: false,
      paddyConversionAreaHa: 0,
      forestConversionAreaHa: 0,
      hasSensitiveResettlement: false,
      evidenceRef: null,
    };
  }
  const paddyHa = Number(details.paddyConversionAreaHa);
  const forestHa = Number(details.forestConversionAreaHa);
  return {
    insideCoreProtectedZone: details.insideCoreProtectedZone === true,
    paddyConversionAreaHa: Number.isFinite(paddyHa) && paddyHa > 0 ? paddyHa : 0,
    forestConversionAreaHa: Number.isFinite(forestHa) && forestHa > 0 ? forestHa : 0,
    hasSensitiveResettlement: details.hasSensitiveResettlement === true,
    evidenceRef: details.evidenceRef ? String(details.evidenceRef).trim() : null,
  };
}

/**
 * Migration bảng xác minh yếu tố nhạy cảm phía server (Item 6)
 */
async function ensureSensitiveVerificationSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS project_sensitive_verifications (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      declared_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
      declared_details JSONB NOT NULL DEFAULT '{}'::jsonb,
      spatial_snapshot JSONB,
      evidence_ref TEXT,
      verification_status VARCHAR(40) NOT NULL DEFAULT 'PENDING_VERIFICATION',
      verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      verified_at TIMESTAMP NULL,
      verification_note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(project_id)
    );
  `);
}

async function getProjectSensitiveVerification(projectId, { db = defaultDb } = {}) {
  const numericId = Number(projectId);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;
  try {
    const res = await db.query(
      `SELECT id, project_id, declared_flags, declared_details, spatial_snapshot,
              evidence_ref, verification_status, verified_by, verified_at, verification_note,
              created_at, updated_at
       FROM project_sensitive_verifications
       WHERE project_id = $1`,
      [numericId]
    );
    if (!res || !Array.isArray(res.rows) || res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      ...row,
      declared_flags: parseJsonSafe(row.declared_flags, {}),
      declared_details: parseJsonSafe(row.declared_details, {}),
      spatial_snapshot: parseJsonSafe(row.spatial_snapshot, null),
    };
  } catch (err) {
    // Fallback an toàn cho mock DB hoặc môi trường chưa chạy migration bảng mới
    if (err && /does not exist|relation/i.test(String(err.message || ''))) {
      return null;
    }
    return null;
  }
}

async function upsertProjectSensitiveDeclaration(
  client,
  { projectId, declaredFlags = {}, declaredDetails = {}, spatialSnapshot = null, evidenceRef = null } = {}
) {
  const numericId = Number(projectId);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;

  const flags = normalizeSensitiveFlags(declaredFlags);
  const details = normalizeSensitiveDetails(declaredDetails);
  const resolvedEvidenceRef = evidenceRef ? String(evidenceRef).trim() : details.evidenceRef;

  const hasSpatialWarning = Boolean(spatialSnapshot && Array.isArray(spatialSnapshot.warnings) && spatialSnapshot.warnings.length > 0);
  const hasTrigger = Object.values(flags).some(Boolean)
    || details.insideCoreProtectedZone
    || details.paddyConversionAreaHa > 0
    || details.forestConversionAreaHa > 0
    || details.hasSensitiveResettlement
    || hasSpatialWarning;

  try {
    const existingRes = await client.query(
      `SELECT id, declared_flags, declared_details, spatial_snapshot, verification_status, verified_by, verified_at, verification_note
       FROM project_sensitive_verifications
       WHERE project_id = $1`,
      [numericId]
    );
    const existing = existingRes?.rows?.[0] || null;

    if (!hasTrigger && !existing) {
      return null;
    }

    if (existing) {
      const prevFlags = normalizeSensitiveFlags(parseJsonSafe(existing.declared_flags, {}));
      const prevDetails = normalizeSensitiveDetails(parseJsonSafe(existing.declared_details, {}));
      const declarationChanged = JSON.stringify(prevFlags) !== JSON.stringify(flags)
        || JSON.stringify(prevDetails) !== JSON.stringify(details);

      let nextStatus = hasTrigger ? (existing.verification_status || 'PENDING_VERIFICATION') : 'NOT_REQUIRED';
      let nextVerifiedBy = existing.verified_by || null;
      let nextVerifiedAt = existing.verified_at || null;
      let nextNote = existing.verification_note || null;

      if (!hasTrigger) {
        nextVerifiedBy = null;
        nextVerifiedAt = null;
      } else if (existing.verification_status === 'VERIFIED' && declarationChanged) {
        nextStatus = 'PENDING_VERIFICATION';
        nextVerifiedBy = null;
        nextVerifiedAt = null;
        nextNote = 'Tự động đưa về PENDING_VERIFICATION do hồ sơ thay đổi khai báo vùng nhạy cảm.';
      } else if (existing.verification_status === 'NOT_REQUIRED' || existing.verification_status === 'REJECTED') {
        if (declarationChanged) {
          nextStatus = 'PENDING_VERIFICATION';
          nextVerifiedBy = null;
          nextVerifiedAt = null;
        }
      }

      const updRes = await client.query(
        `UPDATE project_sensitive_verifications
         SET declared_flags = $1::jsonb,
             declared_details = $2::jsonb,
             spatial_snapshot = $3::jsonb,
             evidence_ref = COALESCE($4, evidence_ref),
             verification_status = $5,
             verified_by = $6,
             verified_at = $7,
             verification_note = $8,
             updated_at = CURRENT_TIMESTAMP
         WHERE project_id = $9
         RETURNING *`,
        [
          JSON.stringify(flags),
          JSON.stringify(details),
          spatialSnapshot ? JSON.stringify(spatialSnapshot) : null,
          resolvedEvidenceRef || null,
          nextStatus,
          nextVerifiedBy,
          nextVerifiedAt,
          nextNote,
          numericId,
        ]
      );
      return updRes?.rows?.[0] || null;
    }

    const insRes = await client.query(
      `INSERT INTO project_sensitive_verifications (
         project_id, declared_flags, declared_details, spatial_snapshot, evidence_ref, verification_status
       ) VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, 'PENDING_VERIFICATION')
       ON CONFLICT (project_id) DO UPDATE SET
         declared_flags = EXCLUDED.declared_flags,
         declared_details = EXCLUDED.declared_details,
         spatial_snapshot = EXCLUDED.spatial_snapshot,
         evidence_ref = COALESCE(EXCLUDED.evidence_ref, project_sensitive_verifications.evidence_ref),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        numericId,
        JSON.stringify(flags),
        JSON.stringify(details),
        spatialSnapshot ? JSON.stringify(spatialSnapshot) : null,
        resolvedEvidenceRef || null,
      ]
    );
    return insRes?.rows?.[0] || null;
  } catch (err) {
    if (err && /does not exist|relation/i.test(String(err.message || ''))) {
      return null;
    }
    throw err;
  }
}

async function reviewProjectSensitiveVerification(
  client,
  { projectId, verificationStatus, verifiedBy, evidenceRef = null, verificationNote = null } = {}
) {
  const numericId = Number(projectId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error('INVALID_PROJECT_ID');
  }
  const normalizedStatus = String(verificationStatus || '').trim().toUpperCase();
  if (!['VERIFIED', 'REJECTED', 'PENDING_VERIFICATION'].includes(normalizedStatus)) {
    throw new Error('INVALID_VERIFICATION_STATUS');
  }
  if (normalizedStatus === 'VERIFIED' && !verifiedBy) {
    throw new Error('VERIFIED_BY_REQUIRED');
  }

  const projRes = await client.query('SELECT id, form_data FROM projects WHERE id = $1', [numericId]);
  if (!projRes || projRes.rowCount === 0) {
    throw new Error('PROJECT_NOT_FOUND');
  }

  const fd = parseJsonSafe(projRes.rows[0].form_data, {});
  const flags = normalizeSensitiveFlags(fd);
  const details = normalizeSensitiveDetails(fd.sensitiveDetails || {});

  const existingRes = await client.query(
    'SELECT id FROM project_sensitive_verifications WHERE project_id = $1',
    [numericId]
  );

  if (existingRes.rowCount === 0) {
    const ins = await client.query(
      `INSERT INTO project_sensitive_verifications (
         project_id, declared_flags, declared_details, evidence_ref,
         verification_status, verified_by, verified_at, verification_note
       ) VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, CURRENT_TIMESTAMP, $7)
       RETURNING *`,
      [
        numericId,
        JSON.stringify(flags),
        JSON.stringify(details),
        evidenceRef || details.evidenceRef || null,
        normalizedStatus,
        normalizedStatus === 'PENDING_VERIFICATION' ? null : verifiedBy,
        verificationNote || null,
      ]
    );
    return ins.rows[0];
  }

  const upd = await client.query(
    `UPDATE project_sensitive_verifications
     SET verification_status = $1::varchar,
         verified_by = $2,
         verified_at = CASE WHEN $1::text = 'PENDING_VERIFICATION' THEN NULL ELSE CURRENT_TIMESTAMP END,
         evidence_ref = COALESCE(NULLIF($3::text, ''), evidence_ref),
         verification_note = COALESCE($4, verification_note),
         updated_at = CURRENT_TIMESTAMP
     WHERE project_id = $5
     RETURNING *`,
    [
      normalizedStatus,
      normalizedStatus === 'PENDING_VERIFICATION' ? null : verifiedBy,
      evidenceRef || '',
      verificationNote || null,
      numericId,
    ]
  );
  return upd.rows[0];
}

/**
 * Schema & Repository GIS Layers từ PostgreSQL (Item 10)
 */
async function ensureGisSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS gis_layers (
      id VARCHAR(120) PRIMARY KEY,
      layer_type VARCHAR(40) NOT NULL,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      flag_key VARCHAR(40),
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      radius_km DOUBLE PRECISION NOT NULL DEFAULT 1,
      geometry_json JSONB,
      province VARCHAR(150),
      legal_ref TEXT,
      verification_status VARCHAR(50) NOT NULL DEFAULT 'NEEDS_LEGAL_VERIFICATION',
      publication_status VARCHAR(30) NOT NULL DEFAULT 'PUBLISHED',
      source_document TEXT,
      verified_by VARCHAR(100),
      verified_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function seedGisLayers(client, { sensitiveZones = [], industrialParks = [], force = false } = {}) {
  const existingRes = await client.query(
    'SELECT id, verification_status, publication_status, verified_by FROM gis_layers'
  );
  const existingMap = new Map((existingRes?.rows || []).map(r => [r.id, r]));

  let inserted = 0;
  let updated = 0;
  let skippedVerified = 0;

  const entries = [
    ...sensitiveZones.map((z, idx) => ({
      id: z.id || `sz_${slugifyId(z.name || idx)}`,
      layer_type: 'SENSITIVE_ZONE',
      name: z.name,
      category: z.category || null,
      flag_key: z.flagKey || z.flag_key || null,
      latitude: Number(z.lat ?? z.latitude),
      longitude: Number(z.lng ?? z.longitude),
      radius_km: Number(z.radiusKm ?? z.radius_km ?? 5),
      geometry_json: z.geometry || null,
      province: z.province || null,
      legal_ref: z.legalRef || z.legal_ref || null,
      verification_status: z.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION',
      source_document: z.sourceDocument || null,
    })),
    ...industrialParks.map((p, idx) => ({
      id: p.id || `ip_${slugifyId(p.name || idx)}`,
      layer_type: 'INDUSTRIAL_PARK',
      name: p.name,
      category: p.category || 'Khu công nghiệp',
      flag_key: 'kcn',
      latitude: Number(p.lat ?? p.latitude),
      longitude: Number(p.lng ?? p.longitude),
      radius_km: Number(p.radiusKm ?? p.radius_km ?? 2),
      geometry_json: p.geometry || null,
      province: p.province || null,
      legal_ref: p.legalRef || p.legal_ref || null,
      verification_status: p.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION',
      source_document: p.sourceDocument || null,
    })),
  ];

  for (const item of entries) {
    if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude) || !item.name) continue;
    const prev = existingMap.get(item.id);
    if (!prev) {
      await client.query(
        `INSERT INTO gis_layers (
           id, layer_type, name, category, flag_key, latitude, longitude, radius_km,
           geometry_json, province, legal_ref, verification_status, publication_status, source_document
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, 'PUBLISHED', $13)`,
        [
          item.id,
          item.layer_type,
          item.name,
          item.category,
          item.flag_key,
          item.latitude,
          item.longitude,
          item.radius_km,
          item.geometry_json ? JSON.stringify(item.geometry_json) : null,
          item.province,
          item.legal_ref,
          item.verification_status,
          item.source_document,
        ]
      );
      inserted++;
      continue;
    }

    const isLocked = prev.verification_status === 'VERIFIED'
      || Boolean(prev.verified_by)
      || EXCLUDED_PUBLICATION_STATUSES.has(String(prev.publication_status || '').toUpperCase());

    if (isLocked) {
      skippedVerified++;
      continue;
    }

    if (force) {
      await client.query(
        `UPDATE gis_layers
         SET layer_type = $1, name = $2, category = $3, flag_key = $4,
             latitude = $5, longitude = $6, radius_km = $7,
             geometry_json = $8::jsonb, province = $9, legal_ref = $10,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $11`,
        [
          item.layer_type,
          item.name,
          item.category,
          item.flag_key,
          item.latitude,
          item.longitude,
          item.radius_km,
          item.geometry_json ? JSON.stringify(item.geometry_json) : null,
          item.province,
          item.legal_ref,
          item.id,
        ]
      );
      updated++;
    }
  }

  return { inserted, updated, skippedVerified };
}

async function loadGisLayers({ db = defaultDb } = {}) {
  try {
    const res = await db.query(
      `SELECT id, layer_type, name, category, flag_key, latitude, longitude, radius_km,
              geometry_json, province, legal_ref, verification_status, publication_status,
              source_document, verified_by, verified_at
       FROM gis_layers
       ORDER BY layer_type, name`
    );

    if (!res || !Array.isArray(res.rows) || res.rows.length === 0) {
      return { ok: false, gisSource: 'FALLBACK_UNVERIFIED', sensitiveZones: [], industrialParks: [], error: 'EMPTY_GIS_LAYERS' };
    }

    const sensitiveZones = [];
    const industrialParks = [];

    for (const row of res.rows) {
      if (!isActivePublicationStatus(row.publication_status)) continue;
      const item = {
        id: row.id,
        layerType: row.layer_type,
        name: row.name,
        category: row.category || '',
        flagKey: row.flag_key || null,
        lat: Number(row.latitude),
        lng: Number(row.longitude),
        radiusKm: Number(row.radius_km || 1),
        geometry: parseJsonSafe(row.geometry_json, null),
        province: row.province || '',
        legalRef: row.legal_ref || '',
        verificationStatus: row.verification_status === 'VERIFIED' ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION',
        sourceDocument: row.source_document || null,
      };
      if (row.layer_type === 'INDUSTRIAL_PARK') industrialParks.push(item);
      else sensitiveZones.push(item);
    }

    if (sensitiveZones.length === 0 && industrialParks.length === 0) {
      return { ok: false, gisSource: 'FALLBACK_UNVERIFIED', sensitiveZones: [], industrialParks: [], error: 'NO_PUBLISHED_GIS_LAYERS' };
    }

    return { ok: true, gisSource: 'DATABASE', sensitiveZones, industrialParks };
  } catch (error) {
    return {
      ok: false,
      gisSource: 'FALLBACK_UNVERIFIED',
      sensitiveZones: [],
      industrialParks: [],
      error: error.message || 'GIS_DB_LOAD_FAILED',
    };
  }
}

/**
 * Schema & Repository Đồng bộ Crawler -> Rule Engine & Admin Review Center (Items 8, 9)
 */
async function ensureCrawlerSyncSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS law_rule_impacts (
      id SERIAL PRIMARY KEY,
      law_id VARCHAR(100) NOT NULL,
      law_title TEXT,
      event_action VARCHAR(50) NOT NULL,
      target_type VARCHAR(40) NOT NULL,
      target_id VARCHAR(150) NOT NULL,
      target_label TEXT,
      severity VARCHAR(20) NOT NULL DEFAULT 'HIGH',
      impact_reason TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
      resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      resolved_at TIMESTAMP,
      resolution_note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS rule_candidates (
      id SERIAL PRIMARY KEY,
      law_id VARCHAR(100) NOT NULL,
      law_title TEXT,
      target_type VARCHAR(40) NOT NULL,
      target_code VARCHAR(150) NOT NULL,
      title TEXT,
      proposed_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      diff_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      extraction_confidence VARCHAR(30) DEFAULT 'LOW',
      source_excerpt TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMP,
      review_note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function listLawRuleImpacts({ status = null, limit = 100, db = defaultDb } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  if (status) {
    const res = await db.query(
      `SELECT * FROM law_rule_impacts WHERE status = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
      [String(status).toUpperCase(), safeLimit]
    );
    return res.rows;
  }
  const res = await db.query(
    `SELECT * FROM law_rule_impacts ORDER BY CASE WHEN status = 'OPEN' THEN 0 ELSE 1 END, created_at DESC, id DESC LIMIT $1`,
    [safeLimit]
  );
  return res.rows;
}

async function resolveLawRuleImpact(client, { impactId, resolvedBy, resolutionNote = null, status = 'RESOLVED' } = {}) {
  const numericId = Number(impactId);
  if (!Number.isInteger(numericId) || numericId <= 0) throw new Error('INVALID_IMPACT_ID');
  const nextStatus = ['RESOLVED', 'IGNORED', 'OPEN'].includes(String(status).toUpperCase())
    ? String(status).toUpperCase()
    : 'RESOLVED';

  const res = await client.query(
    `UPDATE law_rule_impacts
     SET status = $1::varchar,
         resolved_by = $2,
         resolved_at = CASE WHEN $1::text = 'OPEN' THEN NULL ELSE CURRENT_TIMESTAMP END,
         resolution_note = COALESCE($3, resolution_note),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING *`,
    [nextStatus, resolvedBy || null, resolutionNote, numericId]
  );
  if (res.rowCount === 0) throw new Error('IMPACT_NOT_FOUND');
  return res.rows[0];
}

async function listRuleCandidates({ status = null, limit = 100, db = defaultDb } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const res = status
    ? await db.query(
        `SELECT * FROM rule_candidates WHERE status = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
        [String(status).toUpperCase(), safeLimit]
      )
    : await db.query(
        `SELECT * FROM rule_candidates ORDER BY CASE WHEN status IN ('PENDING_REVIEW','EXTRACTED') THEN 0 ELSE 1 END, created_at DESC, id DESC LIMIT $1`,
        [safeLimit]
      );
  return res.rows.map(row => ({
    ...row,
    proposed_data: parseJsonSafe(row.proposed_data, {}),
    diff_summary: parseJsonSafe(row.diff_summary, {}),
  }));
}

function validateQcvnParameters(thamSo) {
  if (!Array.isArray(thamSo) || thamSo.length === 0) {
    throw new Error('QCVN_PARAMETERS_REQUIRED');
  }
  const normalized = [];
  let paramCount = 0;

  for (const p of thamSo) {
    if (!p || typeof p !== 'object') throw new Error('QCVN_PARAMETER_INVALID');
    if (p.nhom && !p.ten && !p.chi_tieu && !p.key && p.gioi_han === undefined && p.max === undefined && p.min === undefined) {
      normalized.push({ nhom: String(p.nhom).trim() });
      continue;
    }

    const name = String(p.ten || p.chi_tieu || p.key || '').trim();
    if (!name) throw new Error('QCVN_PARAMETER_NAME_REQUIRED');

    const item = { ...p };
    const hasMin = item.min !== undefined && item.min !== null && item.min !== '';
    const hasMax = item.max !== undefined && item.max !== null && item.max !== '';
    const hasGioiHan = item.gioi_han !== undefined && item.gioi_han !== null && item.gioi_han !== '';

    const numMin = hasMin ? Number(item.min) : undefined;
    const numMax = hasMax ? Number(item.max) : undefined;
    const numGioiHan = hasGioiHan ? Number(item.gioi_han) : undefined;

    if (numMin !== undefined && Number.isNaN(numMin)) throw new Error(`INVALID_PARAM_MIN:${name}`);
    if (numMax !== undefined && Number.isNaN(numMax)) throw new Error(`INVALID_PARAM_MAX:${name}`);
    if (numGioiHan !== undefined && Number.isNaN(numGioiHan)) throw new Error(`INVALID_PARAM_LIMIT:${name}`);

    const isRange = item.loai === 'range' || (numMin !== undefined && numMax !== undefined && numGioiHan === undefined);
    if (isRange) {
      if (numMin === undefined || numMax === undefined) {
        throw new Error(`QCVN_PARAMETER_LIMIT_REQUIRED:${name}`);
      }
      if (numMin > numMax) {
        throw new Error(`QCVN_PARAMETER_RANGE_INVALID:${name}`);
      }
    } else if (numGioiHan === undefined && numMax === undefined && numMin === undefined) {
      throw new Error(`QCVN_PARAMETER_LIMIT_REQUIRED:${name}`);
    }

    const resolvedLoai = item.loai || (isRange ? 'range' : (numMin !== undefined && numMax === undefined && numGioiHan === undefined ? 'min' : 'max'));
    const resolvedGioiHan = !isRange
      ? (numGioiHan !== undefined ? numGioiHan : (numMax !== undefined ? numMax : numMin))
      : undefined;

    paramCount++;
    normalized.push({
      ...(item.key ? { key: String(item.key).trim() } : { key: slugifyId(name) }),
      ten: name,
      don_vi: String(item.don_vi || item.unit || '').trim(),
      loai: resolvedLoai,
      ...(isRange ? { min: numMin, max: numMax } : { gioi_han: resolvedGioiHan }),
      ...(item.required !== undefined ? { required: Boolean(item.required) } : {}),
      ...(item.averagingPeriod || item.chu_ky ? { averagingPeriod: item.averagingPeriod || item.chu_ky } : {}),
      ...(item.note || item.ghi_chu ? { note: item.note || item.ghi_chu } : {}),
      ...(item.verificationStatus ? { verificationStatus: item.verificationStatus } : {}),
    });
  }

  if (paramCount === 0) {
    throw new Error('QCVN_PARAMETERS_REQUIRED');
  }
  return normalized;
}

async function verifyAndPublishQcvn(client, payload = {}) {
  const {
    id,
    ten,
    apDung,
    thamSo,
    sourceType,
    columnCode,
    flowRange,
    effectiveFrom,
    effectiveTo,
    mandatoryForAllFrom,
    replaces,
    transitionRules,
    status,
    sourceDocument,
    verifiedBy,
    publicationStatus = 'PUBLISHED',
    ruleVersion = '2026.2-verified',
    standardCode,
    standardVersion,
  } = payload;

  const cleanId = String(id || '').trim();
  if (!cleanId) throw new Error('QCVN_ID_REQUIRED');
  const cleanSourceDoc = String(sourceDocument || '').trim();
  if (!cleanSourceDoc) throw new Error('SOURCE_DOCUMENT_REQUIRED');
  if (!verifiedBy) throw new Error('VERIFIED_BY_REQUIRED');

  const existingRes = await client.query('SELECT * FROM qcvns WHERE id = $1', [cleanId]);
  const existing = existingRes.rows[0] || null;
  const resolvedThamSo = validateQcvnParameters(
    thamSo !== undefined ? thamSo : parseJsonSafe(existing?.tham_so, [])
  );

  const resolvedTen = String(ten || existing?.ten || '').trim();
  if (!resolvedTen) throw new Error('QCVN_NAME_REQUIRED');

  const inferred = inferQcvnMetadata(cleanId, {
    ten: resolvedTen,
    sourceType: sourceType || existing?.source_type,
    columnCode: columnCode || existing?.column_code,
    flowRange: flowRange || existing?.flow_range,
    standardCode: standardCode || existing?.standard_code,
    standardVersion: standardVersion || existing?.standard_version,
  });

  const params = [
    cleanId,
    resolvedTen,
    apDung !== undefined ? apDung : (existing?.ap_dung || null),
    JSON.stringify(resolvedThamSo),
    standardCode || existing?.standard_code || inferred.standardCode,
    standardVersion || existing?.standard_version || inferred.standardVersion,
    status || existing?.status || inferred.status,
    sourceType || existing?.source_type || inferred.sourceType,
    columnCode !== undefined ? columnCode : (existing?.column_code || inferred.columnCode),
    flowRange !== undefined ? flowRange : (existing?.flow_range || inferred.flowRange),
    formatDateOnly(effectiveFrom) || formatDateOnly(existing?.effective_from) || inferred.effectiveFrom,
    formatDateOnly(effectiveTo) || formatDateOnly(existing?.effective_to) || inferred.effectiveTo,
    formatDateOnly(mandatoryForAllFrom) || formatDateOnly(existing?.mandatory_for_all_from) || inferred.mandatoryForAllFrom,
    replaces ? JSON.stringify(replaces) : (existing?.replaces ? JSON.stringify(parseJsonSafe(existing.replaces, null)) : null),
    transitionRules ? JSON.stringify(transitionRules) : (existing?.transition_rules ? JSON.stringify(parseJsonSafe(existing.transition_rules, null)) : null),
    cleanSourceDoc,
    ruleVersion,
    String(verifiedBy),
    String(publicationStatus || 'PUBLISHED').toUpperCase(),
  ];

  if (!existing) {
    const ins = await client.query(
      `INSERT INTO qcvns (
         id, ten, ap_dung, tham_so, standard_code, standard_version, status, source_type,
         column_code, flow_range, effective_from, effective_to, mandatory_for_all_from,
         replaces, transition_rules, verification_status, publication_status, source_document,
         rule_version, verified_by, verified_at, published_at, updated_at
       ) VALUES (
         $1, $2, $3, $4::jsonb, $5, $6, $7, $8,
         $9, $10, $11, $12, $13,
         $14::jsonb, $15::jsonb, 'VERIFIED', $19, $16,
         $17, $18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       )
       RETURNING *`,
      params
    );
    return ins.rows[0];
  }

  const upd = await client.query(
    `UPDATE qcvns
     SET ten = $2,
         ap_dung = $3,
         tham_so = $4::jsonb,
         standard_code = $5,
         standard_version = $6,
         status = $7,
         source_type = $8,
         column_code = $9,
         flow_range = $10,
         effective_from = $11,
         effective_to = $12,
         mandatory_for_all_from = $13,
         replaces = $14::jsonb,
         transition_rules = $15::jsonb,
         verification_status = 'VERIFIED',
         publication_status = $19,
         source_document = $16,
         rule_version = $17,
         verified_by = $18,
         verified_at = CURRENT_TIMESTAMP,
         published_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    params
  );
  return upd.rows[0];
}

async function upsertTransitionalQcvn(client, payload = {}) {
  const cleanId = String(payload.id || '').trim();
  if (!/^qcvn(40_2011|14_2008)_[a-z0-9_]+$/i.test(cleanId)) {
    throw new Error('INVALID_TRANSITIONAL_QCVN_ID');
  }
  const sourceType = payload.sourceType || (cleanId.startsWith('qcvn40_2011') ? 'nuoc_thai_cn' : 'nuoc_thai_sh');
  const standardCode = payload.standardCode || (cleanId.startsWith('qcvn40_2011') ? 'QCVN 40:2011/BTNMT' : 'QCVN 14:2008/BTNMT');
  const standardVersion = payload.standardVersion || (cleanId.startsWith('qcvn40_2011') ? '2011' : '2008');

  return verifyAndPublishQcvn(client, {
    ...payload,
    id: cleanId,
    sourceType,
    standardCode,
    standardVersion,
    status: payload.status || 'TRANSITIONAL',
  });
}

async function verifyAndPublishIndustryRules(
  client,
  { code, sourceDocument, verifiedBy, legalRef = null, note = null, thresholds = null, ruleVersion = '2026.2-verified' } = {}
) {
  const cleanCode = String(code || '').trim();
  if (!cleanCode) throw new Error('INDUSTRY_CODE_REQUIRED');
  const cleanSourceDoc = String(sourceDocument || '').trim();
  if (!cleanSourceDoc) throw new Error('SOURCE_DOCUMENT_REQUIRED');
  if (!verifiedBy) throw new Error('VERIFIED_BY_REQUIRED');

  const indRes = await client.query('SELECT code FROM industries WHERE code = $1', [cleanCode]);
  if (indRes.rowCount === 0) throw new Error('INDUSTRY_NOT_FOUND');

  if (Array.isArray(thresholds) && thresholds.length > 0) {
    for (const item of thresholds) {
      if (item.id) {
        await client.query(
          `UPDATE classification_thresholds
           SET project_group = COALESCE($1, project_group),
               legal_doc_required = COALESCE($2, legal_doc_required),
               tq = COALESCE($3, tq),
               historical_tq = COALESCE($4, historical_tq),
               effective_from = COALESCE($5, effective_from),
               effective_to = COALESCE($6, effective_to),
               legal_ref = COALESCE($7, legal_ref),
               source_ref = $8,
               verification_status = 'VERIFIED',
               publication_status = 'PUBLISHED',
               approved_by = $9,
               approved_at = CURRENT_TIMESTAMP,
               rule_version = $10,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $11 AND industry_code = $12`,
          [
            item.projectGroup || null,
            item.hs || null,
            item.tq || null,
            item.historicalTq || null,
            formatDateOnly(item.effectiveFrom),
            formatDateOnly(item.effectiveTo),
            item.ref || legalRef || null,
            cleanSourceDoc,
            String(verifiedBy),
            ruleVersion,
            Number(item.id),
            cleanCode,
          ]
        );
      }
    }
  }

  await client.query(
    `UPDATE classification_thresholds
     SET verification_status = 'VERIFIED',
         publication_status = 'PUBLISHED',
         legal_ref = COALESCE($1, legal_ref),
         source_ref = $2,
         approved_by = $3,
         approved_at = CURRENT_TIMESTAMP,
         rule_version = $4,
         updated_at = CURRENT_TIMESTAMP
     WHERE industry_code = $5
       AND COALESCE(publication_status, 'PUBLISHED') <> 'ARCHIVED'`,
    [legalRef, cleanSourceDoc, String(verifiedBy), ruleVersion, cleanCode]
  );

  const updInd = await client.query(
    `UPDATE industries
     SET verification_status = 'VERIFIED',
         publication_status = 'PUBLISHED',
         note = COALESCE($1, note),
         source_document = $2,
         verified_by = $3,
         verified_at = CURRENT_TIMESTAMP,
         rule_version = $4,
         updated_at = CURRENT_TIMESTAMP
     WHERE code = $5
     RETURNING *`,
    [note, cleanSourceDoc, String(verifiedBy), ruleVersion, cleanCode]
  );

  return updInd.rows[0];
}

async function approveRuleCandidate(
  client,
  { candidateId, reviewedBy, reviewedByName = 'admin', reviewNote = null, sourceDocument = null, overrideProposedData = null } = {}
) {
  const numericId = Number(candidateId);
  if (!Number.isInteger(numericId) || numericId <= 0) throw new Error('INVALID_CANDIDATE_ID');

  const candRes = await client.query('SELECT * FROM rule_candidates WHERE id = $1', [numericId]);
  if (candRes.rowCount === 0) throw new Error('CANDIDATE_NOT_FOUND');

  const cand = candRes.rows[0];
  if (!['PENDING_REVIEW', 'EXTRACTED'].includes(String(cand.status || '').toUpperCase())) {
    throw new Error(`CANDIDATE_ALREADY_PROCESSED:${cand.status}`);
  }

  const proposed = {
    ...parseJsonSafe(cand.proposed_data, {}),
    ...(overrideProposedData && typeof overrideProposedData === 'object' ? overrideProposedData : {}),
  };

  const resolvedSourceDoc = String(sourceDocument || proposed.sourceDocument || '').trim();
  if (!resolvedSourceDoc) throw new Error('SOURCE_DOCUMENT_REQUIRED');

  const targetType = String(cand.target_type || '').toUpperCase();
  let appliedRecord = null;

  if (targetType === 'QCVN') {
    appliedRecord = await verifyAndPublishQcvn(client, {
      id: proposed.id || cand.target_code,
      ten: proposed.ten || cand.title,
      apDung: proposed.ap_dung || proposed.apDung,
      thamSo: proposed.tham_so || proposed.thamSo,
      sourceType: proposed.sourceType || proposed.source_type,
      columnCode: proposed.columnCode || proposed.column_code,
      flowRange: proposed.flowRange || proposed.flow_range,
      effectiveFrom: proposed.effectiveFrom || proposed.effective_from,
      effectiveTo: proposed.effectiveTo || proposed.effective_to,
      mandatoryForAllFrom: proposed.mandatoryForAllFrom || proposed.mandatory_for_all_from,
      replaces: proposed.replaces,
      transitionRules: proposed.transitionRules,
      status: proposed.status,
      sourceDocument: resolvedSourceDoc,
      verifiedBy: reviewedByName,
      ruleVersion: proposed.ruleVersion || `2026.2-cand-${numericId}`,
    });
  } else if (targetType === 'CLASSIFICATION_THRESHOLD' || targetType === 'INDUSTRY_TIER') {
    const industryCode = String(proposed.industryCode || proposed.industry_code || cand.target_code || '').trim();
    if (!industryCode) throw new Error('INDUSTRY_CODE_REQUIRED');
    const minVal = Number(proposed.min ?? proposed.min_value);
    if (Number.isNaN(minVal)) throw new Error('INVALID_THRESHOLD_MIN_VALUE');
    const maxVal = proposed.max !== undefined && proposed.max !== null ? Number(proposed.max) : null;
    const effFrom = formatDateOnly(proposed.effectiveFrom || proposed.effective_from);
    const effTo = formatDateOnly(proposed.effectiveTo || proposed.effective_to);

    if (proposed.supersedeThresholdId) {
      await client.query(
        `UPDATE classification_thresholds
         SET effective_to = COALESCE($1, effective_to),
             is_active_version = CASE WHEN $2::boolean THEN FALSE ELSE is_active_version END,
             superseded_at = CURRENT_DATE,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [effFrom || null, Boolean(proposed.deactivateSuperseded), Number(proposed.supersedeThresholdId)]
      );
    }

    const insThr = await client.query(
      `INSERT INTO classification_thresholds (
         industry_code, process_stage, min_value, max_value, operator, unit,
         capacity_scale, project_group, legal_doc_required, tq, historical_tq,
         phu_luc, legal_ref, law_id, effective_from, effective_to,
         verification_status, publication_status, tier_order, rule_version, source_ref, approved_by, approved_at, is_active_version
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13, $14, $15, $16,
         'VERIFIED', 'PUBLISHED', $17, $18, $19, $20, CURRENT_TIMESTAMP, TRUE
       )
       RETURNING *`,
      [
        industryCode,
        String(proposed.processStage || proposed.process_stage || ''),
        minVal,
        maxVal,
        proposed.operator || '>=',
        proposed.unit || null,
        proposed.capacityScale || proposed.capacity_scale || null,
        proposed.projectGroup || proposed.project_group || 'Nhóm III',
        proposed.hs || proposed.legal_doc_required || 'GPMT',
        proposed.tq || 'cap_so',
        proposed.historicalTq || proposed.historical_tq || null,
        proposed.phu_luc || null,
        proposed.legalRef || proposed.ref || resolvedSourceDoc,
        cand.law_id || null,
        effFrom,
        effTo,
        Number.isFinite(Number(proposed.tierOrder)) ? Number(proposed.tierOrder) : 0,
        proposed.ruleVersion || `2026.2-cand-${numericId}`,
        resolvedSourceDoc,
        String(reviewedByName),
      ]
    );
    appliedRecord = insThr.rows[0];
  } else {
    throw new Error(`UNSUPPORTED_CANDIDATE_TARGET:${targetType}`);
  }

  const updCand = await client.query(
    `UPDATE rule_candidates
     SET status = 'APPROVED',
         reviewed_by = $1,
         reviewed_at = CURRENT_TIMESTAMP,
         review_note = COALESCE($2, review_note),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING *`,
    [reviewedBy || null, reviewNote, numericId]
  );

  return { candidate: updCand.rows[0], appliedRecord };
}

async function rejectRuleCandidate(client, { candidateId, reviewedBy, reviewNote = null } = {}) {
  const numericId = Number(candidateId);
  if (!Number.isInteger(numericId) || numericId <= 0) throw new Error('INVALID_CANDIDATE_ID');
  const res = await client.query(
    `UPDATE rule_candidates
     SET status = 'REJECTED',
         reviewed_by = $1,
         reviewed_at = CURRENT_TIMESTAMP,
         review_note = COALESCE($2, review_note),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING *`,
    [reviewedBy || null, reviewNote, numericId]
  );
  if (res.rowCount === 0) throw new Error('CANDIDATE_NOT_FOUND');
  return res.rows[0];
}

async function getRuleManagementCatalog({ db = defaultDb } = {}) {
  const [indRes, thrRes, qcvnRes] = await Promise.all([
    db.query(
      `SELECT code, name, display_name, unit, verification_status, publication_status,
              rule_version, source_document, verified_by, verified_at, updated_at
       FROM industries
       ORDER BY code`
    ),
    db.query(
      `SELECT id, industry_code, process_stage, min_value, max_value, operator,
              project_group, legal_doc_required, tq, historical_tq,
              effective_from, effective_to, verification_status, publication_status,
              rule_version, legal_ref, source_ref, approved_by, approved_at, is_active_version
       FROM classification_thresholds
       ORDER BY industry_code, COALESCE(process_stage, ''), tier_order ASC, min_value DESC`
    ),
    db.query(
      `SELECT id, ten, ap_dung, tham_so, standard_code, standard_version, status, source_type,
              column_code, flow_range, effective_from, effective_to, mandatory_for_all_from,
              verification_status, publication_status, source_document, rule_version,
              verified_by, verified_at, updated_at
       FROM qcvns
       ORDER BY id`
    ),
  ]);

  const industries = (indRes.rows || []).map(r => ({
    ...r,
    thresholds: (thrRes.rows || []).filter(t => t.industry_code === r.code).map(t => ({
      ...t,
      effective_from: formatDateOnly(t.effective_from),
      effective_to: formatDateOnly(t.effective_to),
    })),
  }));

  const qcvns = (qcvnRes.rows || []).map(q => ({
    ...q,
    tham_so: parseJsonSafe(q.tham_so, []),
    effective_from: formatDateOnly(q.effective_from),
    effective_to: formatDateOnly(q.effective_to),
    mandatory_for_all_from: formatDateOnly(q.mandatory_for_all_from),
  }));

  return {
    industries,
    qcvns,
    summary: {
      industriesTotal: industries.length,
      industriesVerified: industries.filter(i => i.verification_status === 'VERIFIED').length,
      qcvnsTotal: qcvns.length,
      qcvnsVerified: qcvns.filter(q => q.verification_status === 'VERIFIED').length,
    },
  };
}

module.exports = {
  EXCLUDED_PUBLICATION_STATUSES,
  isActivePublicationStatus,
  formatDateOnly,
  ensureClassificationSchema,
  ensureQcvnSchema,
  ensureSensitiveVerificationSchema,
  ensureGisSchema,
  ensureCrawlerSyncSchema,
  seedClassificationCatalog,
  seedQcvnCatalog,
  seedGisLayers,
  loadClassificationCatalog,
  loadQcvnCatalog,
  loadGisLayers,
  getProjectSensitiveVerification,
  upsertProjectSensitiveDeclaration,
  reviewProjectSensitiveVerification,
  listLawRuleImpacts,
  resolveLawRuleImpact,
  listRuleCandidates,
  approveRuleCandidate,
  rejectRuleCandidate,
  getRuleManagementCatalog,
  verifyAndPublishQcvn,
  upsertTransitionalQcvn,
  verifyAndPublishIndustryRules,
};
