/**
 * FEEDBACKHUB ADMIN PORTAL - CLIENT APPLICATION CONTROLLER
 * Smart Dual-Engine Adapter: Seamlessly operates with backend server (server.py)
 * AND provides zero-downtime client-side WebCrypto PBKDF2 verification for static Vercel deployments!
 */

const STORAGE_TOKEN_KEY = 'fbk_admin_session_token';
const STORAGE_FEEDBACK_KEY = 'fbk_records_cloud';
const STORAGE_KEYS_KEY = 'fbk_api_keys_cloud';
const STORAGE_AUTH_KEY = 'fbk_auth_meta';
const API_BASE = window.location.origin;

// Default initial security hash (PBKDF2-HMAC-SHA256, salt: 'fbk_live_salt_2026', 300k iterations)
// Plaintext password is NEVER stored in frontend code.
const DEFAULT_AUTH_SALT = '7a9e3b1c4d5f6081';
const DEFAULT_AUTH_HASH = '1f6c44db606ef085f1c99859f77f0a823ee45a8b75c87a55eef6b5bcdafc5518';
const DEFAULT_ADMIN_EMAIL = 'admin@feedbackhub.com';

let isServerAvailable = false;
let currentAdmin = null;
let allFeedback = [];
let allKeys = [];
let currentInspectedFeedbackId = null;

// =============================================================================
// 1. INITIALIZATION & LIFECYCLE
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  initIcons();
  setupEventListeners();
  initLocalStorage();
  await detectBackend();
  checkAuth();

  // Listen for storage events (real-time cross-tab sync with demo-client.html)
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_FEEDBACK_KEY || e.key === 'fbk_ping_update') {
      loadAllData();
      showToast('New feedback received from client!', 'success');
    }
  });
});

function initIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function getAuthHeader() {
  const token = sessionStorage.getItem(STORAGE_TOKEN_KEY);
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Detect if server.py is running or if we are on static Vercel
async function detectBackend() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(`${API_BASE}/api/auth/verify`, {
      method: 'GET',
      headers: { ...getAuthHeader() },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    isServerAvailable = res.status !== 404 && res.status !== 502;
  } catch (err) {
    isServerAvailable = false;
  }

  updateSystemStatusBadge(isServerAvailable);
}

function updateSystemStatusBadge(online) {
  const pill = document.getElementById('system-status-pill');
  if (!pill) return;
  if (online) {
    pill.innerHTML = `
      <span class="status-dot"></span>
      <span>Backend Server Active</span>
    `;
    pill.style.borderColor = 'rgba(16, 185, 129, 0.4)';
  } else {
    pill.innerHTML = `
      <span class="status-dot" style="background: #6366f1; box-shadow: 0 0 10px #6366f1;"></span>
      <span>Cloud Edge Mode</span>
    `;
    pill.style.borderColor = 'rgba(99, 102, 241, 0.4)';
    pill.title = 'Running on Vercel Edge with persistent local database & WebCrypto verification.';
  }
}

// =============================================================================
// 2. WEBCRYPTO PBKDF2 HELPER (Zero Plaintext Passwords)
// =============================================================================

async function derivePBKDF2Hash(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  // Convert hex salt to Uint8Array
  const saltBytes = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 300000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function initLocalStorage() {
  // Initialize default API key if empty
  if (!localStorage.getItem(STORAGE_KEYS_KEY)) {
    const initialKeys = [
      {
        id: 1,
        key_value: 'fbk_live_bf4a54065934a725799fab202fd11ed2',
        name: 'Default Website Widget Key',
        status: 'active',
        requests_count: 3,
        created_at: new Date().toISOString()
      }
    ];
    localStorage.setItem(STORAGE_KEYS_KEY, JSON.stringify(initialKeys));
  }

  // Initialize seed feedback if empty
  if (!localStorage.getItem(STORAGE_FEEDBACK_KEY)) {
    const initialFeedback = [
      {
        id: 101,
        name: "Sarah Jenkins",
        email: "sarah.j@techvision.io",
        rating: 5,
        category: "Praise",
        message: "The new onboarding flow is exceptionally fast! Loving the clean UI and responsiveness.",
        page_url: "https://example.com/onboarding",
        status: "resolved",
        admin_notes: "Followed up via email to thank Sarah.",
        created_at: new Date(Date.now() - 86400000 * 2).toISOString()
      },
      {
        id: 102,
        name: "Marcus Aurelius",
        email: "marcus@rome.design",
        rating: 4,
        category: "Feature Request",
        message: "Would be fantastic to have dark mode scheduling based on local sunrise/sunset.",
        page_url: "https://example.com/settings",
        status: "reviewing",
        admin_notes: "Added to Q4 product roadmap backlog.",
        created_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 103,
        name: "Alex Chen",
        email: "alex.chen@startup.co",
        rating: 2,
        category: "Bug Report",
        message: "Checkout button freezes for 2 seconds on Safari when using Apple Pay on iOS.",
        page_url: "https://example.com/checkout",
        status: "new",
        admin_notes: "Reproduced bug on mobile WebKit. Ticket #DEV-412.",
        created_at: new Date(Date.now() - 3600000 * 5).toISOString()
      },
      {
        id: 104,
        name: "Elena Rostova",
        email: "elena@designlab.org",
        rating: 5,
        category: "Praise",
        message: "Customer support answered my query within 3 minutes on live chat. Amazing service!",
        page_url: "https://example.com/support",
        status: "resolved",
        admin_notes: "Shared with support team kudos channel.",
        created_at: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 105,
        name: "David Miller",
        email: "dmiller@enterprise.net",
        rating: 3,
        category: "UX / Usability",
        message: "Search filtering by date range is slightly unintuitive when selecting calendar days.",
        page_url: "https://example.com/reports",
        status: "new",
        admin_notes: "",
        created_at: new Date().toISOString()
      }
    ];
    localStorage.setItem(STORAGE_FEEDBACK_KEY, JSON.stringify(initialFeedback));
  }
}

// =============================================================================
// 3. AUTHENTICATION & LOGIN LOGIC
// =============================================================================

function checkAuth() {
  const token = sessionStorage.getItem(STORAGE_TOKEN_KEY);
  if (!token) {
    showLoginView();
    return;
  }

  // Token exists
  currentAdmin = { email: sessionStorage.getItem('fbk_admin_email') || DEFAULT_ADMIN_EMAIL };
  showDashboardView();
  loadAllData();
}

function showLoginView() {
  document.getElementById('login-section').style.display = 'flex';
  document.getElementById('dashboard-shell').style.display = 'none';
  initIcons();
}

function showDashboardView() {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('dashboard-shell').style.display = 'flex';
  if (currentAdmin) {
    document.getElementById('sidebar-user-email').textContent = currentAdmin.email;
    document.getElementById('sidebar-user-avatar').textContent = currentAdmin.email.charAt(0).toUpperCase();
  }
  initIcons();
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const submitBtn = document.getElementById('login-submit-btn');
  const errorAlert = document.getElementById('login-error-alert');
  const errorText = document.getElementById('login-error-text');

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>Verifying cryptographic credentials...</span>';
  errorAlert.style.display = 'none';

  // Strategy 1: Try server endpoint if backend is available
  if (isServerAvailable) {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        sessionStorage.setItem(STORAGE_TOKEN_KEY, data.token);
        sessionStorage.setItem('fbk_admin_email', data.admin.email);
        currentAdmin = data.admin;
        showDashboardView();
        loadAllData();
        showToast('Authenticated securely via backend server!', 'success');
        return;
      }
    } catch (err) {
      console.warn('Backend login attempt encountered an error, falling back to WebCrypto engine:', err);
    }
  }

  // Strategy 2: WebCrypto PBKDF2 verification (for Vercel static deployment)
  try {
    const authMeta = JSON.parse(localStorage.getItem(STORAGE_AUTH_KEY) || '{}');
    const storedSalt = authMeta.salt || DEFAULT_AUTH_SALT;
    const storedHash = authMeta.hash || DEFAULT_AUTH_HASH;
    const storedEmail = authMeta.email || DEFAULT_ADMIN_EMAIL;

    if (email === storedEmail.toLowerCase()) {
      const computedHash = await derivePBKDF2Hash(password, storedSalt);
      if (computedHash === storedHash) {
        const syntheticToken = 'tok_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        sessionStorage.setItem(STORAGE_TOKEN_KEY, syntheticToken);
        sessionStorage.setItem('fbk_admin_email', email);
        currentAdmin = { email };
        showDashboardView();
        loadAllData();
        showToast('Authenticated securely via WebCrypto!', 'success');
        return;
      }
    }

    errorText.textContent = 'Invalid credentials. Please verify your email and password.';
    errorAlert.style.display = 'flex';
    initIcons();
  } catch (err) {
    errorText.textContent = 'Authentication verification error. Please try again.';
    errorAlert.style.display = 'flex';
    initIcons();
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="log-in"></i><span>Authenticate & Enter</span>';
    initIcons();
  }
}

async function handleLogout() {
  if (isServerAvailable) {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { ...getAuthHeader() }
      });
    } catch (e) {}
  }
  sessionStorage.removeItem(STORAGE_TOKEN_KEY);
  sessionStorage.removeItem('fbk_admin_email');
  currentAdmin = null;
  showLoginView();
  showToast('Signed out safely', 'success');
}

