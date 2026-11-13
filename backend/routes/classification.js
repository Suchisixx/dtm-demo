const express = require('express');
const router = express.Router();
const db = require('../config/db');
const logger = require('../utils/logger');
const { evaluateClassificationWithDb, getClassificationMetadata } = require('../services/classification-service');
const { analyzeSpatialContextWithDb, getAllGisLayersWithDb, haversineDistanceKm } = require('../services/spatial-gis-service');
const { getBoundaryByCode, locateAdministrativeUnit } = require('../services/administrative-boundary-service');

// GET /api/classification/administrative-units/:code/boundary — ranh giới theo mã địa giới hiện hành
router.get('/administrative-units/:code/boundary', async (req, res) => {
  try {
    const featureCollection = await getBoundaryByCode(req.params.code);
    return res.json({ success: true, featureCollection });
  } catch (error) {
    const status = error.status || 502;
    if (status >= 500) logger.warn('Không thể tải ranh giới hành chính:', error.message, error.cause?.message || '');
    return res.status(status).json({ error: error.message || 'Không thể tra cứu ranh giới hành chính' });
  }
});

// GET /api/classification/administrative-units/locate — xác định đơn vị bằng giao cắt tọa độ
router.get('/administrative-units/locate', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const result = await locateAdministrativeUnit(lat, lng);
    return res.json({ success: true, result });
  } catch (error) {
    const status = error.status || 502;
    if (status >= 500) logger.warn('Không thể xác định đơn vị hành chính:', error.message);
    return res.status(status).json({ error: error.message || 'Không thể xác định đơn vị hành chính' });
  }
});

// POST /api/classification/evaluate — máy chủ đánh giá hồ sơ bằng quy tắc từ cơ sở dữ liệu
router.post('/evaluate', async (req, res) => {
  try {
    const formData = req.body || {};
    const projectId = formData.projectId ?? formData.project_id ?? null;

    // Thực thi thuật toán phân loại và tra cứu luật từ PostgreSQL (kèm xác minh vùng nhạy cảm phía server)
    const result = await evaluateClassificationWithDb(formData, { db, projectId });

    return res.json({
      success: true,
      result
    });
  } catch (error) {
    if (error.errorCode === 'RULE_DB_UNAVAILABLE' || error.name === 'RuleDataUnavailableError') {
      return res.status(503).json({
        errorCode: 'RULE_DB_UNAVAILABLE',
        error: error.message || 'Cơ sở dữ liệu quy tắc không khả dụng',
      });
    }
    logger.error('Lỗi thực thi phân loại hồ sơ:', error);
    return res.status(500).json({ error: 'Không thể xử lý phân loại dự án!' });
  }
});

// POST /api/classification/spatial-check — phân tích GIS cho tọa độ bằng dữ liệu PostgreSQL
router.post('/spatial-check', async (req, res) => {
  try {
    const { latitude, longitude, excludeProjectId } = req.body || {};
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Tọa độ không hợp lệ!' });
    }

    const spatial = await analyzeSpatialContextWithDb(lat, lng, { db });

    // Tìm các dự án lân cận trong bán kính 15 km từ CSDL
    let nearbyProjects = [];
    try {
      const projRes = await db.query(
        `SELECT id, name, latitude, longitude, dia_chi_hien_thi, classification_result, form_data
         FROM projects
         WHERE latitude IS NOT NULL AND longitude IS NOT NULL`
      );
      for (const row of projRes.rows) {
        if (excludeProjectId && Number(row.id) === Number(excludeProjectId)) continue;
        const pLat = parseFloat(row.latitude);
        const pLng = parseFloat(row.longitude);
        if (isNaN(pLat) || isNaN(pLng)) continue;
        const distKm = haversineDistanceKm(lat, lng, pLat, pLng);
        if (distKm <= 15) {
          const cr = row.classification_result || {};
          const fd = row.form_data || {};
          nearbyProjects.push({
            id: row.id,
            name: row.name,
            latitude: pLat,
            longitude: pLng,
            distanceKm: Number(distKm.toFixed(2)),
            nhom: cr.nhom || 'Cần rà soát',
            hs: cr.hs || '—',
            dia_chi: row.dia_chi_hien_thi || fd.tinh || ''
          });
        }
      }
      nearbyProjects.sort((a, b) => a.distanceKm - b.distanceKm);
    } catch (dbErr) {
      logger.warn('Không thể truy vấn dự án lân cận:', dbErr.message);
    }

    return res.json({
      success: true,
      spatial: {
        ...spatial,
        nearbyProjects: nearbyProjects.slice(0, 8)
      }
    });
  } catch (error) {
    logger.error('Lỗi phân tích không gian GIS:', error);
    return res.status(500).json({ error: 'Không thể phân tích không gian GIS!' });
  }
});

// GET /api/classification/gis-layers — lấy lớp GIS từ PostgreSQL, có cơ chế dự phòng an toàn
router.get('/gis-layers', async (req, res) => {
  try {
    const layers = await getAllGisLayersWithDb({ db });
    return res.json({
      success: true,
      ...layers,
    });
  } catch (error) {
    logger.error('Lỗi tải lớp GIS:', error);
    return res.status(500).json({ error: 'Không thể tải dữ liệu lớp bản đồ GIS!' });
  }
});

// GET /api/classification/metadata — lấy ngành nghề, công đoạn và vùng nhạy cảm từ cơ sở dữ liệu
router.get('/metadata', async (req, res) => {
  try {
    const metadata = await getClassificationMetadata({ db });
    return res.json(metadata);
  } catch (error) {
    if (error.errorCode === 'RULE_DB_UNAVAILABLE' || error.name === 'RuleDataUnavailableError') {
      return res.status(503).json({
        errorCode: 'RULE_DB_UNAVAILABLE',
        error: error.message || 'Cơ sở dữ liệu danh mục ngành không khả dụng',
      });
    }
    logger.error('Lỗi lấy danh mục phân loại:', error);
    return res.status(500).json({ error: 'Không thể tải danh mục ngành nghề!' });
  }
});

// GET /api/classification/industries — danh sách ngành nghề chuẩn hóa từ PostgreSQL
router.get('/industries', async (req, res) => {
  try {
    const meta = await getClassificationMetadata({ db });
    const list = Object.values(meta.industries || {}).map(ind => ({
      code: ind.code,
      name: ind.name,
      displayName: ind.displayName || ind.name,
      aliases: ind.aliases || [],
      groupLabel: ind.groupLabel || 'Ngành nghề khác',
      processStages: ind.processStages || [],
      hasProcessRules: Boolean(ind.hasProcessRules),
      verificationStatus: ind.verificationStatus || 'NEEDS_LEGAL_VERIFICATION',
      ruleVersion: ind.ruleVersion || '2026.2-audit',
    }));
    return res.json({
      success: true,
      data: list,
      industries: list,
      ruleSource: meta.ruleSource,
    });
  } catch (error) {
    if (error.errorCode === 'RULE_DB_UNAVAILABLE' || error.name === 'RuleDataUnavailableError') {
      return res.status(503).json({
        errorCode: 'RULE_DB_UNAVAILABLE',
        error: error.message || 'Cơ sở dữ liệu danh mục ngành không khả dụng',
      });
    }
    logger.error('Lỗi lấy danh mục ngành nghề:', error);
    return res.status(500).json({ error: 'Không thể tải danh sách ngành nghề!' });
  }
});

module.exports = router;
