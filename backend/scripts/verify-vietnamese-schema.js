const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { TABLES } = require('../services/vietnamese-schema');
const { loadClassificationCatalog, loadQcvnCatalog, loadGisLayers } = require('../services/rule-repository');
const { ensureRuntimeDatabaseReady } = require('../services/db-bootstrap');

async function main() {
  const backupPath = process.argv[2];
  if (!backupPath || !fs.existsSync(backupPath)) throw new Error('BACKUP_FILE_REQUIRED');
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const rowCountMismatches = [];
  for (const [legacyName, spec] of Object.entries(TABLES)) {
    const result = await db.query(`SELECT count(*)::int AS count FROM public.${spec.table}`);
    const expected = backup.tables[legacyName]?.rows?.length;
    if (result.rows[0].count !== expected) rowCountMismatches.push({ table: legacyName, before: expected, after: result.rows[0].count });
  }

  const inventory = await db.query(
    `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public'`
  );
  const columnInventory = await db.query(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`
  );
  const physicalTables = new Set(Object.values(TABLES).map(item => item.table));
  const legacyViews = new Set(Object.keys(TABLES));
  const expectedRelationCount = Object.keys(TABLES).length;
  const physicalTableCount = inventory.rows.filter(row => row.table_type === 'BASE TABLE' && physicalTables.has(row.table_name)).length;
  const compatibilityViewCount = inventory.rows.filter(row => row.table_type === 'VIEW' && legacyViews.has(row.table_name)).length;
  const unmappedColumns = [];
  for (const [legacyName, spec] of Object.entries(TABLES)) {
    const translatedColumns = new Set(Object.values(spec.columns));
    for (const row of columnInventory.rows) {
      if (row.table_name === spec.table && !translatedColumns.has(row.column_name)) {
        unmappedColumns.push(`${legacyName}.${row.column_name}`);
      }
    }
  }
  const foreignKeys = await db.query(
    `SELECT count(*)::int AS count FROM information_schema.table_constraints
     WHERE constraint_schema = 'public' AND constraint_type = 'FOREIGN KEY'`
  );
  const [classification, qcvn, gis] = await Promise.all([
    loadClassificationCatalog({ db }), loadQcvnCatalog({ db }), loadGisLayers({ db }),
  ]);
  const bootstrap = await ensureRuntimeDatabaseReady({ db, seedIfMissing: false });
  const summary = {
    physicalTableCount,
    compatibilityViewCount,
    foreignKeyCount: foreignKeys.rows[0].count,
    rowCountMismatches,
    unmappedColumns,
    classificationCatalogLoaded: classification.ok && Object.keys(classification.catalog || {}).length > 0,
    qcvnCatalogLoaded: qcvn.ok && Object.keys(qcvn.catalog || {}).length > 0,
    gisCatalogLoaded: gis.ok,
    runtimeBootstrapReady: bootstrap.ok,
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  if (physicalTableCount !== expectedRelationCount || compatibilityViewCount !== expectedRelationCount || rowCountMismatches.length || unmappedColumns.length || !summary.classificationCatalogLoaded || !summary.qcvnCatalogLoaded || !summary.runtimeBootstrapReady) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  process.stderr.write(`Vietnamese schema verification failed: ${error.message}\n`);
  process.exitCode = 1;
}).finally(() => db.pool.end());