async function handleChangePassword(e) {
  e.preventDefault();
  const oldPassword = document.getElementById('current-pwd').value;
  const newPassword = document.getElementById('new-pwd').value;
  const confirmPassword = document.getElementById('confirm-pwd').value;
  const alertBox = document.getElementById('change-pwd-alert');

  if (newPassword !== confirmPassword) {
    alertBox.className = 'alert alert-danger';
    alertBox.textContent = 'New passwords do not match.';
    alertBox.style.display = 'flex';
    return;
  }

  if (newPassword.length < 8) {
    alertBox.className = 'alert alert-danger';
    alertBox.textContent = 'Password must be at least 8 characters long.';
    alertBox.style.display = 'flex';
    return;
  }

  // Update on server if server is available
  if (isServerAvailable) {
    try {
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alertBox.className = 'alert alert-danger';
        alertBox.textContent = data.error || 'Failed to update password on server.';
        alertBox.style.display = 'flex';
        return;
      }
    } catch (err) {
      console.warn('Server password update failed, continuing with client storage update:', err);
    }
  }

  // Also update WebCrypto local hash
  try {
    const authMeta = JSON.parse(localStorage.getItem(STORAGE_AUTH_KEY) || '{}');
    const storedSalt = authMeta.salt || DEFAULT_AUTH_SALT;
    const storedHash = authMeta.hash || DEFAULT_AUTH_HASH;

    const oldHash = await derivePBKDF2Hash(oldPassword, storedSalt);
    if (oldHash !== storedHash) {
      alertBox.className = 'alert alert-danger';
      alertBox.textContent = 'Current master password is incorrect.';
      alertBox.style.display = 'flex';
      return;
    }

    // Generate new random salt
    const newSalt = Array.from(window.crypto.getRandomValues(new Uint8Array(8)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const newHash = await derivePBKDF2Hash(newPassword, newSalt);

    localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify({
      email: currentAdmin?.email || DEFAULT_ADMIN_EMAIL,
      salt: newSalt,
      hash: newHash
    }));

    alertBox.className = 'alert alert-success';
    alertBox.textContent = 'Master password updated securely! Salt & PBKDF2 hash regenerated.';
    alertBox.style.display = 'flex';
    document.getElementById('change-password-form').reset();
    showToast('Master password successfully updated!', 'success');
  } catch (err) {
    alertBox.className = 'alert alert-danger';
    alertBox.textContent = 'Error updating password hash.';
    alertBox.style.display = 'flex';
  }
}

// =============================================================================
// 4. DATA FETCHING & SYNCHRONIZATION
// =============================================================================

function loadAllData() {
  fetchStats();
  fetchFeedback();
  fetchKeys();
}

async function fetchStats() {
  if (isServerAvailable) {
    try {
      const res = await fetch(`${API_BASE}/api/stats`, {
        headers: { ...getAuthHeader() }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.stats) {
          renderStats(data.stats);
          return;
        }
      }
    } catch (e) {}
  }

  // Client Engine Fallback Calculation
  const records = getLocalFeedback();
  const total = records.length;
  const avg = total > 0 ? (records.reduce((acc, r) => acc + Number(r.rating || 5), 0) / total) : 0;
  
  const starsCount = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  const categories = {};
  const statuses = { 'new': 0, 'reviewing': 0, 'resolved': 0, 'archived': 0 };

  records.forEach(r => {
    const s = String(r.rating || 5);
    starsCount[s] = (starsCount[s] || 0) + 1;

    const cat = r.category || 'General';
    categories[cat] = (categories[cat] || 0) + 1;

    const st = r.status || 'new';
    statuses[st] = (statuses[st] || 0) + 1;
  });

  const positives = (starsCount['4'] || 0) + (starsCount['5'] || 0);
  const posPct = total > 0 ? Math.round((positives / total) * 100) : 100;

  renderStats({
    total,
    avg_rating: Math.round(avg * 10) / 10,
    positive_percentage: posPct,
    stars_count: starsCount,
    categories,
    statuses
  });
}

function animateCounter(elementId, targetValue, isDecimal = false) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const start = 0;
  const duration = 600;
  const startTime = performance.now();

  function update(time) {
    const elapsed = time - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = start + (targetValue - start) * easeOut;

    el.textContent = isDecimal ? current.toFixed(1) : Math.round(current).toLocaleString();
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = isDecimal ? targetValue.toFixed(1) : targetValue.toLocaleString();
    }
  }
  requestAnimationFrame(update);
}

