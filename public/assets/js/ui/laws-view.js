// Legal document list UI.
(function (global) {
  'use strict';

let currentFilter = 'all';
function getLawSortTime(law){
  if(law.sortDate) return new Date(law.sortDate).getTime();
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(law.hieuluc)){
    const [day,month,year]=law.hieuluc.split('/');
    return new Date(`${year}-${month}-${day}`).getTime();
  }
  return new Date(`${law.year}-01-01`).getTime();
}

function getTypeLabel(type){
  return {luat:'LUẬT',nd:'NGHỊ ĐỊNH',tt:'THÔNG TƯ',qcvn:'QCVN',vbhn:'VBHN'}[type]||type.toUpperCase();
}

function getStatusLabel(status){
  return {valid:'Còn hiệu lực',amended:'Đã sửa đổi (đọc kết hợp)',expired:'Hết hiệu lực'}[status]||status;
}

function renderLaws(){
  const list=document.getElementById('law-list');
  const filtered=global.AppData.LAWS.filter(l=>{
    if(currentFilter==='all') return true;
    if(currentFilter==='hieuluc') return l.status==='valid';
    if(currentFilter==='suadoi') return l.status==='amended';
    return l.type===currentFilter;
  }).sort((a,b)=>getLawSortTime(b)-getLawSortTime(a));
  list.innerHTML=filtered.map((l,i)=>`
    <div class="law-card ${l.status==='expired'?'expired':''} fade-up" style="animation-delay:${i*0.04}s">
      <div class="law-accent ${l.status}"></div>
      <div style="padding-left:12px">
        <div class="law-meta">
          <div class="law-year">${l.year}</div>
          <div class="law-content">
            <div class="law-status">
              <div class="status-dot ${l.status}"></div>
              <span class="status-label">${getStatusLabel(l.status)}</span>
              <span class="chip chip-gray" style="margin-left:4px">${getTypeLabel(l.type)}</span>
            </div>
            <div class="law-title">${l.ten}</div>
            <div class="law-number">${l.so} — Hiệu lực: ${l.hieuluc}</div>
            <div class="law-desc">${l.mo_ta}</div>
            ${l.note?`<div style="font-size:12px;color:var(--warn);margin-bottom:8px;padding:6px 10px;background:var(--warn-bg);border-radius:5px;border-left:3px solid #D4860A">⚡ ${l.note}</div>`:''}
            <div class="law-provisions">${l.dieu_khoang.map(d=>`<span class="provision">${d}</span>`).join('')}</div>
          </div>
        </div>
      </div>
    </div>`).join('');
}

function filterLaws(type,btn){
  currentFilter=type;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  renderLaws();
}

function initLawFilters(){
  document.querySelectorAll('.filter-btn').forEach(btn=>{
    btn.addEventListener('click',()=>filterLaws(btn.dataset.filter,btn));
  });
}

global.AppLawsView = {initLawFilters,renderLaws,filterLaws};
})(window);
