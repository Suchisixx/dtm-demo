// backend/services/crawler-sync-service.js
// Đồng bộ sự kiện Crawler -> Phát hiện Rule bị tác động (law_rule_impacts)
// và trích xuất đề xuất Rule mới ở trạng thái PENDING_REVIEW (không bao giờ tự PUBLISHED).

const defaultDb = require('../config/db');

function escapeRegexLike(text) {
  return String(text || '').trim();
}

function normalizeSearchTokens(docData = {}) {
  const tokens = [];
  if (docData.so && String(docData.so).trim()) tokens.push(String(docData.so).trim());
  if (docData.ten && String(docData.ten).trim()) {
    const qcvnMatches = String(docData.ten).match(/QCVN\s+[0-9A-Za-z\-]+(?::[0-9]{4}(?:\/[A-ZĐ]+)?)?/gi) || [];
    qcvnMatches.forEach(m => tokens.push(m.trim()));
  }
  return [...new Set(tokens)];
}

/**
 * Phát hiện các rule phân loại & QCVN đang tham chiếu tới văn bản vừa sửa/hết hiệu lực.
 */
async function detectImpactedRules(lawEvent = {}, { db = defaultDb } = {}) {
  const {
    lawId,
    lawTitle = '',
    so = '',
    eventAction = 'AUTO_CRAWL_UPDATE',
  } = lawEvent;

  if (!lawId || !['AUTO_CRAWL_UPDATE', 'AUTO_CRAWL_EXPIRE'].includes(eventAction)) {
    return [];
  }

  const isExpired = eventAction === 'AUTO_CRAWL_EXPIRE';
  const severity = isExpired ? 'HIGH' : 'MEDIUM';
  const searchTokens = normalizeSearchTokens({ so, ten: lawTitle });
  const createdImpacts = [];

  async function recordImpact({ targetType, targetId, targetLabel, impactReason }) {
    const dupCheck = await db.query(
      `SELECT id FROM law_rule_impacts
       WHERE law_id = $1 AND target_type = $2 AND target_id = $3 AND status = 'OPEN'`,
      [lawId, targetType, String(targetId)]
    );
    if (dupCheck && dupCheck.rowCount > 0) return null;

    const ins = await db.query(
      `INSERT INTO law_rule_impacts (
         law_id, law_title, event_action, target_type, target_id, target_label, severity, impact_reason, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN')
       RETURNING *`,
      [lawId, lawTitle, eventAction, targetType, String(targetId), targetLabel || String(targetId), severity, impactReason]
    );
    const row = ins?.rows?.[0];
    if (row) createdImpacts.push(row);
    return row;
  }

  try {
    // 1. Kiểm tra classification_thresholds theo law_id hoặc tên/số hiệu văn bản
    const thresholdQueryParams = [lawId];
    const extraClauses = ['law_id = $1'];
    searchTokens.forEach(tok => {
      thresholdQueryParams.push(`%${escapeRegexLike(tok)}%`);
      const pIdx = thresholdQueryParams.length;
      extraClauses.push(`legal_ref ILIKE $${pIdx} OR source_ref ILIKE $${pIdx}`);
    });

    const thrRes = await db.query(
      `SELECT id, industry_code, process_stage, project_group, legal_doc_required, legal_ref
       FROM classification_thresholds
       WHERE COALESCE(publication_status, 'PUBLISHED') <> 'ARCHIVED'
         AND (${extraClauses.join(' OR ')})`,
      thresholdQueryParams
    );

    const groupedIndustries = new Set();
    for (const r of (thrRes?.rows || [])) {
      const bucketKey = `${r.industry_code}:${r.process_stage || 'default'}`;
      if (groupedIndustries.has(bucketKey)) continue;
      groupedIndustries.add(bucketKey);

      await recordImpact({
        targetType: 'CLASSIFICATION_THRESHOLD',
        targetId: `${r.industry_code}${r.process_stage ? `:${r.process_stage}` : ''}`,
        targetLabel: `Ngành ${r.industry_code}${r.process_stage ? ` (${r.process_stage})` : ''} — ${r.project_group || ''}`,
        impactReason: isExpired
          ? `Văn bản căn cứ "${lawTitle || lawId}" đã hết hiệu lực (${eventAction}); cần rà soát ngày effective_to và thay thế rule.`
          : `Văn bản căn cứ "${lawTitle || lawId}" vừa có cập nhật nội dung (${eventAction}); cần đối chiếu lại ngưỡng/thẩm quyền.`,
      });
    }

    // 2. Kiểm tra QCVN theo source_document / standard_code
    if (searchTokens.length > 0) {
      const qcvnParams = [];
      const qcvnConds = [];
      searchTokens.forEach(tok => {
        qcvnParams.push(`%${escapeRegexLike(tok)}%`);
        const idx = qcvnParams.length;
        qcvnConds.push(`source_document ILIKE $${idx} OR standard_code ILIKE $${idx} OR ten ILIKE $${idx}`);
      });

      const qcvnRes = await db.query(
        `SELECT id, ten, standard_code
         FROM qcvns
         WHERE COALESCE(publication_status, 'PUBLISHED') <> 'ARCHIVED'
           AND (${qcvnConds.join(' OR ')})`,
        qcvnParams
      );

      for (const q of (qcvnRes?.rows || [])) {
        await recordImpact({
          targetType: 'QCVN',
          targetId: q.id,
          targetLabel: q.ten || q.id,
          impactReason: isExpired
            ? `Văn bản liên quan QCVN "${lawTitle || lawId}" đã chuyển trạng thái hết hiệu lực; cần kiểm tra hiệu lực quy chuẩn ${q.id}.`
            : `Văn bản liên quan QCVN "${lawTitle || lawId}" vừa được cập nhật; cần rà soát bảng giới hạn ${q.id}.`,
        });
      }
    }
  } catch {
    // Bảo vệ crawler không bị gián đoạn nếu schema test tối giản
  }

  return createdImpacts;
}