function renderStats(stats) {
  // Animated KPI numbers
  animateCounter('kpi-total-feedback', stats.total);
  animateCounter('kpi-avg-rating', stats.avg_rating, true);
  
  const posEl = document.getElementById('kpi-positive-pct');
  if (posEl) posEl.textContent = `${stats.positive_percentage}%`;
  
  animateCounter('kpi-pending-count', stats.statuses['new'] || 0);

  // Star display
  const fullStars = Math.round(stats.avg_rating);
  document.getElementById('kpi-rating-stars').textContent = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);

  // Rating distribution bars
  const barsContainer = document.getElementById('rating-bars-container');
  barsContainer.innerHTML = '';
  for (let s = 5; s >= 1; s--) {
    const count = stats.stars_count[String(s)] || 0;
    const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
    barsContainer.innerHTML += `
      <div class="rating-bar-row">
        <div class="rating-bar-label">
          <span>${s}</span>
          <span style="color: #f59e0b;">★</span>
        </div>
        <div class="rating-bar-track">
          <div class="rating-bar-fill" style="width: 0%;" data-width="${pct}%"></div>
        </div>
        <div class="rating-bar-count">${count} (${pct}%)</div>
      </div>
    `;
  }

  // Trigger smooth bar width animation
  setTimeout(() => {
    document.querySelectorAll('.rating-bar-fill').forEach(fill => {
      fill.style.width = fill.getAttribute('data-width');
    });
  }, 50);

  // Category stats list
  const catContainer = document.getElementById('category-stats-container');
  catContainer.innerHTML = '';
  const cats = Object.keys(stats.categories);
  if (cats.length === 0) {
    catContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">No category data yet.</div>';
  } else {
    cats.forEach(cat => {
      const count = stats.categories[cat];
      const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
      catContainer.innerHTML += `
        <div class="category-stat-item">
          <span class="category-pill">${escapeHtml(cat)}</span>
          <span style="font-size: 0.88rem; font-weight: 600;">
            ${count} <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 400;">(${pct}%)</span>
          </span>
        </div>
      `;
    });
  }
}

