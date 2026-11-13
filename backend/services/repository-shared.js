// Hàm dùng chung cho các nhóm kho dữ liệu.
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

async function isVietnamesePhysicalSchema(client) {
  try {
    const result = await client.query(
      `SELECT EXISTS (
         SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'nguong_phan_loai' AND c.relkind IN ('r', 'p')
       ) AS ready`
    );
    return result.rows?.[0]?.ready === true;
  } catch {
    return false;
  }
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
    const match = val.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

module.exports = {
  defaultDb,
  EXCLUDED_PUBLICATION_STATUSES,
  isActivePublicationStatus,
  isVietnamesePhysicalSchema,
  parseJsonSafe,
  formatDateOnly,
  slugifyId,
};