/**
 * Trích xuất có kiểm soát đề xuất rule candidate từ văn bản mới/cập nhật.
 * Luôn tạo ở trạng thái PENDING_REVIEW — tuyệt đối KHÔNG ghi trực tiếp vào rule runtime PUBLISHED.
 */
async function extractRuleCandidatesFromLaw(docData = {}, { db = defaultDb } = {}) {
  const lawId = docData.id || docData.lawId;
  const lawTitle = docData.ten || docData.lawTitle || '';
  if (!lawId) return [];

  const clauses = Array.isArray(docData.dieu_khoang) ? docData.dieu_khoang : [];
  const fullText = [
    lawTitle,
    docData.mo_ta || '',
    ...clauses.map(c => `${c.tieu_de || ''} ${c.noi_dung || ''}`),
  ].join('\n');

  const candidatesToCreate = [];

  // Phát hiện nhắc tới QCVN trong tiêu đề/nội dung
  const qcvnRefs = [...new Set((fullText.match(/QCVN\s+[0-9A-Za-z\-]+:[0-9]{4}(?:\/[A-ZĐ]+)?/gi) || []).map(s => s.trim()))];
  for (const refCode of qcvnRefs.slice(0, 3)) {
    const slug = refCode.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const matchingClause = clauses.find(c => `${c.tieu_de || ''} ${c.noi_dung || ''}`.includes(refCode));
    candidatesToCreate.push({
      targetType: 'QCVN',
      targetCode: slug,
      title: `Đề xuất cập nhật ${refCode} từ ${docData.so || lawId}`,
      proposedData: {
        id: slug,
        ten: `${refCode} (Cần đối chiếu bảng thông số gốc)`,
        standardCode: refCode,
        sourceDocument: docData.so || lawTitle || lawId,
        tham_so: [],
      },
      diffSummary: {
        detectedReference: refCode,
        lawNumber: docData.so || null,
        lawStatus: docData.status || null,
        requiresManualTableEntry: true,
      },
      extractionConfidence: 'LOW',
      sourceExcerpt: matchingClause ? `${matchingClause.tieu_de || ''}: ${String(matchingClause.noi_dung || '').slice(0, 400)}` : lawTitle.slice(0, 300),
    });
  }

  // Phát hiện điều khoản liên quan Phụ lục phân loại / ĐTM / GPMT / ĐKMT (hỗ trợ cả có dấu và không dấu)
  const stripAccents = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd');
  const classKeywords = /(Phụ lục\s+(?:II|III|IV)|Phu luc\s+(?:II|III|IV)|Nhóm\s+(?:I|II|III|IV)|Nhom\s+(?:I|II|III|IV)|đánh giá tác động môi trường|danh gia tac dong moi truong|giấy phép môi trường|giay phep moi truong|đăng ký môi trường|dang ky moi truong)/i;
  const classClauses = clauses.filter(c => {
    const raw = `${c.tieu_de || ''} ${c.noi_dung || ''}`;
    return classKeywords.test(raw) || classKeywords.test(stripAccents(raw));
  });
  if (classClauses.length > 0 || classKeywords.test(`${lawTitle} ${docData.mo_ta || ''}`) || classKeywords.test(stripAccents(`${lawTitle} ${docData.mo_ta || ''}`))) {
    const firstClause = classClauses[0];
    candidatesToCreate.push({
      targetType: 'CLASSIFICATION_THRESHOLD',
      targetCode: `classification_${lawId}`,
      title: `Đề xuất rà soát tiêu chí phân loại từ ${docData.so || lawTitle || lawId}`,
      proposedData: {
        lawId,
        sourceDocument: docData.so || lawTitle || lawId,
        note: `Phát hiện ${classClauses.length} điều khoản liên quan phân loại/thủ tục môi trường cần Admin đối chiếu ngưỡng.`,
        matchedClauses: classClauses.slice(0, 5).map(c => c.tieu_de || 'Điều khoản'),
      },
      diffSummary: {
        matchedClauseCount: classClauses.length,
        lawNumber: docData.so || null,
        requiresAdminThresholdVerification: true,
      },
      extractionConfidence: 'LOW',
      sourceExcerpt: firstClause
        ? `${firstClause.tieu_de || ''}: ${String(firstClause.noi_dung || '').slice(0, 400)}`
        : String(docData.mo_ta || lawTitle).slice(0, 350),
    });
  }

  const inserted = [];
  for (const cand of candidatesToCreate) {
    try {
      const dup = await db.query(
        `SELECT id FROM rule_candidates
         WHERE law_id = $1 AND target_type = $2 AND target_code = $3
           AND status IN ('PENDING_REVIEW', 'EXTRACTED')`,
        [lawId, cand.targetType, cand.targetCode]
      );
      if (dup && dup.rowCount > 0) continue;

      const ins = await db.query(
        `INSERT INTO rule_candidates (
           law_id, law_title, target_type, target_code, title,
           proposed_data, diff_summary, extraction_confidence, source_excerpt, status
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, 'PENDING_REVIEW')
         RETURNING *`,
        [
          lawId,
          lawTitle,
          cand.targetType,
          cand.targetCode,
          cand.title,
          JSON.stringify(cand.proposedData),
          JSON.stringify(cand.diffSummary),
          cand.extractionConfidence,
          cand.sourceExcerpt,
        ]
      );
      if (ins?.rows?.[0]) inserted.push(ins.rows[0]);
    } catch {
      // Bỏ qua an toàn nếu thiếu bảng trên môi trường tối giản
    }
  }

  return inserted;
}

/**
 * Đồng bộ hàng loạt sự kiện từ runCrawler().
 */
async function syncCrawlerEvents(events = [], { db = defaultDb } = {}) {
  let impactsCreated = 0;
  let candidatesCreated = 0;

  for (const evt of (events || [])) {
    if (!evt || !evt.lawId) continue;

    if (evt.eventAction === 'AUTO_CRAWL_UPDATE' || evt.eventAction === 'AUTO_CRAWL_EXPIRE') {
      const impacts = await detectImpactedRules(evt, { db });
      impactsCreated += impacts.length;
    }

    if (evt.eventAction === 'AUTO_CRAWL_CREATE' || evt.eventAction === 'AUTO_CRAWL_UPDATE') {
      const cands = await extractRuleCandidatesFromLaw(evt.docData || evt, { db });
      candidatesCreated += cands.length;
    }
  }

  return { impactsCreated, candidatesCreated };
}

module.exports = {
  detectImpactedRules,
  extractRuleCandidatesFromLaw,
  syncCrawlerEvents,
};