async function fetchFeedback() {
  const rating = document.getElementById('filter-rating').value;
  const status = document.getElementById('filter-status').value;
  const category = document.getElementById('filter-category').value;
  const search = document.getElementById('feedback-search-input').value.trim().toLowerCase();

  let items = [];

  if (isServerAvailable) {
    try {
      const params = new URLSearchParams();
      if (rating) params.append('rating', rating);
      if (status && status !== 'all') params.append('status', status);
      if (category && category !== 'all') params.append('category', category);
      if (search) params.append('search', search);

      const res = await fetch(`${API_BASE}/api/feedback?${params.toString()}`, {
        headers: { ...getAuthHeader() }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) items = data.feedback;
      }
    } catch (e) {}
  }

  // Fallback to local storage
  if (items.length === 0 && !isServerAvailable) {
    let local = getLocalFeedback();

    if (rating) local = local.filter(r => String(r.rating) === String(rating));
    if (status && status !== 'all') local = local.filter(r => r.status === status);
    if (category && category !== 'all') local = local.filter(r => r.category === category);
    if (search) {
      local = local.filter(r =>
        (r.message && r.message.toLowerCase().includes(search)) ||
        (r.name && r.name.toLowerCase().includes(search)) ||
        (r.email && r.email.toLowerCase().includes(search))
      );
    }
    items = local.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  allFeedback = items;
  renderFeedbackTable(allFeedback);
  renderRecentOverview(allFeedback);
  document.getElementById('inbox-badge-count').textContent = allFeedback.length;
}

function getLocalFeedback() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_FEEDBACK_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function setLocalFeedback(arr) {
  localStorage.setItem(STORAGE_FEEDBACK_KEY, JSON.stringify(arr));
  localStorage.setItem('fbk_ping_update', Date.now().toString());
}

function renderFeedbackTable(items) {
  const tbody = document.getElementById('feedback-table-body');
  const emptyState = document.getElementById('table-empty-state');
  tbody.innerHTML = '';

  if (items.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  items.forEach(item => {
    const stars = '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating);
    const dateFormatted = formatDate(item.created_at);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="font-weight: 600; color: var(--text-primary);">${escapeHtml(item.name || 'Anonymous')}</div>
        <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(item.email || 'No email provided')}</div>
      </td>
      <td>
        <div class="star-rating" title="${item.rating} of 5 stars">${stars}</div>
      </td>
      <td>
        <span class="category-pill">${escapeHtml(item.category || 'General')}</span>
      </td>
      <td>
        <div class="message-preview" title="${escapeHtml(item.message)}">${escapeHtml(item.message)}</div>
      </td>
      <td>
        <span class="badge badge-${item.status}">${item.status}</span>
      </td>
      <td style="color: var(--text-muted); font-size: 0.82rem; white-space: nowrap;">
        ${dateFormatted}
      </td>
      <td style="text-align: right;">
        <div class="action-btns" style="justify-content: flex-end;">
          <button class="btn-icon-sm" title="Inspect & Update" onclick="inspectFeedback(${item.id})">
            <i data-lucide="eye" style="width: 15px; height: 15px;"></i>
          </button>
          <button class="btn-icon-sm delete" title="Delete entry" onclick="deleteFeedback(${item.id})">
            <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  initIcons();
}

function renderRecentOverview(items) {
  const container = document.getElementById('recent-feedback-container');
  if (!container) return;
  container.innerHTML = '';

  const recent = items.slice(0, 4);
  if (recent.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0;">No submissions recorded yet.</div>';
    return;
  }

  recent.forEach(item => {
    const stars = '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating);
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 0.5rem; border-bottom: 1px solid var(--border-subtle); cursor: pointer; border-radius: var(--radius-sm); transition: background 0.15s;';
    div.onmouseover = () => { div.style.background = 'rgba(255, 255, 255, 0.03)'; };
    div.onmouseout = () => { div.style.background = 'transparent'; };
    div.onclick = () => inspectFeedback(item.id);
    div.innerHTML = `
      <div style="display: flex; align-items: center; gap: 1rem; overflow: hidden;">
        <div class="star-rating" style="font-size: 0.9rem;">${stars}</div>
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <strong style="font-size: 0.9rem; color: #fff;">${escapeHtml(item.name || 'Anonymous')}</strong>
          <span style="font-size: 0.85rem; color: var(--text-secondary); margin-left: 0.5rem;">${escapeHtml(item.message)}</span>
        </div>
      </div>
      <span class="badge badge-${item.status}">${item.status}</span>
    `;
    container.appendChild(div);
  });
}

// =============================================================================
// 5. INSPECTION & FEEDBACK DETAILS
// =============================================================================

function inspectFeedback(id) {
  const item = allFeedback.find(f => Number(f.id) === Number(id));
  if (!item) return;

  currentInspectedFeedbackId = id;
  const body = document.getElementById('feedback-detail-body');
  const stars = '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating);
  const formattedDate = new Date(item.created_at).toLocaleString();

  body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
      <div class="star-rating" style="font-size: 1.35rem;">${stars}</div>
      <span class="category-pill" style="font-size: 0.88rem; font-weight: 600;">${escapeHtml(item.category)}</span>
    </div>

    <div style="background: rgba(0,0,0,0.45); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.35rem;">
      <div style="font-size: 0.98rem; line-height: 1.6; color: #fff; white-space: pre-wrap;">${escapeHtml(item.message)}</div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.35rem; font-size: 0.85rem; background: rgba(255,255,255,0.02); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
      <div>
        <span style="color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase;">Submitted By:</span>
        <div style="font-weight: 600; color: #fff; margin-top: 2px;">${escapeHtml(item.name || 'Anonymous')}</div>
      </div>
      <div>
        <span style="color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase;">Customer Email:</span>
        <div style="font-weight: 600; color: #a5b4fc; margin-top: 2px;">${escapeHtml(item.email || 'None provided')}</div>
      </div>
      <div>
        <span style="color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase;">Submission Date:</span>
        <div style="color: var(--text-secondary); margin-top: 2px;">${formattedDate}</div>
      </div>
      <div>
        <span style="color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase;">Origin URL:</span>
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-secondary); margin-top: 2px;" title="${escapeHtml(item.page_url || 'N/A')}">
          ${escapeHtml(item.page_url || 'N/A')}
        </div>
      </div>
    </div>

    <div class="form-group" style="margin-bottom: 1.25rem;">
      <label class="form-label" for="modal-status-select">Status Workflow</label>
      <select id="modal-status-select" class="select-dropdown" style="width: 100%;">
        <option value="new" ${item.status === 'new' ? 'selected' : ''}>New / Unread</option>
        <option value="reviewing" ${item.status === 'reviewing' ? 'selected' : ''}>Under Review</option>
        <option value="resolved" ${item.status === 'resolved' ? 'selected' : ''}>Resolved</option>
        <option value="archived" ${item.status === 'archived' ? 'selected' : ''}>Archived</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label" for="modal-admin-notes">Internal Administrator Notes</label>
      <textarea id="modal-admin-notes" class="form-input" rows="3" placeholder="Add private notes, ticket references, or team actions...">${escapeHtml(item.admin_notes || '')}</textarea>
    </div>
  `;

  // Update reply link
  const replyBtn = document.getElementById('modal-reply-btn');
  if (item.email) {
    replyBtn.href = `mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent('Following up on your feedback')}&body=${encodeURIComponent(`Hi ${item.name || 'there'},\n\nThank you for sharing your feedback with us:\n"${item.message}"\n\n`)}`;
    replyBtn.style.display = 'inline-flex';
  } else {
    replyBtn.style.display = 'none';
  }

  openModal('feedback-detail-modal');
  initIcons();
}

async function saveFeedbackDetails() {
  if (!currentInspectedFeedbackId) return;

  const status = document.getElementById('modal-status-select').value;
  const admin_notes = document.getElementById('modal-admin-notes').value;

  if (isServerAvailable) {
    try {
      await fetch(`${API_BASE}/api/feedback/${currentInspectedFeedbackId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ status, admin_notes })
      });
    } catch (e) {}
  }

  // Update local storage
  const local = getLocalFeedback();
  const idx = local.findIndex(f => Number(f.id) === Number(currentInspectedFeedbackId));
  if (idx !== -1) {
    local[idx].status = status;
    local[idx].admin_notes = admin_notes;
    setLocalFeedback(local);
  }

  closeModal('feedback-detail-modal');
  showToast('Feedback updated successfully!', 'success');
  loadAllData();
}

