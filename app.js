/**
 * ========================================================
 * 校園平板借用系統 - 前端核心業務邏輯
 * ========================================================
 */

// 預設平板 28 台編號 (01~27, 30)
const DEFAULT_TABLETS_28 = [
  ...Array.from({ length: 27 }, (_, i) => String(i + 1).padStart(2, '0')),
  '30'
];

// 預設車輛設定 (A~G 共 7 台平板車)
const DEFAULT_CARTS_CONFIG = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(id => ({
  id: id,
  name: `${id} 車`,
  tablets: [...DEFAULT_TABLETS_28]
}));

// 預設節次與標準時段設定
const DEFAULT_PERIODS_CONFIG = [
  { id: '早自修', name: '早自修', start: '07:50', end: '08:35' },
  { id: '第一節', name: '第一節', start: '08:40', end: '09:25' },
  { id: '第二節', name: '第二節', start: '09:35', end: '10:20' },
  { id: '第三節', name: '第三節', start: '10:30', end: '11:15' },
  { id: '第四節', name: '第四節', start: '11:25', end: '12:10' },
  { id: '中午', name: '中午時段', start: '12:10', end: '13:20' },
  { id: '第五節', name: '第五節', start: '13:25', end: '14:10' },
  { id: '第六節', name: '第六節', start: '14:20', end: '15:05' },
  { id: '第七節', name: '第七節', start: '15:15', end: '16:00' },
  { id: '課後', name: '課後輔導', start: '16:05', end: '17:30' },
  { id: '整天', name: '整天借用', start: '08:00', end: '16:00' }
];

// 預設管理員密碼
const DEFAULT_ADMIN_PASSWORD = 'admin123';

// 應用程式狀態 (State)
const state = {
  currentTab: 'borrow',
  carts: [],
  periods: [],
  selectedCart: 'A',
  selectedPeriod: '第一節',
  selectedTablets: new Set(),
  reservations: [],
  matrixDate: '',
  gasUrl: '',
  isAdminLoggedIn: sessionStorage.getItem('tablet_system_admin_auth') === 'true'
};

// ==========================================
// 初始化流程 (Init)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  initDateInputs();
  initCartSelector();
  initPeriodSelector();
  loadReservations();
  updateConflictAndGrid();
  renderActiveReturns();
  renderScheduleMatrix();
  renderRecordsTable();
  updateHeaderBadges();
  updateAdminView();
  initTextareaListeners();
});

// 監聽彈窗內文字計數
function initTextareaListeners() {
  const textarea = document.getElementById('cart-edit-tablets');
  if (textarea) {
    textarea.addEventListener('input', () => {
      const list = parseTabletInput(textarea.value);
      const previewEl = document.getElementById('cart-tablets-count-preview');
      if (previewEl) previewEl.textContent = list.length;
    });
  }
}

// 載入系統設定
function loadConfig() {
  state.gasUrl = localStorage.getItem('tablet_system_gas_url') || '';
  const inputGas = document.getElementById('setting-gas-url');
  if (inputGas) inputGas.value = state.gasUrl;
  updateGasBadge();

  // 載入車輛設定
  const cachedCarts = localStorage.getItem('tablet_system_carts_config');
  if (cachedCarts) {
    try {
      state.carts = JSON.parse(cachedCarts);
    } catch (e) {
      state.carts = [...DEFAULT_CARTS_CONFIG];
    }
  } else {
    state.carts = [...DEFAULT_CARTS_CONFIG];
  }

  if (!state.carts.some(c => c.id === state.selectedCart)) {
    state.selectedCart = state.carts[0] ? state.carts[0].id : 'A';
  }

  // 載入節次設定
  const cachedPeriods = localStorage.getItem('tablet_system_periods_config');
  if (cachedPeriods) {
    try {
      state.periods = JSON.parse(cachedPeriods);
    } catch (e) {
      state.periods = [...DEFAULT_PERIODS_CONFIG];
    }
  } else {
    state.periods = [...DEFAULT_PERIODS_CONFIG];
  }

  if (!state.periods.some(p => p.id === state.selectedPeriod)) {
    state.selectedPeriod = state.periods[0] ? state.periods[0].id : '第一節';
  }
}

function getCartById(cartId) {
  return state.carts.find(c => c.id === cartId) || state.carts[0];
}

function getCartName(cartId) {
  const cart = state.carts.find(c => c.id === cartId);
  return cart ? cart.name : `${cartId} 車`;
}

function getCurrentCartTablets() {
  const cart = getCartById(state.selectedCart);
  return cart && Array.isArray(cart.tablets) ? cart.tablets : [];
}

// 初始化日期預設值 (今天)
function initDateInputs() {
  const today = getTodayDateString();
  const inputBorrowDate = document.getElementById('input-borrow-date');
  const inputReturnDate = document.getElementById('input-return-date');
  const matrixDateInput = document.getElementById('matrix-date-input');

  if (inputBorrowDate) inputBorrowDate.value = today;
  if (inputReturnDate) inputReturnDate.value = today;
  if (matrixDateInput) matrixDateInput.value = today;
  state.matrixDate = today;

  ['input-borrow-date', 'input-borrow-time', 'input-return-date', 'input-return-time'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        updateSummary();
        updateConflictAndGrid();
      });
    }
  });
}

// 動態產生車輛選擇按鈕
function initCartSelector() {
  const container = document.getElementById('cart-selector-container');
  const labelTotal = document.getElementById('label-total-carts');
  if (labelTotal) labelTotal.textContent = `共 ${state.carts.length} 台行動平板車`;
  if (!container) return;
  container.innerHTML = '';

  state.carts.forEach(cart => {
    const card = document.createElement('button');
    card.type = 'button';
    card.id = `cart-btn-${cart.id}`;
    const isActive = cart.id === state.selectedCart;
    card.className = `cart-card p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition ${
      isActive
        ? 'active border-blue-500 bg-blue-50/70 text-blue-700'
        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
    }`;
    card.innerHTML = `
      <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
        ${cart.id}
      </div>
      <span class="text-xs font-bold truncate max-w-full px-1">${escapeHtml(cart.name)}</span>
      <span class="text-[10px] text-slate-400">${cart.tablets.length} 台平板</span>
    `;
    card.onclick = () => selectCart(cart.id);
    container.appendChild(card);
  });
}

// 動態產生節次選擇按鈕
function initPeriodSelector() {
  const container = document.getElementById('period-button-group');
  if (!container) return;
  container.innerHTML = '';

  state.periods.forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = `period-btn-${p.id}`;
    const isActive = p.id === state.selectedPeriod;
    btn.className = `period-pill px-3 py-1.5 rounded-lg text-xs font-medium transition ${
      isActive ? 'active' : 'bg-white text-slate-700'
    }`;
    btn.innerHTML = `${escapeHtml(p.name)} <span class="opacity-70 text-[10px] ml-0.5">${p.start}</span>`;
    btn.onclick = () => selectPeriod(p.id);
    container.appendChild(btn);
  });

  if (state.periods.length > 0) {
    selectPeriod(state.selectedPeriod);
  }
}

