/* ===================================================================
   AUTOORDEN — ADMIN DASHBOARD LOGIC (admin.js)
   Handles: gatekeeper login, KPIs, inventory override,
   pending approvals, sales ledger, and full data reset.
=================================================================== */

const LS_INVENTORY = 'autoorden_inventory';
const LS_PENDING   = 'autoorden_pending';
const LS_SALES     = 'autoorden_sales';
const SESSION_FLAG = 'autoorden_admin_authed';

const ADMIN_PASSWORD = 'Orden1234$';

const PRODUCT_NAMES = {
  slim: 'Ejecutiva de Perfil Delgado',
  tray: 'Edición Viaje con Bandeja Inteligente'
};

/* -------------------------------------------------------------
   STATE HELPERS
------------------------------------------------------------- */
function getInventory() {
  return JSON.parse(localStorage.getItem(LS_INVENTORY)) || { total: 1000, sold: 0 };
}
function setInventory(inv) { localStorage.setItem(LS_INVENTORY, JSON.stringify(inv)); }

function getPending() { return JSON.parse(localStorage.getItem(LS_PENDING)) || []; }
function setPending(arr) { localStorage.setItem(LS_PENDING, JSON.stringify(arr)); }

function getSales() { return JSON.parse(localStorage.getItem(LS_SALES)) || []; }
function setSales(arr) { localStorage.setItem(LS_SALES, JSON.stringify(arr)); }

function ensureState() {
  if (!localStorage.getItem(LS_INVENTORY)) setInventory({ total: 1000, sold: 0 });
  if (!localStorage.getItem(LS_PENDING)) setPending([]);
  if (!localStorage.getItem(LS_SALES)) setSales([]);
}

