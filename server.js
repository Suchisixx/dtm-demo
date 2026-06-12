const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

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

// Tuyến fallback: Trả về trang chủ cho bất kỳ request nào không khớp
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Chạy server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 ETC LegalHub server đang hoạt động tại:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`===================================================`);
});