// ==========================================
// 車輛與節次切換邏輯
// ==========================================
function selectCart(cartId) {
  state.selectedCart = cartId;
  state.carts.forEach(c => {
    const el = document.getElementById(`cart-btn-${c.id}`);
    if (el) {
      if (c.id === cartId) {
        el.className = 'cart-card active p-3 rounded-xl border-2 border-blue-500 bg-blue-50/70 text-blue-700 flex flex-col items-center justify-center gap-1 transition';
      } else {
        el.className = 'cart-card p-3 rounded-xl border-2 border-slate-200 bg-white hover:border-slate-300 text-slate-700 flex flex-col items-center justify-center gap-1 transition';
      }
    }
  });

  state.selectedTablets.clear();
  updateConflictAndGrid();
  updateSummary();
}

function selectPeriod(periodId) {
  state.selectedPeriod = periodId;
  const def = state.periods.find(p => p.id === periodId);

  state.periods.forEach(p => {
    const btn = document.getElementById(`period-btn-${p.id}`);
    if (btn) {
      if (p.id === periodId) {
        btn.className = 'period-pill active px-3 py-1.5 rounded-lg text-xs font-semibold';
      } else {
        btn.className = 'period-pill bg-white text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium';
      }
    }
  });

  if (def) {
    const inputBorrowTime = document.getElementById('input-borrow-time');
    const inputReturnTime = document.getElementById('input-return-time');
    if (inputBorrowTime) inputBorrowTime.value = def.start;
    if (inputReturnTime) inputReturnTime.value = def.end;
  }

  updateConflictAndGrid();
  updateSummary();
}

// ==========================================
// 防衝堂衝突檢查 (先借用登記，歸還時才註銷登記)
// ==========================================
function getConflictMap() {
  const borrowDate = document.getElementById('input-borrow-date').value;
  const borrowTime = document.getElementById('input-borrow-time').value || '00:00';
  const returnDate = document.getElementById('input-return-date').value;
  const returnTime = document.getElementById('input-return-time').value || '23:59';

  const conflictMap = {};

  const startStamp = new Date(`${borrowDate}T${borrowTime}`).getTime();
  const endStamp = new Date(`${returnDate}T${returnTime}`).getTime();

  state.reservations.forEach(res => {
    // 只有相同平板車、且尚未歸還註銷 (status !== 'returned') 才占用
    if (res.cart !== state.selectedCart || res.status === 'returned') return;

    // 核心邏輯：先借用登記，歸還時才註銷登記
    // 若該單已借出登記，且尚未被歸還註銷：
    // 1. 若借用日期在欲借日期當天或之前 (res.borrowDate <= borrowDate)，代表已被實體借走且未歸還註銷！
    // 2. 或預約時段有重疊
    const isTodayOrPrior = res.borrowDate <= borrowDate;
    const resStart = new Date(`${res.borrowDate}T${res.borrowTime}`).getTime();
    const resEnd = new Date(`${res.returnDate}T${res.returnTime}`).getTime();
    const isOverlapping = (startStamp < resEnd) && (endStamp > resStart);

    if (isTodayOrPrior || isOverlapping) {
      if (Array.isArray(res.tablets)) {
        res.tablets.forEach(num => {
          conflictMap[num] = res;
        });
      }
    }
  });

  return conflictMap;
}

// 繪製當前車輛的平板選擇按鈕
function updateConflictAndGrid() {
  const container = document.getElementById('tablet-grid-container');
  if (!container) return;
  container.innerHTML = '';

  const conflictMap = getConflictMap();
  const tablets = getCurrentCartTablets();

  tablets.forEach(num => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = `tablet-btn-${num}`;
    const isConflicted = Boolean(conflictMap[num]);

    if (isConflicted) {
      state.selectedTablets.delete(num);
      const conflictRes = conflictMap[num];
      btn.className = 'tablet-btn disabled';
      btn.title = `【借出使用中，尚未歸還註銷】${conflictRes.teacherName} 老師 (${conflictRes.className} / ${conflictRes.period})`;
      btn.innerHTML = `
        <span class="text-xs font-bold">${num}</span>
        <span class="text-[9px] mt-0.5 text-red-700 truncate w-full px-1 text-center font-normal">借出中</span>
      `;
    } else {
      const isSelected = state.selectedTablets.has(num);
      btn.className = `tablet-btn available ${isSelected ? 'selected' : ''}`;
      btn.innerHTML = `
        <span class="text-sm font-bold">${num}</span>
        ${isSelected ? '<i class="fa-solid fa-check text-[10px] mt-0.5"></i>' : '<span class="text-[9px] text-slate-400 mt-0.5">可借</span>'}
      `;
      btn.onclick = () => toggleTablet(num);
    }

    container.appendChild(btn);
  });

  updateSelectedCountUI();
}

function toggleTablet(num) {
  if (state.selectedTablets.has(num)) {
    state.selectedTablets.delete(num);
  } else {
    state.selectedTablets.add(num);
  }
  updateConflictAndGrid();
  updateSummary();
}

function toggleSelectAllTablets() {
  const conflictMap = getConflictMap();
  const tablets = getCurrentCartTablets();
  const availableTablets = tablets.filter(num => !conflictMap[num]);

  if (availableTablets.length === 0) {
    alert('該時段此平板車已被全數借出登記且尚未歸還，無可用平板！');
    return;
  }

  const allAvailableAreSelected = availableTablets.every(num => state.selectedTablets.has(num));

  if (allAvailableAreSelected) {
    state.selectedTablets.clear();
  } else {
    availableTablets.forEach(num => state.selectedTablets.add(num));
  }

  updateConflictAndGrid();
  updateSummary();
}

function clearSelectedTablets() {
  state.selectedTablets.clear();
  updateConflictAndGrid();
  updateSummary();
}

function updateSelectedCountUI() {
  const tablets = getCurrentCartTablets();
  const totalCount = tablets.length;
  const count = state.selectedTablets.size;
  const countEl = document.getElementById('label-selected-count');
  if (countEl) countEl.textContent = `${count} / ${totalCount}`;

  const btnAll = document.getElementById('btn-select-all');
  if (btnAll) {
    const conflictMap = getConflictMap();
    const availableCount = tablets.filter(num => !conflictMap[num]).length;
    if (count > 0 && count === availableCount) {
      btnAll.innerHTML = '<i class="fa-solid fa-xmark mr-1"></i> 取消全選';
      btnAll.className = 'px-3.5 py-1.5 text-xs font-bold rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 border border-slate-300 transition flex items-center gap-1.5';
    } else {
      btnAll.innerHTML = '<i class="fa-solid fa-check-double mr-1"></i> 整車借用 (全選)';
      btnAll.className = 'px-3.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition flex items-center gap-1.5';
    }
  }
}

function updateSummary() {
  const elCart = document.getElementById('summary-cart');
  const elPeriod = document.getElementById('summary-period');
  const elCount = document.getElementById('summary-count');
  const tablets = getCurrentCartTablets();

  if (elCart) elCart.textContent = getCartName(state.selectedCart);
  if (elPeriod) elPeriod.textContent = state.selectedPeriod;
  if (elCount) {
    const isFull = state.selectedTablets.size === tablets.length && tablets.length > 0;
    elCount.textContent = `${state.selectedTablets.size} 台${isFull ? ' (整車)' : ''}`;
  }
}

