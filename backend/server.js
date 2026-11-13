const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const logger = require('./utils/logger');
const scheduler = require('./utils/scheduler');
const { ensureRuntimeDatabaseReady } = require('./services/db-bootstrap');

const app = express();
const PORT = process.env.PORT || 5000;

// Cấu hình các lớp xử lý trung gian cơ bản
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Phục vụ các file tĩnh trong thư mục 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Đăng ký các tuyến API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/classification', require('./routes/classification'));
app.use('/api/industries', (req, res, next) => {
  req.url = '/industries' + (req.url === '/' ? '' : req.url);
  return require('./routes/classification')(req, res, next);
});
app.use('/api/admin/rules', require('./routes/admin-rules'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/laws', require('./routes/laws'));
app.use('/api/qcvns', require('./routes/qcvns'));
app.use('/api/crawler', require('./routes/crawler'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reminders', require('./routes/reminders'));

// Tuyến dự phòng: trả về trang chủ khi địa chỉ không khớp tuyến nào
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Đồng bộ schema cộng thêm an toàn trước khi mở cổng phục vụ
async function startServer() {
  try {
    await ensureRuntimeDatabaseReady();
  } catch (err) {
    logger.error('Lỗi khởi tạo schema runtime:', err.message);
  }

  // Khởi chạy scheduler kiểm tra luật tự động hàng tháng
  scheduler.init();

  app.listen(PORT, () => {
    logger.info(`Máy chủ LegalHub đang hoạt động tại: http://localhost:${PORT}`);
  });
}

startServer();
