// Page navigation UI.
(function (global) {
  'use strict';

function showPage(id,btn){
  const activeBtn = document.querySelector('.nav-btn.active');
  const fromQcvn = activeBtn && activeBtn.dataset.page === 'qcvn';
  const toQcvn = id === 'qcvn';

  if (fromQcvn && !toQcvn) {
    if (global.AppQcvnView && typeof global.AppQcvnView.hasUnsavedChanges === 'function' && global.AppQcvnView.hasUnsavedChanges()) {
      if (!confirm('Bạn có thay đổi chưa lưu trên bảng QCVN. Bạn có chắc chắn muốn rời đi mà không lưu không?')) {
        return;
      }
      if (global.AppQcvnView.resetUnsavedChanges) {
        global.AppQcvnView.resetUnsavedChanges();
      }
    }
  }

  if (btn.classList.contains('tab-private') && !global.CurrentUser) {
    if (global.AppAuth && global.AppAuth.showLoginModal) {
      global.AppAuth.showLoginModal();
    } else {
      alert('Vui lòng đăng nhập để sử dụng chức năng này!');
    }
    return;
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
}

function updateCapLabel(){
  const v=document.getElementById('f-nganh').value;
  if(v&&global.AppData.IND_DB[v]) document.getElementById('cap-label').textContent=global.AppClassificationRules.getCapacityLabel(v);
  else document.getElementById('cap-label').textContent='Quy mô / Công suất *';
}

function initNavigation(){
  document.querySelectorAll('.nav-btn').forEach(btn=>{
    btn.addEventListener('click',()=>showPage(btn.dataset.page,btn));
  });
  document.getElementById('f-nganh').addEventListener('change',updateCapLabel);
}

global.AppNavigation = {initNavigation,showPage,updateCapLabel};
})(window);
