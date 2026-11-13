// Kho dữ liệu xác minh dự án và lớp bản đồ GIS.
const logger = require('../utils/logger');
const {
  defaultDb,
  EXCLUDED_PUBLICATION_STATUSES,
  isVietnamesePhysicalSchema,
  parseJsonSafe,
  slugifyId,
} = require('./repository-shared');
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
 * Migration bảng xác minh yếu tố nhạy cảm phía máy chủ
 */
async function ensureSensitiveVerificationSchema(client) {
  if (await isVietnamesePhysicalSchema(client)) return;
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
    // Dùng kết quả dự phòng an toàn cho DB giả lập hoặc môi trường chưa có bảng mới
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

    const params = [
      numericId,
      JSON.stringify(flags),
      JSON.stringify(details),
      spatialSnapshot ? JSON.stringify(spatialSnapshot) : null,
      resolvedEvidenceRef || null,
    ];

    const useViSchema = await isVietnamesePhysicalSchema(client);
    if (useViSchema) {
      try {
        const insRes = await client.query(
          `INSERT INTO xac_minh_yeu_to_nhay_cam_du_an (
             du_an_ma, co_yeu_to_khai_bao, chi_tiet_khai_bao, du_lieu_khong_gian, tai_lieu_chung_minh, trang_thai_xac_minh
           ) VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, 'PENDING_VERIFICATION')
           ON CONFLICT (du_an_ma) DO UPDATE SET
             co_yeu_to_khai_bao = EXCLUDED.co_yeu_to_khai_bao,
             chi_tiet_khai_bao = EXCLUDED.chi_tiet_khai_bao,
             du_lieu_khong_gian = EXCLUDED.du_lieu_khong_gian,
             tai_lieu_chung_minh = COALESCE(EXCLUDED.tai_lieu_chung_minh, xac_minh_yeu_to_nhay_cam_du_an.tai_lieu_chung_minh),
             cap_nhat_luc = CURRENT_TIMESTAMP
           RETURNING ma AS id, du_an_ma AS project_id, co_yeu_to_khai_bao AS declared_flags,
             chi_tiet_khai_bao AS declared_details, du_lieu_khong_gian AS spatial_snapshot,
             tai_lieu_chung_minh AS evidence_ref, trang_thai_xac_minh AS verification_status,
             nguoi_xac_minh_ma AS verified_by, xac_minh_luc AS verified_at,
             ghi_chu_xac_minh AS verification_note, tao_luc AS created_at, cap_nhat_luc AS updated_at`,
          params
        );
        return insRes?.rows?.[0] || null;
      } catch (viErr) {
        if (!/does not exist|relation/i.test(String(viErr?.message || ''))) {
          throw viErr;
        }
        logger.warn('Không tìm thấy bảng xac_minh_yeu_to_nhay_cam_du_an, chuyển sang project_sensitive_verifications:', viErr.message);
      }
    }

    const legacyRes = await client.query(
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
      params
    );
    return legacyRes?.rows?.[0] || null;
  } catch (err) {
    logger.error('Lỗi lưu xác minh yếu tố nhạy cảm dự án:', err?.message || err);
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
 * Schema và kho lớp GIS lấy từ PostgreSQL
 */
async function ensureGisSchema(client) {
  if (await isVietnamesePhysicalSchema(client)) return;
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

module.exports = {
  ensureSensitiveVerificationSchema,
  getProjectSensitiveVerification,
  upsertProjectSensitiveDeclaration,
  reviewProjectSensitiveVerification,
  ensureGisSchema,
  seedGisLayers,
  loadGisLayers,
};
