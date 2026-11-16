// backend/scripts/start-e2e-server.js
// Khởi chạy máy chủ Express phục vụ kiểm thử tự động đầu-cuối (Playwright E2E).
// Tự động kết nối PostgreSQL hoặc nạp bản chụp dữ liệu thực tế nếu chạy trong môi trường hộp cát.

const db = require('../config/db');
const { installSandboxDbFallbackIfNeeded } = require('./sandbox-db-adapter');

(async () => {
  await installSandboxDbFallbackIfNeeded(db);
  require('../server');
})();
