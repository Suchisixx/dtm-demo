// backend/scripts/generate-drawio-diagrams.js
// Kịch bản sinh bộ 9 sơ đồ kiến trúc draw.io (.drawio) và ảnh vector (.svg) theo phong cách tối giản,
// chuẩn học thuật, thoáng đãng, tuyệt đối không có dây nối chồng chéo (Zero Line Crossing).

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '../../docs/diagrams');
const IMAGES_DIR = path.join(OUTPUT_DIR, 'images');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildDrawioXml(diagrams) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="Mozilla/5.0" version="24.0.0" type="device">\n`;

  for (const diag of diagrams) {
    xml += `  <diagram id="${diag.id}" name="${escapeXml(diag.title)}">\n`;
    xml += `    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${diag.width || 1200}" pageHeight="${diag.height || 850}" math="0" shadow="0">\n`;
    xml += `      <root>\n`;
    xml += `        <mxCell id="0" />\n`;
    xml += `        <mxCell id="1" parent="0" />\n`;

    for (const cell of diag.cells) {
      if (cell.isEdge) {
        xml += `        <mxCell id="${cell.id}" value="${escapeXml(cell.value || '')}" style="${cell.style || ''}" edge="1" parent="1" source="${cell.source}" target="${cell.target}">\n`;
        xml += `          <mxGeometry relative="1" as="geometry">\n`;
        if (cell.points && cell.points.length > 0) {
          xml += `            <Array as="points">\n`;
          for (const pt of cell.points) {
            xml += `              <mxPoint x="${pt.x}" y="${pt.y}" />\n`;
          }
          xml += `            </Array>\n`;
        }
        xml += `          </mxGeometry>\n`;
        xml += `        </mxCell>\n`;
      } else {
        xml += `        <mxCell id="${cell.id}" value="${escapeXml(cell.value || '')}" style="${cell.style || ''}" vertex="1" parent="1">\n`;
        xml += `          <mxGeometry x="${cell.x}" y="${cell.y}" width="${cell.w}" height="${cell.h}" as="geometry" />\n`;
        xml += `        </mxCell>\n`;
      }
    }

    xml += `      </root>\n`;
    xml += `    </mxGraphModel>\n`;
    xml += `  </diagram>\n`;
  }

  xml += `</mxfile>\n`;
  return xml;
}

// --------------------------------------------------------------------------------------------------
// BỘ SINH SVG CHUẨN ĐỘ PHÂN GIẢI CAO (CHO WORD & WEB)
// --------------------------------------------------------------------------------------------------

function generateSvgFromDiagram(diag) {
  const w = diag.width || 1200;
  const h = diag.height || 850;
  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n`;
  svg += `  <defs>\n`;
  svg += `    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n`;
  svg += `      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#334155"/>\n`;
  svg += `    </marker>\n`;
  svg += `    <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n`;
  svg += `      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#2563EB"/>\n`;
  svg += `    </marker>\n`;
  svg += `    <marker id="arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n`;
  svg += `      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#16A34A"/>\n`;
  svg += `    </marker>\n`;
  svg += `    <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n`;
  svg += `      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#DC2626"/>\n`;
  svg += `    </marker>\n`;
  svg += `    <marker id="generalization" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">\n`;
  svg += `      <polygon points="2,2 10,6 2,10" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.5"/>\n`;
  svg += `    </marker>\n`;
  svg += `    <style>\n`;
  svg += `      text { font-family: 'Segoe UI', Arial, sans-serif; }\n`;
  svg += `    </style>\n`;
  svg += `  </defs>\n`;
  svg += `  <rect width="100%" height="100%" fill="#FFFFFF" />\n`;

  const nodeMap = new Map();
  for (const c of diag.cells) {
    if (!c.isEdge) nodeMap.set(c.id, c);
  }

  // Draw nodes
  for (const cell of diag.cells) {
    if (cell.isEdge) continue;

    const style = cell.style || '';
    let fill = '#FFFFFF';
    let stroke = '#334155';
    let strokeWidth = 1.5;
    let rx = 6;
    let ry = 6;
    let dash = 'none';

    const fillMatch = style.match(/fillColor=([^;]+)/);
    if (fillMatch) fill = fillMatch[1];
    const strokeMatch = style.match(/strokeColor=([^;]+)/);
    if (strokeMatch) stroke = strokeMatch[1];
    const widthMatch = style.match(/strokeWidth=([^;]+)/);
    if (widthMatch) strokeWidth = parseFloat(widthMatch[1]);
    if (style.includes('dashed=1')) dash = '5, 4';

    if (style.includes('shape=umlActor')) {
      const cx = cell.x + cell.w / 2;
      const cy = cell.y + 20;
      svg += `  <circle cx="${cx}" cy="${cy}" r="14" fill="#FFFFFF" stroke="${stroke}" stroke-width="${strokeWidth}" />\n`;
      svg += `  <line x1="${cx}" y1="${cy + 14}" x2="${cx}" y2="${cy + 52}" stroke="${stroke}" stroke-width="${strokeWidth}" />\n`;
      svg += `  <line x1="${cx - 20}" y1="${cy + 26}" x2="${cx + 20}" y2="${cy + 26}" stroke="${stroke}" stroke-width="${strokeWidth}" />\n`;
      svg += `  <line x1="${cx}" y1="${cy + 52}" x2="${cx - 16}" y2="${cy + 82}" stroke="${stroke}" stroke-width="${strokeWidth}" />\n`;
      svg += `  <line x1="${cx}" y1="${cy + 52}" x2="${cx + 16}" y2="${cy + 82}" stroke="${stroke}" stroke-width="${strokeWidth}" />\n`;

      const lines = cell.value.split('\n');
      let textY = cy + 100;
      for (const line of lines) {
        svg += `  <text x="${cx}" y="${textY}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#0F172A">${escapeXml(line)}</text>\n`;
        textY += 15;
      }
    } else if (style.includes('ellipse')) {
      const cx = cell.x + cell.w / 2;
      const cy = cell.y + cell.h / 2;
      svg += `  <ellipse cx="${cx}" cy="${cy}" rx="${cell.w / 2}" ry="${cell.h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${dash}" />\n`;
      const lines = cell.value.split('\n');
      let textY = cy - ((lines.length - 1) * 14) / 2 + 4;
      for (const line of lines) {
        let fw = style.includes('fontStyle=1') ? '700' : '500';
        let fcolor = style.includes('fontColor=#FFFFFF') ? '#FFFFFF' : '#0F172A';
        svg += `  <text x="${cx}" y="${textY}" text-anchor="middle" font-size="11.5" font-weight="${fw}" fill="${fcolor}">${escapeXml(line)}</text>\n`;
        textY += 15;
      }
    } else if (style.includes('rhombus')) {
      const cx = cell.x + cell.w / 2;
      const cy = cell.y + cell.h / 2;
      const pts = `${cx},${cell.y} ${cell.x + cell.w},${cy} ${cx},${cell.y + cell.h} ${cell.x},${cy}`;
      svg += `  <polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${dash}" />\n`;
      const lines = cell.value.split('\n');
      let textY = cy - ((lines.length - 1) * 14) / 2 + 4;
      for (const line of lines) {
        svg += `  <text x="${cx}" y="${textY}" text-anchor="middle" font-size="11" font-weight="600" fill="#0F172A">${escapeXml(line)}</text>\n`;
        textY += 14;
      }
    } else if (style.includes('shape=cylinder')) {
      svg += `  <rect x="${cell.x}" y="${cell.y + 12}" width="${cell.w}" height="${cell.h - 12}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" rx="4" />\n`;
      svg += `  <ellipse cx="${cell.x + cell.w / 2}" cy="${cell.y + 12}" rx="${cell.w / 2}" ry="12" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />\n`;
      const lines = cell.value.split('\n');
      let textY = cell.y + 38;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isHeader = i === 0;
        svg += `  <text x="${cell.x + cell.w / 2}" y="${textY}" text-anchor="middle" font-size="${isHeader ? '12' : '11'}" font-weight="${isHeader ? '700' : '400'}" fill="${isHeader ? '#0F172A' : '#475569'}">${escapeXml(line)}</text>\n`;
        textY += 16;
      }
    } else {
      if (style.includes('rounded=0')) { rx = 0; ry = 0; }
      svg += `  <rect x="${cell.x}" y="${cell.y}" width="${cell.w}" height="${cell.h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" rx="${rx}" ry="${ry}" stroke-dasharray="${dash}" />\n`;

      const lines = cell.value.split('\n');
      const isTitle = style.includes('fontSize=18');
      const isSwimlane = style.includes('verticalAlign=top');
      const isERD = cell.id.startsWith('erd_');

      if (isTitle) {
        svg += `  <text x="${cell.x + cell.w / 2}" y="${cell.y + cell.h / 2 + 6}" text-anchor="middle" font-size="15" font-weight="800" fill="#0F172A">${escapeXml(cell.value)}</text>\n`;
      } else if (isSwimlane) {
        svg += `  <text x="${cell.x + 16}" y="${cell.y + 22}" text-anchor="start" font-size="12" font-weight="700" fill="${stroke}">${escapeXml(lines[0])}</text>\n`;
      } else if (isERD) {
        let textY = cell.y + 18;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (i === 0) {
            svg += `  <rect x="${cell.x}" y="${cell.y}" width="${cell.w}" height="26" fill="${stroke}" fill-opacity="0.1" />\n`;
            svg += `  <text x="${cell.x + 10}" y="${textY}" font-size="11.5" font-weight="700" fill="${stroke}">${escapeXml(line)}</text>\n`;
            textY += 10;
            svg += `  <line x1="${cell.x}" y1="${textY}" x2="${cell.x + cell.w}" y2="${textY}" stroke="${stroke}" stroke-width="1" />\n`;
            textY += 14;
          } else {
            let textColor = '#334155';
            let fw = '400';
            if (line.includes('[PK]')) { textColor = '#B45309'; fw = '700'; }
            else if (line.includes('[FK')) { textColor = '#0369A1'; fw = '600'; }
            svg += `  <text x="${cell.x + 10}" y="${textY}" font-size="10.5" font-weight="${fw}" fill="${textColor}">${escapeXml(line)}</text>\n`;
            textY += 14;
          }
        }
      } else {
        const cx = cell.x + cell.w / 2;
        let textY = cell.y + cell.h / 2 - ((lines.length - 1) * 15) / 2 + 5;
        for (const line of lines) {
          let fw = style.includes('fontStyle=1') ? '700' : '400';
          let fcolor = style.includes('fontColor=#FFFFFF') ? '#FFFFFF' : '#0F172A';
          if (style.includes('fontColor=#')) {
            const m = style.match(/fontColor=([^;]+)/);
            if (m) fcolor = m[1];
          }
          svg += `  <text x="${cx}" y="${textY}" text-anchor="middle" font-size="11" font-weight="${fw}" fill="${fcolor}">${escapeXml(line)}</text>\n`;
          textY += 15;
        }
      }
    }
  }

  // Draw edges (clean connectors)
  for (const cell of diag.cells) {
    if (!cell.isEdge) continue;
    const s = nodeMap.get(cell.source);
    const t = nodeMap.get(cell.target);
    if (!s || !t) continue;

    let stroke = '#334155';
    let marker = 'url(#arrow)';
    if (cell.style.includes('strokeColor=#2563EB')) { stroke = '#2563EB'; marker = 'url(#arrow-blue)'; }
    else if (cell.style.includes('strokeColor=#16A34A') || cell.style.includes('strokeColor=#059669')) { stroke = '#16A34A'; marker = 'url(#arrow-green)'; }
    else if (cell.style.includes('strokeColor=#DC2626')) { stroke = '#DC2626'; marker = 'url(#arrow-red)'; }

    if (cell.style.includes('endArrow=none')) marker = '';
    else if (cell.style.includes('endArrow=block') && cell.style.includes('endFill=0')) marker = 'url(#generalization)';

    const sx = s.x + s.w / 2;
    const sy = s.y + s.h / 2;
    const tx = t.x + t.w / 2;
    const ty = t.y + t.h / 2;

    let x1 = sx, y1 = sy, x2 = tx, y2 = ty;
    if (Math.abs(tx - sx) > Math.abs(ty - sy)) {
      if (tx > sx) { x1 = s.x + s.w; x2 = t.x; }
      else { x1 = s.x; x2 = t.x + t.w; }
    } else {
      if (ty > sy) { y1 = s.y + s.h; y2 = t.y; }
      else { y1 = s.y; y2 = t.y + t.h; }
    }

    let dash = cell.style.includes('dashed=1') ? 'stroke-dasharray="4, 4"' : '';
    let markerAttr = marker ? `marker-end="${marker}"` : '';

    svg += `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="1.5" ${dash} ${markerAttr} />\n`;

    if (cell.value) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2 - 5;
      if (Math.abs(x1 - x2) < 5) {
        svg += `  <rect x="${mx - 32}" y="${my - 8}" width="64" height="16" fill="#FFFFFF" rx="2" />\n`;
      }
      svg += `  <text x="${mx}" y="${my + 4}" text-anchor="middle" font-size="10" font-weight="600" fill="${stroke}">${escapeXml(cell.value)}</text>\n`;
    }
  }

  svg += `</svg>\n`;
  return svg;
}

