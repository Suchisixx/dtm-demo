const cheerio = require('cheerio');
const db = require('../config/db');
const logger = require('./logger');
const { syncCrawlerEvents } = require('../services/crawler-sync-service');

// Khóa không cho nhiều phiên thu thập dữ liệu chạy chồng nhau
let isCrawlerRunning = false;

function getCrawlerRunningState() {
  return isCrawlerRunning;
}

// Hàm hỗ trợ tải trang có giới hạn thời gian và chuỗi User-Agent nhận diện
async function fetchWithTimeout(url, timeoutMs = 15000) {
  return fetch(url, {
    headers: {
      'User-Agent': 'ETC-LegalHub-Crawler/2.0 (Environmental Regulatory Sync Engine)'
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
}

// Chuẩn hóa slug thành mã văn bản dùng trong cơ sở dữ liệu
function getLawIdFromSlug(slug) {
  let id = slug.toLowerCase()
    .replace(/^nghi-dinh-/, 'nd_')
    .replace(/^thong-tu-/, 'tt_')
    .replace(/^luat-/, 'luat_')
    .replace(/^qcvn-/, 'qcvn_')
    .replace(/^van-ban-hop-nhat-/, 'vbhn_')
    .replace(/^quyet-dinh-/, 'qd_')
    .replace(/^nghi-quyet-/, 'nq_')
    .replace(/-/g, '_');

  // Loại bỏ hậu tố thừa để ánh xạ về mã định danh chuẩn
  id = id.replace(/_(nd_cp|tt_btnmt|tt_bnnmt|qh15|tt_bnnptnt)$/, '');
  return id;
}

// Chuẩn hóa loại văn bản
function getLawTypeFromSlug(slug) {
  if (slug.startsWith('nghi-dinh-')) return 'nd';
  if (slug.startsWith('thong-tu-')) return 'tt';
  if (slug.startsWith('luat-')) return 'luat';
  if (slug.startsWith('qcvn-')) return 'qcvn';
  if (slug.startsWith('van-ban-hop-nhat-')) return 'vbhn';
  if (slug.startsWith('quyet-dinh-')) return 'qd';
  if (slug.startsWith('nghi-quyet-')) return 'nq';
  return 'luat';
}

function cleanProvisionText(raw, docTitle = '', provisionTitle = '') {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw.trim();

  // 1. Loại bỏ các chuỗi rác tiếng Anh đầu trang sinh ra từ trang tài liệu
  text = text.replace(/For the complete documentation index, see llms\.txt\.\s*/gi, '');
  text = text.replace(/This page is also available as Markdown\.\s*/gi, '');
  text = text.replace(/CopyOn this page\s*/gi, '');
  text = text.replace(/On this page\s*/gi, '');

  // 2. Loại bỏ thanh điều hướng Trước/Sau và ngày cập nhật ở cuối trang
  text = text.replace(/Previous[\s\S]*?Next[\s\S]*?(Last updated.*ago)?$/i, '');
  text = text.replace(/Previous\s*.*Next\s*.*$/i, '');
  text = text.replace(/Last updated\s+[0-9]+\s+[a-z\s]+ago\s*$/i, '');

  // 3. Loại bỏ đường dẫn điều hướng dính liền tiêu đề ở đầu trang
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

// 1. Tải sơ đồ trang và lấy địa chỉ trang cùng ngày sửa đổi gần nhất
async function fetchAndParseSitemap() {
  logger.info('Đang tải sitemap từ luatmoitruong.vn...');
  const response = await fetchWithTimeout('https://www.luatmoitruong.vn/sitemap-pages.xml', 15000);
  if (!response.ok) {
    throw new Error(`Không thể tải sitemap-pages.xml. HTTP Status: ${response.status}`);
  }
  const xmlText = await response.text();

  const urlRegex = /<url>([\s\S]*?)<\/url>/g;
  let match;
  const entries = [];

  while ((match = urlRegex.exec(xmlText)) !== null) {
    const block = match[1];
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
    if (locMatch) {
      entries.push({
        loc: locMatch[1].trim(),
        lastmod: lastmodMatch ? lastmodMatch[1].trim() : null
      });
    }
  }

  logger.info(`Đã phân tích sitemap: Tìm thấy tổng cộng ${entries.length} URLs.`);
  return entries;
}

// 2. Thu thập trang văn bản và kiểm tra hiệu lực trước khi phân tích các trang con
async function crawlDocument(mainUrl, subpageUrls = []) {
  logger.info(`Đang kiểm tra trang gốc: ${mainUrl}`);

  // A. Tải trang chính để lấy thông tin mô tả
  const mainRes = await fetchWithTimeout(mainUrl, 15000);
  if (!mainRes.ok) {
    throw new Error(`Lỗi khi tải trang gốc ${mainUrl}. HTTP ${mainRes.status}`);
  }
  const mainHtml = await mainRes.text();
  const $ = cheerio.load(mainHtml);

  const titleText = $('title').text() || '';
  const docTitle = titleText.split('|')[0].split(' - ')[0].trim();
  const metaDesc = $('meta[name="description"]').attr('content') || '';

  // Chỉ kiểm tra trạng thái hiệu lực ở vùng tiêu đề, meta description và 500 ký tự đầu của phần giới thiệu
  // nhằm tránh dương tính giả khi nội dung văn bản nhắc tới "Nghị định ... hết hiệu lực toàn bộ" ở Điều khoản thi hành
  const mainIntroText = ($('main').text() || $.text() || '').replace(/\s+/g, ' ').trim().slice(0, 500).toLowerCase();
  const metaText = metaDesc.toLowerCase();
  const titleLower = titleText.toLowerCase();

  const isExpired =
    titleLower.includes('hết hiệu lực') ||
    metaText.includes('hết hiệu lực toàn bộ') ||
    metaText.includes('đã hết hiệu lực') ||
    mainIntroText.includes('tình trạng: hết hiệu lực') ||
    mainIntroText.includes('trạng thái: hết hiệu lực') ||
    mainIntroText.includes('văn bản đã hết hiệu lực');

  if (isExpired) {
    logger.info(`[Crawler Notification] Phát hiện văn bản hết hiệu lực: "${docTitle}" (${mainUrl})`);
    return { isExpired: true, docTitle, mainUrl };
  }

  const urlObj = new URL(mainUrl);
  const slug = urlObj.pathname.split('/').filter(Boolean)[0];

  const type = getLawTypeFromSlug(slug);
  const id = getLawIdFromSlug(slug);

  let so = docTitle;
  let year = new Date().getFullYear();

  // Lấy số hiệu từ tiêu đề, ví dụ "48/2026/NĐ-CP"
  const soRegex = /([0-9]+(?:\.[0-9]+)?\/[0-9]{4}\/[A-Za-z0-9Đđ\u00C0-\u1EF9\/-]+)/i;
  const soMatch = docTitle.match(soRegex);
  if (id === 'luat_tai_nguyen_nuoc' || docTitle.includes('Tài nguyên nước')) {
    so = '28/2023/QH15';
    year = 2023;
  } else if (id === 'luat_bvmt_2020' || id === 'luat_bao_ve_moi_truong' || docTitle.includes('Bảo vệ môi trường 2020')) {
    so = '72/2020/QH14';
    year = 2020;
  } else if (soMatch) {
    so = soMatch[0].trim();
  } else {
    // Nếu không có số hiệu, thử phân tích slug
    const slugSo = slug.replace(/^(luat|nghi-dinh|thong-tu|quyet-dinh|qcvn|van-ban-hop-nhat|nghi-quyet)-/, '');
    const cleanSlugSo = slugSo.replace(/-/g, '/').toUpperCase();
    if (cleanSlugSo) {
      so = cleanSlugSo;
    }
  }

  // Lấy năm ban hành
  const yearMatch = docTitle.match(/\b(20[0-9]{2}|19[0-9]{2})\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }

  // B. Thu thập trang con để ghép các điều khoản, chỉ áp dụng với văn bản hợp lệ
  // Sử dụng { numeric: true } để sắp xếp tự nhiên: dieu-1, dieu-2, ..., dieu-10
  const clauses = [];
  const sortedSubpages = [...subpageUrls].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  for (const subUrl of sortedSubpages) {
    try {
      logger.info(`  -> Quét điều khoản con: ${subUrl}`);
      const subRes = await fetchWithTimeout(subUrl, 15000);
      if (!subRes.ok) continue;
      const subHtml = await subRes.text();
      const $sub = cheerio.load(subHtml);

      // Loại bỏ nội dung phụ: đường dẫn điều hướng, phân trang, thông báo máy đọc, mục lục
      $sub('.llms-txt, .vp-doc-footer, .pager, .pager-container, nav, .table-of-contents, .outline, footer, .breadcrumb').remove();

      const subTitle = $sub('h1').first().text().trim() || $sub('title').text().split('|')[0].trim();

      let subContent = $sub('main').text().trim();
      if (!subContent) {
        subContent = $sub('.markdown-section').text().trim() || $sub('article').text().trim();
      }

      const cleanContent = cleanProvisionText(
        subContent.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim(),
        docTitle,
        subTitle
      );

      if (subTitle && cleanContent) {
        clauses.push({
          tieu_de: subTitle,
          noi_dung: cleanContent
        });
      }

      await new Promise(resolve => setTimeout(resolve, 150));
    } catch (err) {
      logger.error(`Lỗi khi quét điều khoản con ${subUrl}:`, err.message);
    }
  }

  return {
    isExpired: false,
    id,
    type,
    year,
    so,
    ten: docTitle,
    hieuluc: 'Đang có hiệu lực',
    status: 'valid',
    mo_ta: metaDesc || `Quy định pháp lý về ${docTitle}`,
    dieu_khoang: clauses,
    link: mainUrl
  };
}

// 3. Tác vụ chính, tra cứu nhanh trong cơ sở dữ liệu để bỏ qua văn bản không đổi
async function runCrawler(updatedByUserId = null) {
  if (isCrawlerRunning) {
    throw new Error('CRAWLER_BUSY');
  }

  isCrawlerRunning = true;
  const startTime = Date.now();

  try {
    logger.info('--- Bắt đầu quy trình kiểm tra cập nhật văn bản (Tối ưu hóa tốc độ & Hiệu lực) ---');

    // A. Nạp văn bản hiện có từ cơ sở dữ liệu vào Map để tra cứu nhanh trong bộ nhớ
    const existingLawsRes = await db.query(
      'SELECT id, status, hieuluc, sort_date, last_crawled_mod FROM laws'
    );
    const lawMap = new Map();
    existingLawsRes.rows.forEach(r => lawMap.set(r.id, r));
    logger.info(`[Database Cache] Đã tải ${lawMap.size} văn bản hiện có trong cơ sở dữ liệu.`);

    const urls = await fetchAndParseSitemap();

    // B. Phân biệt địa chỉ văn bản chính với địa chỉ các trang con
    const mainDocs = [];
    const subPages = {};
    let totalSubPagesCount = 0;

    for (const entry of urls) {
      try {
        const urlObj = new URL(entry.loc);
        const segments = urlObj.pathname.split('/').filter(Boolean);
        if (segments.length === 0) continue;

        const firstSegment = segments[0];
        const isLegalPrefix = /^(luat|nghi-dinh|thong-tu|quyet-dinh|qcvn|van-ban-hop-nhat|nghi-quyet)-/.test(firstSegment);
        if (!isLegalPrefix) continue;

        if (segments.length === 1) {
          mainDocs.push(entry);
        } else {
          const parentSlug = firstSegment;
          if (!subPages[parentSlug]) {
            subPages[parentSlug] = [];
          }
          subPages[parentSlug].push(entry.loc);
          totalSubPagesCount++;
        }
      } catch (err) {
        // Bỏ qua địa chỉ không hợp lệ
      }
    }

    logger.info(`Đã lọc: Có ${mainDocs.length} tài liệu gốc và ${totalSubPagesCount} trang điều khoản con.`);

    let createdCount = 0;
    let updatedCount = 0;
    let expiredUpdatedCount = 0;
    let skippedExistingCount = 0;
    let skippedExpiredCount = 0;
    const crawlEvents = [];

    // C. Vòng lặp xử lý nhanh
    for (const doc of mainDocs) {
      try {
        const urlObj = new URL(doc.loc);
        const slug = urlObj.pathname.split('/').filter(Boolean)[0];
        const dbId = getLawIdFromSlug(slug);

        const existingRecord = lawMap.get(dbId);
        const existsInDb = Boolean(existingRecord);

        if (existsInDb) {
          const lastCrawledMod = existingRecord.last_crawled_mod;

          // Nếu văn bản đã có trong DB nhưng chưa có dấu thời gian last_crawled_mod, cập nhật dấu thời gian để đồng bộ cache
          if (!lastCrawledMod && doc.lastmod) {
            await db.query('UPDATE laws SET last_crawled_mod = $1 WHERE id = $2', [doc.lastmod, dbId]);
            existingRecord.last_crawled_mod = doc.lastmod;
          }

          // Nếu ngày sửa đổi trên sơ đồ trang trùng bộ nhớ đệm DB, bỏ qua bước tải nội dung
          if (doc.lastmod && existingRecord.last_crawled_mod === doc.lastmod) {
            skippedExistingCount++;
            continue;
          }
        }

        // Tài liệu mới hoặc có thay đổi nội dung trên sitemap
        logger.info(`Phát hiện tài liệu cần kiểm tra: ${doc.loc} (Mới: ${!existsInDb})`);

        const docData = await crawlDocument(doc.loc, subPages[slug] || []);

        // Xử lý khi văn bản được xác định là ĐÃ HẾT HIỆU LỰC
        if (docData.isExpired) {
          if (existsInDb && existingRecord.status !== 'expired') {
            await db.query(
              `UPDATE laws
               SET status = 'expired', hieuluc = 'Hết hiệu lực', last_crawled_mod = $1
               WHERE id = $2`,
              [doc.lastmod, dbId]
            );
            await db.query(
              `INSERT INTO law_update_history (law_id, action, updated_by, description)
               VALUES ($1, 'AUTO_CRAWL_EXPIRE', $2, $3)`,
              [dbId, updatedByUserId, `Tự động chuyển trạng thái Hết hiệu lực: ${docData.docTitle}`]
            );
            existingRecord.status = 'expired';
            existingRecord.last_crawled_mod = doc.lastmod;
            expiredUpdatedCount++;
            crawlEvents.push({
              lawId: dbId,
              lawTitle: docData.docTitle || existingRecord.ten || dbId,
              so: existingRecord.so || '',
              eventAction: 'AUTO_CRAWL_EXPIRE',
            });
            logger.info(`✔ Đã cập nhật trạng thái Hết hiệu lực cho văn bản: ${docData.docTitle}`);
          } else {
            skippedExpiredCount++;
          }
          continue;
        }

        const defaultSortDate = doc.lastmod
          ? doc.lastmod.slice(0, 10)
          : `${docData.year}-01-01`;

        if (!existsInDb) {
          // Thêm văn bản hợp lệ mới, kèm ngày sắp xếp đã chuẩn hóa
          await db.query(
            `INSERT INTO laws (id, type, year, sort_date, so, ten, hieuluc, status, mo_ta, dieu_khoang, link, last_crawled_mod)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              docData.id,
              docData.type,
              docData.year,
              defaultSortDate,
              docData.so,
              docData.ten,
              docData.hieuluc,
              docData.status,
              docData.mo_ta,
              JSON.stringify(docData.dieu_khoang),
              docData.link,
              doc.lastmod
            ]
          );

          await db.query(
            `INSERT INTO law_update_history (law_id, action, updated_by, description)
             VALUES ($1, 'AUTO_CRAWL_CREATE', $2, $3)`,
            [docData.id, updatedByUserId, `Tải tự động văn bản còn hiệu lực mới: ${docData.ten} (${docData.dieu_khoang.length} điều khoản)`]
          );

          createdCount++;
          crawlEvents.push({
            lawId: docData.id,
            lawTitle: docData.ten,
            so: docData.so,
            eventAction: 'AUTO_CRAWL_CREATE',
            docData,
          });
          lawMap.set(docData.id, {
            id: docData.id,
            status: docData.status,
            hieuluc: docData.hieuluc,
            sort_date: defaultSortDate,
            last_crawled_mod: doc.lastmod
          });
          logger.info(`✔ Đã tạo mới văn bản: ${docData.ten}`);
        } else {
          // Giữ nguyên ngày hiệu lực và ngày sắp xếp đã được quản trị viên chuẩn hóa
          const preservedHieuluc =
            existingRecord.hieuluc && existingRecord.hieuluc !== 'Đang có hiệu lực'
              ? existingRecord.hieuluc
              : docData.hieuluc;
          const preservedSortDate = existingRecord.sort_date || defaultSortDate;

          await db.query(
            `UPDATE laws 
             SET type = $1, year = $2, sort_date = $3, so = $4, ten = $5, hieuluc = $6, status = $7, mo_ta = $8, dieu_khoang = $9, link = $10, last_crawled_mod = $11
             WHERE id = $12`,
            [
              docData.type,
              docData.year,
              preservedSortDate,
              docData.so,
              docData.ten,
              preservedHieuluc,
              docData.status,
              docData.mo_ta,
              JSON.stringify(docData.dieu_khoang),
              docData.link,
              doc.lastmod,
              docData.id
            ]
          );

          await db.query(
            `INSERT INTO law_update_history (law_id, action, updated_by, description)
             VALUES ($1, 'AUTO_CRAWL_UPDATE', $2, $3)`,
            [docData.id, updatedByUserId, `Đồng bộ cập nhật nội dung văn bản: ${docData.ten} (${docData.dieu_khoang.length} điều khoản)`]
          );

          updatedCount++;
          crawlEvents.push({
            lawId: docData.id,
            lawTitle: docData.ten,
            so: docData.so,
            eventAction: 'AUTO_CRAWL_UPDATE',
            docData,
          });
          existingRecord.last_crawled_mod = doc.lastmod;
          logger.info(`✔ Đã cập nhật văn bản: ${docData.ten}`);
        }

        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        logger.error(`Lỗi khi xử lý tài liệu ${doc.loc}:`, err.message);
      }
    }

    let syncStats = { impactsCreated: 0, candidatesCreated: 0 };
    if (crawlEvents.length > 0) {
      try {
        syncStats = await syncCrawlerEvents(crawlEvents, { db });
        logger.info(
          `✔ Đồng bộ Crawler -> Rule Engine: ${syncStats.impactsCreated} cảnh báo tác động, ${syncStats.candidatesCreated} đề xuất PENDING_REVIEW.`
        );
      } catch (syncErr) {
        logger.warn('Không thể đồng bộ sự kiện crawler sang Rule Engine:', syncErr.message);
      }
    }

    const durationMs = Date.now() - startTime;
    const stats = {
      totalSitemapUrls: urls.length,
      totalMainDocs: mainDocs.length,
      totalSubPages: totalSubPagesCount,
      createdCount,
      updatedCount,
      expiredUpdatedCount,
      skippedExistingCount,
      skippedExpiredCount,
      impactsCreated: syncStats.impactsCreated,
      candidatesCreated: syncStats.candidatesCreated,
      durationMs,
      scannedAt: new Date().toISOString()
    };

    logger.info(
      `--- Hoàn tất quét (${durationMs}ms): Tạo mới ${createdCount}, Cập nhật ${updatedCount}, Chuyển hết HL ${expiredUpdatedCount}, Đã đồng bộ ${skippedExistingCount}, Bỏ qua hết HL ${skippedExpiredCount} ---`
    );
    return stats;
  } finally {
    isCrawlerRunning = false;
  }
}

module.exports = {
  runCrawler,
  getCrawlerRunningState
};
