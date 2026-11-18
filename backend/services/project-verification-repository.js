// Kho dữ liệu xác minh dự án và lớp bản đồ GIS.
const logger = require('../utils/logger');
const {
  defaultDb,
  EXCLUDED_PUBLICATION_STATUSES,
  isActivePublicationStatus,
  isVerifiedStatusValue,
  isVietnamesePhysicalSchema,
  parseJsonSafe,
  slugifyId,
  toDbVerificationStatus,
  toCanonicalVerificationStatus,
  toDbPublicationStatus,
  toDbGisLayerType,
  toCanonicalGisLayerType,
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
      verification_status: toCanonicalVerificationStatus(row.verification_status),
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

      const existingCanonical = toCanonicalVerificationStatus(existing.verification_status);
      let nextStatus = hasTrigger ? (existingCanonical || 'PENDING_VERIFICATION') : 'NOT_REQUIRED';
      let nextVerifiedBy = existing.verified_by || null;
      let nextVerifiedAt = existing.verified_at || null;
      let nextNote = existing.verification_note || null;

      if (!hasTrigger) {
        nextVerifiedBy = null;
        nextVerifiedAt = null;
      } else if (existingCanonical === 'VERIFIED' && declarationChanged) {
        nextStatus = 'PENDING_VERIFICATION';
        nextVerifiedBy = null;
        nextVerifiedAt = null;
        nextNote = 'Tự động đưa về Chờ xác minh do hồ sơ thay đổi khai báo vùng nhạy cảm.';
      } else if (existingCanonical === 'NOT_REQUIRED' || existingCanonical === 'REJECTED') {
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
          toDbVerificationStatus(nextStatus),
          nextVerifiedBy,
          nextVerifiedAt,
          nextNote,
          numericId,
        ]
      );
      const updRow = updRes?.rows?.[0] || null;
      return updRow ? { ...updRow, verification_status: toCanonicalVerificationStatus(updRow.verification_status) } : null;
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
           ) VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, 'cho_xac_minh')
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
        const insRow = insRes?.rows?.[0] || null;
        return insRow ? { ...insRow, verification_status: toCanonicalVerificationStatus(insRow.verification_status) } : null;
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
       ) VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, 'cho_xac_minh')
       ON CONFLICT (project_id) DO UPDATE SET
         declared_flags = EXCLUDED.declared_flags,
         declared_details = EXCLUDED.declared_details,
         spatial_snapshot = EXCLUDED.spatial_snapshot,
         evidence_ref = COALESCE(EXCLUDED.evidence_ref, project_sensitive_verifications.evidence_ref),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      params
    );
    const legacyRow = legacyRes?.rows?.[0] || null;
    return legacyRow ? { ...legacyRow, verification_status: toCanonicalVerificationStatus(legacyRow.verification_status) } : null;
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
  const normalizedStatus = toCanonicalVerificationStatus(verificationStatus);
  if (!['VERIFIED', 'REJECTED', 'PENDING_VERIFICATION'].includes(normalizedStatus)) {
    throw new Error('INVALID_VERIFICATION_STATUS');
  }
  if (normalizedStatus === 'VERIFIED' && !verifiedBy) {
    throw new Error('VERIFIED_BY_REQUIRED');
  }
  const dbStatus = toDbVerificationStatus(normalizedStatus);

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
        dbStatus,
        normalizedStatus === 'PENDING_VERIFICATION' ? null : verifiedBy,
        verificationNote || null,
      ]
    );
    const insRow = ins.rows[0];
    return insRow ? { ...insRow, verification_status: toCanonicalVerificationStatus(insRow.verification_status) } : insRow;
  }

  const upd = await client.query(
    `UPDATE project_sensitive_verifications
     SET verification_status = $1::varchar,
         verified_by = $2,
         verified_at = CASE WHEN $1::text IN ('PENDING_VERIFICATION', 'cho_xac_minh') THEN NULL ELSE CURRENT_TIMESTAMP END,
         evidence_ref = COALESCE(NULLIF($3::text, ''), evidence_ref),
         verification_note = COALESCE($4, verification_note),
         updated_at = CURRENT_TIMESTAMP
     WHERE project_id = $5
     RETURNING *`,
    [
      dbStatus,
      normalizedStatus === 'PENDING_VERIFICATION' ? null : verifiedBy,
      evidenceRef || '',
      verificationNote || null,
      numericId,
    ]
  );
  const updRow = upd.rows[0];
  return updRow ? { ...updRow, verification_status: toCanonicalVerificationStatus(updRow.verification_status) } : updRow;
}

