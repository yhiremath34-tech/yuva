/**
 * FEEDBACK ADMIN PORTAL - CLIENT APPLICATION CONTROLLER
 * Zero hardcoded credentials. All authentication is verified server-side with PBKDF2 hashes.
 */

const STORAGE_TOKEN_KEY = 'fbk_admin_session_token';
const API_BASE = window.location.origin;

let currentAdmin = null;
let allFeedback = [];
let allKeys = [];
let currentInspectedFeedbackId = null;

// =============================================================================
// 1. INITIALIZATION & AUTHENTICATION STATE
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initIcons();
  setupEventListeners();
  checkAuth();
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

async function checkAuth() {
  const token = sessionStorage.getItem(STORAGE_TOKEN_KEY);
  if (!token) {
    showLoginView();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/verify`, {
      headers: { ...getAuthHeader() }
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      currentAdmin = data.admin;
      showDashboardView();
      loadAllData();
    } else {
      sessionStorage.removeItem(STORAGE_TOKEN_KEY);
      showLoginView();
    }
  } catch (err) {
    console.error('Authentication verification failed:', err);
    showLoginView();
  }
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

// =============================================================================
// 2. EVENT LISTENERS
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

  // Login Form Submission
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Logout Button
  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Navigation Tab Switching
  document.querySelectorAll('.nav-link[data-tab]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = link.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // Top Action Buttons
  const refreshBtn = document.getElementById('refresh-data-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    loadAllData();
    showToast('Data refreshed successfully', 'success');
  });

  const seedBtn = document.getElementById('seed-sample-btn');
  if (seedBtn) seedBtn.addEventListener('click', handleSeedSample);

  // Filters & Search in Inbox
  const searchInput = document.getElementById('feedback-search-input');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchFeedback(), 250);
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

  // Generate Key Modal
  const openKeyModalBtn = document.getElementById('open-generate-key-modal-btn');
  if (openKeyModalBtn) openKeyModalBtn.addEventListener('click', () => {
    document.getElementById('new-key-name').value = '';
    openModal('generate-key-modal');
  });

  const submitKeyBtn = document.getElementById('submit-generate-key-btn');
  if (submitKeyBtn) submitKeyBtn.addEventListener('click', handleGenerateKey);

  // Modal Delete & Reply
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

// =============================================================================
// 3. AUTHENTICATION HANDLERS
// =============================================================================

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const submitBtn = document.getElementById('login-submit-btn');
  const errorAlert = document.getElementById('login-error-alert');
  const errorText = document.getElementById('login-error-text');

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>Verifying...</span>';
  errorAlert.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (res.ok && data.ok) {
      sessionStorage.setItem(STORAGE_TOKEN_KEY, data.token);
      currentAdmin = data.admin;
      showDashboardView();
      loadAllData();
      showToast('Welcome back, Administrator!', 'success');
    } else {
      errorText.textContent = data.error || 'Invalid credentials.';
      errorAlert.style.display = 'flex';
      initIcons();
    }
  } catch (err) {
    errorText.textContent = 'Server connection failed. Ensure server.py is running.';
    errorAlert.style.display = 'flex';
    initIcons();
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="log-in"></i><span>Authenticate & Enter</span>';
    initIcons();
  }
}

async function handleLogout() {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
  } catch (err) {
    console.warn('Logout notification error:', err);
  }
  sessionStorage.removeItem(STORAGE_TOKEN_KEY);
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

  try {
    const res = await fetch(`${API_BASE}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
    });
    const data = await res.json();

    if (res.ok && data.ok) {
      alertBox.className = 'alert alert-success';
      alertBox.textContent = 'Master password updated securely! Salt & PBKDF2 hash regenerated.';
      alertBox.style.display = 'flex';
      document.getElementById('change-password-form').reset();
      showToast('Master password updated!', 'success');
    } else {
      alertBox.className = 'alert alert-danger';
      alertBox.textContent = data.error || 'Failed to update password.';
      alertBox.style.display = 'flex';
    }
  } catch (err) {
    alertBox.className = 'alert alert-danger';
    alertBox.textContent = 'Network error while updating password.';
    alertBox.style.display = 'flex';
  }
}

// =============================================================================
// 4. DATA LOADING & RENDERING
// =============================================================================