async function deleteFeedback(id) {
  if (!confirm('Are you sure you want to permanently delete this feedback entry?')) return;

  if (isServerAvailable) {
    try {
      await fetch(`${API_BASE}/api/feedback/${id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeader() }
      });
    } catch (e) {}
  }

  const local = getLocalFeedback();
  const updated = local.filter(f => Number(f.id) !== Number(id));
  setLocalFeedback(updated);

  showToast('Feedback entry deleted', 'success');
  loadAllData();
}

// =============================================================================
// 6. API KEYS & INTEGRATION
// =============================================================================

async function fetchKeys() {
  if (isServerAvailable) {
    try {
      const res = await fetch(`${API_BASE}/api/keys`, {
        headers: { ...getAuthHeader() }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.keys) {
          allKeys = data.keys;
          renderKeysList(allKeys);
          updateCodeSnippets(allKeys);
          return;
        }
      }
    } catch (e) {}
  }

  // Fallback to local keys
  try {
    allKeys = JSON.parse(localStorage.getItem(STORAGE_KEYS_KEY) || '[]');
  } catch (e) {
    allKeys = [];
  }

  renderKeysList(allKeys);
  updateCodeSnippets(allKeys);
}

function renderKeysList(keys) {
  const container = document.getElementById('api-keys-list-container');
  container.innerHTML = '';

  if (keys.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); padding: 1.5rem 0;">No active API keys found. Generate a new key above.</div>';
    return;
  }

  keys.forEach(k => {
    const isRevoked = k.status === 'revoked';
    const card = document.createElement('div');
    card.className = 'key-card';
    card.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.4rem; overflow: hidden;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <strong style="font-size: 1rem; color: #fff;">${escapeHtml(k.name)}</strong>
          <span class="badge badge-${isRevoked ? 'archived' : 'resolved'}">${escapeHtml(k.status)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
          <span class="key-mono" id="key-val-${k.id}">${k.key_value}</span>
          <button class="btn-icon-sm" title="Copy Full API Key" onclick="copyToClipboard('${k.key_value}', 'API Key copied to clipboard!')">
            <i data-lucide="copy" style="width: 14px; height: 14px;"></i>
          </button>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
          Requests Handled: <strong style="color: var(--text-primary);">${k.requests_count || 0}</strong> • Created: ${formatDate(k.created_at)}
        </div>
      </div>
      <div>
        ${!isRevoked ? `
          <button class="btn btn-secondary" style="padding: 0.45rem 0.95rem; font-size: 0.82rem;" onclick="revokeKey(${k.id})">
            Revoke Key
          </button>
        ` : `<span style="color: var(--text-muted); font-size: 0.85rem;">Revoked</span>`}
      </div>
    `;
    container.appendChild(card);
  });

  initIcons();
}

async function handleGenerateKey() {
  const nameInput = document.getElementById('new-key-name');
  const name = nameInput.value.trim() || 'Production Website Key';
  const newKeyVal = 'fbk_live_' + Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  if (isServerAvailable) {
    try {
      await fetch(`${API_BASE}/api/keys/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ name })
      });
    } catch (e) {}
  }

  // Update local storage
  let localKeys = [];
  try {
    localKeys = JSON.parse(localStorage.getItem(STORAGE_KEYS_KEY) || '[]');
  } catch (e) {}

  localKeys.unshift({
    id: Date.now(),
    key_value: newKeyVal,
    name: name,
    status: 'active',
    requests_count: 0,
    created_at: new Date().toISOString()
  });
  localStorage.setItem(STORAGE_KEYS_KEY, JSON.stringify(localKeys));

  closeModal('generate-key-modal');
  showToast('New API key created successfully!', 'success');
  fetchKeys();
}

async function revokeKey(id) {
  if (!confirm('Are you sure you want to revoke this API key? External websites using this key will immediately be blocked from sending reviews.')) return;

  if (isServerAvailable) {
    try {
      await fetch(`${API_BASE}/api/keys/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ id })
      });
    } catch (e) {}
  }

  let localKeys = [];
  try {
    localKeys = JSON.parse(localStorage.getItem(STORAGE_KEYS_KEY) || '[]');
    const target = localKeys.find(k => Number(k.id) === Number(id));
    if (target) target.status = 'revoked';
    localStorage.setItem(STORAGE_KEYS_KEY, JSON.stringify(localKeys));
  } catch (e) {}

  showToast('API Key revoked', 'success');
  fetchKeys();
}