// ==================================================================================================
// ĐỊNH NGHĨA 9 SƠ ĐỒ TINH GIẢN, KHÔNG DÂY CHỒNG CHÉO
// ==================================================================================================

// 1. Sơ đồ 2.1: Use Case tổng quát (Phong cách Ảnh 1 Mẫu của người dùng)
const sd21 = {
  id: 'sd21_usecase',
  filename: 'So_do_2.1_Use_Case_Tong_Quat',
  title: 'Sơ đồ Use Case tổng quát hệ thống',
  width: 1050,
  height: 800,
  cells: [
    { id: 't1', value: 'SƠ ĐỒ USE CASE TỔNG QUÁT HỆ THỐNG', style: 'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=18;fontStyle=1;', x: 100, y: 20, w: 850, h: 35 },

    // Actor Left Top: Chuyên viên tư vấn (Nhân viên)
    { id: 'act_staff', value: 'Chuyên viên tư vấn\n(Nhân viên)', style: 'shape=umlActor;verticalLabelPosition=bottom;strokeColor=#1E293B;', x: 90, y: 250, w: 60, h: 90 },

    // Actor Left Bottom: Quản trị viên (Admin kế thừa quyền của Nhân viên)
    { id: 'act_admin', value: 'Quản trị viên\n(Admin)', style: 'shape=umlActor;verticalLabelPosition=bottom;strokeColor=#1E293B;', x: 90, y: 590, w: 60, h: 90 },

    // Quan hệ Kế thừa Actor chuẩn UML: Admin kế thừa Nhân viên (tam giác rỗng hướng lên Nhân viên)
    { id: 'e_a_inherit', isEdge: true, source: 'act_admin', target: 'act_staff', value: 'Kế thừa', style: 'endArrow=block;endFill=0;html=1;strokeColor=#0F172A;strokeWidth=1.5;labelBackgroundColor=#FFFFFF;fontStyle=2;fontSize=11;' },

    // System Boundary
    { id: 'box_sys', value: 'Hệ thống', style: 'shape=rect;rounded=0;strokeWidth=2;strokeColor=#0F172A;fillColor=none;align=center;verticalAlign=top;spacingTop=12;fontSize=13;fontStyle=1;', x: 260, y: 70, w: 500, h: 690 },

    // Use cases stacked vertically with clean spacing (NO CROSSING)
    { id: 'uc1', value: 'Tra cứu văn bản & QCVN', style: 'ellipse;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.5;fontStyle=1;', x: 380, y: 110, w: 260, h: 55 },
    { id: 'uc2', value: 'Phân loại hồ sơ môi trường (ĐTM/GPMT)', style: 'ellipse;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.5;fontStyle=1;', x: 380, y: 200, w: 260, h: 55 },
    { id: 'uc3', value: 'Đối chiếu kết quả quan trắc với QCVN', style: 'ellipse;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.5;fontStyle=1;', x: 380, y: 290, w: 260, h: 55 },
    { id: 'uc4', value: 'Quản lý hồ sơ dự án & Bản đồ GIS', style: 'ellipse;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.5;fontStyle=1;', x: 380, y: 380, w: 260, h: 55 },
    { id: 'uc5', value: 'Theo dõi nhắc hạn nghĩa vụ & Dashboard', style: 'ellipse;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.5;fontStyle=1;', x: 380, y: 470, w: 260, h: 55 },
    { id: 'uc6', value: 'Đăng nhập & Xác thực hệ thống', style: 'ellipse;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.5;fontStyle=1;', x: 380, y: 570, w: 260, h: 55 },
    { id: 'uc7', value: 'Quản trị nhân sự, luật & Web Crawler', style: 'ellipse;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.5;fontStyle=1;', x: 380, y: 670, w: 260, h: 55 },

    // Actor Right Top (Guest)
    { id: 'act_guest', value: 'Khách vãng lai', style: 'shape=umlActor;verticalLabelPosition=bottom;strokeColor=#1E293B;', x: 880, y: 110, w: 60, h: 90 },

    // Edges Left (Staff -> UCs) - Direct lines, no crossing!
    { id: 'e_s1', isEdge: true, source: 'act_staff', target: 'uc1', style: 'endArrow=none;html=1;strokeColor=#0F172A;strokeWidth=1.4;' },
    { id: 'e_s2', isEdge: true, source: 'act_staff', target: 'uc2', style: 'endArrow=none;html=1;strokeColor=#0F172A;strokeWidth=1.4;' },
    { id: 'e_s3', isEdge: true, source: 'act_staff', target: 'uc3', style: 'endArrow=none;html=1;strokeColor=#0F172A;strokeWidth=1.4;' },
    { id: 'e_s4', isEdge: true, source: 'act_staff', target: 'uc4', style: 'endArrow=none;html=1;strokeColor=#0F172A;strokeWidth=1.4;' },
    { id: 'e_s5', isEdge: true, source: 'act_staff', target: 'uc5', style: 'endArrow=none;html=1;strokeColor=#0F172A;strokeWidth=1.4;' },

    // Edges Left (Admin -> UC6 & UC7) - Direct lines, no crossing!
    { id: 'e_a1', isEdge: true, source: 'act_admin', target: 'uc6', style: 'endArrow=none;html=1;strokeColor=#0F172A;strokeWidth=1.4;' },
    { id: 'e_a2', isEdge: true, source: 'act_admin', target: 'uc7', style: 'endArrow=none;html=1;strokeColor=#0F172A;strokeWidth=1.4;' },

    // Edges Right (Guest -> UC1)
    { id: 'e_g1', isEdge: true, source: 'act_guest', target: 'uc1', style: 'endArrow=none;html=1;strokeColor=#0F172A;strokeWidth=1.4;' },

    // Vertical <<include>> line inside system
    { id: 'e_inc1', isEdge: true, source: 'uc5', target: 'uc6', value: '<<include>>', style: 'endArrow=open;dashed=1;html=1;strokeColor=#0F172A;strokeWidth=1.2;' }
  ]
};