function loadAllData() {
  fetchStats();
  fetchFeedback();
  fetchKeys();
}

async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok && data.stats) {
      renderStats(data.stats);
    }
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
}

function renderStats(stats) {
  // KPI Cards
  document.getElementById('kpi-total-feedback').textContent = stats.total.toLocaleString();
  document.getElementById('kpi-avg-rating').textContent = stats.avg_rating.toFixed(1);
  document.getElementById('kpi-positive-pct').textContent = `${stats.positive_percentage}%`;
  document.getElementById('kpi-pending-count').textContent = stats.statuses['new'] || 0;

  // Star display
  const fullStars = Math.round(stats.avg_rating);
  document.getElementById('kpi-rating-stars').textContent = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);

  // Rating distribution bars
  const barsContainer = document.getElementById('rating-bars-container');
  barsContainer.innerHTML = '';
  for (let s = 5; s >= 1; s--) {
    const count = stats.stars_count[s] || 0;
    const pct = stats.total > 0 ? ((count / stats.total) * 100).toFixed(0) : 0;
    barsContainer.innerHTML += `
      <div class="rating-bar-row">
        <div class="rating-bar-label">
          <span>${s}</span>
          <span style="color: #f59e0b;">★</span>
        </div>
        <div class="rating-bar-track">
          <div class="rating-bar-fill" style="width: ${pct}%;"></div>
        </div>
        <div class="rating-bar-count">${count} (${pct}%)</div>
      </div>
    `;
  }

  // Category stats list
  const catContainer = document.getElementById('category-stats-container');
  catContainer.innerHTML = '';
  const categories = Object.keys(stats.categories);
  if (categories.length === 0) {
    catContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">No category data yet.</div>';
  } else {
    categories.forEach(cat => {
      const count = stats.categories[cat];
      const pct = stats.total > 0 ? ((count / stats.total) * 100).toFixed(0) : 0;
      catContainer.innerHTML += `
        <div class="category-stat-item">
          <span class="category-pill">${escapeHtml(cat)}</span>
          <span style="font-size: 0.85rem; font-weight: 600;">${count} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">(${pct}%)</span></span>
        </div>
      `;
    });
  }
}

async function fetchFeedback() {
  const rating = document.getElementById('filter-rating').value;
  const status = document.getElementById('filter-status').value;
  const category = document.getElementById('filter-category').value;
  const search = document.getElementById('feedback-search-input').value.trim();

  const params = new URLSearchParams();
  if (rating) params.append('rating', rating);
  if (status && status !== 'all') params.append('status', status);
  if (category && category !== 'all') params.append('category', category);
  if (search) params.append('search', search);

  try {
    const res = await fetch(`${API_BASE}/api/feedback?${params.toString()}`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok && data.feedback) {
      allFeedback = data.feedback;
      renderFeedbackTable(allFeedback);
      renderRecentOverview(allFeedback);
      document.getElementById('inbox-badge-count').textContent = allFeedback.length;
    }
  } catch (err) {
    console.error('Error fetching feedback:', err);
  }
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
      <td style="color: var(--text-muted); font-size: 0.82rem;">
        ${dateFormatted}
      </td>
      <td style="text-align: right;">
        <div class="action-btns" style="justify-content: flex-end;">
          <button class="btn-icon-sm" title="Inspect & Update" onclick="inspectFeedback(${item.id})">
            <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
          </button>
          <button class="btn-icon-sm delete" title="Delete entry" onclick="deleteFeedback(${item.id})">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
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
    div.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border-subtle); cursor: pointer;';
    div.onclick = () => inspectFeedback(item.id);
    div.innerHTML = `
      <div style="display: flex; align-items: center; gap: 1rem; overflow: hidden;">
        <div class="star-rating" style="font-size: 0.85rem;">${stars}</div>
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <strong style="font-size: 0.88rem;">${escapeHtml(item.name || 'Anonymous')}</strong>
          <span style="font-size: 0.82rem; color: var(--text-secondary); margin-left: 0.5rem;">${escapeHtml(item.message)}</span>
        </div>
      </div>
      <span class="badge badge-${item.status}">${item.status}</span>
    `;
    container.appendChild(div);
  });
}

// =============================================================================
// 5. FEEDBACK INSPECTION & MODAL
// =============================================================================

