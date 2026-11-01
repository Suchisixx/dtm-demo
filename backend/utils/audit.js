const db = require('../config/db');
const logger = require('./logger');

async function logAudit(userId, action, req, payload = null) {
  try {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    
    await db.query(
      `INSERT INTO audit_logs (user_id, action, ip_address, user_agent, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, ipAddress, userAgent, payload ? JSON.stringify(payload) : null]
    );
  } catch (error) {
    logger.error('Lỗi khi ghi Audit Log:', error);
  }
}

async function logLawHistory(lawId, action, userId, description) {
  try {
    await db.query(
      `INSERT INTO law_update_history (law_id, action, updated_by, description)
       VALUES ($1, $2, $3, $4)`,
      [lawId, action, userId, description]
    );
  } catch (error) {
    logger.error('Lỗi khi ghi Lịch sử văn bản:', error);
  }
}

module.exports = {
  logAudit,
  logLawHistory
};