// 2. Sơ đồ 2.2: Kiến trúc hệ thống 4 tầng (Phong cách Ảnh 2 Mẫu - Luồng ngang Trái sang Phải)
const sd22 = {
  id: 'sd22_architecture',
  filename: 'So_do_2.2_Kien_Truc_4_Tang',
  title: 'Sơ đồ 2.2: Sơ đồ Kiến trúc hệ thống 4 tầng',
  width: 1200,
  height: 580,
  cells: [
    { id: 't2', value: 'SƠ ĐỒ 2.2: KIẾN TRÚC HỆ THỐNG 4 TẦNG (ETC LEGALHUB ARCHITECTURE)', style: 'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=18;fontStyle=1;', x: 150, y: 25, w: 900, h: 35 },

    // Step 1: User
    { id: 'n_user', value: 'Người dùng\n(Chuyên viên / QTV)', style: 'shape=umlActor;verticalLabelPosition=bottom;strokeColor=#1E293B;', x: 60, y: 230, w: 60, h: 90 },

    // Step 2: Presentation Tier
    { id: 'n_web', value: 'TẦNG TRÌNH BÀY (CLIENT)\n\nVue.js 3 SPA Application\n• Quản lý hồ sơ & Mini-Map\n• Đối chiếu quy chuẩn QCVN\n• Bản đồ không gian Leaflet.js\n• Bảng điều khiển KPI Chart.js', style: 'shape=rect;rounded=1;fillColor=#F8FAFC;strokeColor=#2563EB;strokeWidth=2;fontStyle=1;align=center;', x: 200, y: 190, w: 220, h: 170 },

    // Step 3: Application Server
    { id: 'box_app', value: 'TẦNG NGHIỆP VỤ (EXPRESS API SERVERS)', style: 'shape=rect;rounded=1;dashed=1;strokeWidth=2;strokeColor=#16A34A;fillColor=#F0FDF4;align=center;verticalAlign=top;spacingTop=10;fontStyle=1;fontSize=11.5;', x: 500, y: 120, w: 320, h: 320 },
    
    // 3 stacked service components inside (like Image 2!)
    { id: 'srv_1', value: 'Động cơ Phân loại (Rule Engine)\nNghị định 08/2022 & NĐ 48/2026', style: 'shape=cylinder;whiteSpace=wrap;fillColor=#FFFFFF;strokeColor=#16A34A;strokeWidth=1.5;fontStyle=1;', x: 530, y: 160, w: 260, h: 70 },
    { id: 'srv_2', value: 'Động cơ Đối chiếu QCVN\nQCVN 40, QCVN 14, QCVN 19', style: 'shape=cylinder;whiteSpace=wrap;fillColor=#FFFFFF;strokeColor=#16A34A;strokeWidth=1.5;fontStyle=1;', x: 530, y: 250, w: 260, h: 70 },
    { id: 'srv_3', value: 'Dịch vụ GIS & Thống kê KPI\nPhân tích bán kính R & Cảnh báo', style: 'shape=cylinder;whiteSpace=wrap;fillColor=#FFFFFF;strokeColor=#16A34A;strokeWidth=1.5;fontStyle=1;', x: 530, y: 340, w: 260, h: 70 },

    // Step 4: Data Tier (Database Cylinder)
    { id: 'n_db', value: 'TẦNG DỮ LIỆU (DATABASE)\n\nPostgreSQL & PostGIS\n• Dữ liệu dự án & Tọa độ GIS\n• Tri thức quy tắc & QCVN\n• Mẫu quan trắc môi trường', style: 'shape=cylinder;fillColor=#F5F3FF;strokeColor=#7C3AED;strokeWidth=2;fontStyle=1;align=center;', x: 910, y: 200, w: 220, h: 160 },

    // Side Component: Background Crawler
    { id: 'n_cron', value: 'Tác vụ nền: Web Crawler\n(node-cron tự động quét)', style: 'shape=rect;rounded=1;fillColor=#FFFBEB;strokeColor=#D97706;strokeWidth=1.5;fontStyle=1;', x: 530, y: 470, w: 260, h: 55 },
    { id: 'n_source', value: 'Trang nguồn:\nluatmoitruong.vn', style: 'shape=rect;rounded=1;fillColor=#FFFFFF;strokeColor=#D97706;strokeWidth=1.5;fontStyle=1;', x: 910, y: 470, w: 220, h: 55 },

    // Connectors: Straight / Right Angle (Image 2 style)
    { id: 'e22_1', isEdge: true, source: 'n_user', target: 'n_web', value: 'HTTP / JSON', style: 'endArrow=classic;html=1;strokeColor=#2563EB;strokeWidth=1.5;' },
    { id: 'e22_2', isEdge: true, source: 'n_web', target: 'srv_2', value: 'REST API Calls', style: 'endArrow=classic;html=1;strokeColor=#16A34A;strokeWidth=1.5;' },
    { id: 'e22_3', isEdge: true, source: 'srv_2', target: 'n_db', value: 'SQL / PostGIS', style: 'endArrow=classic;html=1;strokeColor=#7C3AED;strokeWidth=1.5;' },
    { id: 'e22_4', isEdge: true, source: 'n_cron', target: 'n_source', value: 'Tải HTML', style: 'endArrow=classic;html=1;strokeColor=#D97706;strokeWidth=1.5;' },
    { id: 'e22_5', isEdge: true, source: 'n_cron', target: 'srv_3', style: 'endArrow=classic;html=1;strokeColor=#D97706;strokeWidth=1.2;dashed=1;' }
  ]
};

