require('dotenv').config({ path: 'D:/ĐATN/demo/backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  database: process.env.DB_NAME || 'etc_legalhub'
});

function cleanProvisionText(raw, docTitle = '', provisionTitle = '') {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw.trim();

  // 1. Loại bỏ các chuỗi rác tiếng Anh đầu trang sinh ra từ trang tài liệu
  text = text.replace(/For the complete documentation index, see llms\.txt\.\s*/gi, '');
  text = text.replace(/This page is also available as Markdown\.\s*/gi, '');
  text = text.replace(/CopyOn this page\s*/gi, '');
  text = text.replace(/On this page\s*/gi, '');

  // 2. Loại bỏ các thanh điều hướng Previous/Next và Last updated ở cuối trang
  text = text.replace(/Previous[\s\S]*?Next[\s\S]*?(Last updated.*ago)?$/i, '');
  text = text.replace(/Previous\s*.*Next\s*.*$/i, '');
  text = text.replace(/Last updated\s+[0-9]+\s+[a-z\s]+ago\s*$/i, '');

  // 3. Loại bỏ breadcrumbs dính liền tiêu đề ở đầu trang
  const docBase = docTitle.replace(/\s*—.*$/, '').replace(/\s*[0-9]{4}.*$/, '').trim();
  if (docBase && text.startsWith(docBase)) {
    text = text.slice(docBase.length).trim();
  }
  if (docTitle && text.startsWith(docTitle.trim())) {
    text = text.slice(docTitle.trim().length).trim();
  }

  // Loại bỏ tên chương lặp lại trước Điều (ví dụ: "Chương I. NHỮNG QUY ĐỊNH CHUNGĐiều 1...")
  const chapMatch = text.match(/^(Chương\s+[IVXLCDM0-9]+[^\n.]*\.?\s*[A-ZÀ-Ỵ\s,]+)(?=Điều|\d+\.)/);
  if (chapMatch) {
    text = text.slice(chapMatch[0].length).trim();
  }

  // Loại bỏ tiêu đề điều khoản nếu lặp lại ngay đầu nội dung
  if (provisionTitle && text.startsWith(provisionTitle.trim())) {
    text = text.slice(provisionTitle.trim().length).trim();
  }

  // Loại bỏ các khoảng trắng dư thừa liên tiếp
  text = text.replace(/[ \t]+/g, ' ').trim();
  return text;
}

async function runClean() {
  console.log('=== BẮT ĐẦU QUY TRÌNH LÀM SẠCH VĂN BẢN VÀ BREADCRUMBS ===');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const allLaws = await client.query('SELECT id, ten, dieu_khoang FROM laws');
    let cleanedCount = 0;

    for (const law of allLaws.rows) {
      let isModified = false;
      const rawDk = law.dieu_khoang;

      if (Array.isArray(rawDk) && rawDk.length > 0) {
        const cleanedDk = rawDk.map(item => {
          if (typeof item === 'object' && item !== null) {
            const rawContent = item.noi_dung || '';
            const cleanedContent = cleanProvisionText(rawContent, law.ten, item.tieu_de);
            if (cleanedContent !== rawContent) {
              isModified = true;
            }
            return {
              ...item,
              noi_dung: cleanedContent
            };
          }
          return item;
        });

        if (isModified) {
          await client.query(
            'UPDATE laws SET dieu_khoang = $1 WHERE id = $2',
            [JSON.stringify(cleanedDk), law.id]
          );
          cleanedCount++;
        }
      }
    }
    console.log(`✔ Đã làm sạch hoàn toàn breadcrumbs cho ${cleanedCount} văn bản.`);

    await client.query('COMMIT');
    console.log('=== LÀM SẠCH HOÀN TẤT THÀNH CÔNG! ===');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Lỗi khi làm sạch dữ liệu:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runClean();
