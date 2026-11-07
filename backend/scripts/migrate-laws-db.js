require('dotenv').config({ path: 'D:/ĐATN/demo/backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  database: process.env.DB_NAME || 'etc_legalhub'
});

async function migrate() {
  console.log('=== BẮT ĐẦU CHUẨN HÓA DỮ LIỆU LAWS & HỆ THỐNG ===');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Sửa các số hiệu bị cắt cụt do Unicode
    console.log('\n1. Đang sửa các số hiệu văn bản bị cụt...');
    const fixList = [
      { id: 'nd_05_2025_nd_cp', so: '05/2025/NĐ-CP' },
      { id: 'nd_06_2022_nd_cp', so: '06/2022/NĐ-CP' },
      { id: 'nd_08_2022_nd_cp', so: '08/2022/NĐ-CP' },
      { id: 'nd_110_2026_nd_cp', so: '110/2026/NĐ-CP' },
      { id: 'nd_112_2026_nd_cp', so: '112/2026/NĐ-CP' },
      { id: 'nd_119_2025_nd_cp', so: '119/2025/NĐ-CP' },
      { id: 'nd_131_2025_nd_cp', so: '131/2025/NĐ-CP' },
      { id: 'nd_136_2025_nd_cp', so: '136/2025/NĐ-CP' },
      { id: 'nd_153_2024_nd_cp', so: '153/2024/NĐ-CP' },
      { id: 'nd_23_2026_nd_cp', so: '23/2026/NĐ-CP' },
      { id: 'nd_29_2026_nd_cp', so: '29/2026/NĐ-CP' },
      { id: 'nd_290_2025_nd_cp', so: '290/2025/NĐ-CP' },
      { id: 'nd_346_2025_nd_cp', so: '346/2025/NĐ-CP' },
      { id: 'nd_36_2020_nd_cp', so: '36/2020/NĐ-CP' },
      { id: 'nd_41_2021_nd_cp', so: '41/2021/NĐ-CP' },
      { id: 'nd_45_2022_nd_cp', so: '45/2022/NĐ-CP' },
      { id: 'nd_48_2026_nd_cp', so: '48/2026/NĐ-CP' },
      { id: 'nd_53_2020_nd_cp', so: '53/2020/NĐ-CP' },
      { id: 'nd_53_2024_nd_cp', so: '53/2024/NĐ-CP' },
      { id: 'nd_54_2024_nd_cp', so: '54/2024/NĐ-CP' },
      { id: 'nd_82_2017_nd_cp', so: '82/2017/NĐ-CP' },
      { id: 'nd_83_2026_nd_cp', so: '83/2026/NĐ-CP' },
      { id: 'qd_11_2025_qd_ttg', so: '11/2025/QĐ-TTg' },
      { id: 'qd_21_2025_qd_ttg', so: '21/2025/QĐ-TTg' },
      { id: 'qd_42_2026_qd_ttg', so: '42/2026/QĐ-TTg' }
    ];

    for (const item of fixList) {
      await client.query('UPDATE laws SET so = $1 WHERE id = $2', [item.so, item.id]);
    }
    console.log(`✔ Đã cập nhật chuẩn hóa số hiệu cho ${fixList.length} văn bản.`);

    // 2. Hợp nhất 20 cặp văn bản trùng lặp giữa Seed và Crawler
    console.log('\n2. Đang hợp nhất các cặp văn bản trùng lặp...');
    const duplicatePairs = [
      { canonicalId: 'nd_08_2022', duplicateId: 'nd_08_2022_nd_cp', status: 'amended' },
      { canonicalId: 'nd_05_2025', duplicateId: 'nd_05_2025_nd_cp', status: 'amended' },
      { canonicalId: 'nd_48_2026', duplicateId: 'nd_48_2026_nd_cp', status: 'valid' },
      { canonicalId: 'nd_110_2026', duplicateId: 'nd_110_2026_nd_cp', status: 'valid' },
      { canonicalId: 'nd_45_2022', duplicateId: 'nd_45_2022_nd_cp', status: 'amended' },
      { canonicalId: 'nd_53_2024', duplicateId: 'nd_53_2024_nd_cp', status: 'valid' },
      { canonicalId: 'nd_54_2024', duplicateId: 'nd_54_2024_nd_cp', status: 'valid' },
      { canonicalId: 'nd_290_2025', duplicateId: 'nd_290_2025_nd_cp', status: 'valid' },
      { canonicalId: 'nd_23_2026', duplicateId: 'nd_23_2026_nd_cp', status: 'valid' },
      { canonicalId: 'nd_82_2017', duplicateId: 'nd_82_2017_nd_cp', status: 'valid' },
      { canonicalId: 'tt_02_2022', duplicateId: 'tt_02_2022_tt_btnmt', status: 'amended' },
      { canonicalId: 'tt_09_2026', duplicateId: 'tt_09_2026_tt_bnnmt', status: 'valid' },
      { canonicalId: 'tt_10_2021', duplicateId: 'tt_10_2021_tt_btnmt', status: 'valid' },
      { canonicalId: 'tt_12_2021', duplicateId: 'tt_12_2021_tt_bnnptnt', status: 'valid' },
      { canonicalId: 'tt_27_2015', duplicateId: 'tt_27_2015_tt_btnmt', status: 'amended' },
      { canonicalId: 'tt_14_2025', duplicateId: 'tt_14_2025_tt_bnnmt', status: 'valid' },
      { canonicalId: 'tt_03_2024', duplicateId: 'tt_03_2024_tt_btnmt', status: 'valid' },
      { canonicalId: 'tt_04_2024', duplicateId: 'tt_04_2024_tt_btnmt', status: 'valid' },
      { canonicalId: 'tt_05_2024', duplicateId: 'tt_05_2024_tt_btnmt', status: 'valid' },
      { canonicalId: 'luat_146_2025', duplicateId: 'luat_146_2025_qh15', status: 'valid' }
    ];

    for (const pair of duplicatePairs) {
      // Lấy dữ liệu của cả 2
      const resC = await client.query('SELECT * FROM laws WHERE id = $1', [pair.canonicalId]);
      const resD = await client.query('SELECT * FROM laws WHERE id = $1', [pair.duplicateId]);

      if (resC.rowCount > 0 && resD.rowCount > 0) {
        const can = resC.rows[0];
        const dup = resD.rows[0];

        // Lấy điều khoản chi tiết từ bên có nội dung dài hơn
        const canDkLen = JSON.stringify(can.dieu_khoang || []).length;
        const dupDkLen = JSON.stringify(dup.dieu_khoang || []).length;
        const bestDieuKhoang = dupDkLen > canDkLen ? dup.dieu_khoang : can.dieu_khoang;
        const bestLink = dup.link || can.link;
        const bestMod = dup.last_crawled_mod || can.last_crawled_mod;

        // Cập nhật bản ghi canonical
        await client.query(
          `UPDATE laws 
           SET dieu_khoang = $1, link = $2, last_crawled_mod = $3, status = $4
           WHERE id = $5`,
          [JSON.stringify(bestDieuKhoang), bestLink, bestMod, pair.status, pair.canonicalId]
        );

        // Chuyển khóa ngoại trong law_update_history sang canonicalId
        await client.query(
          'UPDATE law_update_history SET law_id = $1 WHERE law_id = $2',
          [pair.canonicalId, pair.duplicateId]
        );

        // Chuyển khóa ngoại trong legal_appendices nếu có
        await client.query(
          'UPDATE legal_appendices SET law_id = $1 WHERE law_id = $2',
          [pair.canonicalId, pair.duplicateId]
        );

        // Xóa bản ghi duplicate thừa
        await client.query('DELETE FROM laws WHERE id = $1', [pair.duplicateId]);
        console.log(`  + Đã hợp nhất [${pair.duplicateId}] vào [${pair.canonicalId}] (status: ${pair.status})`);
      }
    }

    // 3. Chuẩn hóa mã status cho toàn bộ các bản ghi còn lại
    console.log('\n3. Đang chuẩn hóa status tiếng Việt sang valid...');
    const statusUpdateRes = await client.query(`
      UPDATE laws 
      SET status = 'valid' 
      WHERE status = 'Hiệu lực' OR status IS NULL OR status = ''
    `);
    console.log(`✔ Đã chuẩn hóa ${statusUpdateRes.rowCount} bản ghi sang status = 'valid'.`);

    // 4. Điền missing law_id trong bảng legal_appendices
    console.log('\n4. Đang cập nhật law_id trong bảng legal_appendices...');
    await client.query(`
      UPDATE legal_appendices SET law_id = 'nd_48_2026' WHERE id IN ('app_do_thi_0', 'app_do_thi_1');
      UPDATE legal_appendices SET law_id = 'luat_bvmt_2020' WHERE id IN ('app_do_thi_2', 'app_khai_thac_nuoc_2');
    `);
    console.log('✔ Đã điền đầy đủ law_id cho toàn bộ legal_appendices.');

    await client.query('COMMIT');
    console.log('\n=== MIGRATION THÀNH CÔNG RỰC RỠ! ===');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Lỗi migration:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
