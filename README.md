# FeedbackHub - Admin Portal & Secure API Integration System

A modern, production-grade **Feedback Admin Portal** featuring real-time KPI analytics, feedback triage, status workflows, CSV/JSON export, and an **API Key Management System** to connect external websites.

---

## 🔒 Security & Password Protection Guarantee

> **The Admin Password is NEVER revealed in frontend code or visible in browser developer tools.**
> - **Server-Side Authentication**: All credential checks happen on the backend server (`server.py`).
> - **PBKDF2-HMAC-SHA256 Hashing**: Passwords are cryptographically salted and hashed with 300,000 iterations.
> - **No Plaintext Passwords**: No passwords, salts, or master hashes exist in HTML or JavaScript files.
> - **Session Protection**: Successful authentication returns a cryptographically random session token (`secrets.token_hex(32)`).

---

## 🚀 Quick Start (Windows)

### Option 1: Double-Click Runner
Simply double-click `start.bat` in this folder. It will start the server and automatically launch `http://localhost:8000` in your web browser.

### Option 2: Command Line
Open PowerShell or Command Prompt in this folder and run:
```powershell
python server.py
```
Then visit **`http://localhost:8000`** in your browser.

---

## 🔑 Default Administrator Credentials

| Field | Value |
|---|---|
| **Admin Email** | `admin@feedbackhub.com` |
| **Master Password** | `Admin@2026!SecureKey` |

*You can update your master password at any time from the **Security Settings** tab.*

---

## 🌐 Connecting Your External Website (API Key)

In the Admin Portal, open the **API Keys & Integration** tab to view your active API keys or generate new ones.

### 1. One-Line Floating Widget Embed (Recommended)
Paste this script tag right before the closing `</body>` tag on any client website:

```html
<script 
  src="http://localhost:8000/widget.js" 
  data-api-key="YOUR_API_KEY" 
  data-position="bottom-right" 
  defer>
</script>
```
*A floating "Feedback" button and responsive modal will automatically appear on your website!*

### 2. Custom REST API Submission
You can also submit feedback directly from your own custom forms or React/Vue apps:

**Endpoint**: `POST http://localhost:8000/api/v1/feedback`  
**Headers**:
- `Content-Type: application/json`
- `x-api-key: YOUR_API_KEY`

**Payload**:
```json
{
  "rating": 5,
  "category": "Praise",
  "message": "The new design is clean and super fast!",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "page_url": "https://yoursite.com/pricing"
}
```

---

## 🧪 Live Demo Client Website

A pre-configured demo client website is included to test end-to-end feedback submission.
Open:
```
http://localhost:8000/demo-client.html
```
Click the floating feedback button in the bottom-right corner, submit a review, and watch it show up live inside your Admin Portal!
