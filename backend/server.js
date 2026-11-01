const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const logger = require('./utils/logger');
const scheduler = require('./utils/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình Middleware cơ bản
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Phục vụ các file tĩnh trong thư mục 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Đăng ký các API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/classification', require('./routes/classification'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/laws', require('./routes/laws'));
app.use('/api/qcvns', require('./routes/qcvns'));
app.use('/api/crawler', require('./routes/crawler'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Khởi chạy scheduler kiểm tra luật tự động hàng tháng
scheduler.init();

// Tuyến fallback: Trả về trang chủ cho bất kỳ request nào không khớp
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Chạy server
app.listen(PORT, () => {
  logger.info(`ETC server đang hoạt động tại: http://localhost:${PORT}`);
});