// 3. Sơ đồ 2.3: Luồng dữ liệu DFD (Mức 0 và Mức 1)
const sd23 = {
  id: 'sd23_dfd',
  filename: 'So_do_2.3_Luong_Du_Lieu_DFD',
  title: 'Sơ đồ 2.3: Sơ đồ Luồng dữ liệu DFD (Mức 0 và Mức 1)',
  width: 1100,
  height: 800,
  cells: [
    { id: 't3', value: 'SƠ ĐỒ 2.3: LUỒNG DỮ LIỆU DFD (MỨC 0 NGỮ CẢNH & MỨC 1 PHÂN RÃ)', style: 'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=18;fontStyle=1;', x: 100, y: 20, w: 900, h: 35 },

    // Part A: DFD Level 0 (Context)
    { id: 'b_dfd0', value: 'A. SƠ ĐỒ NGỮ CẢNH (DFD MỨC 0)', style: 'shape=rect;rounded=1;dashed=1;strokeColor=#64748B;fillColor=#F8FAFC;align=left;spacingLeft=14;spacingTop=8;fontStyle=1;fontSize=11.5;', x: 80, y: 65, w: 940, h: 220 },
    
    { id: 'ent_staff', value: 'Chuyên viên tư vấn', style: 'shape=rect;fillColor=#FFFFFF;strokeColor=#16A34A;strokeWidth=1.5;fontStyle=1;', x: 120, y: 150, w: 150, h: 60 },
    { id: 'proc_0', value: '0.0\nHỆ THỐNG QUẢN LÝ &\nGIÁM SÁT PHÁP LÝ MÔI TRƯỜNG\n(ETC LEGALHUB)', style: 'ellipse;fillColor=#286B4F;strokeColor=#1E563F;strokeWidth=2;fontStyle=1;fontColor=#FFFFFF;align=center;', x: 420, y: 120, w: 260, h: 120 },
    { id: 'ent_admin', value: 'Quản trị viên', style: 'shape=rect;fillColor=#FFFFFF;strokeColor=#D97706;strokeWidth=1.5;fontStyle=1;', x: 820, y: 105, w: 150, h: 55 },
    { id: 'ent_web', value: 'Cổng luatmoitruong.vn', style: 'shape=rect;fillColor=#FFFFFF;strokeColor=#D97706;strokeWidth=1.5;fontStyle=1;', x: 820, y: 200, w: 150, h: 55 },

    { id: 'e_df0_1', isEdge: true, source: 'ent_staff', target: 'proc_0', value: 'Thông số dự án & số đo QCVN', style: 'endArrow=classic;html=1;strokeColor=#16A34A;strokeWidth=1.4;' },
    { id: 'e_df0_2', isEdge: true, source: 'proc_0', target: 'ent_staff', value: 'Hồ sơ ĐTM/GPMT & Bản đồ GIS', style: 'endArrow=classic;html=1;strokeColor=#16A34A;strokeWidth=1.4;' },
    { id: 'e_df0_3', isEdge: true, source: 'ent_admin', target: 'proc_0', value: 'Lệnh đồng bộ & Kiểm duyệt luật', style: 'endArrow=classic;html=1;strokeColor=#D97706;strokeWidth=1.4;' },
    { id: 'e_df0_4', isEdge: true, source: 'ent_web', target: 'proc_0', value: 'Văn bản pháp lý mới', style: 'endArrow=classic;html=1;strokeColor=#D97706;strokeWidth=1.4;' },

    // Part B: DFD Level 1 (Decomposition)
    { id: 'b_dfd1', value: 'B. SƠ ĐỒ PHÂN RÃ CHỨC NĂNG (DFD MỨC 1)', style: 'shape=rect;rounded=1;dashed=1;strokeColor=#286B4F;fillColor=#F8FAFC;align=left;spacingLeft=14;spacingTop=8;fontStyle=1;fontSize=11.5;', x: 80, y: 310, w: 940, h: 460 },

    // 4 Functional Processes (Clean 2x2 grid)
    { id: 'p1', value: '1.0: Xác thực &\nPhân quyền', style: 'ellipse;fillColor=#EFF6FF;strokeColor=#2563EB;fontStyle=1;', x: 150, y: 360, w: 160, h: 70 },
    { id: 'p2', value: '2.0: Phân loại hồ sơ\n& Xác định thẩm quyền', style: 'ellipse;fillColor=#ECFDF5;strokeColor=#059669;fontStyle=1;', x: 470, y: 360, w: 170, h: 70 },
    { id: 'p3', value: '3.0: Đối chiếu QCVN\n& Đánh giá mẫu đo', style: 'ellipse;fillColor=#ECFDF5;strokeColor=#059669;fontStyle=1;', x: 780, y: 360, w: 170, h: 70 },

    { id: 'p4', value: '4.0: Quản lý dự án\n& Bản đồ GIS', style: 'ellipse;fillColor=#ECFDF5;strokeColor=#059669;fontStyle=1;', x: 150, y: 640, w: 160, h: 70 },
    { id: 'p5', value: '5.0: Giám sát nhắc hạn\n& Dashboard KPI', style: 'ellipse;fillColor=#ECFDF5;strokeColor=#059669;fontStyle=1;', x: 470, y: 640, w: 170, h: 70 },
    { id: 'p6', value: '6.0: Đồng bộ pháp lý\n(Web Crawler)', style: 'ellipse;fillColor=#FEF3C7;strokeColor=#D97706;fontStyle=1;', x: 780, y: 640, w: 170, h: 70 },

    // Central Data Stores (horizontal bar in the middle)
    { id: 'ds1', value: 'D1: Kho người dùng (users)', style: 'shape=partialRectangle;top=0;bottom=0;left=1;right=1;fillColor=#FFFFFF;strokeColor=#2563EB;strokeWidth=1.5;fontStyle=1;', x: 130, y: 500, w: 200, h: 40 },
    { id: 'ds2', value: 'D2: Kho tri thức luật & QCVN', style: 'shape=partialRectangle;top=0;bottom=0;left=1;right=1;fillColor=#FFFFFF;strokeColor=#059669;strokeWidth=1.5;fontStyle=1;', x: 450, y: 500, w: 210, h: 40 },
    { id: 'ds3', value: 'D3: Kho dự án & Mẫu quan trắc', style: 'shape=partialRectangle;top=0;bottom=0;left=1;right=1;fillColor=#FFFFFF;strokeColor=#059669;strokeWidth=1.5;fontStyle=1;', x: 760, y: 500, w: 210, h: 40 },

    // Direct vertical connectors (NO CROSSING!)
    { id: 'e_df1_1', isEdge: true, source: 'p1', target: 'ds1', style: 'endArrow=classic;html=1;strokeColor=#2563EB;strokeWidth=1.4;' },
    { id: 'e_df1_2', isEdge: true, source: 'p2', target: 'ds2', style: 'endArrow=classic;html=1;strokeColor=#059669;strokeWidth=1.4;' },
    { id: 'e_df1_3', isEdge: true, source: 'p3', target: 'ds3', style: 'endArrow=classic;html=1;strokeColor=#059669;strokeWidth=1.4;' },
    { id: 'e_df1_4', isEdge: true, source: 'p4', target: 'ds3', style: 'endArrow=classic;html=1;strokeColor=#059669;strokeWidth=1.4;' },
    { id: 'e_df1_5', isEdge: true, source: 'p5', target: 'ds3', style: 'endArrow=classic;html=1;strokeColor=#059669;strokeWidth=1.4;' },
    { id: 'e_df1_6', isEdge: true, source: 'p6', target: 'ds2', style: 'endArrow=classic;html=1;strokeColor=#D97706;strokeWidth=1.4;' }
  ]
};