/* -------------------------------------------------------------
   GATEKEEPER LOGIN
------------------------------------------------------------- */
function initLogin() {
  const loginScreen = document.getElementById('loginScreen');
  const shell = document.getElementById('adminShell');
  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');

  function grantAccess() {
    sessionStorage.setItem(SESSION_FLAG, 'true');
    loginScreen.style.display = 'none';
    shell.classList.add('show');
    renderAll();
  }

  function logout() {
    // Clear authentication
    sessionStorage.removeItem(SESSION_FLAG);
    
    // Reset UI to login state
    loginScreen.style.display = 'flex';
    shell.classList.remove('show');
    
    // Clear form and focus
    document.getElementById('loginPassword').value = '';
    errorEl.classList.remove('show');
    setTimeout(() => document.getElementById('loginPassword').focus(), 100);
  }

  if (sessionStorage.getItem(SESSION_FLAG) === 'true') {
    grantAccess();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = document.getElementById('loginPassword').value;
    if (value === ADMIN_PASSWORD) {
      errorEl.classList.remove('show');
      grantAccess();
    } else {
      errorEl.textContent = 'Incorrect password. Please try again.';
      errorEl.classList.add('show');
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
}

/* -------------------------------------------------------------
   KPI STRIP
------------------------------------------------------------- */
function renderKpis() {
  const inv = getInventory();
  const remaining = Math.max(inv.total - inv.sold, 0);
  const sales = getSales();
  const pending = getPending();
  const revenue = sales.reduce((sum, s) => sum + s.total, 0);

  document.getElementById('kpiRemaining').textContent = remaining.toLocaleString();
  document.getElementById('kpiPlaced').textContent = inv.sold.toLocaleString();
  document.getElementById('kpiRevenue').textContent = revenue.toLocaleString() + ' PEN';
  document.getElementById('kpiPending').textContent = pending.length;

  const remainingCard = document.getElementById('kpiRemainingCard');
  remainingCard.classList.toggle('warning', remaining < 50);

  document.getElementById('inventoryOverrideInput').value = inv.sold;
}

/* -------------------------------------------------------------
   INVENTORY OVERRIDE
------------------------------------------------------------- */
function initInventoryOverride() {
  document.getElementById('inventoryOverrideForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const newSold = Number(document.getElementById('inventoryOverrideInput').value);
    if (Number.isNaN(newSold) || newSold < 0) return;
    const inv = getInventory();
    inv.sold = newSold;
    setInventory(inv);
    renderAll();
  });
}

/* -------------------------------------------------------------
   PENDING REQUESTS TABLE
------------------------------------------------------------- */
function renderPendingTable() {
  const pending = getPending();
  const tbody = document.getElementById('pendingTableBody');
  tbody.innerHTML = '';

  if (pending.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No pending requests right now.</td></tr>';
    return;
  }

  pending
    .slice()
    .sort((a, b) => b.ts - a.ts)
    .forEach((order) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${order.id}</td>
        <td>${escapeHtml(order.name)}</td>
        <td>${escapeHtml(order.phone)}</td>
        <td>${escapeHtml(order.wilayah)}</td>
        <td>${escapeHtml(order.address || 'N/A')}</td>
        <td>${PRODUCT_NAMES[order.productId] || order.productId}</td>
        <td>${order.qty}</td>
        <td>${order.total} PEN</td>
        <td class="row-actions">
          <button class="btn btn-sm btn-approve" data-approve="${order.id}">Approve</button>
          <button class="btn btn-sm btn-danger" data-decline="${order.id}">Decline</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  tbody.querySelectorAll('[data-approve]').forEach((btn) => {
    btn.addEventListener('click', () => approveOrder(btn.dataset.approve));
  });
  tbody.querySelectorAll('[data-decline]').forEach((btn) => {
    btn.addEventListener('click', () => declineOrder(btn.dataset.decline));
  });
}

function approveOrder(orderId) {
  const pending = getPending();
  const idx = pending.findIndex((o) => o.id === orderId);
  if (idx === -1) return;
  const order = pending[idx];

  // Move to sales
  const sales = getSales();
  sales.unshift({
    id: order.id,
    name: order.name,
    qty: order.qty,
    total: order.total,
    ts: Date.now(),
    wilayah: order.wilayah,
    address: order.address
  });
  setSales(sales);

  // Increment inventory sold count
  const inv = getInventory();
  inv.sold += order.qty;
  setInventory(inv);

  // Remove from pending
  pending.splice(idx, 1);
  setPending(pending);

  renderAll();
}

function declineOrder(orderId) {
  const pending = getPending().filter((o) => o.id !== orderId);
  setPending(pending);
  renderAll();
}

function initDeleteAllPending() {
  document.getElementById('deleteAllPendingBtn').addEventListener('click', () => {
    if (getPending().length === 0) return;
    if (confirm('Delete all pending requests? This cannot be undone.')) {
      setPending([]);
      renderAll();
    }
  });
}

/* -------------------------------------------------------------
   SALES LEDGER (last 10)
------------------------------------------------------------- */
function renderSalesLedger() {
  const sales = getSales().slice().sort((a, b) => b.ts - a.ts).slice(0, 10);
  const tbody = document.getElementById('salesTableBody');
  tbody.innerHTML = '';

  if (sales.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No approved sales yet.</td></tr>';
    return;
  }

  sales.forEach((sale) => {
    const tr = document.createElement('tr');
    const date = new Date(sale.ts).toLocaleString();
    tr.innerHTML = `
      <td>${sale.id}</td>
      <td>${escapeHtml(sale.name)}</td>
      <td>${escapeHtml(sale.wilayah)}</td>
      <td>${escapeHtml(sale.address || 'N/A')}</td>
      <td>${sale.qty}</td>
      <td>${sale.total} PEN</td>
      <td>${date}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* -------------------------------------------------------------
   SYSTEM RESET
------------------------------------------------------------- */
function initReset() {
  document.getElementById('resetDataBtn').addEventListener('click', () => {
    const confirmed = confirm(
      'This will permanently erase ALL inventory, pending requests, and sales records. Continue?'
    );
    if (!confirmed) return;
    localStorage.removeItem(LS_INVENTORY);
    localStorage.removeItem(LS_PENDING);
    localStorage.removeItem(LS_SALES);
    ensureState();
    renderAll();
  });
}

/* -------------------------------------------------------------
   UTIL
------------------------------------------------------------- */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* -------------------------------------------------------------
   RENDER ALL + BOOTSTRAP
------------------------------------------------------------- */
function renderAll() {
  renderKpis();
  renderPendingTable();
  renderSalesLedger();
}

document.addEventListener('DOMContentLoaded', () => {
  ensureState();
  initLogin();
  initInventoryOverride();
  initDeleteAllPending();
  initReset();
});
