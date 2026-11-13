const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const {
  ensureClassificationSchema,
  ensureQcvnSchema,
  ensureSensitiveVerificationSchema,
  ensureGisSchema,
  ensureCrawlerSyncSchema,
  seedClassificationCatalog,
  seedQcvnCatalog,
  seedGisLayers,
} = require('./services/rule-repository');
const { migrateVietnameseSchema } = require('./services/vietnamese-schema');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'admin',
};

async function initDatabase() {
  console.log('--- Đang khởi tạo cơ sở dữ liệu PostgreSQL ---');
  
  // 1. Kết nối tới cơ sở dữ liệu mặc định 'postgres' để kiểm tra và tạo cơ sở dữ liệu ứng dụng
  const defaultClient = new Client({
    ...dbConfig,
    database: 'postgres',
  });

  try {
    await defaultClient.connect();
    console.log('✔ Đã kết nối với PostgreSQL instance.');
    
    const dbName = process.env.DB_NAME || 'etc_legalhub';
    const checkDbQuery = `SELECT 1 FROM pg_database WHERE datname = '${dbName}'`;
    const checkRes = await defaultClient.query(checkDbQuery);
    
    if (checkRes.rowCount === 0) {
      console.log(`Database '${dbName}' chưa tồn tại. Đang tạo mới...`);
      await defaultClient.query(`CREATE DATABASE ${dbName}`);
      console.log(`✔ Đã tạo database '${dbName}' thành công.`);
    } else {
      console.log(`Database '${dbName}' đã tồn tại.`);
    }
  } catch (error) {
    console.error('❌ Lỗi kết nối hoặc tạo database:', error.message);
    process.exit(1);
  } finally {
    await defaultClient.end();
  }

  // 2. Kết nối trực tiếp vào cơ sở dữ liệu ứng dụng vừa tạo
  const targetClient = new Client({
    ...dbConfig,
    database: process.env.DB_NAME || 'etc_legalhub',
  });

  try {
    await targetClient.connect();
    console.log('✔ Đã kết nối trực tiếp vào database ứng dụng.');

    const schemaState = await targetClient.query(
      `SELECT EXISTS (
         SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'nguoi_dung' AND c.relkind IN ('r', 'p')
       ) AS vietnamese_schema,
       EXISTS (
         SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relkind IN ('r', 'p')
       ) AS legacy_schema`
    );
    if (schemaState.rows?.[0]?.vietnamese_schema === true) {
      console.log('Schema tiếng Việt đã tồn tại; đồng bộ danh mục qua bootstrap runtime.');
      const { ensureRuntimeDatabaseReady } = require('./services/db-bootstrap');
      await ensureRuntimeDatabaseReady({ db: targetClient });
      return;
    }
    if (schemaState.rows?.[0]?.legacy_schema === true) {
      throw new Error('VIETNAMESE_SCHEMA_MIGRATION_REQUIRED: create a database backup, then run backend/scripts/migrate-vietnamese-schema.js');
    }

    // Tạo bảng users
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        reset_token_hash VARCHAR(255) NULL,
        reset_token_expires TIMESTAMP NULL,
        full_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) DEFAULT 'staff',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await targetClient.query(createUsersTable);
    console.log('✔ Bảng "users" đã sẵn sàng.');

    // Di cư cấu trúc bảng users (đổi tên cột password -> password_hash và thêm các cột khác nếu bảng đã tồn tại từ trước)
    const alterUsersTable = `
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password') THEN
          ALTER TABLE users RENAME COLUMN password TO password_hash;
        END IF;
      END $$;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(255) NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'staff';
      ALTER TABLE users DROP COLUMN IF EXISTS plain_password;
    `;
    await targetClient.query(alterUsersTable);
    console.log('✔ Cập nhật bảo mật và cấu trúc bảng "users" thành công.');

    // Tạo bảng projects
    const createProjectsTable = `
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        form_data JSONB NOT NULL,
        checklist_state JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await targetClient.query(createProjectsTable);
    console.log('✔ Bảng "projects" đã sẵn sàng.');

    // Thêm cột GIS cho bản đồ dự án
    await targetClient.query(`
      ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS latitude NUMERIC,
        ADD COLUMN IF NOT EXISTS longitude NUMERIC,
        ADD COLUMN IF NOT EXISTS dia_chi_hien_thi TEXT,
        ADD COLUMN IF NOT EXISTS quan_huyen TEXT,
        ADD COLUMN IF NOT EXISTS phuong_xa TEXT,
        ADD COLUMN IF NOT EXISTS classification_result JSONB;
    `);
    // Bổ sung tọa độ từ form_data cho dữ liệu cũ
    await targetClient.query(`
      UPDATE projects SET
        latitude = (form_data->>'latitude')::NUMERIC,
        longitude = (form_data->>'longitude')::NUMERIC
      WHERE form_data->>'latitude' IS NOT NULL
        AND form_data->>'longitude' IS NOT NULL
        AND latitude IS NULL;
    `);
    console.log('✔ Cập nhật cột GIS cho bảng "projects".');

    // Tạo bảng laws
    const createLawsTable = `
      CREATE TABLE IF NOT EXISTS laws (
        id VARCHAR(100) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        year INTEGER NOT NULL,
        sort_date VARCHAR(50),
        so VARCHAR(255) NOT NULL,
        ten TEXT NOT NULL,
        hieuluc VARCHAR(255),
        status VARCHAR(50),
        mo_ta TEXT,
        dieu_khoang JSONB DEFAULT '[]'::jsonb,
        note TEXT,
        link TEXT
      );
    `;
    await targetClient.query(createLawsTable);
    console.log('✔ Bảng "laws" đã sẵn sàng.');

    // Đảm bảo có cột last_crawled_mod để lưu vết sitemap modified date
    await targetClient.query(`
      ALTER TABLE laws ADD COLUMN IF NOT EXISTS last_crawled_mod VARCHAR(100) NULL;
    `);
    console.log('✔ Cập nhật cột "last_crawled_mod" cho bảng laws.');

    // Tạo bảng qcvns
    const createQcvnsTable = `
      CREATE TABLE IF NOT EXISTS qcvns (
        id VARCHAR(100) PRIMARY KEY,
        ten VARCHAR(255) NOT NULL,
        ap_dung TEXT,
        tham_so JSONB NOT NULL
      );
    `;
    await targetClient.query(createQcvnsTable);
    console.log('✔ Bảng "qcvns" đã sẵn sàng.');

    // Tạo bảng qcvn_samples để lưu kết quả quan trắc của người dùng
    const createQcvnSamplesTable = `
      CREATE TABLE IF NOT EXISTS qcvn_samples (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        sub_type VARCHAR(100) NOT NULL,
        values JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await targetClient.query(createQcvnSamplesTable);
    console.log('✔ Bảng "qcvn_samples" đã sẵn sàng.');

    // Bổ sung liên kết mẫu quan trắc với dự án
    await targetClient.query(`
      ALTER TABLE qcvn_samples
        ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS trang_thai_tong_quat VARCHAR(20);
    `);
    await targetClient.query(`
      CREATE INDEX IF NOT EXISTS idx_qcvn_samples_project_id ON qcvn_samples(project_id);
    `);
    console.log('✔ Cột "project_id" và "trang_thai_tong_quat" đã sẵn sàng trong bảng qcvn_samples.');

    // Tạo bảng industries (Ngành nghề)
    const createIndustriesTable = `
      CREATE TABLE IF NOT EXISTS industries (
        code VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        risk_level VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await targetClient.query(createIndustriesTable);
    console.log('✔ Bảng "industries" đã sẵn sàng.');

    // Tạo bảng legal_appendices (Phụ lục pháp lý)
    const createLegalAppendicesTable = `
      CREATE TABLE IF NOT EXISTS legal_appendices (
        id VARCHAR(100) PRIMARY KEY,
        law_id VARCHAR(100) REFERENCES laws(id) ON DELETE SET NULL,
        appendix_name VARCHAR(255),
        item_number VARCHAR(50),
        content_summary TEXT
      );
    `;
    await targetClient.query(createLegalAppendicesTable);
    console.log('✔ Bảng "legal_appendices" đã sẵn sàng.');

    // Tạo bảng classification_thresholds (Ngưỡng phân loại công suất)
    const createClassificationThresholdsTable = `
      CREATE TABLE IF NOT EXISTS classification_thresholds (
        id SERIAL PRIMARY KEY,
        industry_code VARCHAR(50) REFERENCES industries(code) ON DELETE CASCADE,
        min_value DECIMAL(15,2) NOT NULL,
        max_value DECIMAL(15,2),
        unit VARCHAR(50),
        project_group VARCHAR(10),
        legal_doc_required VARCHAR(20),
        appendix_id VARCHAR(100) REFERENCES legal_appendices(id) ON DELETE SET NULL
      );
    `;
    await targetClient.query(createClassificationThresholdsTable);
    console.log('✔ Bảng "classification_thresholds" đã sẵn sàng.');

    // Tạo bảng rules lưu định nghĩa quy tắc nghiệp vụ
    const createRulesTable = `
      CREATE TABLE IF NOT EXISTS rules (
        id VARCHAR(100) PRIMARY KEY,
        rule_name VARCHAR(255) NOT NULL,
        rule_type VARCHAR(50),
        expression TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        version INTEGER DEFAULT 1
      );
    `;
    await targetClient.query(createRulesTable);
    console.log('✔ Bảng "rules" đã sẵn sàng.');

    // Tạo bảng rule_versions (Các phiên bản của Quy tắc)
    const createRuleVersionsTable = `
      CREATE TABLE IF NOT EXISTS rule_versions (
        id SERIAL PRIMARY KEY,
        rule_id VARCHAR(100) REFERENCES rules(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        expression TEXT NOT NULL,
        changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        change_reason TEXT
      );
    `;
    await targetClient.query(createRuleVersionsTable);
    console.log('✔ Bảng "rule_versions" đã sẵn sàng.');

    // Tạo bảng law_update_history (Lịch sử cập nhật văn bản pháp lý)
    const createLawUpdateHistoryTable = `
      CREATE TABLE IF NOT EXISTS law_update_history (
        id SERIAL PRIMARY KEY,
        law_id VARCHAR(100),
        action VARCHAR(50) NOT NULL,
        updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        description TEXT
      );
    `;
    await targetClient.query(createLawUpdateHistoryTable);
    // Đảm bảo không bị ràng buộc ngoại khóa chặt chẽ khi xóa văn bản
    await targetClient.query('ALTER TABLE law_update_history DROP CONSTRAINT IF EXISTS law_update_history_law_id_fkey;');
    console.log('✔ Bảng "law_update_history" đã sẵn sàng.');

    // Tạo bảng system_settings để lưu trữ các thiết lập hệ thống như tự động quét crawler
    const createSystemSettingsTable = `
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL
      );
    `;
    await targetClient.query(createSystemSettingsTable);
    console.log('✔ Bảng "system_settings" đã sẵn sàng.');

    // Tạo cấu hình ban đầu cho tác vụ quét tự động
    await targetClient.query(`
      INSERT INTO system_settings (key, value)
      VALUES ('auto_crawl_enabled', 'false')
      ON CONFLICT (key) DO UPDATE SET value = 'false';
    `);
    console.log('✔ Cấu hình mặc định cho crawler đã được lưu.');

    // Tạo bảng query_logs (Nhật ký người dùng tra cứu phân loại)
    const createQueryLogsTable = `
      CREATE TABLE IF NOT EXISTS query_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        query_type VARCHAR(50) NOT NULL,
        input_params JSONB NOT NULL,
        output_result JSONB NOT NULL,
        queried_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await targetClient.query(createQueryLogsTable);
    console.log('✔ Bảng "query_logs" đã sẵn sàng.');

    // Tạo bảng audit_logs (Nhật ký giám sát hệ thống)
    const createAuditLogsTable = `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        ip_address VARCHAR(50),
        user_agent TEXT,
        payload JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await targetClient.query(createAuditLogsTable);
    console.log('✔ Bảng "audit_logs" đã sẵn sàng.');

    // 3. Tạo tài khoản mẫu
    const seedUsers = [
      { username: 'admin', password: 'admin123', fullName: 'Người quản trị', role: 'admin' },
      { username: 'staff1', password: 'staff123', fullName: 'Nhân viên 1', role: 'staff' },
      { username: 'staff2', password: 'staff223', fullName: 'Nhân viên 2', role: 'staff' }
    ];

    console.log('Đang đồng bộ tài khoản mẫu...');
    for (const u of seedUsers) {
      const checkUser = await targetClient.query('SELECT 1 FROM users WHERE username = $1', [u.username]);
      if (checkUser.rowCount === 0) {
        const hashedPw = await bcrypt.hash(u.password, 10);
        await targetClient.query(
          'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
          [u.username, hashedPw, u.fullName, u.role]
        );
        console.log(`  + Đã tạo tài khoản: ${u.username} (${u.fullName})`);
      } else {
        const hashedPw = await bcrypt.hash(u.password, 10);
        await targetClient.query(
          'UPDATE users SET role = $1, password_hash = $2 WHERE username = $3',
          [u.role, hashedPw, u.username]
        );
        console.log(`  * Đã cập nhật phân quyền tài khoản: ${u.username}`);
      }
    }
    console.log('✔ Đã đồng bộ toàn bộ tài khoản mẫu thành công.');

    // Hàm tạo liên kết trực tiếp đến luatmoitruong.vn
    function getDirectLawLink(law) {
      if (law.link && law.link.startsWith('https://www.luatmoitruong.vn/')) {
        return law.link;
      }
      
      const norm = (str) => {
        if (!str) return '';
        return str.normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[đĐ]/g, 'd')
          .toLowerCase();
      };

      const cleanNum = norm(law.so)
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      if (law.type === 'luat') {
        if (law.id.includes('bvmt')) return 'https://www.luatmoitruong.vn/luat-bao-ve-moi-truong';
        if (law.id.includes('dat_dai')) return 'https://thuvienphapluat.vn/van-ban/Bat-dong-san/Luat-Dat-dai-2024-31-2024-QH15-587104.aspx';
        if (law.id.includes('tainguyen_nuoc')) return 'https://www.luatmoitruong.vn/luat-tai-nguyen-nuoc';
        if (law.id.includes('dautu')) return 'https://thuvienphapluat.vn/van-ban/Doanh-nghiep/Luat-Dau-tu-so-61-2020-QH14-321051.aspx';
        return `https://www.luatmoitruong.vn/luat-${cleanNum}`;
      }
      
      if (law.type === 'nd') {
        return `https://www.luatmoitruong.vn/nghi-dinh-${cleanNum}`;
      }
      
      if (law.type === 'tt') {
        return `https://www.luatmoitruong.vn/thong-tu-${cleanNum}`;
      }
      
      if (law.type === 'qcvn') {
        let qSlug = cleanNum;
        if (!qSlug.startsWith('qcvn')) {
          qSlug = 'qcvn-' + qSlug;
        }
        return `https://www.luatmoitruong.vn/${qSlug}`;
      }
      
      if (law.type === 'vbhn') {
        return `https://www.luatmoitruong.vn/van-ban-hop-nhat-${cleanNum}`;
      }

      return `https://www.luatmoitruong.vn/${cleanNum}`;
    }

    // 4. Đồng bộ văn bản pháp lý từ dữ liệu nền (nếu có) vào cơ sở dữ liệu
    try {
      const lawsPath = path.join(__dirname, '../frontend/src/data/laws.js');
      if (fs.existsSync(lawsPath)) {
        console.log('Đang đồng bộ văn bản pháp lý từ frontend/src/data/laws.js...');
        const lawsCode = fs.readFileSync(lawsPath, 'utf8')
          .replace(/export\s+const\s+/g, 'const ') + '\n;globalThis.__LAWS__ = LAWS;';
        const sandbox = { globalThis: {} };
        vm.createContext(sandbox);
        vm.runInContext(lawsCode, sandbox);
        const lawsList = sandbox.globalThis.__LAWS__ || [];

        for (const law of lawsList) {
          const checkLaw = await targetClient.query('SELECT 1 FROM laws WHERE id = $1', [law.id]);
          const targetLink = getDirectLawLink(law);
          
          if (checkLaw.rowCount === 0) {
            await targetClient.query(
              `INSERT INTO laws (id, type, year, sort_date, so, ten, hieuluc, status, mo_ta, dieu_khoang, note, link) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [
                law.id,
                law.type,
                law.year,
                law.sortDate || null,
                law.so,
                law.ten,
                law.hieuluc || null,
                law.status || null,
                law.mo_ta || null,
                JSON.stringify(law.dieu_khoang || []),
                law.note || null,
                targetLink
              ]
            );
          } else {
            await targetClient.query(
              `UPDATE laws 
               SET type = $1, year = $2, sort_date = $3, so = $4, ten = $5, hieuluc = $6, status = $7, mo_ta = $8, dieu_khoang = $9, note = $10, link = $11 
               WHERE id = $12`,
              [
                law.type,
                law.year,
                law.sortDate || null,
                law.so,
                law.ten,
                law.hieuluc || null,
                law.status || null,
                law.mo_ta || null,
                JSON.stringify(law.dieu_khoang || []),
                law.note || null,
                targetLink,
                law.id
              ]
            );
          }
        }
        console.log(`✔ Đã đồng bộ ${lawsList.length} văn bản pháp lý vào cơ sở dữ liệu.`);
      } else {
        const lawCountRes = await targetClient.query('SELECT COUNT(*) AS count FROM laws');
        console.log(`✔ Bảng "laws" hiện có ${lawCountRes.rows[0].count} văn bản pháp lý trong cơ sở dữ liệu.`);
      }
    } catch (e) {
      console.error('⚠️ Không thể đồng bộ laws:', e.message);
    }

    const schemaOnly = process.argv.includes('--schema-only');
    const forceSeed = process.argv.includes('--force-seed');

    await ensureQcvnSchema(targetClient);
    await ensureClassificationSchema(targetClient);
    await ensureSensitiveVerificationSchema(targetClient);
    await ensureGisSchema(targetClient);
    await ensureCrawlerSyncSchema(targetClient);
    await migrateVietnameseSchema(targetClient);
    console.log('✔ Đã đổi tên schema PostgreSQL sang tiếng Việt và tạo lớp tương thích SQL.');
    console.log('✔ Đã kiểm tra và bổ sung các cột metadata pháp lý, xác minh nhạy cảm, GIS & crawler sync (migration an toàn, không xóa dữ liệu).');

    if (schemaOnly) {
      console.log('--- HOÀN TẤT MIGRATION SCHEMA (--schema-only) ---');
      return;
    }

    // 5. Bổ sung QCVN an toàn từ frontend/src/data/qcvn-db.js, không ghi đè dữ liệu đã VERIFIED/PUBLISHED
    try {
      console.log('Đang seed danh mục QCVN (idempotent, bảo toàn bản ghi VERIFIED)...');
      const { QCVN_DATA, QCVN_SCHEMA_VERSION } = require('../frontend/src/data/qcvn-db.js');
      const qcvnStats = await seedQcvnCatalog(targetClient, {
        qcvnData: QCVN_DATA || {},
        ruleVersion: QCVN_SCHEMA_VERSION || '2026.2-audit',
        force: forceSeed,
      });
      console.log(`✔ Seed QCVN hoàn tất: thêm mới ${qcvnStats.inserted}, bổ sung metadata ${qcvnStats.enriched}, giữ nguyên ${qcvnStats.skippedVerified} bản ghi đã duyệt.`);
    } catch (e) {
      console.error('⚠️ Không thể seed danh mục QCVN:', e.message);
    }

    // 6. Bổ sung ngành nghề và ngưỡng phân loại, gồm các quy tắc theo công đoạn; không TRUNCATE
    try {
      console.log('Đang seed Ngành nghề & Ngưỡng phân loại từ classification-service.js...');
      const { IND_DB: indDb, INDUSTRY_META, RULE_SCHEMA_VERSION } = require('./services/classification-service');
      const classStats = await seedClassificationCatalog(targetClient, {
        indDb: indDb || {},
        industryMeta: INDUSTRY_META || {},
        ruleVersion: RULE_SCHEMA_VERSION || '2026.2-audit',
        force: forceSeed,
      });
      console.log(`✔ Seed phân loại hoàn tất: thêm ${classStats.industriesInserted} ngành, cập nhật ${classStats.industriesEnriched}, chèn ${classStats.thresholdsInserted} ngưỡng (gồm processRules), giữ nguyên ${classStats.skippedVerified} nhóm ngưỡng đã duyệt.`);
    } catch (e) {
      console.error('⚠️ Không thể đồng bộ ngành nghề từ classification-service.js:', e.message);
    }

    // 6b. Bổ sung lớp GIS vùng nhạy cảm và KCN, bảo toàn bản ghi VERIFIED
    try {
      console.log('Đang seed lớp GIS nhạy cảm & KCN từ spatial-gis-service.js...');
      const { VIETNAM_SENSITIVE_ZONES, VIETNAM_INDUSTRIAL_PARKS } = require('./services/spatial-gis-service');
      const gisStats = await seedGisLayers(targetClient, {
        sensitiveZones: VIETNAM_SENSITIVE_ZONES || [],
        industrialParks: VIETNAM_INDUSTRIAL_PARKS || [],
        force: forceSeed,
      });
      console.log(`✔ Seed GIS hoàn tất: thêm mới ${gisStats.inserted}, cập nhật ${gisStats.updated}, giữ nguyên ${gisStats.skippedVerified} lớp đã duyệt.`);
    } catch (e) {
      console.error('⚠️ Không thể seed lớp GIS:', e.message);
    }

    // 7. Đồng bộ các quy tắc mẫu vào cơ sở dữ liệu (A01, A04, Q10)
    try {
      console.log('Đang đồng bộ Quy tắc mẫu của Rule Engine...');
      const sampleRules = [
        {
          id: 'rule_project_classification',
          name: 'Quy tắc phân loại dự án môi trường (Kiến trúc 3 bước sau kiểm toán)',
          type: 'classification',
          expression: JSON.stringify({
            name: 'Project Classification 3-Step Pipeline',
            version: '2026.2-audit',
            description: 'Tách độc lập 3 bước: (1) Nhóm dự án -> (2) Nghĩa vụ thủ tục môi trường -> (3) Chủ thể và cơ quan có thẩm quyền',
            logic: {
              step1: 'determineProjectGroup: Xác định Nhóm I, II, III, IV theo công suất ngành, công đoạn và điều kiện pháp lý của yếu tố nhạy cảm (không tự nâng từ boolean đơn thuần)',
              step2: 'determineEnvironmentalObligations: Xác định ĐTM, GPMT, ĐKMT, Miễn ĐKMT mà không làm sai lệch Nhóm dự án; không tự chuyển ĐTM sang GPMT chỉ vì nằm trong KCN',
              step3: 'determineCompetentAuthority: Tách Người có thẩm quyền, Cơ quan có thẩm quyền, Cơ quan tiếp nhận, Đơn vị chuyên môn theo mốc hiệu lực 01/07/2025'
            }
          })
        },
        {
          id: 'rule_qcvn_monitoring_check',
          name: 'Quy tắc đối chiếu thông số quan trắc QCVN & GPMT',
          type: 'monitoring',
          expression: JSON.stringify({
            name: 'QCVN Monitoring & Permit Limit Engine',
            version: '2026.2-audit',
            description: 'Đối chiếu thông số đo đạc với giới hạn QCVN và giới hạn trong GPMT, kiểm tra chu kỳ trung bình và tính đầy đủ của thông số bắt buộc',
            logic: {
              max: 'Đạt khi giá trị đo <= giới hạn (bao gồm trường hợp bằng giới hạn)',
              min: 'Đạt khi giá trị đo >= giới hạn',
              range: 'Đạt khi giới hạn dưới <= giá trị đo <= giới hạn trên',
              completeness: 'Trả INCOMPLETE (chua_du_thong_so) nếu thiếu chỉ tiêu bắt buộc; trả NEEDS_REVIEW (can_ra_soat) nếu thiếu nguồn tiếp nhận hoặc sai chu kỳ trung bình'
            }
          })
        }
      ];

      for (const r of sampleRules) {
        const checkRule = await targetClient.query('SELECT 1 FROM rules WHERE id = $1', [r.id]);
        if (checkRule.rowCount === 0) {
          await targetClient.query(
            `INSERT INTO rules (id, rule_name, rule_type, expression, version) 
             VALUES ($1, $2, $3, $4, 2)`,
            [r.id, r.name, r.type, r.expression]
          );
          await targetClient.query(
            `INSERT INTO rule_versions (rule_id, version, expression, changed_by, change_reason) 
             VALUES ($1, 2, $2, (SELECT id FROM users WHERE username = 'admin' LIMIT 1), 'Cập nhật kiến trúc sau kiểm toán pháp lý 2026.2')`,
            [r.id, r.expression]
          );
          console.log(`  + Đã tạo quy tắc: ${r.id}`);
        } else {
          await targetClient.query(
            `UPDATE rules SET rule_name = $1, expression = $2, version = 2 WHERE id = $3`,
            [r.name, r.expression, r.id]
          );
        }
      }
      console.log('✔ Đã đồng bộ các quy tắc Rule Engine mẫu thành công.');
    } catch (e) {
      console.error('⚠️ Không thể đồng bộ quy tắc mẫu:', e.message);
    }

    console.log('--- KHỞI TẠO HOÀN TẤT ---');
  } catch (error) {
    console.error('❌ Lỗi khởi tạo bảng hoặc tài khoản:', error.message);
  } finally {
    await targetClient.end();
  }
}

initDatabase();