/**
 * Schema và kho lớp GIS lấy từ PostgreSQL
 */
async function ensureGisSchema(client) {
  const vietnamese = await isVietnamesePhysicalSchema(client);
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
  } catch (error) {
    const unavailable = error?.code === '0A000' || error?.code === '42501'
      || /extension ["']?postgis["']? is not available|permission denied to create extension/i.test(String(error?.message || ''));
    if (!unavailable) throw error;
    if (!vietnamese) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS gis_layers (
          id VARCHAR(120) PRIMARY KEY,
          layer_type VARCHAR(40) NOT NULL,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(100), flag_key VARCHAR(40),
          latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL,
          radius_km DOUBLE PRECISION NOT NULL DEFAULT 1, geometry_json JSONB,
          province VARCHAR(150), legal_ref TEXT,
          verification_status VARCHAR(50) NOT NULL DEFAULT 'NEEDS_LEGAL_VERIFICATION',
          publication_status VARCHAR(30) NOT NULL DEFAULT 'PUBLISHED',
          source_document TEXT, verified_by VARCHAR(100), verified_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    logger.warn('PostGIS chưa khả dụng; giữ schema GIS tương thích và mọi phân tích vị trí sẽ ở chế độ FALLBACK_UNVERIFIED.');
    return { ok: false, code: 'POSTGIS_UNAVAILABLE' };
  }
  await client.query(`
    CREATE OR REPLACE FUNCTION legalhub_geojson_polygon(input jsonb) RETURNS geometry AS $$
    DECLARE payload jsonb; result geometry;
    BEGIN
      payload := CASE WHEN input->>'type' = 'Feature' THEN input->'geometry' ELSE input END;
      IF payload IS NULL OR payload->>'type' NOT IN ('Polygon', 'MultiPolygon') THEN RETURN NULL; END IF;
      result := ST_SetSRID(ST_GeomFromGeoJSON(payload::text), 4326);
      IF NOT ST_IsValid(result) THEN RETURN NULL; END IF;
      RETURN result;
    EXCEPTION WHEN OTHERS THEN RETURN NULL;
    END; $$ LANGUAGE plpgsql IMMUTABLE;
  `);
  if (!vietnamese) {
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
      ALTER TABLE gis_layers ADD COLUMN IF NOT EXISTS spatial_geometry geometry(Geometry, 4326);
      CREATE INDEX IF NOT EXISTS gis_layers_spatial_geometry_gix ON gis_layers USING GIST (spatial_geometry);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS spatial_geometry geometry(Point, 4326);
      CREATE INDEX IF NOT EXISTS projects_spatial_geometry_gix ON projects USING GIST (spatial_geometry);
    `);
  } else {
    await client.query(`
      ALTER TABLE lop_ban_do ADD COLUMN IF NOT EXISTS hinh_hoc_khong_gian geometry(Geometry, 4326);
      CREATE INDEX IF NOT EXISTS lop_ban_do_hinh_hoc_khong_gian_gix ON lop_ban_do USING GIST (hinh_hoc_khong_gian);
      ALTER TABLE du_an ADD COLUMN IF NOT EXISTS vi_tri_khong_gian geometry(Point, 4326);
      CREATE INDEX IF NOT EXISTS du_an_vi_tri_khong_gian_gix ON du_an USING GIST (vi_tri_khong_gian);
    `);
  }

  await client.query(`
    UPDATE ${vietnamese ? 'lop_ban_do' : 'gis_layers'}
       SET ${vietnamese ? 'hinh_hoc_khong_gian' : 'spatial_geometry'} =
         legalhub_geojson_polygon(${vietnamese ? 'hinh_hoc' : 'geometry_json'})
     WHERE ${vietnamese ? 'hinh_hoc_khong_gian' : 'spatial_geometry'} IS NULL
       AND ${vietnamese ? 'hinh_hoc' : 'geometry_json'} IS NOT NULL;
    UPDATE ${vietnamese ? 'lop_ban_do' : 'gis_layers'}
       SET ${vietnamese ? 'hinh_hoc_khong_gian' : 'spatial_geometry'} =
         ST_SetSRID(ST_MakePoint(${vietnamese ? 'kinh_do' : 'longitude'}, ${vietnamese ? 'vi_do' : 'latitude'}), 4326)
     WHERE ${vietnamese ? 'hinh_hoc_khong_gian' : 'spatial_geometry'} IS NULL
       AND ${vietnamese ? 'vi_do' : 'latitude'} BETWEEN -90 AND 90
       AND ${vietnamese ? 'kinh_do' : 'longitude'} BETWEEN -180 AND 180;
    UPDATE ${vietnamese ? 'du_an' : 'projects'}
       SET ${vietnamese ? 'vi_tri_khong_gian' : 'spatial_geometry'} =
         ST_SetSRID(ST_MakePoint(${vietnamese ? 'kinh_do' : 'longitude'}, ${vietnamese ? 'vi_do' : 'latitude'}), 4326)
     WHERE ${vietnamese ? 'vi_tri_khong_gian' : 'spatial_geometry'} IS NULL
       AND ${vietnamese ? 'vi_do' : 'latitude'} BETWEEN -90 AND 90
       AND ${vietnamese ? 'kinh_do' : 'longitude'} BETWEEN -180 AND 180;
  `);
  const triggersSql = vietnamese ? `
    CREATE OR REPLACE FUNCTION legalhub_sync_project_geometry_vi() RETURNS trigger AS $$
    BEGIN
      NEW.vi_tri_khong_gian := CASE WHEN NEW.vi_do BETWEEN -90 AND 90 AND NEW.kinh_do BETWEEN -180 AND 180
        THEN ST_SetSRID(ST_MakePoint(NEW.kinh_do, NEW.vi_do), 4326) ELSE NULL END;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS legalhub_project_geometry_sync ON du_an;
    CREATE TRIGGER legalhub_project_geometry_sync BEFORE INSERT OR UPDATE OF vi_do, kinh_do
    ON du_an FOR EACH ROW EXECUTE FUNCTION legalhub_sync_project_geometry_vi();
    CREATE OR REPLACE FUNCTION legalhub_sync_layer_geometry_vi() RETURNS trigger AS $$
    BEGIN
      IF NEW.hinh_hoc IS NOT NULL AND (NEW.hinh_hoc->>'type' IN ('Polygon', 'MultiPolygon', 'Feature')) THEN
        NEW.hinh_hoc_khong_gian := legalhub_geojson_polygon(NEW.hinh_hoc);
      ELSIF NEW.vi_do BETWEEN -90 AND 90 AND NEW.kinh_do BETWEEN -180 AND 180 THEN
        NEW.hinh_hoc_khong_gian := ST_SetSRID(ST_MakePoint(NEW.kinh_do, NEW.vi_do), 4326);
      ELSE NEW.hinh_hoc_khong_gian := NULL; END IF;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS legalhub_layer_geometry_sync ON lop_ban_do;
    CREATE TRIGGER legalhub_layer_geometry_sync BEFORE INSERT OR UPDATE OF hinh_hoc, vi_do, kinh_do
    ON lop_ban_do FOR EACH ROW EXECUTE FUNCTION legalhub_sync_layer_geometry_vi();
  ` : `
    CREATE OR REPLACE FUNCTION legalhub_sync_project_geometry() RETURNS trigger AS $$
    BEGIN
      NEW.spatial_geometry := CASE WHEN NEW.latitude BETWEEN -90 AND 90 AND NEW.longitude BETWEEN -180 AND 180
        THEN ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326) ELSE NULL END;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS legalhub_project_geometry_sync ON projects;
    CREATE TRIGGER legalhub_project_geometry_sync BEFORE INSERT OR UPDATE OF latitude, longitude
    ON projects FOR EACH ROW EXECUTE FUNCTION legalhub_sync_project_geometry();
    CREATE OR REPLACE FUNCTION legalhub_sync_layer_geometry() RETURNS trigger AS $$
    BEGIN
      IF NEW.geometry_json IS NOT NULL AND NEW.geometry_json->>'type' IN ('Polygon', 'MultiPolygon', 'Feature') THEN
        NEW.spatial_geometry := legalhub_geojson_polygon(NEW.geometry_json);
      ELSIF NEW.latitude BETWEEN -90 AND 90 AND NEW.longitude BETWEEN -180 AND 180 THEN
        NEW.spatial_geometry := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
      ELSE NEW.spatial_geometry := NULL; END IF;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS legalhub_layer_geometry_sync ON gis_layers;
    CREATE TRIGGER legalhub_layer_geometry_sync BEFORE INSERT OR UPDATE OF geometry_json, latitude, longitude
    ON gis_layers FOR EACH ROW EXECUTE FUNCTION legalhub_sync_layer_geometry();
  `;
  await client.query(triggersSql);
  return { ok: true, code: 'POSTGIS_READY' };
}

async function evaluateSpatialLayers(lat, lng, { db = defaultDb } = {}) {
  const vietnamese = await isVietnamesePhysicalSchema(db);
  const table = vietnamese ? 'lop_ban_do' : 'gis_layers';
  const id = vietnamese ? 'ma' : 'id';
  const type = vietnamese ? 'loai_lop' : 'layer_type';
  const name = vietnamese ? 'ten_lop' : 'name';
  const category = vietnamese ? 'danh_muc' : 'category';
  const flag = vietnamese ? 'ma_co' : 'flag_key';
  const latitude = vietnamese ? 'vi_do' : 'latitude';
  const longitude = vietnamese ? 'kinh_do' : 'longitude';
  const radius = vietnamese ? 'ban_kinh_km' : 'radius_km';
  const geom = vietnamese ? 'hinh_hoc_khong_gian' : 'spatial_geometry';
  const json = vietnamese ? 'hinh_hoc' : 'geometry_json';
  const province = vietnamese ? 'tinh' : 'province';
  const legalRef = vietnamese ? 'can_cu_phap_ly' : 'legal_ref';
  const verification = vietnamese ? 'trang_thai_xac_minh' : 'verification_status';
  const publication = vietnamese ? 'trang_thai_cong_bo' : 'publication_status';
  const source = vietnamese ? 'tai_lieu_nguon' : 'source_document';
  const pointExpr = 'ST_SetSRID(ST_MakePoint($2, $1), 4326)';
  const result = await db.query(
    `SELECT ${id} AS id, ${type} AS layer_type, ${name} AS name, ${category} AS category,
            ${flag} AS flag_key, ${latitude} AS latitude, ${longitude} AS longitude,
            ${radius} AS radius_km, ${province} AS province, ${legalRef} AS legal_ref,
            ${verification} AS verification_status, ${publication} AS publication_status,
            ${source} AS source_document,
            CASE WHEN GeometryType(${geom}) IN ('POLYGON', 'MULTIPOLYGON') THEN ST_AsGeoJSON(${geom})::jsonb ELSE ${json} END AS geometry_json,
            GeometryType(${geom}) IN ('POLYGON', 'MULTIPOLYGON') AND ST_IsValid(${geom}) AS geometry_valid,
            GeometryType(${geom}) IN ('POLYGON', 'MULTIPOLYGON') AND ST_IsValid(${geom}) AND ST_Covers(${geom}, ${pointExpr}) AS covers_point,
            CASE WHEN GeometryType(${geom}) IN ('POLYGON', 'MULTIPOLYGON') AND ST_IsValid(${geom})
                 THEN ST_Distance(${geom}::geography, ${pointExpr}::geography) / 1000.0
                 ELSE ST_Distance(ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
                                  ${pointExpr}::geography) / 1000.0 END AS distance_km
       FROM ${table}
      ORDER BY ${type}, ${name}`,
    [Number(lat), Number(lng)]
  );
  return (result.rows || []).filter(row => isActivePublicationStatus(row.publication_status));
}

async function seedGisLayers(client, { sensitiveZones = [], industrialParks = [], force = false } = {}) {
  const existingRes = await client.query(
    'SELECT id, verification_status, publication_status, verified_by, geometry_json FROM gis_layers'
  );
  const existingMap = new Map((existingRes?.rows || []).map(r => [r.id, r]));

  let inserted = 0;
  let updated = 0;
  let skippedVerified = 0;

  const entries = [
    ...sensitiveZones.map((z, idx) => ({
      id: z.id || `sz_${slugifyId(z.name || idx)}`,
      layer_type: toDbGisLayerType('SENSITIVE_ZONE'),
      name: z.name,
      category: z.category || null,
      flag_key: z.flagKey || z.flag_key || null,
      latitude: Number(z.lat ?? z.latitude),
      longitude: Number(z.lng ?? z.longitude),
      radius_km: Number(z.radiusKm ?? z.radius_km ?? 5),
      geometry_json: z.geometry || null,
      province: z.province || null,
      legal_ref: z.legalRef || z.legal_ref || null,
      verification_status: toDbVerificationStatus(z.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION'),
      source_document: z.sourceDocument || null,
    })),
    ...industrialParks.map((p, idx) => ({
      id: p.id || `ip_${slugifyId(p.name || idx)}`,
      layer_type: toDbGisLayerType('INDUSTRIAL_PARK'),
      name: p.name,
      category: p.category || 'Khu công nghiệp',
      flag_key: 'kcn',
      latitude: Number(p.lat ?? p.latitude),
      longitude: Number(p.lng ?? p.longitude),
      radius_km: Number(p.radiusKm ?? p.radius_km ?? 2),
      geometry_json: p.geometry || null,
      province: p.province || null,
      legal_ref: p.legalRef || p.legal_ref || null,
      verification_status: toDbVerificationStatus(p.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION'),
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
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14)`,
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
          toDbPublicationStatus('PUBLISHED'),
          item.source_document,
        ]
      );
      inserted++;
      continue;
    }

    const isLocked = isVerifiedStatusValue(prev.verification_status)
      || Boolean(prev.verified_by)
      || !isActivePublicationStatus(prev.publication_status);

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
    } else if (item.geometry_json && !prev.geometry_json) {
      await client.query(
        `UPDATE gis_layers
         SET geometry_json = COALESCE(geometry_json, $1::jsonb),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND geometry_json IS NULL`,
        [JSON.stringify(item.geometry_json), item.id]
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
      const canonicalLayerType = toCanonicalGisLayerType(row.layer_type);
      const item = {
        id: row.id,
        layerType: canonicalLayerType,
        name: row.name,
        category: row.category || '',
        flagKey: row.flag_key || null,
        lat: Number(row.latitude),
        lng: Number(row.longitude),
        radiusKm: Number(row.radius_km || 1),
        geometry: parseJsonSafe(row.geometry_json, null),
        province: row.province || '',
        legalRef: row.legal_ref || '',
        verificationStatus: toCanonicalVerificationStatus(row.verification_status) === 'VERIFIED' ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION',
        sourceDocument: row.source_document || null,
      };
      if (canonicalLayerType === 'INDUSTRIAL_PARK') industrialParks.push(item);
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
  evaluateSpatialLayers,
};