// 4. Sơ đồ 2.4: Quan hệ thực thể ERD (3 cột gọn gàng, Crow's foot)
const sd24 = {
  id: 'sd24_erd',
  filename: 'So_do_2.4_Quan_He_Thuc_The_ERD',
  title: 'Sơ đồ 2.4: Sơ đồ Quan hệ thực thể (ERD Crow\'s Foot)',
  width: 1100,
  height: 650,
  cells: [
    { id: 't4', value: 'SƠ ĐỒ 2.4: SƠ ĐỒ QUAN HỆ THỰC THỂ (ENTITY RELATIONSHIP DIAGRAM)', style: 'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=18;fontStyle=1;', x: 100, y: 20, w: 900, h: 35 },

    // Column 1: Users & Logs
    { id: 'erd_users', value: 'USERS (Tài khoản)\n+ id: SERIAL [PK]\n- username: VARCHAR\n- role: VARCHAR (admin/staff)\n- full_name: VARCHAR', style: 'shape=rect;fillColor=#EFF6FF;strokeColor=#2563EB;strokeWidth=1.5;align=left;', x: 60, y: 100, w: 260, h: 110 },
    { id: 'erd_audit', value: 'AUDIT_LOGS (Nhật ký)\n+ id: SERIAL [PK]\n# user_id: INT [FK]\n- action: VARCHAR\n- created_at: TIMESTAMPTZ', style: 'shape=rect;fillColor=#F8FAFC;strokeColor=#64748B;strokeWidth=1.5;align=left;', x: 60, y: 320, w: 260, h: 100 },

    // Column 2: Projects & Monitoring
    { id: 'erd_proj', value: 'PROJECTS (Hồ sơ dự án)\n+ id: SERIAL [PK]\n# user_id: INT [FK]\n- name: VARCHAR\n- latitude: NUMERIC\n- longitude: NUMERIC\n- classification_result: JSONB', style: 'shape=rect;fillColor=#ECFDF5;strokeColor=#059669;strokeWidth=1.5;align=left;', x: 420, y: 100, w: 270, h: 130 },
    { id: 'erd_samples', value: 'QCVN_SAMPLES (Mẫu quan trắc)\n+ id: SERIAL [PK]\n# project_id: INT [FK]\n# user_id: INT [FK]\n- sub_type: VARCHAR [FK]\n- trang_thai_tong_quat: VARCHAR', style: 'shape=rect;fillColor=#ECFDF5;strokeColor=#059669;strokeWidth=1.5;align=left;', x: 420, y: 310, w: 270, h: 120 },
    { id: 'erd_reminders', value: 'REMINDERS (Nhắc hạn)\n+ id: SERIAL [PK]\n# project_id: INT [FK]\n- next_due_date: DATE\n- alert_level: VARCHAR', style: 'shape=rect;fillColor=#FEF3C7;strokeColor=#D97706;strokeWidth=1.5;align=left;', x: 420, y: 500, w: 270, h: 100 },

    // Column 3: Rules & Legal Knowledge
    { id: 'erd_ind', value: 'INDUSTRIES (Ngành nghề)\n+ id: SERIAL [PK]\n- code: VARCHAR [UNIQUE]\n- name: VARCHAR\n- sector: VARCHAR', style: 'shape=rect;fillColor=#F5F3FF;strokeColor=#7C3AED;strokeWidth=1.5;align=left;', x: 790, y: 100, w: 260, h: 110 },
    { id: 'erd_thresh', value: 'CLASSIFICATION_THRESHOLDS\n+ id: SERIAL [PK]\n# industry_id: INT [FK]\n- group_name: VARCHAR (I/II/III)\n- dossier_type: VARCHAR (ĐTM/GPMT)', style: 'shape=rect;fillColor=#F5F3FF;strokeColor=#7C3AED;strokeWidth=1.5;align=left;', x: 790, y: 280, w: 260, h: 110 },
    { id: 'erd_qcvn', value: 'QCVNS (Quy chuẩn kỹ thuật)\n+ id: VARCHAR [PK]\n- standard_code: VARCHAR\n- column: VARCHAR (A/B)\n- parameters: JSONB', style: 'shape=rect;fillColor=#F5F3FF;strokeColor=#7C3AED;strokeWidth=1.5;align=left;', x: 790, y: 460, w: 260, h: 110 },

    // Connections (Crow's Foot Style, horizontal & vertical, zero crossing!)
    { id: 'e_erd_1', isEdge: true, source: 'erd_users', target: 'erd_proj', value: '1 : N', style: 'endArrow=ERmany;startArrow=ERone;html=1;strokeColor=#2563EB;strokeWidth=1.5;' },
    { id: 'e_erd_2', isEdge: true, source: 'erd_users', target: 'erd_audit', value: '1 : N', style: 'endArrow=ERmany;startArrow=ERone;html=1;strokeColor=#64748B;strokeWidth=1.2;' },
    { id: 'e_erd_3', isEdge: true, source: 'erd_proj', target: 'erd_samples', value: '1 : N', style: 'endArrow=ERmany;startArrow=ERone;html=1;strokeColor=#059669;strokeWidth=1.5;' },
    { id: 'e_erd_4', isEdge: true, source: 'erd_proj', target: 'erd_reminders', value: '1 : N', style: 'endArrow=ERmany;startArrow=ERone;html=1;strokeColor=#D97706;strokeWidth=1.2;' },
    { id: 'e_erd_5', isEdge: true, source: 'erd_ind', target: 'erd_thresh', value: '1 : N', style: 'endArrow=ERmany;startArrow=ERone;html=1;strokeColor=#7C3AED;strokeWidth=1.5;' },
    { id: 'e_erd_6', isEdge: true, source: 'erd_qcvn', target: 'erd_samples', value: '1 : N', style: 'endArrow=ERmany;startArrow=ERone;html=1;strokeColor=#7C3AED;strokeWidth=1.5;' }
  ]
};

// 5. Sơ đồ 2.5: Lưu đồ Cây quyết định phân loại (Top-to-Bottom, Zero Crossing)
const sd25 = {
  id: 'sd25_decision_tree',
  filename: 'So_do_2.5_Cay_Quyet_Dinh_Phan_Loai',
  title: 'Sơ đồ 2.5: Lưu đồ Cây quyết định phân loại hồ sơ môi trường',
  width: 950,
  height: 820,
  cells: [
    { id: 't5', value: 'SƠ ĐỒ 2.5: LƯU ĐỒ CÂY QUYẾT ĐỊNH PHÂN LOẠI HỒ SƠ MÔI TRƯỜNG', style: 'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=18;fontStyle=1;', x: 100, y: 20, w: 750, h: 35 },

    // Spine (Vertical axis at x: 340)
    { id: 'dt_start', value: 'Bắt đầu: Nhập thông số dự án\n(Ngành nghề, công suất, vị trí, yếu tố nhạy cảm)', style: 'ellipse;fillColor=#286B4F;strokeColor=#1E563F;fontStyle=1;fontColor=#FFFFFF;', x: 300, y: 70, w: 320, h: 55 },

    { id: 'dt_g1', value: 'Ngành tồn tại trong DB &\nCông suất > 0?', style: 'rhombus;fillColor=#FEF3C7;strokeColor=#D97706;fontStyle=1;', x: 360, y: 160, w: 200, h: 80 },
    { id: 'dt_err1', value: 'DỪNG: Trạng thái NEEDS_REVIEW\n(Thông số không hợp lệ)', style: 'shape=rect;rounded=1;fillColor=#FEF2F2;strokeColor=#DC2626;fontColor=#DC2626;fontStyle=1;', x: 670, y: 175, w: 220, h: 50 },

    { id: 'dt_match', value: 'So khớp công suất với Bảng ngưỡng quy mô\n=> Xác định Nhóm ban đầu (Nhóm I, II, III, IV)', style: 'shape=rect;rounded=1;fillColor=#EFF6FF;strokeColor=#2563EB;strokeWidth=1.5;fontStyle=1;', x: 320, y: 280, w: 280, h: 55 },

    { id: 'dt_g2', value: 'Có yếu tố nhạy cảm môi trường?\n(Ven biển, bảo tồn, rừng, xả thải lớn)', style: 'rhombus;fillColor=#FEF3C7;strokeColor=#D97706;fontStyle=1;', x: 350, y: 375, w: 220, h: 90 },
    { id: 'dt_upgrade', value: 'Áp dụng quy tắc nâng nhóm:\nNhóm III -> Nhóm II | Nhóm II -> Nhóm I', style: 'shape=rect;rounded=1;fillColor=#FFFBEB;strokeColor=#D97706;fontStyle=1;fontColor=#B45309;', x: 670, y: 395, w: 230, h: 50 },

    { id: 'dt_dossier', value: 'Xác định loại hồ sơ môi trường:\n• Nhóm I & II: Báo cáo ĐTM & Giấy phép GPMT\n• Nhóm III: Giấy phép GPMT / Đăng ký ĐKMT\n• Nhóm IV: Đăng ký môi trường ĐKMT', style: 'shape=rect;rounded=1;fillColor=#ECFDF5;strokeColor=#059669;strokeWidth=1.5;fontStyle=1;', x: 320, y: 510, w: 280, h: 75 },

    { id: 'dt_auth', value: 'Xác định cấp thẩm quyền phê duyệt:\nBộ Nông nghiệp & MT / UBND Tỉnh / Cấp Xã', style: 'shape=rect;rounded=1;fillColor=#F5F3FF;strokeColor=#7C3AED;strokeWidth=1.5;fontStyle=1;', x: 320, y: 625, w: 280, h: 55 },

    { id: 'dt_end', value: 'Kết thúc: Xuất kết quả phân loại & Checklist hồ sơ', style: 'ellipse;fillColor=#286B4F;strokeColor=#1E563F;fontStyle=1;fontColor=#FFFFFF;', x: 300, y: 720, w: 320, h: 55 },

    // Connectors (Pure vertical spine + Right branches)
    { id: 'e_dt_1', isEdge: true, source: 'dt_start', target: 'dt_g1', style: 'endArrow=classic;html=1;strokeColor=#286B4F;strokeWidth=1.5;' },
    { id: 'e_dt_2', isEdge: true, source: 'dt_g1', target: 'dt_err1', value: 'Không', style: 'endArrow=classic;html=1;strokeColor=#DC2626;strokeWidth=1.4;fontColor=#DC2626;' },
    { id: 'e_dt_3', isEdge: true, source: 'dt_g1', target: 'dt_match', value: 'Hợp lệ', style: 'endArrow=classic;html=1;strokeColor=#16A34A;strokeWidth=1.4;fontColor=#16A34A;' },
    { id: 'e_dt_4', isEdge: true, source: 'dt_match', target: 'dt_g2', style: 'endArrow=classic;html=1;strokeColor=#2563EB;strokeWidth=1.5;' },
    { id: 'e_dt_5', isEdge: true, source: 'dt_g2', target: 'dt_upgrade', value: 'Có', style: 'endArrow=classic;html=1;strokeColor=#D97706;strokeWidth=1.4;fontColor=#D97706;' },
    { id: 'e_dt_6', isEdge: true, source: 'dt_g2', target: 'dt_dossier', value: 'Không', style: 'endArrow=classic;html=1;strokeColor=#16A34A;strokeWidth=1.4;fontColor=#16A34A;' },
    { id: 'e_dt_7', isEdge: true, source: 'dt_upgrade', target: 'dt_dossier', style: 'endArrow=classic;html=1;strokeColor=#D97706;strokeWidth=1.2;' },
    { id: 'e_dt_8', isEdge: true, source: 'dt_dossier', target: 'dt_auth', style: 'endArrow=classic;html=1;strokeColor=#059669;strokeWidth=1.5;' },
    { id: 'e_dt_9', isEdge: true, source: 'dt_auth', target: 'dt_end', style: 'endArrow=classic;html=1;strokeColor=#7C3AED;strokeWidth=1.5;' }
  ]
};

