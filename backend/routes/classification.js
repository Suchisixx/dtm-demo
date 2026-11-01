const express = require('express');
const router = express.Router();
const db = require('../config/db');
const logger = require('../utils/logger');
const { evaluateClassification, IND_DB, SENSITIVE_AREAS } = require('../services/classification-service');

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

// GET /api/classification/metadata - Lấy danh mục ngành nghề và danh mục vùng nhạy cảm
router.get('/metadata', (req, res) => {
  return res.json({
    industries: IND_DB,
    sensitiveAreas: SENSITIVE_AREAS
  });
});

module.exports = router;
