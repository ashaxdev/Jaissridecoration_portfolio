# Jaissri Decoration Website

## 🚀 Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```
Or for development (auto-restart):
```bash
npm run dev
```

### 3. Open in Browser
- **Website**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin

---

## 🔐 Admin Login
| Field    | Value         |
|----------|---------------|
| Username | `admin`       |
| Password | `jaissri@2026`|

> ⚠️ Change credentials in `server.js` lines 14–15 before going live!

---

## 📁 Project Structure
```
jaissri/
├── server.js              # Node.js + Express backend
├── package.json
├── data/
│   ├── gallery-manifest.json   # Gallery image metadata (auto-created)
│   └── feedbacks.json          # Client reviews (auto-created)
├── public/
│   ├── index.html         # Main website
│   ├── logo.png           # Your logo (place here!)
│   ├── gallery/           # Uploaded gallery images stored here
│   └── uploads/
│       └── feedback/      # Client avatar images stored here
└── views/
    ├── admin-login.html   # Admin login page
    └── admin.html         # Admin dashboard
```

---

## 🖼️ Logo
Place your logo image as `public/logo.png`
- Recommended: 200×200px, circular/square, PNG or JPG
- If not found, a green "J" placeholder shows instead

## 🎨 Features
- ✅ Dark green + dark blue droplet animated background
- ✅ Navbar with logo image support
- ✅ Gallery loaded from server (stored in `/public/gallery/`)
- ✅ Filter gallery by category
- ✅ Lightbox image viewer
- ✅ Admin: upload multiple images with category tagging
- ✅ Admin: add/delete client reviews
- ✅ Reviews shown as auto-playing carousel on website
- ✅ No database needed — all data stored in JSON files + folders
