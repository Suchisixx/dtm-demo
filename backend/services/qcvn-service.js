// backend/services/qcvn-service.js
// Service đối chiếu QCVN phía Backend: nạp catalog từ PostgreSQL qua rule-repository
// và thực thi đánh giá dùng chung với frontend thông qua qcvn-evaluator.

const defaultDb = require('../config/db');
const { loadQcvnCatalog } = require('./rule-repository');
const {
  QCVN_STATUS_TO_DB,
  parsePermitLimit,
  selectApplicableQcvn,
  evaluateQcvnSample,
} = require('../../frontend/src/utils/qcvn-evaluator');

let cachedFallbackData = null;

function getFallbackQcvnFixture() {
  if (!cachedFallbackData) {
    try {
      const fixture = require('../../frontend/src/data/qcvn-db');
      cachedFallbackData = {
        QCVN_DATA: fixture.QCVN_DATA || {},
        SUB_TYPES: fixture.SUB_TYPES || {},
      };
    } catch {
      cachedFallbackData = { QCVN_DATA: {}, SUB_TYPES: {} };
    }
  }
  return cachedFallbackData;
}

/**
 * Nạp catalog QCVN từ DB. Nếu DB lỗi hoặc rỗng, dùng fallback kèm cờ FALLBACK_UNVERIFIED.
 */
async function getRuntimeQcvnCatalog({ db = defaultDb } = {}) {
  const loaded = await loadQcvnCatalog({ db });
  if (loaded.ok && loaded.catalog && Object.keys(loaded.catalog).length > 0) {
    return {
      catalog: loaded.catalog,
      ruleSource: 'DATABASE',
      fallbackReason: null,
    };
  }

  const fallback = getFallbackQcvnFixture();
  return {
    catalog: fallback.QCVN_DATA,
    ruleSource: 'FALLBACK_UNVERIFIED',
    fallbackReason: loaded.error || 'DB_UNAVAILABLE',
  };
}

async function selectApplicableQcvnWithDb(options = {}, { db = defaultDb } = {}) {
  const { catalog, ruleSource, fallbackReason } = await getRuntimeQcvnCatalog({ db });
  const fallback = getFallbackQcvnFixture();
  const res = selectApplicableQcvn({
    ...options,
    qcvnDatabase: catalog,
    subTypes: fallback.SUB_TYPES,
    ruleSource,
  });
  return {
    ...res,
    fallbackReason: fallbackReason || null,
  };
}

async function evaluateQcvnSampleWithDb(sampleInput = {}, { db = defaultDb } = {}) {
  const { catalog, ruleSource, fallbackReason } = await getRuntimeQcvnCatalog({ db });
  const res = evaluateQcvnSample({
    ...sampleInput,
    qcvnDatabase: catalog,
    ruleSource,
  });
  return {
    ...res,
    fallbackReason: fallbackReason || null,
  };
}

module.exports = {
  QCVN_STATUS_TO_DB,
  parsePermitLimit,
  selectApplicableQcvn,
  evaluateQcvnSample,
  getFallbackQcvnFixture,
  getRuntimeQcvnCatalog,
  selectApplicableQcvnWithDb,
  evaluateQcvnSampleWithDb,
};
