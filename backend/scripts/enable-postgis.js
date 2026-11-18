// backend/scripts/enable-postgis.js
// Kiểm tra extension PostGIS trên PostgreSQL, bật PostGIS, tạo cột geometry & chỉ mục GiST,
// và đồng bộ dữ liệu đa giác GeoJSON mẫu vào bảng lop_ban_do.

const db = require('../config/db');
const {
  ensureGisSchema,
  seedGisLayers,
} = require('../services/project-verification-repository');
const {
  VIETNAM_SENSITIVE_ZONES,
  VIETNAM_INDUSTRIAL_PARKS,
} = require('../services/spatial-gis-service');

async function main() {
  const verRes = await db.query('SELECT version() AS ver');
  console.log('PostgreSQL:', verRes.rows[0]?.ver);

  const availRes = await db.query(
    "SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name LIKE '%postgis%' ORDER BY name"
  );
  if (availRes.rowCount === 0) {
    console.error('❌ Máy chủ PostgreSQL hiện tại CHƯA cài gói phần mở rộng PostGIS.');
    console.error('👉 Vui lòng mở Application Stack Builder (PostgreSQL 16) -> Spatial Extensions -> Cài đặt "PostGIS Bundle for PostgreSQL 16 (64-bit)", sau đó chạy lại lệnh này.');
    process.exitCode = 1;
    await db.pool.end();
    return;
  }

  console.log('✔ Tìm thấy gói PostGIS khả dụng:', availRes.rows);

  const schemaStatus = await ensureGisSchema(db);
  console.log('✔ Trạng thái ensureGisSchema:', schemaStatus);

  const seedStats = await seedGisLayers(db, {
    sensitiveZones: VIETNAM_SENSITIVE_ZONES,
    industrialParks: VIETNAM_INDUSTRIAL_PARKS,
    force: false,
  });
  console.log('✔ Đồng bộ dữ liệu lop_ban_do (bao gồm GeoJSON Polygon):', seedStats);

  // Backfill lại hinh_hoc_khong_gian cho các dòng vừa được cập nhật hinh_hoc
  await db.query(`
    UPDATE lop_ban_do
    SET hinh_hoc_khong_gian = legalhub_geojson_polygon(hinh_hoc)
    WHERE hinh_hoc IS NOT NULL
      AND (hinh_hoc_khong_gian IS NULL OR GeometryType(hinh_hoc_khong_gian) NOT IN ('POLYGON', 'MULTIPOLYGON'))
  `);

  const statsRes = await db.query(`
    SELECT
      COUNT(*)::int AS total_layers,
      COUNT(*) FILTER (WHERE GeometryType(hinh_hoc_khong_gian) IN ('POLYGON', 'MULTIPOLYGON'))::int AS polygon_layers,
      COUNT(*) FILTER (WHERE GeometryType(hinh_hoc_khong_gian) = 'POINT')::int AS point_layers
    FROM lop_ban_do
  `);
  console.log('✔ Thống kê hình học PostGIS trong lop_ban_do:', statsRes.rows[0]);

  const extRes = await db.query("SELECT extname, extversion FROM pg_extension WHERE extname LIKE 'postgis%'");
  console.log('✔ Extension đang bật:', extRes.rows);

  await db.pool.end();
}

main().catch(async (err) => {
  console.error('❌ Lỗi khi kích hoạt PostGIS:', err.message);
  try { await db.pool.end(); } catch {}
  process.exit(1);
});