// ==========================================
// 借用表單提交 (Submit)
// ==========================================
async function handleBorrowSubmit(e) {
  e.preventDefault();

  if (state.selectedTablets.size === 0) {
    alert('請至少勾選一台欲借用的平板！(或點選「整車借用」)');
    return;
  }

  const teacherName = document.getElementById('input-teacher-name').value.trim();
  const className = document.getElementById('input-class-name').value.trim();
  const phone = document.getElementById('input-phone').value.trim();
  const note = document.getElementById('input-note').value.trim();
  const borrowDate = document.getElementById('input-borrow-date').value;
  const borrowTime = document.getElementById('input-borrow-time').value;
  const returnDate = document.getElementById('input-return-date').value;
  const returnTime = document.getElementById('input-return-time').value;

  if (!borrowDate || !borrowTime || !returnDate || !returnTime) {
    alert('請完整選擇借用與歸還的日期和時間！');
    return;
  }

  const conflictMap = getConflictMap();
  const conflictItems = Array.from(state.selectedTablets).filter(num => conflictMap[num]);
  if (conflictItems.length > 0) {
    alert(`送出失敗：平板編號 [${conflictItems.join(', ')}] 目前已被借出登記且尚未歸還註銷，請重新選擇！`);
    updateConflictAndGrid();
    return;
  }

  const sortedTablets = Array.from(state.selectedTablets).sort();
  const currentTotal = getCurrentCartTablets().length;
  const isFullCart = sortedTablets.length === currentTotal && currentTotal > 0;

  const newReservation = {
    id: 'TB-' + Date.now().toString().slice(-6),
    cart: state.selectedCart,
    tablets: sortedTablets,
    isFullCart: isFullCart,
    borrowDate: borrowDate,
    borrowTime: borrowTime,
    period: state.selectedPeriod,
    returnDate: returnDate,
    returnTime: returnTime,
    teacherName: teacherName,
    className: className,
    phone: phone,
    note: note,
    status: 'borrowed', // borrowed (借出登記中，待註銷), returned (已歸還註銷)
    createdAt: new Date().toISOString()
  };

  state.reservations.unshift(newReservation);
  saveReservations();
  syncToGoogleSheets(newReservation);
  showSuccessModal(newReservation);

  document.getElementById('borrow-form').reset();
  state.selectedTablets.clear();
  updateConflictAndGrid();
  renderActiveReturns();
  renderScheduleMatrix();
  renderRecordsTable();
  updateHeaderBadges();
}

function showSuccessModal(res) {
  const modal = document.getElementById('modal-success');
  const content = document.getElementById('modal-success-content');
  if (!modal || !content) return;

  content.innerHTML = `
    <div class="flex justify-between border-b border-slate-200 pb-2">
      <span class="text-slate-500">借用單號：</span>
      <span class="font-mono font-bold text-blue-700">${res.id}</span>
    </div>
    <div class="flex justify-between">
      <span class="text-slate-500">借用老師：</span>
      <span class="font-semibold text-slate-800">${escapeHtml(res.teacherName)} (${escapeHtml(res.className)})</span>
    </div>
    <div class="flex justify-between">
      <span class="text-slate-500">平板車輛：</span>
      <span class="font-semibold text-slate-800">${escapeHtml(getCartName(res.cart))} (${res.isFullCart ? '整車借用' : res.tablets.length + ' 台'})</span>
    </div>
    <div class="flex justify-between">
      <span class="text-slate-500">借用時段：</span>
      <span class="font-semibold text-slate-800">${res.borrowDate} ${escapeHtml(res.period)} (${res.borrowTime} ~ ${res.returnTime})</span>
    </div>
    <div class="flex justify-between">
      <span class="text-slate-500">當前狀態：</span>
      <span class="font-bold text-amber-600">借出使用中 (待歸還註銷)</span>
    </div>
    <div class="pt-1 text-[11px] text-slate-500 border-t border-slate-200">
      平板編號：<span class="font-mono text-slate-700">${res.isFullCart ? '全車借用' : res.tablets.join(', ')}</span>
    </div>
  `;

  modal.classList.remove('hidden');
}

function closeSuccessModal() {
  const modal = document.getElementById('modal-success');
  if (modal) modal.classList.add('hidden');
}

function closeSuccessModalAndGoReturn() {
  closeSuccessModal();
  switchTab('return');
}

function printBorrowSlip() {
  window.print();
}

