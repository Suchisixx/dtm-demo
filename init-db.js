const { Client } = require('pg');
const bcrypt = require('bcryptjs');
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
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await targetClient.query(createUsersTable);
    console.log('✔ Bảng "users" đã sẵn sàng.');

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

    // 3. Tạo tài khoản mẫu (Seed Users)
    const seedUsers = [
      { username: 'admin', password: 'admin123', fullName: 'Người quản trị' },
      { username: 'staff1', password: 'staff123', fullName: 'Nhân viên 1' },
      { username: 'staff2', password: 'staff223', fullName: 'Nhân viên 2' }
    ];

    console.log('Đang đồng bộ tài khoản mẫu...');
    for (const u of seedUsers) {
      const checkUser = await targetClient.query('SELECT 1 FROM users WHERE username = $1', [u.username]);
      if (checkUser.rowCount === 0) {
        const hashedPw = await bcrypt.hash(u.password, 10);
        await targetClient.query(
          'INSERT INTO users (username, password, full_name) VALUES ($1, $2, $3)',
          [u.username, hashedPw, u.fullName]
        );
        console.log(`  + Đã tạo tài khoản: ${u.username} (${u.fullName})`);
      } else {
        console.log(`  - Tài khoản '${u.username}' đã có sẵn.`);
      }
    }
    console.log('✔ Đã đồng bộ toàn bộ tài khoản mẫu thành công.');
    console.log('--- KHỞI TẠO HOÀN TẤT ---');
  } catch (error) {
    console.error('❌ Lỗi khởi tạo bảng hoặc tài khoản:', error.message);
  } finally {
    await targetClient.end();
  }
}

initDatabase();