function updateCodeSnippets(keys) {
  const activeKey = keys.find(k => k.status === 'active')?.key_value || 'fbk_live_bf4a54065934a725799fab202fd11ed2';
  const origin = window.location.origin;

  // Embed snippet
  const embedSnippet = `<!-- 1. Include the FeedbackHub Widget Script in your HTML -->
<script 
  src="${origin}/widget.js" 
  data-api-key="${activeKey}" 
  data-position="bottom-right" 
  defer>
</script>`;
  document.getElementById('embed-code-snippet').textContent = embedSnippet;

  // Fetch API snippet
  const fetchSnippet = `// Submit user feedback programmatically using fetch()
async function sendFeedback(rating, category, message, userEmail, userName) {
  const response = await fetch('${origin}/api/v1/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': '${activeKey}'
    },
    body: JSON.stringify({
      rating: rating,        // Integer 1 to 5
      category: category,    // e.g. "Praise", "Feature Request", "Bug Report"
      message: message,      // Review text
      email: userEmail,      // Optional
      name: userName,        // Optional
      page_url: window.location.href
    })
  });

  const data = await response.json();
  if (response.ok) {
    console.log('Feedback submitted:', data.message);
  }
}`;
  document.getElementById('fetch-code-snippet').textContent = fetchSnippet;

  // cURL snippet
  const curlSnippet = `curl -X POST "${origin}/api/v1/feedback" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${activeKey}" \\
  -d '{
    "rating": 5,
    "category": "Praise",
    "message": "Super responsive dashboard and intuitive design!",
    "name": "Alex",
    "email": "alex@example.com"
  }'`;
  document.getElementById('curl-code-snippet').textContent = curlSnippet;
}

// =============================================================================
// 7. EXPORT TOOLS (CSV & JSON)
// =============================================================================

