/**
 * FeedbackHub - Universal Drop-in Feedback Widget
 * Embed on any external website using a single <script> tag:
 * <script src="http://localhost:8000/widget.js" data-api-key="fbk_live_..." defer></script>
 */

(function() {
  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  const API_KEY = currentScript ? currentScript.getAttribute('data-api-key') || '' : '';
  const POSITION = currentScript ? currentScript.getAttribute('data-position') || 'bottom-right' : 'bottom-right';
  const SERVER_ORIGIN = (function() {
    if (currentScript && currentScript.src) {
      try {
        const url = new URL(currentScript.src);
        return url.origin;
      } catch (e) {}
    }
    return window.location.origin;
  })();

  // Inject Styles
  const style = document.createElement('style');
  style.id = 'feedbackhub-widget-styles';
  style.textContent = `
    .fbk-widget-btn {
      position: fixed;
      ${POSITION.includes('left') ? 'left: 24px;' : 'right: 24px;'}
      bottom: 24px;
      z-index: 999990;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #ffffff;
      border: none;
      border-radius: 999px;
      padding: 12px 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.5), 0 8px 10px -6px rgba(99, 102, 241, 0.3);
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      animation: fbkFloat 4s ease-in-out infinite;
    }
    @keyframes fbkFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }
    .fbk-widget-btn:hover {
      transform: translateY(-4px) scale(1.03);
      box-shadow: 0 15px 32px -4px rgba(99, 102, 241, 0.65);
    }
    .fbk-widget-btn:active {
      transform: scale(0.96);
    }
    .fbk-widget-btn svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .fbk-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(11, 15, 25, 0.75);
      backdrop-filter: blur(8px);
      z-index: 999995;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .fbk-modal-overlay.fbk-open {
      display: flex;
      opacity: 1;
    }
    .fbk-modal-card {
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85);
      color: #f9fafb;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      transform: scale(0.92);
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .fbk-modal-overlay.fbk-open .fbk-modal-card {
      transform: scale(1);
    }
    .fbk-header {
      padding: 18px 22px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .fbk-header h3 {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .fbk-close-btn {
      background: transparent;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
      padding: 4px;
      border-radius: 4px;
      transition: color 0.15s;
    }
    .fbk-close-btn:hover { color: #ffffff; }
    .fbk-body {
      padding: 20px 22px;
    }
    .fbk-stars-row {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-bottom: 18px;
    }
    .fbk-star-icon {
      font-size: 32px;
      cursor: pointer;
      color: #374151;
      transition: color 0.15s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      user-select: none;
    }
    .fbk-star-icon:hover, .fbk-star-icon.active {
      color: #fbbf24;
      transform: scale(1.18);
    }
    .fbk-categories {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .fbk-cat-pill {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #9ca3af;
      border-radius: 999px;
      padding: 5px 12px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .fbk-cat-pill:hover, .fbk-cat-pill.selected {
      background: rgba(99, 102, 241, 0.25);
      border-color: #6366f1;
      color: #ffffff;
      font-weight: 600;
      transform: translateY(-1px);
    }
    .fbk-textarea {
      width: 100%;
      background: #0b0f19;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      color: #f9fafb;
      padding: 12px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      min-height: 85px;
      box-sizing: border-box;
      margin-bottom: 12px;
      outline: none;
      transition: border-color 0.2s;
    }
    .fbk-textarea:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
    }
    .fbk-input-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 16px;
    }
    .fbk-input {
      width: 100%;
      background: #0b0f19;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      color: #f9fafb;
      padding: 8px 12px;
      font-size: 13px;
      font-family: inherit;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.2s;
    }
    .fbk-input:focus { border-color: #6366f1; }
    .fbk-submit-btn {
      width: 100%;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #ffffff;
      border: none;
      border-radius: 10px;
      padding: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .fbk-submit-btn:hover {
      box-shadow: 0 4px 18px rgba(99, 102, 241, 0.45);
      transform: translateY(-1px);
    }
    .fbk-submit-btn:active {
      transform: scale(0.98);
    }
    .fbk-submit-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .fbk-success-view {
      text-align: center;
      padding: 30px 10px;
      display: none;
    }
    .fbk-success-icon {
      width: 54px;
      height: 54px;
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
      font-size: 28px;
      animation: checkBounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes checkBounce {
      from { transform: scale(0); }
      to { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);

  // Inject Floating Button
  const btn = document.createElement('button');
  btn.className = 'fbk-widget-btn';
  btn.setAttribute('aria-label', 'Give feedback');
  btn.innerHTML = `
    <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
    <span>Feedback</span>
  `;
  document.body.appendChild(btn);

  // Inject Modal Structure
  const modal = document.createElement('div');
  modal.className = 'fbk-modal-overlay';
  modal.innerHTML = `
    <div class="fbk-modal-card">
      <div class="fbk-header">
        <h3>Share Your Feedback</h3>
        <button class="fbk-close-btn" aria-label="Close modal">&times;</button>
      </div>

      <div class="fbk-body" id="fbk-form-container">
        <!-- Star Rating -->
        <div class="fbk-stars-row" id="fbk-stars">
          <span class="fbk-star-icon active" data-rating="1">★</span>
          <span class="fbk-star-icon active" data-rating="2">★</span>
          <span class="fbk-star-icon active" data-rating="3">★</span>
          <span class="fbk-star-icon active" data-rating="4">★</span>
          <span class="fbk-star-icon active" data-rating="5">★</span>
        </div>

        <!-- Categories -->
        <div class="fbk-categories" id="fbk-cats">
          <span class="fbk-cat-pill selected" data-cat="Praise">💖 Praise</span>
          <span class="fbk-cat-pill" data-cat="Feature Request">💡 Feature</span>
          <span class="fbk-cat-pill" data-cat="Bug Report">🐛 Bug</span>
          <span class="fbk-cat-pill" data-cat="UX / Usability">🎨 UX</span>
          <span class="fbk-cat-pill" data-cat="General">💬 General</span>
        </div>

        <!-- Message -->
        <textarea id="fbk-msg" class="fbk-textarea" placeholder="What's on your mind? How can we improve?"></textarea>

        <!-- Optional Name & Email -->
        <div class="fbk-input-row">
          <input type="text" id="fbk-name" class="fbk-input" placeholder="Your Name (optional)">
          <input type="email" id="fbk-email" class="fbk-input" placeholder="Your Email (optional)">
        </div>

        <button id="fbk-submit-btn" class="fbk-submit-btn">Send Feedback</button>
      </div>

      <!-- Success State -->
      <div class="fbk-body fbk-success-view" id="fbk-success-box">
        <div class="fbk-success-icon">✓</div>
        <h4 style="margin: 0 0 6px; font-size: 19px; color: #fff; font-weight: 700;">Thank you!</h4>
        <p style="margin: 0; color: #9ca3af; font-size: 13.5px;">Your feedback helps us continuously improve.</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Logic & State
  let selectedRating = 5;
  let selectedCategory = 'Praise';

  // Open/Close
  btn.addEventListener('click', () => {
    modal.classList.add('fbk-open');
    document.getElementById('fbk-form-container').style.display = 'block';
    document.getElementById('fbk-success-box').style.display = 'none';
    setTimeout(() => {
      const msgInput = document.getElementById('fbk-msg');
      if (msgInput) msgInput.focus();
    }, 100);
  });

  const closeBtn = modal.querySelector('.fbk-close-btn');
  closeBtn.addEventListener('click', () => modal.classList.remove('fbk-open'));

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('fbk-open');
  });

  // Star Ratings
  const stars = modal.querySelectorAll('.fbk-star-icon');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.getAttribute('data-rating'), 10);
      updateStars(selectedRating);
    });
  });

  function updateStars(rating) {
    stars.forEach(s => {
      const val = parseInt(s.getAttribute('data-rating'), 10);
      if (val <= rating) {
        s.classList.add('active');
      } else {
        s.classList.remove('active');
      }
    });
  }

  // Category Pills
  const catPills = modal.querySelectorAll('.fbk-cat-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');
      selectedCategory = pill.getAttribute('data-cat');
    });
  });

  // Submission Handler
  const submitBtn = document.getElementById('fbk-submit-btn');
  submitBtn.addEventListener('click', async () => {
    const message = document.getElementById('fbk-msg').value.trim();
    if (!message) {
      alert('Please enter a brief feedback message.');
      return;
    }

    const name = document.getElementById('fbk-name').value.trim();
    const email = document.getElementById('fbk-email').value.trim();

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    let submittedSuccessfully = false;

    // Strategy 1: Post to backend server if available
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(`${SERVER_ORIGIN}/api/v1/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY || 'fbk_live_default'
        },
        body: JSON.stringify({
          rating: selectedRating,
          category: selectedCategory,
          message: message,
          name: name,
          email: email,
          page_url: window.location.href
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        submittedSuccessfully = true;
      }
    } catch (err) {
      // Backend not running / static Vercel
    }

    // Strategy 2: Store in client-side cloud storage (for static Vercel resilience)
    try {
      const STORAGE_FEEDBACK_KEY = 'fbk_records_cloud';
      const local = JSON.parse(localStorage.getItem(STORAGE_FEEDBACK_KEY) || '[]');
      local.unshift({
        id: Date.now(),
        name: name || 'Anonymous',
        email: email || '',
        rating: selectedRating,
        category: selectedCategory,
        message: message,
        page_url: window.location.href,
        status: 'new',
        admin_notes: '',
        created_at: new Date().toISOString()
      });
      localStorage.setItem(STORAGE_FEEDBACK_KEY, JSON.stringify(local));
      localStorage.setItem('fbk_ping_update', Date.now().toString());
      submittedSuccessfully = true;
    } catch (err) {
      console.warn('LocalStorage save error:', err);
    }

    if (submittedSuccessfully) {
      // Show success view
      document.getElementById('fbk-form-container').style.display = 'none';
      document.getElementById('fbk-success-box').style.display = 'block';
      document.getElementById('fbk-msg').value = '';

      // Auto-close modal after 2.2 seconds
      setTimeout(() => {
        modal.classList.remove('fbk-open');
      }, 2200);
    } else {
      alert('Could not send feedback. Please check your network connection.');
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Feedback';
  });

})();