// 6. Sơ đồ 2.6: Lưu đồ Đối chiếu quan trắc QCVN (Top-to-Bottom, Zero Crossing)
const sd26 = {
  id: 'sd26_qcvn_flow',
  filename: 'So_do_2.6_Doi_Chieu_Quan_Trac_QCVN',
  title: 'Sơ đồ 2.6: Lưu đồ Đối chiếu kết quả quan trắc với QCVN',
  width: 950,
  height: 820,
  cells: [
    { id: 't6', value: 'SƠ ĐỒ 2.6: LƯU ĐỒ ĐỐI CHIẾU KẾT QUẢ QUAN TRẮC VỚI QCVN', style: 'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=18;fontStyle=1;', x: 100, y: 20, w: 750, h: 35 },

    { id: 'q_start', value: 'Bắt đầu: Nhập kết quả mẫu đo\n(Loại mẫu: Nước thải CN/SH, Khí thải; Lưu lượng)', style: 'ellipse;fillColor=#286B4F;strokeColor=#1E563F;fontStyle=1;fontColor=#FFFFFF;', x: 310, y: 70, w: 320, h: 55 },

    { id: 'q_select', value: 'Tự động chọn bộ quy chuẩn & Cột áp dụng\n(QCVN 40, 14, 19 theo Cột A hoặc Cột B)', style: 'shape=rect;rounded=1;fillColor=#EFF6FF;strokeColor=#2563EB;strokeWidth=1.5;fontStyle=1;', x: 330, y: 160, w: 280, h: 55 },

    { id: 'q_gate', value: 'Đủ chỉ tiêu bắt buộc &\nĐúng chu kỳ lấy mẫu?', style: 'rhombus;fillColor=#FEF3C7;strokeColor=#D97706;fontStyle=1;', x: 370, y: 250, w: 200, h: 80 },
    { id: 'q_err', value: 'DỪNG: Gán INCOMPLETE\n(Khóa xuất báo cáo chính thức)', style: 'shape=rect;rounded=1;fillColor=#FEF2F2;strokeColor=#DC2626;fontColor=#DC2626;fontStyle=1;', x: 670, y: 265, w: 220, h: 50 },

    { id: 'q_compare', value: 'So sánh từng thông số đo với ngưỡng quy chuẩn\n(Ngưỡng Max, Min, và Khoảng giá trị pH)', style: 'shape=rect;rounded=1;fillColor=#F0FDF4;strokeColor=#16A34A;strokeWidth=1.5;fontStyle=1;', x: 320, y: 370, w: 300, h: 55 },

    { id: 'q_branch', value: 'Đánh giá phân loại 3 mức trạng thái:\n• 🔴 Vượt ngưỡng: Có ít nhất 1 thông số vượt chuẩn\n• 🟡 Cảnh báo: Các chỉ tiêu đạt nhưng có chỉ tiêu > 80% ngưỡng\n• 🟢 Đạt chuẩn: 100% chỉ tiêu nằm trong giới hạn an toàn', style: 'shape=rect;rounded=1;fillColor=#F8FAFC;strokeColor=#286B4F;strokeWidth=2;fontStyle=1;', x: 300, y: 465, w: 340, h: 85 },

    { id: 'q_save', value: 'Lưu kết quả đánh giá vào CSDL (bảng qcvn_samples)\nGhi nhận trang_thai_tong_quat & evaluation_details', style: 'shape=rect;rounded=1;fillColor=#F5F3FF;strokeColor=#7C3AED;strokeWidth=1.5;fontStyle=1;', x: 320, y: 590, w: 300, h: 55 },

    { id: 'q_end', value: 'Kết thúc: Hiển thị ghim màu trên Bản đồ GIS\n(Xanh: Đạt · Vàng: Cảnh báo · Đỏ: Vượt)', style: 'ellipse;fillColor=#286B4F;strokeColor=#1E563F;fontStyle=1;fontColor=#FFFFFF;', x: 310, y: 685, w: 320, h: 55 },

    // Connectors
    { id: 'e_q1', isEdge: true, source: 'q_start', target: 'q_select', style: 'endArrow=classic;html=1;strokeColor=#286B4F;strokeWidth=1.5;' },
    { id: 'e_q2', isEdge: true, source: 'q_select', target: 'q_gate', style: 'endArrow=classic;html=1;strokeColor=#2563EB;strokeWidth=1.5;' },
    { id: 'e_q3', isEdge: true, source: 'q_gate', target: 'q_err', value: 'Thiếu', style: 'endArrow=classic;html=1;strokeColor=#DC2626;strokeWidth=1.4;fontColor=#DC2626;' },
    { id: 'e_q4', isEdge: true, source: 'q_gate', target: 'q_compare', value: 'Đầy đủ', style: 'endArrow=classic;html=1;strokeColor=#16A34A;strokeWidth=1.4;fontColor=#16A34A;' },
    { id: 'e_q5', isEdge: true, source: 'q_compare', target: 'q_branch', style: 'endArrow=classic;html=1;strokeColor=#16A34A;strokeWidth=1.5;' },
    { id: 'e_q6', isEdge: true, source: 'q_branch', target: 'q_save', style: 'endArrow=classic;html=1;strokeColor=#286B4F;strokeWidth=1.5;' },
    { id: 'e_q7', isEdge: true, source: 'q_save', target: 'q_end', style: 'endArrow=classic;html=1;strokeColor=#7C3AED;strokeWidth=1.5;' }
  ]
};

