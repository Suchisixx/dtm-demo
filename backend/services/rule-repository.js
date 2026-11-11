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

/**
 * Migration cộng thêm cho hệ thống phân loại (không chạy TRUNCATE, không làm mất dữ liệu cũ)
 */
async function ensureClassificationSchema(client) {
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
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);
}

/**
 * Migration cộng thêm cho bảng qcvns & qcvn_samples
 */
async function ensureQcvnSchema(client) {
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
              verification_status, publication_status, tier_order, rule_version, source_ref, approved_by, approved_at
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
          effectiveFrom: r.effective_from || null,
          effectiveTo: r.effective_to || null,
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
        effectiveFrom: row.effective_from || null,
        effectiveTo: row.effective_to || null,
        mandatoryForAllFrom: row.mandatory_for_all_from || null,
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

module.exports = {
  EXCLUDED_PUBLICATION_STATUSES,
  isActivePublicationStatus,
  ensureClassificationSchema,
  ensureQcvnSchema,
  seedClassificationCatalog,
  seedQcvnCatalog,
  loadClassificationCatalog,
  loadQcvnCatalog,
};