// ==========================================
// 歸還註銷專區邏輯 (Return & Check-in)
// ==========================================
function renderActiveReturns() {
  // 更新車輛下拉選單
  const cartFilterSelect = document.getElementById('returns-cart-filter');
  if (cartFilterSelect) {
    const currentVal = cartFilterSelect.value || 'all';
    cartFilterSelect.innerHTML = '<option value="all">所有車輛</option>';
    state.carts.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      if (c.id === currentVal) opt.selected = true;
      cartFilterSelect.appendChild(opt);
    });
  }

  const container = document.getElementById('active-returns-container');
  const emptyEl = document.getElementById('active-returns-empty');
  const searchInput = document.getElementById('returns-search-input');
  if (!container) return;

  const keyword = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const cartFilter = cartFilterSelect ? cartFilterSelect.value : 'all';

  // 取得所有「借出登記中（未歸還）」的單據
  const allActive = state.reservations.filter(r => r.status === 'borrowed');

  // 計算在外平板總數
  const totalActiveTablets = allActive.reduce((sum, r) => sum + (Array.isArray(r.tablets) ? r.tablets.length : 0), 0);
  const statCount = document.getElementById('stat-pending-returns-count');
  const statTablets = document.getElementById('stat-pending-tablets-count');
  const badgeCount = document.getElementById('badge-active-count');

  if (statCount) statCount.innerHTML = `${allActive.length} <span class="text-xs font-normal text-slate-400">筆</span>`;
  if (statTablets) statTablets.innerHTML = `${totalActiveTablets} <span class="text-xs font-normal text-slate-400">台</span>`;
  if (badgeCount) badgeCount.textContent = allActive.length;

  let filtered = allActive.filter(r => {
    if (cartFilter !== 'all' && r.cart !== cartFilter) return false;
    if (keyword) {
      const match = (r.teacherName + r.className + getCartName(r.cart) + r.cart + r.id + (r.note || '')).toLowerCase();
      if (!match.includes(keyword)) return false;
    }
    return true;
  });

  container.innerHTML = '';

  if (filtered.length === 0) {
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  } else {
    if (emptyEl) emptyEl.classList.add('hidden');
  }

  filtered.forEach(r => {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4';

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <span class="inline-flex items-center gap-1.5 font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg text-xs">
            <i class="fa-solid fa-van-shuttle"></i> ${escapeHtml(getCartName(r.cart))}
          </span>
          <span class="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            借出登記中 (待註銷)
          </span>
        </div>

        <div class="space-y-1.5 text-xs text-slate-600">
          <div class="flex justify-between items-baseline">
            <span class="text-slate-400">借用老師：</span>
            <span class="font-bold text-slate-800 text-sm">${escapeHtml(r.teacherName)} (${escapeHtml(r.className)})</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">登記時段：</span>
            <span class="font-medium text-slate-700">${r.borrowDate} ${escapeHtml(r.period)} (${r.borrowTime}~${r.returnTime})</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">借出台數：</span>
            <span class="font-bold text-blue-600">${r.isFullCart ? '整車借用' : `${r.tablets.length} 台`}</span>
          </div>
          <div class="bg-slate-50 p-2 rounded-lg font-mono text-[11px] text-slate-500 break-words mt-1">
            編號：${r.isFullCart ? '全車借用' : r.tablets.join(', ')}
          </div>
          ${r.phone ? `<div class="text-[11px] text-slate-400">分機/電話：${escapeHtml(r.phone)}</div>` : ''}
          ${r.note ? `<div class="text-[11px] text-slate-500 italic">備註：${escapeHtml(r.note)}</div>` : ''}
        </div>
      </div>

      <div class="pt-3 border-t border-slate-100">
        <button onclick="openReturnConfirmModal('${r.id}')" class="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-1.5">
          <i class="fa-solid fa-arrow-rotate-left"></i>
          <span>確認歸還並註銷登記</span>
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

function openReturnConfirmModal(id) {
  const res = state.reservations.find(r => r.id === id);
  if (!res) return;

  const idInput = document.getElementById('return-confirm-id');
  const summaryEl = document.getElementById('return-confirm-summary');
  const dateInput = document.getElementById('return-confirm-date');
  const timeInput = document.getElementById('return-confirm-time');
  const noteInput = document.getElementById('return-confirm-note');

  if (idInput) idInput.value = res.id;
  if (dateInput) dateInput.value = getTodayDateString();

  const now = new Date();
  const currentHH = String(now.getHours()).padStart(2, '0');
  const currentMM = String(now.getMinutes()).padStart(2, '0');
  if (timeInput) timeInput.value = `${currentHH}:${currentMM}`;
  if (noteInput) noteInput.value = '';

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="flex justify-between border-b border-slate-200 pb-1.5">
        <span class="text-slate-500">借用單號：</span>
        <span class="font-mono font-bold text-slate-700">${res.id}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-slate-500">借用老師：</span>
        <span class="font-bold text-slate-800">${escapeHtml(res.teacherName)} (${escapeHtml(res.className)})</span>
      </div>
      <div class="flex justify-between">
        <span class="text-slate-500">借用車輛：</span>
        <span class="font-bold text-blue-700">${escapeHtml(getCartName(res.cart))} (${res.isFullCart ? '整車借用' : `${res.tablets.length} 台`})</span>
      </div>
      <div class="flex justify-between text-slate-500 text-[11px]">
        <span>借出時段：</span>
        <span>${res.borrowDate} ${escapeHtml(res.period)} (${res.borrowTime}~${res.returnTime})</span>
      </div>
    `;
  }

  toggleReturnModal(true);
}

function toggleReturnModal(show) {
  const modal = document.getElementById('modal-return-confirm');
  if (modal) {
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
  }
}

function handleReturnConfirmSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('return-confirm-id').value;
  const returnDate = document.getElementById('return-confirm-date').value;
  const returnTime = document.getElementById('return-confirm-time').value;
  const returnNote = document.getElementById('return-confirm-note').value.trim();

  const res = state.reservations.find(r => r.id === id);
  if (!res) return;

  res.status = 'returned';
  res.actualReturnDate = returnDate;
  res.actualReturnTime = returnTime;
  if (returnNote) {
    res.note = res.note ? `${res.note} (歸還紀錄: ${returnNote})` : `歸還紀錄: ${returnNote}`;
  }

  saveReservations();
  updateGasStatus(id, 'returned');
  toggleReturnModal(false);

  renderActiveReturns();
  renderRecordsTable();
  renderScheduleMatrix();
  updateConflictAndGrid();
  updateHeaderBadges();

  alert(`🎉 歸還手續完成！\n【${res.teacherName} 老師】借用的 ${getCartName(res.cart)} 已註銷登記，平板已全數釋放回庫存！`);
}

// 快速歸還（呼叫確認彈窗）
function confirmReturn(id) {
  openReturnConfirmModal(id);
}

// ==========================================
// 看板總覽渲染 (Schedule Matrix)
// ==========================================
function setMatrixToday() {
  state.matrixDate = getTodayDateString();
  const input = document.getElementById('matrix-date-input');
  if (input) input.value = state.matrixDate;
  renderScheduleMatrix();
}

function changeMatrixDate(deltaDays) {
  const current = new Date(state.matrixDate || getTodayDateString());
  current.setDate(current.getDate() + deltaDays);
  const yyyy = current.getFullYear();
  const mm = String(current.getMonth() + 1).padStart(2, '0');
  const dd = String(current.getDate()).padStart(2, '0');
  state.matrixDate = `${yyyy}-${mm}-${dd}`;
  const input = document.getElementById('matrix-date-input');
  if (input) input.value = state.matrixDate;
  renderScheduleMatrix();
}

function renderScheduleMatrix() {
  const headerRow = document.getElementById('matrix-header-row');
  const tbody = document.getElementById('matrix-tbody');
  const input = document.getElementById('matrix-date-input');
  if (!tbody) return;
  if (input) state.matrixDate = input.value;

  if (headerRow) {
    headerRow.innerHTML = '<th class="p-3 w-28 text-left pl-4">節次 / 時段</th>';
    state.carts.forEach(cart => {
      const th = document.createElement('th');
      th.className = 'p-3';
      th.textContent = cart.name;
      headerRow.appendChild(th);
    });
  }

  tbody.innerHTML = '';
  const targetDate = state.matrixDate;

  // 篩選當日借用中 (未歸還註銷)
  const dayReservations = state.reservations.filter(r => {
    return r.borrowDate === targetDate && r.status !== 'returned';
  });

  state.periods.forEach(period => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/80 transition';

    const tdPeriod = document.createElement('td');
    tdPeriod.className = 'p-3 pl-4 text-left font-semibold text-slate-700 border-r border-slate-100 bg-slate-50/50';
    tdPeriod.innerHTML = `
      <div>${escapeHtml(period.name)}</div>
      <div class="text-[10px] text-slate-400 font-normal">${period.start}~${period.end}</div>
    `;
    tr.appendChild(tdPeriod);

    state.carts.forEach(cart => {
      const td = document.createElement('td');
      td.className = 'p-2 border-r border-b border-slate-100 matrix-cell align-top';

      const cartRes = dayReservations.filter(r => {
        if (r.cart !== cart.id) return false;
        if (r.period === period.id || r.period === '整天') return true;
        const pStart = `${targetDate}T${period.start}`;
        const pEnd = `${targetDate}T${period.end}`;
        const rStart = `${r.borrowDate}T${r.borrowTime}`;
        const rEnd = `${r.returnDate}T${r.returnTime}`;
        return (new Date(pStart) < new Date(rEnd)) && (new Date(pEnd) > new Date(rStart));
      });

      if (cartRes.length === 0) {
        td.innerHTML = `
          <div class="h-full flex items-center justify-center text-slate-300 hover:text-blue-500 cursor-pointer" onclick="quickBookFromMatrix('${cart.id}', '${period.id}')" title="點擊直接預約此節">
            <span class="text-[11px]">&plus; 空閒</span>
          </div>
        `;
      } else {
        let cellHtml = '';
        cartRes.forEach(r => {
          const badgeClass = r.isFullCart ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-blue-100 text-blue-800 border-blue-200';
          cellHtml += `
            <div class="p-1.5 rounded-lg border ${badgeClass} text-[11px] text-left mb-1 shadow-xs cursor-pointer" onclick="viewReservationDetail('${r.id}')" title="點擊查看詳細">
              <div class="font-bold truncate">${escapeHtml(r.teacherName)}</div>
              <div class="text-[10px] opacity-80 truncate">${escapeHtml(r.className)}</div>
              <div class="text-[9px] font-semibold mt-0.5 text-amber-700">借出待註銷 (${r.isFullCart ? '整車' : `${r.tablets.length} 台`})</div>
            </div>
          `;
        });
        td.innerHTML = cellHtml;
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

function quickBookFromMatrix(cartId, periodId) {
  switchTab('borrow');
  selectCart(cartId);
  selectPeriod(periodId);
  const inputBorrowDate = document.getElementById('input-borrow-date');
  const inputReturnDate = document.getElementById('input-return-date');
  if (inputBorrowDate) inputBorrowDate.value = state.matrixDate;
  if (inputReturnDate) inputReturnDate.value = state.matrixDate;
  updateConflictAndGrid();
  updateSummary();
}

function viewReservationDetail(id) {
  const res = state.reservations.find(r => r.id === id);
  if (!res) return;
  alert(`【借用登記明細】\n單號：${res.id}\n車輛：${getCartName(res.cart)}\n老師：${res.teacherName}\n班級：${res.className}\n電話：${res.phone || '無'}\n時段：${res.borrowDate} ${res.period} (${res.borrowTime} ~ ${res.returnTime})\n平板：${res.isFullCart ? '整車借用' : res.tablets.join(', ')}\n狀態：${res.status === 'borrowed' ? '借出使用中 (待註銷)' : '已歸還註銷'}\n備註：${res.note || '無'}`);
}

// ==========================================
// 借用紀錄清單 (Records & History)
// ==========================================
function renderRecordsTable() {
  const tbody = document.getElementById('records-tbody');
  const emptyNotice = document.getElementById('records-empty');
  const searchInput = document.getElementById('records-search-input');
  const filterSelect = document.getElementById('records-status-filter');
  if (!tbody) return;

  const keyword = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const statusFilter = filterSelect ? filterSelect.value : 'all';

  let list = state.reservations.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (keyword) {
      const match = (r.teacherName + r.className + getCartName(r.cart) + r.cart + r.id + (r.note || '')).toLowerCase();
      if (!match.includes(keyword)) return false;
    }
    return true;
  });

  tbody.innerHTML = '';

  if (list.length === 0) {
    if (emptyNotice) emptyNotice.classList.remove('hidden');
    return;
  } else {
    if (emptyNotice) emptyNotice.classList.add('hidden');
  }

  list.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

    const isReturned = r.status === 'returned';
    const statusBadge = isReturned
      ? '<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600">已歸還註銷</span>'
      : '<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">借出登記中</span>';

    tr.innerHTML = `
      <td class="p-3 pl-4 font-mono font-bold text-slate-700">${r.id}</td>
      <td class="p-3">
        <span class="inline-flex items-center gap-1 font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
          <i class="fa-solid fa-van-shuttle text-[10px]"></i> ${escapeHtml(getCartName(r.cart))}
        </span>
      </td>
      <td class="p-3">
        <div class="font-bold text-slate-800">${escapeHtml(r.teacherName)}</div>
        <div class="text-[11px] text-slate-400">${escapeHtml(r.className)}</div>
      </td>
      <td class="p-3">
        <div class="font-medium text-slate-700">${r.borrowDate}</div>
        <div class="text-[11px] text-blue-600 font-semibold">${escapeHtml(r.period)} (${r.borrowTime}~${r.returnTime})</div>
      </td>
      <td class="p-3">
        <div class="font-semibold text-slate-700">${r.isFullCart ? '整車借用' : `${r.tablets.length} 台`}</div>
        <div class="text-[10px] text-slate-400 truncate max-w-[120px]" title="${(r.tablets || []).join(', ')}">
          ${r.isFullCart ? '全車借用' : (r.tablets || []).join(', ')}
        </div>
      </td>
      <td class="p-3 text-slate-600 font-mono">
        ${isReturned && r.actualReturnTime ? `${r.actualReturnDate || r.returnDate} ${r.actualReturnTime}` : `${r.returnDate} ${r.returnTime}`}
      </td>
      <td class="p-3 text-center">
        ${statusBadge}
      </td>
      <td class="p-3 text-center pr-4">
        <div class="flex items-center justify-center gap-1.5">
          ${
            !isReturned
              ? `<button onclick="confirmReturn('${r.id}')" class="px-2.5 py-1 text-xs font-semibold rounded bg-amber-500 text-white hover:bg-amber-600 transition flex items-center gap-1 shadow-xs" title="確認歸還並註銷登記">
                  <i class="fa-solid fa-arrow-rotate-left text-[10px]"></i> 歸還註銷
                </button>`
              : ''
          }
          <button onclick="confirmDelete('${r.id}')" class="p-1.5 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition" title="刪除紀錄">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function confirmDelete(id) {
  if (!state.isAdminLoggedIn) {
    const input = prompt('此為管理員權限操作，請輸入管理密碼：');
    if (input === null) return;
    if (input !== getAdminPassword()) {
      alert('密碼錯誤，操作取消！');
      return;
    }
  }

  if (confirm('確定要永久刪除此筆借用紀錄嗎？')) {
    state.reservations = state.reservations.filter(r => r.id !== id);
    saveReservations();
    deleteGasRecord(id);
    renderActiveReturns();
    renderRecordsTable();
    renderScheduleMatrix();
    updateConflictAndGrid();
    updateHeaderBadges();
  }
}

// ==========================================
// 後台平板車輛與各節課管理 (Admin Settings)
// ==========================================
function saveCartsConfig() {
  localStorage.setItem('tablet_system_carts_config', JSON.stringify(state.carts));
}

function savePeriodsConfig() {
  localStorage.setItem('tablet_system_periods_config', JSON.stringify(state.periods));
}

function renderAdminCartsTable() {
  const tbody = document.getElementById('admin-carts-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  state.carts.forEach(cart => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

    const tabletsPreview = cart.tablets.length > 8
      ? `${cart.tablets.slice(0, 7).join(', ')} ...等 ${cart.tablets.length} 台`
      : cart.tablets.join(', ');

    tr.innerHTML = `
      <td class="p-2.5 pl-3 font-mono font-bold text-blue-700">${escapeHtml(cart.id)}</td>
      <td class="p-2.5 font-bold text-slate-800">${escapeHtml(cart.name)}</td>
      <td class="p-2.5 text-center font-semibold text-slate-700">${cart.tablets.length} 台</td>
      <td class="p-2.5 text-slate-500 font-mono text-[11px] truncate max-w-[200px]" title="${cart.tablets.join(', ')}">
        ${tabletsPreview}
      </td>
      <td class="p-2.5 text-center pr-3">
        <div class="flex items-center justify-center gap-1.5">
          <button onclick="openEditCartModal('${cart.id}')" class="px-2 py-1 text-xs font-semibold rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition" title="編輯車輛">
            <i class="fa-regular fa-pen-to-square mr-0.5"></i> 編輯
          </button>
          <button onclick="deleteCart('${cart.id}')" class="p-1 text-xs text-slate-400 hover:text-red-600 rounded transition" title="刪除車輛">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openEditCartModal(cartId = null) {
  const title = document.getElementById('modal-cart-title');
  const idInput = document.getElementById('cart-edit-id');
  const origIdInput = document.getElementById('cart-edit-original-id');
  const nameInput = document.getElementById('cart-edit-name');
  const tabletsInput = document.getElementById('cart-edit-tablets');
  const previewCount = document.getElementById('cart-tablets-count-preview');

  if (cartId) {
    const cart = getCartById(cartId);
    title.innerHTML = '<i class="fa-solid fa-van-shuttle text-blue-600"></i><span>編輯平板車</span>';
    origIdInput.value = cart.id;
    idInput.value = cart.id;
    idInput.disabled = true;
    nameInput.value = cart.name;
    tabletsInput.value = cart.tablets.join(', ');
    previewCount.textContent = cart.tablets.length;
  } else {
    title.innerHTML = '<i class="fa-solid fa-van-shuttle text-blue-600"></i><span>新增平板車</span>';
    origIdInput.value = '';
    const nextChar = String.fromCharCode(65 + state.carts.length);
    idInput.value = nextChar;
    idInput.disabled = false;
    nameInput.value = `${nextChar} 車`;
    tabletsInput.value = DEFAULT_TABLETS_28.join(', ');
    previewCount.textContent = DEFAULT_TABLETS_28.length;
  }

  toggleCartModal(true);
}

function toggleCartModal(show) {
  const modal = document.getElementById('modal-cart-edit');
  if (modal) {
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
  }
}

function parseTabletInput(text) {
  if (!text) return [];
  return text.split(/[,，\s\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .filter((v, idx, arr) => arr.indexOf(v) === idx);
}

function generateSequentialTablets() {
  const countInput = document.getElementById('cart-quick-count');
  const count = parseInt(countInput.value, 10);
  if (!count || count <= 0) {
    alert('請輸入大於 0 的平板台數！');
    return;
  }
  const generated = Array.from({ length: count }, (_, i) => String(i + 1).padStart(2, '0'));
  const textarea = document.getElementById('cart-edit-tablets');
  textarea.value = generated.join(', ');
  document.getElementById('cart-tablets-count-preview').textContent = generated.length;
}

function setPresetTablets28() {
  const textarea = document.getElementById('cart-edit-tablets');
  textarea.value = DEFAULT_TABLETS_28.join(', ');
  document.getElementById('cart-tablets-count-preview').textContent = DEFAULT_TABLETS_28.length;
}

function handleCartFormSubmit(e) {
  e.preventDefault();
  const origId = document.getElementById('cart-edit-original-id').value.trim();
  const id = document.getElementById('cart-edit-id').value.trim().toUpperCase();
  const name = document.getElementById('cart-edit-name').value.trim();
  const tablets = parseTabletInput(document.getElementById('cart-edit-tablets').value);

  if (!id || !name) {
    alert('請完整輸入車輛代號與名稱！');
    return;
  }
  if (tablets.length === 0) {
    alert('請至少設定 1 台平板編號！');
    return;
  }

  if (!origId && state.carts.some(c => c.id === id)) {
    alert(`車輛代號【${id}】已存在，請使用其他代號！`);
    return;
  }

  if (origId) {
    const target = state.carts.find(c => c.id === origId);
    if (target) {
      target.name = name;
      target.tablets = tablets;
    }
  } else {
    state.carts.push({ id, name, tablets });
  }

  saveCartsConfig();
  toggleCartModal(false);
  initCartSelector();
  updateConflictAndGrid();
  renderActiveReturns();
  renderScheduleMatrix();
  renderAdminCartsTable();
  alert('平板車輛設定已成功儲存！');
}

function deleteCart(cartId) {
  if (state.carts.length <= 1) {
    alert('系統至少必須保留一台平板車！');
    return;
  }

  const inUse = state.reservations.some(r => r.cart === cartId && r.status !== 'returned');
  const confirmMsg = inUse
    ? `警告：【${getCartName(cartId)}】目前尚有未歸還註銷的借用單！刪除將影響現有排程，確定要刪除嗎？`
    : `確定要刪除【${getCartName(cartId)}】嗎？`;

  if (confirm(confirmMsg)) {
    state.carts = state.carts.filter(c => c.id !== cartId);
    saveCartsConfig();

    if (state.selectedCart === cartId) {
      state.selectedCart = state.carts[0].id;
    }

    initCartSelector();
    updateConflictAndGrid();
    renderActiveReturns();
    renderScheduleMatrix();
    renderAdminCartsTable();
  }
}

function resetDefaultCarts() {
  if (confirm('確定要還原為預設的 A、B、C、D、E、F、G 共 7 台平板車設定嗎？')) {
    state.carts = JSON.parse(JSON.stringify(DEFAULT_CARTS_CONFIG));
    saveCartsConfig();
    if (!state.carts.some(c => c.id === state.selectedCart)) {
      state.selectedCart = state.carts[0].id;
    }
    initCartSelector();
    updateConflictAndGrid();
    renderActiveReturns();
    renderScheduleMatrix();
    renderAdminCartsTable();
    alert('已還原預設平板車設定！');
  }
}

// ------------------------------------------
// 各節作息時間管理
// ------------------------------------------
function renderAdminPeriodsTable() {
  const tbody = document.getElementById('admin-periods-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  state.periods.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

    const [sh, sm] = p.start.split(':').map(Number);
    const [eh, em] = p.end.split(':').map(Number);
    const duration = (eh * 60 + em) - (sh * 60 + sm);
    const durationText = duration > 0 ? `${duration} 分鐘` : '-';

    tr.innerHTML = `
      <td class="p-2.5 pl-3 font-bold text-slate-800">${escapeHtml(p.name)}</td>
      <td class="p-2.5 font-mono text-slate-700">${p.start}</td>
      <td class="p-2.5 font-mono text-slate-700">${p.end}</td>
      <td class="p-2.5 text-center text-slate-500">${durationText}</td>
      <td class="p-2.5 text-center pr-3">
        <div class="flex items-center justify-center gap-1.5">
          <button onclick="openEditPeriodModal('${p.id}')" class="px-2 py-1 text-xs font-semibold rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition" title="編輯節次">
            <i class="fa-regular fa-pen-to-square mr-0.5"></i> 編輯
          </button>
          <button onclick="deletePeriod('${p.id}')" class="p-1 text-xs text-slate-400 hover:text-red-600 rounded transition" title="刪除節次">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openEditPeriodModal(periodId = null) {
  const title = document.getElementById('modal-period-title');
  const origIdInput = document.getElementById('period-edit-original-id');
  const nameInput = document.getElementById('period-edit-name');
  const startInput = document.getElementById('period-edit-start');
  const endInput = document.getElementById('period-edit-end');

  if (periodId) {
    const p = state.periods.find(item => item.id === periodId);
    title.innerHTML = '<i class="fa-solid fa-clock text-indigo-600"></i><span>編輯節次作息</span>';
    origIdInput.value = p.id;
    nameInput.value = p.name;
    startInput.value = p.start;
    endInput.value = p.end;
  } else {
    title.innerHTML = '<i class="fa-solid fa-clock text-indigo-600"></i><span>新增節次作息</span>';
    origIdInput.value = '';
    nameInput.value = '';
    startInput.value = '08:00';
    endInput.value = '08:45';
  }

  togglePeriodModal(true);
}

function togglePeriodModal(show) {
  const modal = document.getElementById('modal-period-edit');
  if (modal) {
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
  }
}

function handlePeriodFormSubmit(e) {
  e.preventDefault();
  const origId = document.getElementById('period-edit-original-id').value.trim();
  const name = document.getElementById('period-edit-name').value.trim();
  const start = document.getElementById('period-edit-start').value;
  const end = document.getElementById('period-edit-end').value;

  if (!name || !start || !end) {
    alert('請完整填寫節次名稱與起訖時間！');
    return;
  }

  if (origId) {
    const target = state.periods.find(p => p.id === origId);
    if (target) {
      target.id = name;
      target.name = name;
      target.start = start;
      target.end = end;
    }
  } else {
    if (state.periods.some(p => p.name === name)) {
      alert(`節次名稱【${name}】已存在！`);
      return;
    }
    state.periods.push({ id: name, name, start, end });
  }

  savePeriodsConfig();
  togglePeriodModal(false);
  initPeriodSelector();
  renderScheduleMatrix();
  renderAdminPeriodsTable();
  alert('節次作息時間已成功更新！');
}

function deletePeriod(periodId) {
  if (state.periods.length <= 1) {
    alert('系統至少必須保留一個節次！');
    return;
  }

  if (confirm(`確定要刪除【${periodId}】節次嗎？`)) {
    state.periods = state.periods.filter(p => p.id !== periodId);
    savePeriodsConfig();

    if (state.selectedPeriod === periodId) {
      state.selectedPeriod = state.periods[0].id;
    }

    initPeriodSelector();
    renderScheduleMatrix();
    renderAdminPeriodsTable();
  }
}

function resetDefaultPeriods() {
  if (confirm('確定要還原為預設的作息時間表嗎？')) {
    state.periods = JSON.parse(JSON.stringify(DEFAULT_PERIODS_CONFIG));
    savePeriodsConfig();
    if (!state.periods.some(p => p.id === state.selectedPeriod)) {
      state.selectedPeriod = state.periods[0].id;
    }
    initPeriodSelector();
    renderScheduleMatrix();
    renderAdminPeriodsTable();
    alert('已還原預設作息時間表！');
  }
}

// ==========================================
// 資料持久化與示範資料
// ==========================================
function loadReservations() {
  const cached = localStorage.getItem('tablet_system_reservations');
  if (cached) {
    try {
      state.reservations = JSON.parse(cached);
    } catch (e) {
      state.reservations = [];
    }
  }

  if (state.reservations.length === 0) {
    loadDemoReservations(false);
  }
}

function saveReservations() {
  localStorage.setItem('tablet_system_reservations', JSON.stringify(state.reservations));
}

function loadDemoReservations(showNotice = true) {
  const today = getTodayDateString();
  const cartATablets = (getCartById('A') || state.carts[0]).tablets;
  const cartBTablets = (getCartById('B') || state.carts[1] || state.carts[0]).tablets;
  const cartCTablets = (getCartById('C') || state.carts[2] || state.carts[0]).tablets;

  const demoData = [
    {
      id: 'TB-100201',
      cart: 'A',
      tablets: cartATablets.slice(0, 15),
      isFullCart: false,
      borrowDate: today,
      borrowTime: '08:40',
      period: '第一節',
      returnDate: today,
      returnTime: '09:25',
      teacherName: '陳雅婷',
      className: '501班 國語數位閱讀',
      phone: '分機 205',
      note: '教學評鑑公開觀課使用',
      status: 'borrowed', // 借出登記中 (未歸還註銷)
      createdAt: new Date().toISOString()
    },
    {
      id: 'TB-100202',
      cart: 'C',
      tablets: [...cartCTablets],
      isFullCart: true,
      borrowDate: today,
      borrowTime: '10:30',
      period: '第三節',
      returnDate: today,
      returnTime: '11:15',
      teacherName: '林俊豪',
      className: '603班 資訊科技線上測驗',
      phone: '分機 310',
      note: '整車借用',
      status: 'returned', // 已歸還註銷
      actualReturnDate: today,
      actualReturnTime: '11:18',
      createdAt: new Date().toISOString()
    },
    {
      id: 'TB-100203',
      cart: 'B',
      tablets: cartBTablets.slice(0, 20),
      isFullCart: false,
      borrowDate: today,
      borrowTime: '13:25',
      period: '第五節',
      returnDate: today,
      returnTime: '14:10',
      teacherName: '張美麗',
      className: '302班 英語口說練習',
      phone: '0912-345-678',
      note: '配合外籍英語教師教學',
      status: 'borrowed', // 借出登記中 (未歸還註銷)
      createdAt: new Date().toISOString()
    }
  ];

  state.reservations = demoData;
  saveReservations();
  renderActiveReturns();
  renderRecordsTable();
  renderScheduleMatrix();
  updateConflictAndGrid();
  updateHeaderBadges();

  if (showNotice) {
    alert('已成功載入示範借用資料！您可以切換至「歸還註銷」查看待歸還單據，或至「借用看板」查看。');
  }
}

function confirmClearAllReservations() {
  if (!state.isAdminLoggedIn) {
    const input = prompt('此為管理員權限操作，請輸入管理密碼：');
    if (input === null) return;
    if (input !== getAdminPassword()) {
      alert('密碼錯誤，操作取消！');
      return;
    }
  }

  if (confirm('警告：確定要清空所有借用資料嗎？此動作無法復原！')) {
    state.reservations = [];
    saveReservations();
    renderActiveReturns();
    renderRecordsTable();
    renderScheduleMatrix();
    updateConflictAndGrid();
    updateHeaderBadges();
    alert('已成功清空所有資料！');
  }
}

function exportRecordsToCSV() {
  if (state.reservations.length === 0) {
    alert('目前尚無資料可匯出！');
    return;
  }

  const headers = ['單號', '車輛', '老師姓名', '班級/用途', '聯絡電話', '借用日期', '節次', '開始時間', '預計歸還時間', '實際歸還時間', '借用台數', '平板號碼', '登記狀態', '備註'];
  const rows = state.reservations.map(r => [
    r.id,
    `"${getCartName(r.cart).replace(/"/g, '""')}"`,
    `"${r.teacherName.replace(/"/g, '""')}"`,
    `"${r.className.replace(/"/g, '""')}"`,
    `"${(r.phone || '').replace(/"/g, '""')}"`,
    r.borrowDate,
    r.period,
    r.borrowTime,
    r.returnTime,
    r.actualReturnTime ? `${r.actualReturnDate || r.borrowDate} ${r.actualReturnTime}` : '未歸還註銷',
    r.isFullCart ? '整車' : `${r.tablets.length}台`,
    `"${(r.tablets || []).join(' ')}"`,
    r.status === 'returned' ? '已歸還註銷' : '借出登記中',
    `"${(r.note || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `校園平板借用與歸還清單_${getTodayDateString()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ==========================================
// Google 試算表串接 (Google Apps Script API)
// ==========================================
function saveGasSettings() {
  const url = document.getElementById('setting-gas-url').value.trim();
  state.gasUrl = url;
  localStorage.setItem('tablet_system_gas_url', url);
  updateGasBadge();
  alert('已儲存 Google 試算表串接設定！');
}

function updateGasBadge() {
  const badge = document.getElementById('gas-sync-status-badge');
  if (!badge) return;
  if (state.gasUrl) {
    badge.className = 'px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800';
    badge.innerHTML = '<i class="fa-solid fa-circle-check mr-1"></i> 已配置雲端試算表';
  } else {
    badge.className = 'px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600';
    badge.innerHTML = '未連接 (使用本地快取)';
  }
}

async function testGasConnection() {
  const url = document.getElementById('setting-gas-url').value.trim();
  if (!url) {
    alert('請先輸入 Google Apps Script 網頁應用程式網址！');
    return;
  }

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.success) {
      if (Array.isArray(json.data) && json.data.length > 0) {
        if (confirm(`連線成功！雲端試算表目前有 ${json.data.length} 筆資料，是否同步覆蓋本地資料？`)) {
          state.reservations = json.data;
          saveReservations();
          renderActiveReturns();
          renderRecordsTable();
          renderScheduleMatrix();
          updateConflictAndGrid();
          updateHeaderBadges();
        }
      } else {
        alert('連線成功！Google 試算表已就緒（目前尚無資料）。');
      }
    } else {
      alert(`連線回應錯誤：${json.error || '未知錯誤'}`);
    }
  } catch (err) {
    alert(`連線失敗：${err.message}\n請確認：\n1. 網址是否正確\n2. 部署權限是否設為「任何人」(Anyone)`);
  }
}

function syncToGoogleSheets(reservation) {
  if (!state.gasUrl) return;
  fetch(state.gasUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', data: reservation })
  }).catch(e => console.warn('GAS sync warning:', e));
}

function updateGasStatus(id, newStatus) {
  if (!state.gasUrl) return;
  fetch(state.gasUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'updateStatus', id: id, status: newStatus })
  }).catch(e => console.warn('GAS status warning:', e));
}

function deleteGasRecord(id) {
  if (!state.gasUrl) return;
  fetch(state.gasUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', id: id })
  }).catch(e => console.warn('GAS delete warning:', e));
}

function toggleGasInstructionModal(show) {
  const modal = document.getElementById('modal-gas-instruction');
  if (modal) {
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
  }
}

// ==========================================
// 管理員身分驗證與安全密碼管理
// ==========================================
function getAdminPassword() {
  return localStorage.getItem('tablet_system_admin_pwd') || DEFAULT_ADMIN_PASSWORD;
}

function setAdminPassword(newPwd) {
  localStorage.setItem('tablet_system_admin_pwd', newPwd);
}

function handleAdminLogin(e) {
  e.preventDefault();
  const inputEl = document.getElementById('input-admin-password');
  const errorEl = document.getElementById('admin-login-error');
  const entered = (inputEl ? inputEl.value : '').trim();

  if (entered === getAdminPassword()) {
    state.isAdminLoggedIn = true;
    sessionStorage.setItem('tablet_system_admin_auth', 'true');
    if (errorEl) errorEl.classList.add('hidden');
    if (inputEl) inputEl.value = '';
    updateAdminView();
  } else {
    if (errorEl) errorEl.classList.remove('hidden');
    if (inputEl) {
      inputEl.focus();
      inputEl.select();
    }
  }
}

function adminLogout() {
  if (confirm('確定要登出管理員身分嗎？')) {
    state.isAdminLoggedIn = false;
    sessionStorage.removeItem('tablet_system_admin_auth');
    updateAdminView();
  }
}

function updateAdminView() {
  const lockEl = document.getElementById('admin-auth-lock');
  const panelEl = document.getElementById('admin-content-panel');
  const errorEl = document.getElementById('admin-login-error');
  if (errorEl) errorEl.classList.add('hidden');

  if (state.isAdminLoggedIn) {
    if (lockEl) lockEl.classList.add('hidden');
    if (panelEl) panelEl.classList.remove('hidden');
    renderAdminCartsTable();
    renderAdminPeriodsTable();
  } else {
    if (lockEl) lockEl.classList.remove('hidden');
    if (panelEl) panelEl.classList.add('hidden');
  }
}

function togglePasswordVisibility(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
}

function toggleChangePasswordModal(show) {
  const modal = document.getElementById('modal-change-password');
  const errorEl = document.getElementById('change-pwd-error');
  if (errorEl) errorEl.classList.add('hidden');
  if (!modal) return;

  if (show) {
    document.getElementById('input-old-password').value = '';
    document.getElementById('input-new-password').value = '';
    document.getElementById('input-confirm-password').value = '';
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
  }
}

function handleChangePassword(e) {
  e.preventDefault();
  const oldPwd = document.getElementById('input-old-password').value;
  const newPwd = document.getElementById('input-new-password').value;
  const confirmPwd = document.getElementById('input-confirm-password').value;
  const errorEl = document.getElementById('change-pwd-error');

  const showError = msg => {
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
    }
  };

  if (oldPwd !== getAdminPassword()) {
    showError('舊密碼輸入錯誤，請重新確認！');
    return;
  }

  if (newPwd.length < 4) {
    showError('新密碼長度至少需要 4 碼！');
    return;
  }

  if (newPwd !== confirmPwd) {
    showError('兩次輸入的新密碼不一致！');
    return;
  }

  setAdminPassword(newPwd);
  toggleChangePasswordModal(false);
  alert('管理密碼變更成功！請妥善保存新密碼。');
}

// ==========================================
// 分頁切換與輔助工具
// ==========================================
function switchTab(tabName) {
  state.currentTab = tabName;
  ['borrow', 'return', 'matrix', 'records', 'admin'].forEach(name => {
    const tabEl = document.getElementById(`tab-${name}`);
    const navBtn = document.getElementById(`nav-${name}`);

    if (name === tabName) {
      if (tabEl) tabEl.classList.remove('hidden');
      if (navBtn) {
        navBtn.className = 'px-3 py-2 text-sm font-semibold rounded-lg bg-blue-50 text-blue-600 flex items-center gap-1.5 transition';
      }
    } else {
      if (tabEl) tabEl.classList.add('hidden');
      if (navBtn) {
        navBtn.className = 'px-3 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition';
      }
    }
  });

  if (tabName === 'return') {
    renderActiveReturns();
  } else if (tabName === 'matrix') {
    renderScheduleMatrix();
  } else if (tabName === 'records') {
    renderRecordsTable();
  } else if (tabName === 'admin') {
    updateAdminView();
  }
}

function updateHeaderBadges() {
  const badge = document.getElementById('badge-active-count');
  if (!badge) return;
  const activeCount = state.reservations.filter(r => r.status !== 'returned').length;
  badge.textContent = activeCount;
}

function getTodayDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}
