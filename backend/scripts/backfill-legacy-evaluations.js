const db = require('../config/db');
const { evaluateClassificationWithDb } = require('../services/classification-service');

function parseJson(value, fallback = {}) {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return fallback;
}

function hasProjectAuditMetadata(value) {
  const result = parseJson(value);
  return Boolean(result.ruleSource && result.ruleVersion && result.verificationStatus && result.evaluationDate);
}

async function main() {
  const client = await db.pool.connect();
  let projectsUpdated = 0;
  let samplesDowngraded = 0;
  try {
    await client.query('BEGIN');

    const projects = await client.query(
      'SELECT id, form_data, classification_result FROM projects ORDER BY id FOR UPDATE'
    );
    for (const project of projects.rows) {
      if (hasProjectAuditMetadata(project.classification_result)) continue;
      const formData = parseJson(project.form_data);
      const evaluation = await evaluateClassificationWithDb(formData, {
        db: client,
        projectId: project.id,
      });
      await client.query(
        'UPDATE projects SET classification_result = $1::jsonb WHERE id = $2',
        [JSON.stringify(evaluation), project.id]
      );
      projectsUpdated++;
    }

    const samples = await client.query(
      `SELECT id, evaluation_details
       FROM qcvn_samples
       WHERE overall_status IS NULL
          OR evaluated_rule_version IS NULL
          OR evaluated_verification_status IS NULL
          OR NOT (COALESCE(evaluation_details, '{}'::jsonb) ? 'ruleSource')
          OR NOT (COALESCE(evaluation_details, '{}'::jsonb) ? 'ruleVersion')
          OR NOT (COALESCE(evaluation_details, '{}'::jsonb) ? 'verificationStatus')
          OR NOT (COALESCE(evaluation_details, '{}'::jsonb) ? 'evaluationDate')
       ORDER BY id
       FOR UPDATE`
    );
    const backfillDate = new Date().toISOString().slice(0, 10);
    for (const sample of samples.rows) {
      const details = parseJson(sample.evaluation_details);
      const nextDetails = {
        ...details,
        overallStatus: 'NEEDS_REVIEW',
        conclusionStatus: 'NEEDS_REVIEW',
        reason: 'LEGACY_EVALUATION_METADATA_MISSING',
        isOfficialConclusion: false,
        canExportOfficialReport: false,
        verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
        ruleSource: 'LEGACY_UNVERIFIED',
        ruleVersion: null,
        evaluationDate: null,
        metadataBackfillDate: backfillDate,
        unverifiedReasons: [
          ...(Array.isArray(details.unverifiedReasons) ? details.unverifiedReasons : []),
          'Kết quả cũ thiếu metadata truy xuất quy tắc; cần chạy đánh giá lại trước khi sử dụng.',
        ],
      };
      await client.query(
        `UPDATE qcvn_samples
         SET trang_thai_tong_quat = 'can_ra_soat',
             overall_status = 'NEEDS_REVIEW',
             evaluation_details = $1::jsonb,
             evaluated_rule_version = NULL,
             evaluated_verification_status = 'NEEDS_LEGAL_VERIFICATION'
         WHERE id = $2`,
        [JSON.stringify(nextDetails), sample.id]
      );
      samplesDowngraded++;
    }

    await client.query('COMMIT');
    process.stdout.write(JSON.stringify({ projectsUpdated, samplesDowngraded }) + '\n');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await db.pool.end();
  }
}

main().catch(error => {
  process.stderr.write(`Legacy evaluation backfill failed: ${error.message}\n`);
  process.exitCode = 1;
});