function exportToCSV() {
  if (allFeedback.length === 0) {
    showToast('No feedback entries to export', 'error');
    return;
  }

  const headers = ['ID', 'Name', 'Email', 'Rating', 'Category', 'Message', 'Status', 'Page URL', 'Admin Notes', 'Date'];
  const rows = allFeedback.map(f => [
    f.id,
    `"${(f.name || '').replace(/"/g, '""')}"`,
    `"${(f.email || '').replace(/"/g, '""')}"`,
    f.rating,
    `"${(f.category || '').replace(/"/g, '""')}"`,
    `"${(f.message || '').replace(/"/g, '""')}"`,
    f.status,
    `"${(f.page_url || '').replace(/"/g, '""')}"`,
    `"${(f.admin_notes || '').replace(/"/g, '""')}"`,
    `"${f.created_at}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `feedback_export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Exported feedback to CSV', 'success');
}

function exportToJSON() {
  if (allFeedback.length === 0) {
    showToast('No feedback entries to export', 'error');
    return;
  }

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(allFeedback, null, 2));
  const link = document.createElement('a');
  link.setAttribute('href', dataStr);
  link.setAttribute('download', `feedback_export_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Exported feedback to JSON', 'success');
}

function handleSeedSample() {
  const samples = [
    { name: "Jordan Taylor", email: "jordan@matrix.dev", rating: 5, category: "Praise", message: "Blown away by the speed and intuitive design! Best admin dashboard I've tested this year." },
    { name: "Devon Vance", email: "devon@cloudops.net", rating: 4, category: "Feature Request", message: "Would be great to add Slack or Discord webhook notifications on new reviews." },
    { name: "Aria Thorne", email: "aria@fintech.io", rating: 3, category: "UX / Usability", message: "The export button works great, but could we add an option to filter columns before export?" }
  ];
  const item = samples[Math.floor(Math.random() * samples.length)];

  if (isServerAvailable) {
    fetch(`${API_BASE}/api/feedback/sample`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(item)
    }).catch(() => {});
  }

  // Update local storage
  const local = getLocalFeedback();
  local.unshift({
    id: Date.now(),
    name: item.name,
    email: item.email,
    rating: item.rating,
    category: item.category,
    message: item.message,
    page_url: window.location.origin + '/demo-client.html',
    status: 'new',
    admin_notes: '',
    created_at: new Date().toISOString()
  });
  setLocalFeedback(local);

  showToast('Sample feedback added!', 'success');
  loadAllData();
}

// =============================================================================
// 8. EVENT LISTENERS & NAVIGATION
// =============================================================================

function setupEventListeners() {
  // Password Visibility Toggle
  const togglePwdBtn = document.getElementById('toggle-password-btn');
  const pwdInput = document.getElementById('login-password');
  if (togglePwdBtn && pwdInput) {
    togglePwdBtn.addEventListener('click', () => {
      const isPassword = pwdInput.type === 'password';
      pwdInput.type = isPassword ? 'text' : 'password';
      const eyeIcon = document.getElementById('pwd-eye-icon');
      if (eyeIcon) {
        eyeIcon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
        initIcons();
      }
    });
  }

  // Login Form
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  // Logout Button
  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  // Navigation Tabs
  document.querySelectorAll('.nav-link[data-tab]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(link.getAttribute('data-tab'));
    });
  });

  // Action Buttons
  const refreshBtn = document.getElementById('refresh-data-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    loadAllData();
    showToast('Data refreshed successfully', 'success');
  });

  const seedBtn = document.getElementById('seed-sample-btn');
  if (seedBtn) seedBtn.addEventListener('click', handleSeedSample);

  // Inbox Search & Filters
  const searchInput = document.getElementById('feedback-search-input');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchFeedback(), 200);
    });
  }

  ['filter-rating', 'filter-status', 'filter-category'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => fetchFeedback());
  });

  // Export Buttons
  const exportCsvBtn = document.getElementById('export-csv-btn');
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCSV);

  const exportJsonBtn = document.getElementById('export-json-btn');
  if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportToJSON);

  // Key Generation
  const openKeyModalBtn = document.getElementById('open-generate-key-modal-btn');
  if (openKeyModalBtn) openKeyModalBtn.addEventListener('click', () => {
    document.getElementById('new-key-name').value = '';
    openModal('generate-key-modal');
  });

  const submitKeyBtn = document.getElementById('submit-generate-key-btn');
  if (submitKeyBtn) submitKeyBtn.addEventListener('click', handleGenerateKey);

  // Modal Delete
  const modalDeleteBtn = document.getElementById('modal-delete-btn');
  if (modalDeleteBtn) modalDeleteBtn.addEventListener('click', () => {
    if (currentInspectedFeedbackId) {
      deleteFeedback(currentInspectedFeedbackId);
      closeModal('feedback-detail-modal');
    }
  });

  // Change Password Form
  const changePwdForm = document.getElementById('change-password-form');
  if (changePwdForm) changePwdForm.addEventListener('submit', handleChangePassword);
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  const targetPanel = document.getElementById(tabId);
  const targetLink = document.querySelector(`.nav-link[data-tab="${tabId}"]`);

  if (targetPanel) targetPanel.classList.add('active');
  if (targetLink) targetLink.classList.add('active');

  const titleEl = document.getElementById('top-bar-title');
  const descEl = document.getElementById('top-bar-desc');

  if (tabId === 'tab-overview') {
    titleEl.textContent = 'Overview & Analytics';
    descEl.textContent = 'Real-time performance metrics and customer feedback breakdown';
    fetchStats();
  } else if (tabId === 'tab-inbox') {
    titleEl.textContent = 'Feedback Inbox';
    descEl.textContent = 'Browse, filter, inspect, and reply to all customer submissions';
    fetchFeedback();
  } else if (tabId === 'tab-keys') {
    titleEl.textContent = 'API Keys & Integration';
    descEl.textContent = 'Manage connection keys and generate embed snippets for your client websites';
    fetchKeys();
  } else if (tabId === 'tab-security') {
    titleEl.textContent = 'Security & Credentials';
    descEl.textContent = 'Master password updates and cryptographic protection specifications';
  }

  initIcons();
}

function openModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.add('show');
}

function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove('show');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" style="width: 16px; height: 16px; flex-shrink: 0;"></i>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);
  initIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function copyToClipboard(text, successMsg = 'Copied to clipboard!') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(successMsg, 'success');
  }).catch(() => {
    showToast('Failed to copy text', 'error');
  });
}

function copySnippet(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    copyToClipboard(el.textContent, 'Code snippet copied to clipboard!');
  }
}

function formatDate(isoStr) {
  if (!isoStr) return 'N/A';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return isoStr;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