function inspectFeedback(id) {
  const item = allFeedback.find(f => f.id === id);
  if (!item) return;

  currentInspectedFeedbackId = id;
  const body = document.getElementById('feedback-detail-body');
  const stars = '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating);
  const formattedDate = new Date(item.created_at).toLocaleString();

  body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
      <div class="star-rating" style="font-size: 1.2rem;">${stars}</div>
      <span class="category-pill" style="font-size: 0.85rem;">${escapeHtml(item.category)}</span>
    </div>

    <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem;">
      <div style="font-size: 0.95rem; line-height: 1.5; color: #fff; white-space: pre-wrap;">${escapeHtml(item.message)}</div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem; font-size: 0.82rem;">
      <div>
        <span style="color: var(--text-muted);">Submitted By:</span>
        <div style="font-weight: 600;">${escapeHtml(item.name || 'Anonymous')}</div>
      </div>
      <div>
        <span style="color: var(--text-muted);">Email:</span>
        <div style="font-weight: 600;">${escapeHtml(item.email || 'None')}</div>
      </div>
      <div>
        <span style="color: var(--text-muted);">Submitted On:</span>
        <div>${formattedDate}</div>
      </div>
      <div>
        <span style="color: var(--text-muted);">Source URL:</span>
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.page_url || 'N/A')}">
          ${escapeHtml(item.page_url || 'N/A')}
        </div>
      </div>
    </div>

    <div class="form-group" style="margin-bottom: 1rem;">
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
      <textarea id="modal-admin-notes" class="form-input" rows="3" placeholder="Add follow-up notes, ticket references, or team comments...">${escapeHtml(item.admin_notes || '')}</textarea>
    </div>
  `;

  // Update reply link
  const replyBtn = document.getElementById('modal-reply-btn');
  if (item.email) {
    replyBtn.href = `mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent('Following up on your feedback')}&body=${encodeURIComponent(`Hi ${item.name || 'there'},\n\nThank you for your feedback:\n"${item.message}"\n\n`)}`;
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

  try {
    const res = await fetch(`${API_BASE}/api/feedback/${currentInspectedFeedbackId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ status, admin_notes })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      closeModal('feedback-detail-modal');
      showToast('Feedback updated successfully', 'success');
      loadAllData();
    }
  } catch (err) {
    showToast('Failed to save feedback changes', 'error');
  }
}

async function deleteFeedback(id) {
  if (!confirm('Are you sure you want to delete this feedback entry?')) return;

  try {
    const res = await fetch(`${API_BASE}/api/feedback/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      showToast('Feedback record deleted', 'success');
      loadAllData();
    }
  } catch (err) {
    showToast('Failed to delete feedback', 'error');
  }
}

// =============================================================================
// 6. API KEY MANAGEMENT & CODE SNIPPETS
// =============================================================================

async function fetchKeys() {
  try {
    const res = await fetch(`${API_BASE}/api/keys`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok && data.keys) {
      allKeys = data.keys;
      renderKeysList(allKeys);
      updateCodeSnippets(allKeys);
    }
  } catch (err) {
    console.error('Error fetching API keys:', err);
  }
}

function renderKeysList(keys) {
  const container = document.getElementById('api-keys-list-container');
  container.innerHTML = '';

  if (keys.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); padding: 1rem 0;">No API keys generated yet. Click "Generate New Key" above.</div>';
    return;
  }

  keys.forEach(k => {
    const isRevoked = k.status === 'revoked';
    const card = document.createElement('div');
    card.className = 'key-card';
    card.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.35rem; overflow: hidden;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <strong style="font-size: 0.95rem;">${escapeHtml(k.name)}</strong>
          <span class="badge badge-${isRevoked ? 'archived' : 'resolved'}">${escapeHtml(k.status)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span class="key-mono" id="key-val-${k.id}">${k.key_value}</span>
          <button class="btn-icon-sm" title="Copy Full API Key" onclick="copyToClipboard('${k.key_value}', 'API Key copied!')">
            <i data-lucide="copy" style="width: 14px; height: 14px;"></i>
          </button>
        </div>
        <div style="font-size: 0.78rem; color: var(--text-muted);">
          Requests Handled: <strong style="color: var(--text-primary);">${k.requests_count}</strong> • Created: ${formatDate(k.created_at)}
        </div>
      </div>
      <div>
        ${!isRevoked ? `
          <button class="btn btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="revokeKey(${k.id})">
            Revoke Key
          </button>
        ` : `<span style="color: var(--text-muted); font-size: 0.8rem;">Revoked</span>`}
      </div>
    `;
    container.appendChild(card);
  });

  initIcons();
}

