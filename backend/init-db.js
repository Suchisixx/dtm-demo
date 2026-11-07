const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'admin',
};

async function initDatabase() {
  console.log('--- Đang khởi tạo cơ sở dữ liệu PostgreSQL ---');
  
  // 1. Kết nối với database mặc định 'postgres' để kiểm tra và tạo database mới
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

  // 2. Kết nối trực tiếp vào database 'etc_legalhub' mới tạo
  const targetClient = new Client({
    ...dbConfig,
    database: process.env.DB_NAME || 'etc_legalhub',
  });

  try {
    await targetClient.connect();
    console.log('✔ Đã kết nối trực tiếp vào database ứng dụng.');

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
    // Backfill toạ độ từ form_data cho dữ liệu cũ
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

    // Migration: Liên kết mẫu quan trắc với dự án
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

    // Tạo bảng rules (Quy tắc Rule Engine)
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

    // Seed cấu hình tự động quét mặc định là true
    await targetClient.query(`
      INSERT INTO system_settings (key, value)
      VALUES ('auto_crawl_enabled', 'true')
      ON CONFLICT (key) DO NOTHING;
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

    // 3. Tạo tài khoản mẫu (Seed Users)
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

    // Helper to generate direct luatmoitruong.vn link
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

    // 4. Đồng bộ văn bản pháp lý từ laws.js vào database
    try {
      console.log('Đang đồng bộ văn bản pháp lý từ laws.js...');
      const lawsCode = fs.readFileSync(path.join(__dirname, 'public/assets/js/data/laws.js'), 'utf8');
      const sandbox = { window: {} };
      vm.createContext(sandbox);
      vm.runInContext(lawsCode, sandbox);
      const lawsList = sandbox.window.AppData.LAWS || [];

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
    } catch (e) {
      console.error('⚠️ Không thể đồng bộ laws.js:', e.message);
    }

    // 5. Đồng bộ QCVN từ qcvn-db.js vào database
    try {
      console.log('Đang đồng bộ QCVN từ qcvn-db.js...');
      const qcvnsCode = fs.readFileSync(path.join(__dirname, 'public/assets/js/data/qcvn-db.js'), 'utf8');
      const sandbox = { window: {} };
      vm.createContext(sandbox);
      vm.runInContext(qcvnsCode, sandbox);
      const qcvnsData = sandbox.window.AppData.QCVN_DATA || {};

      for (const id of Object.keys(qcvnsData)) {
        const qcvn = qcvnsData[id];
        const checkQcvn = await targetClient.query('SELECT 1 FROM qcvns WHERE id = $1', [id]);
        if (checkQcvn.rowCount === 0) {
          await targetClient.query(
            `INSERT INTO qcvns (id, ten, ap_dung, tham_so) 
             VALUES ($1, $2, $3, $4)`,
            [
              id,
              qcvn.ten,
              qcvn.ap_dung || null,
              JSON.stringify(qcvn.tham_so || [])
            ]
          );
        } else {
          await targetClient.query(
            `UPDATE qcvns 
             SET ten = $1, ap_dung = $2, tham_so = $3 
             WHERE id = $4`,
            [
              qcvn.ten,
              qcvn.ap_dung || null,
              JSON.stringify(qcvn.tham_so || []),
              id
            ]
          );
        }
      }
      console.log(`✔ Đã đồng bộ ${Object.keys(qcvnsData).length} quy chuẩn QCVN vào cơ sở dữ liệu.`);
    } catch (e) {
      console.error('⚠️ Không thể đồng bộ qcvn-db.js:', e.message);
    }

    // 6. Đồng bộ Ngành nghề & Ngưỡng phân loại từ classification-db.js vào database
    try {
      console.log('Đang đồng bộ Ngành nghề & Ngưỡng phân loại từ classification-db.js...');
      const classCode = fs.readFileSync(path.join(__dirname, 'public/assets/js/data/classification-db.js'), 'utf8');
      const sandbox = { window: {} };
      vm.createContext(sandbox);
      vm.runInContext(classCode, sandbox);
      
      const indDb = sandbox.window.AppData.IND_DB || {};
      
      // Xóa dữ liệu cũ trong các bảng phân loại để tránh xung đột khoá ngoại hoặc trùng lặp khi chạy lại
      await targetClient.query('TRUNCATE TABLE classification_thresholds CASCADE');
      await targetClient.query('TRUNCATE TABLE legal_appendices CASCADE');
      await targetClient.query('TRUNCATE TABLE industries CASCADE');

      for (const code of Object.keys(indDb)) {
        const industry = indDb[code];
        
        // Trích xuất tên sạch (bỏ phần đơn vị trong ngoặc đơn)
        // Ví dụ: "Chế biến thực phẩm, đồ uống (tấn/năm)" -> "Chế biến thực phẩm, đồ uống"
        const cleanName = industry.lbl.replace(/\s*\(.*\)\s*$/, '').trim();
        
        // Thêm vào bảng industries
        await targetClient.query(
          `INSERT INTO industries (code, name, risk_level) 
           VALUES ($1, $2, $3)`,
          [code, cleanName, 'medium'] // mặc định risk_level trung bình
        );
        
        // Duyệt các tier để thêm vào appendices và thresholds
        const tiers = industry.t || [];
        for (let i = 0; i < tiers.length; i++) {
          const tier = tiers[i];
          
          // Tạo một ID cho appendix (ví dụ: app_thuc_pham_0)
          const appendixId = `app_${code}_${i}`;
          
          // Trích xuất thông tin phụ lục
          // ví dụ phu_luc: "Phụ lục III, Mục 11"
          const plParts = (tier.phu_luc || '').split(',');
          const appendixName = plParts[0] ? plParts[0].trim() : 'Phụ lục không tên';
          const itemNumber = plParts[1] ? plParts[1].trim() : '';
          
          // Ánh xạ sang ID văn bản
          // ví dụ ref: "NĐ 08/2022 (VBHN 49/2026)"
          let lawId = null;
          if (tier.ref) {
            if (tier.ref.includes('08/2022') || tier.ref.includes('49/2026')) {
              lawId = 'nd_08_2022';
            } else if (tier.ref.includes('2020')) {
              lawId = 'luat_bvmt_2020';
            }
          }
          
          // Lưu vào bảng legal_appendices
          await targetClient.query(
            `INSERT INTO legal_appendices (id, law_id, appendix_name, item_number, content_summary) 
             VALUES ($1, $2, $3, $4, $5)`,
            [appendixId, lawId, appendixName, itemNumber, `Quy định quy mô công suất cho loại hình ${cleanName}`]
          );
          
          // Tính toán max_value (nếu là tier trước, max_value sẽ là min_value của tier trước đó)
          // Ví dụ: tier 0: min 100000 -> max null
          //        tier 1: min 20000 -> max 100000 (min của tier 0)
          //        tier 2: min 1000 -> max 20000 (min của tier 1)
          let maxValue = null;
          if (i > 0) {
            maxValue = tiers[i - 1].min;
          }
          
          // Trích xuất đơn vị từ lbl
          // Ví dụ: "Chế biến thực phẩm, đồ uống (tấn/năm)" -> "tấn/năm"
          const unitMatch = industry.lbl.match(/\((.*)\)/);
          const unit = unitMatch ? unitMatch[1] : '';
          
          const groupMap = {
            'DTM': 'Nhóm II',
            'GPMT': 'Nhóm III',
            'DKMT': 'Nhóm IV'
          };
          // Nếu min_value >= 100.000 (hoặc tier đầu tiên và là DTM) và thẩm quyền cấp bộ, có thể là Nhóm I
          let projectGroup = groupMap[tier.hs] || 'Nhóm III';
          if (tier.hs === 'DTM' && tier.tq === 'cap_bo') {
            projectGroup = 'Nhóm I';
          }
          
          // Lưu vào bảng classification_thresholds
          await targetClient.query(
            `INSERT INTO classification_thresholds (industry_code, min_value, max_value, unit, project_group, legal_doc_required, appendix_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [code, tier.min, maxValue, unit, projectGroup, tier.hs, appendixId]
          );
        }
      }
      console.log(`✔ Đã đồng bộ toàn bộ ngành nghề và ngưỡng phân loại vào cơ sở dữ liệu.`);
    } catch (e) {
      console.error('⚠️ Không thể đồng bộ ngành nghề từ classification-db.js:', e.message);
    }

    // 7. Đồng bộ Quy tắc mẫu của Rule Engine vào database
    try {
      console.log('Đang đồng bộ Quy tắc mẫu của Rule Engine...');
      const sampleRules = [
        {
          id: 'rule_project_classification',
          name: 'Quy tắc phân loại dự án môi trường',
          type: 'classification',
          expression: JSON.stringify({
            name: 'Project Classification Cây quyết định',
            description: 'Phân loại dự án dựa trên công suất ngành, cờ nhạy cảm, nước thải và khí thải',
            logic: {
              step1: 'Kiểm tra cờ nhạy cảm (rung, lua, bg, bao_ton). Nếu true -> Nhóm I (DTM Bộ)',
              step2: 'Tìm tier công suất trong bảng classification_thresholds dựa trên industry_code và capacity',
              step3: 'Kiểm tra lưu lượng nước thải. Nếu >= 1000m3 -> nâng lên ĐTM cấp Sở (Nhóm II)',
              step4: 'Kiểm tra lưu lượng khí thải. Nếu >= 20000m3/h -> nâng lên GPMT cấp Sở; >= 200000m3/h -> nâng lên ĐTM cấp Sở',
              step5: 'Kiểm tra cờ kcn. Nếu true và DTM -> hạ xuống GPMT cấp Sở'
            }
          })
        },
        {
          id: 'rule_qcvn_monitoring_check',
          name: 'Quy tắc đối chiếu thông số quan trắc QCVN',
          type: 'monitoring',
          expression: JSON.stringify({
            name: 'QCVN Monitoring Đối chiếu thông số',
            description: 'Đối chiếu thông số đo đạc với giới hạn cho phép trong QCVN',
            logic: {
              max: 'Đạt khi giá trị đo <= giới hạn',
              min: 'Đạt khi giá trị đo >= giới hạn',
              range: 'Đạt khi giới hạn dưới <= giá trị đo <= giới hạn trên'
            }
          })
        }
      ];

      for (const r of sampleRules) {
        const checkRule = await targetClient.query('SELECT 1 FROM rules WHERE id = $1', [r.id]);
        if (checkRule.rowCount === 0) {
          await targetClient.query(
            `INSERT INTO rules (id, rule_name, rule_type, expression, version) 
             VALUES ($1, $2, $3, $4, 1)`,
            [r.id, r.name, r.type, r.expression]
          );
          
          // Ghi phiên bản đầu tiên
          await targetClient.query(
            `INSERT INTO rule_versions (rule_id, version, expression, changed_by, change_reason) 
             VALUES ($1, 1, $2, (SELECT id FROM users WHERE username = 'admin' LIMIT 1), 'Phiên bản khởi tạo hệ thống')`,
            [r.id, r.expression]
          );
          console.log(`  + Đã tạo quy tắc: ${r.id}`);
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