// 7. Sơ đồ 2.7: Sơ đồ Hoạt động Crawler (3 Làn bơi, Không chồng chéo)
const sd27 = {
  id: 'sd27_crawler_activity',
  filename: 'So_do_2.7_Cap_Nhat_Phap_Ly_Crawler',
  title: 'Sơ đồ 2.7: Sơ đồ Hoạt động của tiến trình cập nhật pháp lý tự động (Web Crawler)',
  width: 1050,
  height: 750,
  cells: [
    { id: 't7', value: 'SƠ ĐỒ 2.7: SƠ ĐỒ HOẠT ĐỘNG TIẾN TRÌNH CẬP NHẬT PHÁP LÝ TỰ ĐỘNG (WEB CRAWLER)', style: 'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=18;fontStyle=1;', x: 80, y: 20, w: 900, h: 35 },

    // 3 Swimlanes
    { id: 'lane_1', value: 'QUẢN TRỊ VIÊN / LẬP LỊCH', style: 'shape=rect;rounded=0;fillColor=#FFFBEB;strokeColor=#D97706;strokeWidth=1.5;verticalAlign=top;spacingTop=8;fontStyle=1;', x: 60, y: 70, w: 280, h: 650 },
    { id: 'lane_2', value: 'ĐỘNG CƠ CRAWLER (BACKEND)', style: 'shape=rect;rounded=0;fillColor=#F0F9FF;strokeColor=#0284C7;strokeWidth=1.5;verticalAlign=top;spacingTop=8;fontStyle=1;', x: 340, y: 70, w: 370, h: 650 },
    { id: 'lane_3', value: 'CƠ SỞ DỮ LIỆU POSTGRESQL', style: 'shape=rect;rounded=0;fillColor=#F5F3FF;strokeColor=#7C3AED;strokeWidth=1.5;verticalAlign=top;spacingTop=8;fontStyle=1;', x: 710, y: 70, w: 280, h: 650 },

    // Sequential Step Ladder (NO CROSSING!)
    { id: 'cr_start', value: 'Kích hoạt quét:\nnode-cron hoặc bấm nút', style: 'ellipse;fillColor=#D97706;fontColor=#FFFFFF;fontStyle=1;', x: 100, y: 120, w: 200, h: 55 },
    { id: 'cr_fetch', value: 'Gửi HTTP Request tải trang\n(luatmoitruong.vn)', style: 'shape=rect;rounded=1;fillColor=#FFFFFF;strokeColor=#0284C7;fontStyle=1;', x: 410, y: 120, w: 230, h: 55 },
    { id: 'cr_parse', value: 'Bóc tách số hiệu, điều khoản\n& Tính mã băm SHA-256', style: 'shape=rect;rounded=1;fillColor=#FFFFFF;strokeColor=#0284C7;fontStyle=1;', x: 410, y: 220, w: 230, h: 55 },
    { id: 'cr_query', value: 'Truy vấn băm cũ\ntrong bảng laws', style: 'shape=rect;rounded=1;fillColor=#FFFFFF;strokeColor=#7C3AED;fontStyle=1;', x: 750, y: 220, w: 200, h: 55 },
    { id: 'cr_check', value: 'Băm SHA-256\nkhác biệt?', style: 'rhombus;fillColor=#FEF3C7;strokeColor=#D97706;fontStyle=1;', x: 450, y: 320, w: 150, h: 70 },
    { id: 'cr_stop', value: 'Bỏ qua (Không đổi)', style: 'shape=rect;rounded=1;fillColor=#F8FAFC;strokeColor=#64748B;', x: 750, y: 330, w: 180, h: 45 },
    { id: 'cr_save', value: 'Lưu bản ghi chờ duyệt\n(crawler_candidates: PENDING)', style: 'shape=rect;rounded=1;fillColor=#FFFFFF;strokeColor=#7C3AED;fontStyle=1;', x: 410, y: 440, w: 230, h: 55 },
    { id: 'cr_admin', value: 'Quản trị viên rà soát\n& Bấm Xác nhận công bố', style: 'shape=rect;rounded=1;fillColor=#FEF3C7;strokeColor=#D97706;fontStyle=1;', x: 100, y: 530, w: 200, h: 55 },
    { id: 'cr_publish', value: 'Chuyển trạng thái VERIFIED\n(Chính thức tham gia runtime)', style: 'shape=rect;rounded=1;fillColor=#ECFDF5;strokeColor=#059669;strokeWidth=2;fontStyle=1;', x: 410, y: 530, w: 230, h: 55 },
    { id: 'cr_end', value: 'Hoàn tất phiên đồng bộ', style: 'ellipse;fillColor=#286B4F;fontColor=#FFFFFF;fontStyle=1;', x: 425, y: 630, w: 200, h: 50 },

    // Connectors
    { id: 'e_cr_1', isEdge: true, source: 'cr_start', target: 'cr_fetch', style: 'endArrow=classic;html=1;strokeColor=#D97706;strokeWidth=1.5;' },
    { id: 'e_cr_2', isEdge: true, source: 'cr_fetch', target: 'cr_parse', style: 'endArrow=classic;html=1;strokeColor=#0284C7;strokeWidth=1.5;' },
    { id: 'e_cr_3', isEdge: true, source: 'cr_parse', target: 'cr_query', style: 'endArrow=classic;html=1;strokeColor=#7C3AED;strokeWidth=1.5;' },
    { id: 'e_cr_4', isEdge: true, source: 'cr_query', target: 'cr_check', style: 'endArrow=classic;html=1;strokeColor=#0284C7;strokeWidth=1.5;' },
    { id: 'e_cr_5', isEdge: true, source: 'cr_check', target: 'cr_stop', value: 'Trùng (0)', style: 'endArrow=classic;html=1;strokeColor=#64748B;strokeWidth=1.2;' },
    { id: 'e_cr_6', isEdge: true, source: 'cr_check', target: 'cr_save', value: 'Khác (!=)', style: 'endArrow=classic;html=1;strokeColor=#D97706;strokeWidth=1.4;' },
    { id: 'e_cr_7', isEdge: true, source: 'cr_save', target: 'cr_admin', style: 'endArrow=classic;html=1;strokeColor=#D97706;strokeWidth=1.5;' },
    { id: 'e_cr_8', isEdge: true, source: 'cr_admin', target: 'cr_publish', style: 'endArrow=classic;html=1;strokeColor=#059669;strokeWidth=1.5;' },
    { id: 'e_cr_9', isEdge: true, source: 'cr_publish', target: 'cr_end', style: 'endArrow=classic;html=1;strokeColor=#286B4F;strokeWidth=1.5;' }
  ]
};

// 8. Sơ đồ 2.8: Lưu đồ Nhắc hạn tuân thủ môi trường (Trục dọc 3 nhánh song song)
const sd28 = {
  id: 'sd28_reminder',
  filename: 'So_do_2.8_Tinh_Han_Nhac_Nghia_Vu',
  title: 'Sơ đồ 2.8: Lưu đồ Tính hạn và phân mức cảnh báo nghĩa vụ môi trường',
  width: 950,
  height: 750,
  cells: [
    { id: 't8', value: 'SƠ ĐỒ 2.8: LƯU ĐỒ TÍNH HẠN VÀ PHÂN MỨC CẢNH BÁO NGHĨA VỤ MÔI TRƯỜNG', style: 'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=18;fontStyle=1;', x: 100, y: 20, w: 750, h: 35 },

    { id: 'rm_start', value: 'Bắt đầu: Tác vụ cron chạy ngầm định kỳ hàng ngày (00:00)\nĐọc danh mục dự án & nghĩa vụ định kỳ trong CSDL', style: 'ellipse;fillColor=#286B4F;strokeColor=#1E563F;fontStyle=1;fontColor=#FFFFFF;', x: 300, y: 70, w: 340, h: 55 },

    { id: 'rm_calc', value: 'Tính mốc thời hạn đến hạn tiếp theo (T_due)\nvà khoảng cách số ngày còn lại: Δt = T_due - T_hien_tai', style: 'shape=rect;rounded=1;fillColor=#EFF6FF;strokeColor=#2563EB;strokeWidth=1.5;fontStyle=1;', x: 310, y: 165, w: 320, h: 55 },

    { id: 'rm_branch', value: 'Phân loại số ngày còn lại (Δt)?', style: 'rhombus;fillColor=#FEF3C7;strokeColor=#D97706;fontStyle=1;', x: 370, y: 260, w: 200, h: 80 },

    // 3 parallel branches
    { id: 'rm_danger', value: '🔴 ĐÃ QUÁ HẠN (Δt < 0)\nCảnh báo mức cao nhất', style: 'shape=rect;rounded=1;fillColor=#FEF2F2;strokeColor=#DC2626;fontColor=#DC2626;fontStyle=1;', x: 80, y: 390, w: 220, h: 60 },
    { id: 'rm_warn', value: '🟡 SẮP ĐẾN HẠN (0 <= Δt <= 15)\nNhắc nhở chuẩn bị nộp', style: 'shape=rect;rounded=1;fillColor=#FFFBEB;strokeColor=#D97706;fontColor=#B45309;fontStyle=1;', x: 360, y: 390, w: 220, h: 60 },
    { id: 'rm_normal', value: '🟢 TRONG HẠN (Δt > 15)\nTiến độ tuân thủ an toàn', style: 'shape=rect;rounded=1;fillColor=#ECFDF5;strokeColor=#059669;fontColor=#065F46;fontStyle=1;', x: 640, y: 390, w: 220, h: 60 },

    { id: 'rm_update', value: 'Cập nhật bảng reminders & Tổng hợp KPI Dashboard\n(Hiển thị thẻ cảnh báo và thông tin hạn nộp)', style: 'shape=rect;rounded=1;fillColor=#F8FAFC;strokeColor=#286B4F;strokeWidth=2;fontStyle=1;', x: 280, y: 510, w: 380, h: 65 },

    { id: 'rm_end', value: 'Hoàn tất chu kỳ tính hạn hàng ngày', style: 'ellipse;fillColor=#286B4F;strokeColor=#1E563F;fontStyle=1;fontColor=#FFFFFF;', x: 330, y: 625, w: 280, h: 50 },

    // Connectors
    { id: 'e_rm_1', isEdge: true, source: 'rm_start', target: 'rm_calc', style: 'endArrow=classic;html=1;strokeColor=#286B4F;strokeWidth=1.5;' },
    { id: 'e_rm_2', isEdge: true, source: 'rm_calc', target: 'rm_branch', style: 'endArrow=classic;html=1;strokeColor=#2563EB;strokeWidth=1.5;' },
    { id: 'e_rm_3', isEdge: true, source: 'rm_branch', target: 'rm_danger', value: 'Quá hạn', style: 'endArrow=classic;html=1;strokeColor=#DC2626;strokeWidth=1.4;fontColor=#DC2626;' },
    { id: 'e_rm_4', isEdge: true, source: 'rm_branch', target: 'rm_warn', value: 'Sắp hạn', style: 'endArrow=classic;html=1;strokeColor=#D97706;strokeWidth=1.4;fontColor=#D97706;' },
    { id: 'e_rm_5', isEdge: true, source: 'rm_branch', target: 'rm_normal', value: 'Trong hạn', style: 'endArrow=classic;html=1;strokeColor=#059669;strokeWidth=1.4;fontColor=#059669;' },
    { id: 'e_rm_6', isEdge: true, source: 'rm_danger', target: 'rm_update', style: 'endArrow=classic;html=1;strokeColor=#64748B;' },
    { id: 'e_rm_7', isEdge: true, source: 'rm_warn', target: 'rm_update', style: 'endArrow=classic;html=1;strokeColor=#64748B;' },
    { id: 'e_rm_8', isEdge: true, source: 'rm_normal', target: 'rm_update', style: 'endArrow=classic;html=1;strokeColor=#64748B;' },
    { id: 'e_rm_9', isEdge: true, source: 'rm_update', target: 'rm_end', style: 'endArrow=classic;html=1;strokeColor=#286B4F;strokeWidth=1.5;' }
  ]
};

