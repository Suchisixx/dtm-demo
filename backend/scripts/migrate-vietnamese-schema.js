const fs = require('fs/promises');
const path = require('path');
const db = require('../config/db');
const { TABLES, migrateVietnameseSchema } = require('../services/vietnamese-schema');

async function createSnapshot() {
  const client = await db.pool.connect();
  const entries = {};
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    for (const [legacyName, spec] of Object.entries(TABLES)) {
      const kind = await client.query(
        `SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = $1`, [legacyName]
      );
      if (!['r', 'p'].includes(kind.rows[0]?.relkind)) {
        throw new Error(`BACKUP_SOURCE_NOT_FOUND:${legacyName}`);
      }
      const [columns, rows] = await Promise.all([
        client.query(
          `SELECT column_name, data_type, udt_name, is_nullable, column_default
           FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [legacyName]
        ),
        client.query(`SELECT to_jsonb(t) AS row FROM public.${legacyName} t`),
      ]);
      entries[legacyName] = { targetName: spec.table, columns: columns.rows, rows: rows.rows.map(item => item.row) };
    }

    await client.query('COMMIT');
    const dir = path.join(__dirname, '..', 'backups', 'schema-rename');
    await fs.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const file = path.join(dir, `postgres-before-vietnamese-schema-${stamp}.json`);
    await fs.writeFile(file, JSON.stringify({ createdAt: new Date().toISOString(), database: process.env.DB_NAME || 'etc_legalhub', tables: entries }, null, 2), { flag: 'wx' });
    return file;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    const backupFile = await createSnapshot();
    process.stdout.write(`Backup created: ${backupFile}\n`);
    const result = await migrateVietnameseSchema(db);
    process.stdout.write(`Schema migration complete: ${result.tablesRenamed} physical tables renamed; legacy compatibility views created.\n`);
  } finally {
    await db.pool.end();
  }
}

main().catch(error => {
  process.stderr.write(`Vietnamese schema migration failed: ${error.message}\n`);
  process.exitCode = 1;
});