async function handleGenerateKey() {
  const nameInput = document.getElementById('new-key-name');
  const name = nameInput.value.trim() || 'External Website Key';

  try {
    const res = await fetch(`${API_BASE}/api/keys/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      closeModal('generate-key-modal');
      showToast('New API key generated successfully!', 'success');
      fetchKeys();
    }
  } catch (err) {
    showToast('Failed to generate key', 'error');
  }
}

async function revokeKey(id) {
  if (!confirm('Are you sure you want to revoke this API key? External websites using this key will no longer be able to submit reviews.')) return;

  try {
    const res = await fetch(`${API_BASE}/api/keys/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      showToast('API key revoked', 'success');
      fetchKeys();
    }
  } catch (err) {
    showToast('Failed to revoke key', 'error');
  }
}

function updateCodeSnippets(keys) {
  const activeKey = keys.find(k => k.status === 'active')?.key_value || 'fbk_live_your_api_key_here';

  // Embed script
  const embedSnippet = `<!-- 1. Include the FeedbackHub Widget Script in your HTML -->
<script 
  src="${API_BASE}/widget.js" 
  data-api-key="${activeKey}" 
  data-position="bottom-right"
  defer>
</script>`;
  document.getElementById('embed-code-snippet').textContent = embedSnippet;

  // Fetch API Snippet
  const fetchSnippet = `// Submit user feedback using JavaScript fetch()
async function submitFeedback(rating, category, message, userEmail, userName) {
  const response = await fetch('${API_BASE}/api/v1/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': '${activeKey}'
    },
    body: JSON.stringify({
      rating: rating,        // 1 to 5
      category: category,    // e.g. "Praise", "Bug Report", "Feature Request"
      message: message,      // Review text
      email: userEmail,      // Optional
      name: userName,        // Optional
      page_url: window.location.href
    })
  });

  const result = await response.json();
  if (response.ok) {
    console.log('Feedback submitted:', result.message);
  }
}`;
  document.getElementById('fetch-code-snippet').textContent = fetchSnippet;

  // cURL snippet
  const curlSnippet = `curl -X POST "${API_BASE}/api/v1/feedback" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${activeKey}" \\
  -d '{
    "rating": 5,
    "category": "Praise",
    "message": "Super clean dashboard and fast response!",
    "name": "Jane Doe",
    "email": "jane@example.com"
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

// Quick Sample Generator
async function handleSeedSample() {
  try {
    const samples = [
      { name: "Jordan Taylor", email: "jordan@matrix.dev", rating: 5, category: "Praise", message: "Blown away by the speed and intuitive design! Best admin dashboard I've tested this year." },
      { name: "Devon Vance", email: "devon@cloudops.net", rating: 4, category: "Feature Request", message: "Would be great to add Slack or Discord webhook notifications on new reviews." },
      { name: "Aria Thorne", email: "aria@fintech.io", rating: 3, category: "UX / Usability", message: "The export button works great, but could we add an option to filter columns before export?" }
    ];
    const item = samples[Math.floor(Math.random() * samples.length)];

    const res = await fetch(`${API_BASE}/api/feedback/sample`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(item)
    });
    if (res.ok) {
      showToast('Added test feedback entry!', 'success');
      loadAllData();
    }
  } catch (err) {
    showToast('Failed to seed sample', 'error');
  }
}

// =============================================================================
// 8. HELPERS & UTILITIES
// =============================================================================

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
  } else if (tabId === 'tab-inbox') {
    titleEl.textContent = 'Feedback Inbox';
    descEl.textContent = 'Browse, filter, inspect, and reply to all customer submissions';
  } else if (tabId === 'tab-keys') {
    titleEl.textContent = 'API Keys & Integration';
    descEl.textContent = 'Manage connection keys and generate embed snippets for your client websites';
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
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" style="width: 16px; height: 16px;"></i>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);
  initIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
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
    copyToClipboard(el.textContent, 'Code snippet copied!');
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