// 9. Sơ đồ 2.9: Luồng truy vấn và hiển thị dữ liệu không gian GIS (3 Cột Tuần tự)
const sd29 = {
  id: 'sd29_gis_spatial',
  filename: 'So_do_2.9_Truy_Van_Khong_Gian_GIS',
  title: 'Sơ đồ 2.9: Luồng truy vấn và hiển thị dữ liệu không gian GIS',
  width: 1050,
  height: 600,
  cells: [
    { id: 't9', value: 'SƠ ĐỒ 2.9: LUỒNG TRUY VẤN VÀ HIỂN THỊ DỮ LIỆU KHÔNG GIAN GIS (POSTGIS -> LEAFLET)', style: 'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=18;fontStyle=1;', x: 75, y: 20, w: 900, h: 35 },

    // 3 Columns
    { id: 'col_client', value: 'CLIENT: GIAO DIỆN LEAFLET.JS', style: 'shape=rect;rounded=0;fillColor=#F0FDF4;strokeColor=#16A34A;strokeWidth=1.5;verticalAlign=top;spacingTop=8;fontStyle=1;', x: 50, y: 70, w: 280, h: 500 },
    { id: 'col_server', value: 'SERVER: EXPRESS API & GIS SERVICE', style: 'shape=rect;rounded=0;fillColor=#F0F9FF;strokeColor=#0284C7;strokeWidth=1.5;verticalAlign=top;spacingTop=8;fontStyle=1;', x: 380, y: 70, w: 300, h: 500 },
    { id: 'col_db', value: 'DATABASE: POSTGRESQL & POSTGIS', style: 'shape=rect;rounded=0;fillColor=#F5F3FF;strokeColor=#7C3AED;strokeWidth=1.5;verticalAlign=top;spacingTop=8;fontStyle=1;', x: 730, y: 70, w: 270, h: 500 },

    // Step 1: User Filter
    { id: 'g_step1', value: 'Người dùng chọn bộ lọc\n(Tỉnh, Nhóm I/II/III, Trạng thái)', style: 'shape=rect;rounded=1;fillColor=#FFFFFF;strokeColor=#16A34A;fontStyle=1;', x: 80, y: 120, w: 220, h: 60 },

    // Step 2: API Call
    { id: 'g_step2', value: 'Nhận GET /api/projects/geo\nXác thực phiên đăng nhập JWT', style: 'shape=rect;rounded=1;fillColor=#FFFFFF;strokeColor=#0284C7;fontStyle=1;', x: 420, y: 120, w: 220, h: 60 },

    // Step 3: SQL Query PostGIS
    { id: 'g_step3', value: 'Thực thi SQL không gian:\nLấy tọa độ & mẫu đo gần nhất', style: 'shape=rect;rounded=1;fillColor=#FFFFFF;strokeColor=#7C3AED;fontStyle=1;', x: 760, y: 120, w: 210, h: 60 },

    // Step 4: Spatial Processing
    { id: 'g_step4', value: 'Phân tích bán kính tác động R\n& Đóng gói mảng GeoJSON', style: 'shape=rect;rounded=1;fillColor=#FFFFFF;strokeColor=#0284C7;fontStyle=1;', x: 420, y: 250, w: 220, h: 60 },

    // Step 5: Render Pins
    { id: 'g_step5', value: 'Dựng ghim Marker theo màu:\n🟢 Đạt · 🟡 Cảnh báo · 🔴 Vượt', style: 'shape=rect;rounded=1;fillColor=#FFFFFF;strokeColor=#16A34A;fontStyle=1;', x: 80, y: 250, w: 220, h: 60 },

    // Step 6: Render Circles & Layers
    { id: 'g_step6', value: 'Vẽ vòng tròn bán kính R &\nChồng lớp đa giác KCN, bảo vệ', style: 'shape=rect;rounded=1;fillColor=#FFFFFF;strokeColor=#16A34A;fontStyle=1;', x: 80, y: 370, w: 220, h: 60 },

    // Step 7: Popup Interactivity
    { id: 'g_step7', value: 'Gắn Popup thông tin dự án &\nNút xem chi tiết hồ sơ', style: 'shape=rect;rounded=1;fillColor=#FFFFFF;strokeColor=#16A34A;fontStyle=1;', x: 80, y: 480, w: 220, h: 60 },

    // Clean Horizontal & Downward Connectors (ZERO CROSSING)
    { id: 'e_g_1', isEdge: true, source: 'g_step1', target: 'g_step2', value: '1. Gọi API', style: 'endArrow=classic;html=1;strokeColor=#16A34A;strokeWidth=1.5;' },
    { id: 'e_g_2', isEdge: true, source: 'g_step2', target: 'g_step3', value: '2. SQL Query', style: 'endArrow=classic;html=1;strokeColor=#0284C7;strokeWidth=1.5;' },
    { id: 'e_g_3', isEdge: true, source: 'g_step3', target: 'g_step4', value: '3. Trả tọa độ', style: 'endArrow=classic;html=1;strokeColor=#7C3AED;strokeWidth=1.5;' },
    { id: 'e_g_4', isEdge: true, source: 'g_step4', target: 'g_step5', value: '4. GeoJSON', style: 'endArrow=classic;html=1;strokeColor=#0284C7;strokeWidth=1.5;' },
    { id: 'e_g_5', isEdge: true, source: 'g_step5', target: 'g_step6', style: 'endArrow=classic;html=1;strokeColor=#16A34A;strokeWidth=1.5;' },
    { id: 'e_g_6', isEdge: true, source: 'g_step6', target: 'g_step7', style: 'endArrow=classic;html=1;strokeColor=#16A34A;strokeWidth=1.5;' }
  ]
};

const ALL_DIAGRAMS = [
  sd21,
  sd22,
  sd23,
  sd24,
  sd25,
  sd26,
  sd27,
  sd28,
  sd29
];

// --------------------------------------------------------------------------------------------------
// XUẤT BẢN CÁC TỆP
// --------------------------------------------------------------------------------------------------

console.log('--- BẮT ĐẦU TẠO LẠI BỘ 9 SƠ ĐỒ TINH GIẢN, KHÔNG DÂY CHỒNG CHÉO ---');

// 1. Master draw.io file (9 tabs)
const masterDrawioXml = buildDrawioXml(ALL_DIAGRAMS);
const masterFilePath = path.join(OUTPUT_DIR, 'ETC_LegalHub_All_Diagrams.drawio');
fs.writeFileSync(masterFilePath, masterDrawioXml, 'utf8');
console.log(`✔ Đã tạo Master Workbook draw.io: ${masterFilePath}`);

// 2. Individual .drawio and .svg files
for (const diag of ALL_DIAGRAMS) {
  const singleXml = buildDrawioXml([diag]);
  const singleDrawioPath = path.join(OUTPUT_DIR, `${diag.filename}.drawio`);
  fs.writeFileSync(singleDrawioPath, singleXml, 'utf8');

  const svgContent = generateSvgFromDiagram(diag);
  const svgPath = path.join(IMAGES_DIR, `${diag.filename}.svg`);
  fs.writeFileSync(svgPath, svgContent, 'utf8');

  console.log(`✔ [${diag.id}] ${diag.filename}.drawio & .svg`);
}

console.log('\n--- HOÀN TẤT: 100% SƠ ĐỒ ĐÃ ĐƯỢC CHUẨN HÓA VÀ KHÔNG CÒN DÂY NỐI CHỒNG CHÉO ---');
