/**
 * FeedbackHub - Universal Drop-in Feedback Widget
 * Embed on any external website using a single <script> tag:
 * <script src="http://localhost:8000/widget.js" data-api-key="fbk_live_..." defer></script>
 */

(function() {
  // Find current script tag to extract API Key and server origin
  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  const API_KEY = currentScript.getAttribute('data-api-key') || '';
  const POSITION = currentScript.getAttribute('data-position') || 'bottom-right';
  const SERVER_ORIGIN = (function() {
    if (currentScript.src) {
      const url = new URL(currentScript.src);
      return url.origin;
    }
    return window.location.origin;
  })();

  if (!API_KEY) {
    console.error('[FeedbackHub Widget] Missing data-api-key attribute on script tag.');
    return;
  }

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
    }
    .fbk-widget-btn:hover {
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 15px 30px -5px rgba(99, 102, 241, 0.65);
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
      background: rgba(11, 15, 25, 0.7);
      backdrop-filter: blur(6px);
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
      border-radius: 18px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75);
      color: #f9fafb;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      transform: scale(0.95);
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
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
      font-size: 30px;
      cursor: pointer;
      color: #4b5563;
      transition: color 0.15s, transform 0.15s;
      user-select: none;
    }
    .fbk-star-icon:hover, .fbk-star-icon.active {
      color: #fbbf24;
      transform: scale(1.15);
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
      transition: all 0.15s;
    }
    .fbk-cat-pill:hover, .fbk-cat-pill.selected {
      background: rgba(99, 102, 241, 0.25);
      border-color: #6366f1;
      color: #ffffff;
      font-weight: 600;
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
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
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
      width: 52px;
      height: 52px;
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
      font-size: 26px;
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
        <h4 style="margin: 0 0 6px; font-size: 18px; color: #fff;">Thank you!</h4>
        <p style="margin: 0; color: #9ca3af; font-size: 13px;">Your feedback helps us continuously improve.</p>
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
    document.getElementById('fbk-msg').focus();
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

    try {
      const response = await fetch(`${SERVER_ORIGIN}/api/v1/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({
          rating: selectedRating,
          category: selectedCategory,
          message: message,
          name: name,
          email: email,
          page_url: window.location.href
        })
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        // Show success screen
        document.getElementById('fbk-form-container').style.display = 'none';
        document.getElementById('fbk-success-box').style.display = 'block';

        // Clear input fields
        document.getElementById('fbk-msg').value = '';
        
        // Auto-close after 2.5 seconds
        setTimeout(() => {
          modal.classList.remove('fbk-open');
        }, 2200);
      } else {
        alert(result.error || 'Failed to submit feedback. Check your API key.');
      }
    } catch (err) {
      console.error('[FeedbackHub Widget] Submission error:', err);
      alert('Could not connect to feedback server. Check network connection.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Feedback';
    }
  });

})();
