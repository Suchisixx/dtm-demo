const cheerio = require('cheerio');
const db = require('../config/db');
const logger = require('./logger');

// Helper to normalize slug into a standard database ID
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
  return id;
}

// Helper to normalize the document type
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

// 1. Fetch sitemap and extract page URLs and their last modified dates
async function fetchAndParseSitemap() {
  logger.info('Đang tải sitemap từ luatmoitruong.vn...');
  const response = await fetch('https://www.luatmoitruong.vn/sitemap-pages.xml');
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

// 2. Crawl a document page and check validity before parsing subpages
async function crawlDocument(mainUrl, subpageUrls = []) {
  logger.info(`Đang kiểm tra trang gốc: ${mainUrl}`);
  
  // A. Fetch main page for meta info
  const mainRes = await fetch(mainUrl);
  if (!mainRes.ok) {
    throw new Error(`Lỗi khi tải trang gốc ${mainUrl}. HTTP ${mainRes.status}`);
  }
  const mainHtml = await mainRes.text();
  const $ = cheerio.load(mainHtml);
  
  const titleText = $('title').text() || '';
  const docTitle = titleText.split('|')[0].split(' - ')[0].trim();
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  
  // Check Validity: If document is expired, log warning to console and skip
  const fullText = $.text().toLowerCase();
  const metaText = metaDesc.toLowerCase();
  const isExpired = fullText.includes('hết hiệu lực toàn bộ') || 
                    fullText.includes('đã hết hiệu lực') || 
                    metaText.includes('hết hiệu lực') ||
                    metaText.includes('đã hết hiệu lực');
                    
  if (isExpired) {
    logger.info(`[Crawler Notification] ⚠️ BỎ QUA VĂN BẢN HẾT HIỆU LỰC: "${docTitle}" (${mainUrl})`);
    return { isExpired: true, docTitle, mainUrl };
  }
  
  const urlObj = new URL(mainUrl);
  const slug = urlObj.pathname.split('/').filter(Boolean)[0];
  
  const type = getLawTypeFromSlug(slug);
  const id = getLawIdFromSlug(slug);
  
  let so = docTitle;
  let year = new Date().getFullYear();
  
  // Extract number from title, e.g. "48/2026/NĐ-CP"
  const soRegex = /([0-9]+(?:\.[0-9]+)?\/[0-9]{4}\/[A-Z0-9-]+)/i;
  const soMatch = docTitle.match(soRegex);
  if (soMatch) {
    so = soMatch[0].toUpperCase();
  } else {
    // Fallback: try parsing slug
    const slugSo = slug.replace(/^(luat|nghi-dinh|thong-tu|quyet-dinh|qcvn|van-ban-hop-nhat|nghi-quyet)-/, '');
    const cleanSlugSo = slugSo.replace(/-/g, '/').toUpperCase();
    if (cleanSlugSo) {
      so = cleanSlugSo;
    }
  }
  
  // Extract year
  const yearMatch = docTitle.match(/\b(20[0-9]{2}|19[0-9]{2})\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1]);
  }

  // B. Crawl subpages to compile clauses (only for valid documents)
  const clauses = [];
  const sortedSubpages = subpageUrls.sort((a, b) => a.localeCompare(b));
  
  for (const subUrl of sortedSubpages) {
    try {
      logger.info(`  -> Quét điều khoản con: ${subUrl}`);
      const subRes = await fetch(subUrl);
      if (!subRes.ok) continue;
      const subHtml = await subRes.text();
      const $sub = cheerio.load(subHtml);
      
      const subTitle = $sub('h1').first().text().trim() || $sub('title').text().split('|')[0].trim();
      
      let subContent = $sub('main').text().trim();
      if (!subContent) {
        subContent = $sub('.markdown-section').text().trim() || $sub('article').text().trim();
      }
      
      const cleanContent = subContent
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();
        
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

// 3. Main runner with fast DB lookup to skip existing unchanged documents
async function runCrawler(updatedByUserId = null) {
  logger.info('--- Bắt đầu quy trình kiểm tra cập nhật văn bản (Tối ưu hóa tốc độ & Hiệu lực) ---');
  
  // A. Load existing laws from DB into Map for instant memory lookup
  const existingLawsRes = await db.query('SELECT id, last_crawled_mod FROM laws');
  const lawMap = new Map();
  existingLawsRes.rows.forEach(r => lawMap.set(r.id, r.last_crawled_mod));
  logger.info(`[Database Cache] Đã tải ${lawMap.size} văn bản hiện có trong cơ sở dữ liệu.`);
  
  const urls = await fetchAndParseSitemap();
  
  // B. Filter parent document URLs vs subpages
  const mainDocs = [];
  const subPages = {};

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
      }
    } catch (err) {
      // Ignore invalid URLs
    }
  }

  logger.info(`Đã lọc: Có ${mainDocs.length} tài liệu gốc và ${Object.keys(subPages).length} nhóm trang con.`);

  let createdCount = 0;
  let updatedCount = 0;
  let skippedExistingCount = 0;
  let skippedExpiredCount = 0;

  // C. Fast Process loop
  for (const doc of mainDocs) {
    try {
      const urlObj = new URL(doc.loc);
      const slug = urlObj.pathname.split('/').filter(Boolean)[0];
      const dbId = getLawIdFromSlug(slug);

      const existsInDb = lawMap.has(dbId);

      if (existsInDb) {
        const lastCrawledMod = lawMap.get(dbId);
        
        // If document exists in DB and lastmod is null, update timestamp quietly to prevent future re-crawls
        if (!lastCrawledMod && doc.lastmod) {
          await db.query('UPDATE laws SET last_crawled_mod = $1 WHERE id = $2', [doc.lastmod, dbId]);
          lawMap.set(dbId, doc.lastmod);
        }

        // If sitemap lastmod matches DB lastmod, skip immediately (FAST PATH)
        if (doc.lastmod && lastCrawledMod === doc.lastmod) {
          skippedExistingCount++;
          continue;
        }
      }

      // If code reaches here, it's either NEW or MODIFIED in sitemap
      logger.info(`Phát hiện tài liệu cần kiểm tra: ${doc.loc} (Mới: ${!existsInDb})`);
      
      const docData = await crawlDocument(doc.loc, subPages[slug] || []);
      
      // If the document is expired, skip adding/updating DB
      if (docData.isExpired) {
        skippedExpiredCount++;
        continue;
      }
      
      if (!existsInDb) {
        // Insert new valid document
        await db.query(
          `INSERT INTO laws (id, type, year, so, ten, hieuluc, status, mo_ta, dieu_khoang, link, last_crawled_mod)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            docData.id,
            docData.type,
            docData.year,
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
          [docData.id, updatedByUserId, `Tải tự động văn bản còn hiệu lực mới: ${docData.ten}`]
        );
        
        createdCount++;
        lawMap.set(docData.id, doc.lastmod);
        logger.info(`✔ Đã tạo mới văn bản: ${docData.ten}`);
      } else {
        // Update existing valid document
        await db.query(
          `UPDATE laws 
           SET type = $1, year = $2, so = $3, ten = $4, hieuluc = $5, status = $6, mo_ta = $7, dieu_khoang = $8, link = $9, last_crawled_mod = $10
           WHERE id = $11`,
          [
            docData.type,
            docData.year,
            docData.so,
            docData.ten,
            docData.hieuluc,
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
          [docData.id, updatedByUserId, `Cập nhật nội dung văn bản: ${docData.ten}`]
        );
        
        updatedCount++;
        logger.info(`✔ Đã cập nhật văn bản: ${docData.ten}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (err) {
      logger.error(`Lỗi khi xử lý tài liệu ${doc.loc}:`, err.message);
    }
  }

  logger.info(`--- Hoàn tất quét: Tạo mới ${createdCount}, Cập nhật ${updatedCount}, Bỏ qua đã có ${skippedExistingCount}, Bỏ qua hết hiệu lực ${skippedExpiredCount} ---`);
  return { createdCount, updatedCount, skippedExistingCount, skippedExpiredCount };
}

module.exports = {
  runCrawler
};
