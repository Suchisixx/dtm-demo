const express = require('express');
const router = express.Router();
const db = require('../config/db');
const logger = require('../utils/logger');
const { evaluateClassification, IND_DB, SENSITIVE_AREAS } = require('../services/classification-service');
const { analyzeSpatialContext, getAllGisLayers, haversineDistanceKm } = require('../services/spatial-gis-service');

// POST /api/classification/evaluate - Đánh giá và phân loại hồ sơ dự án từ Backend
router.post('/evaluate', async (req, res) => {
  try {
    const formData = req.body || {};

    // Thực thi thuật toán phân loại và tra cứu luật trên Backend
    const result = evaluateClassification(formData);

    return res.json({
      success: true,
      result
    });
  } catch (error) {
    logger.error('Lỗi thực thi phân loại hồ sơ:', error);
    return res.status(500).json({ error: 'Không thể xử lý phân loại dự án!' });
  }
});

// POST /api/classification/spatial-check - Phân tích không gian GIS cho tọa độ (lat, lng)
router.post('/spatial-check', async (req, res) => {
  try {
    const { latitude, longitude, excludeProjectId } = req.body || {};
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Tọa độ không hợp lệ!' });
    }

    const spatial = analyzeSpatialContext(lat, lng);

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
            nhom: cr.nhom || 'Nhóm III',
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

// GET /api/classification/gis-layers - Lấy dữ liệu lớp chuyên đề GIS (Vùng nhạy cảm, KCN, Biên giới)
router.get('/gis-layers', (req, res) => {
  return res.json({
    success: true,
    ...getAllGisLayers()
  });
});

// GET /api/classification/metadata - Lấy danh mục ngành nghề và danh mục vùng nhạy cảm
router.get('/metadata', (req, res) => {
  return res.json({
    industries: IND_DB,
    sensitiveAreas: SENSITIVE_AREAS
  });
});

module.exports = router;
