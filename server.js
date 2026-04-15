const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'jaissri-secret-2026',
  resave: false,
  saveUninitialized: false
}));

// Admin credentials (change these!)
const ADMIN_USER = 'Jaissri';
const ADMIN_PASS = 'HEXLUR';

// Ensure folders exist
['public/gallery', 'public/uploads/feedback', 'data'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Gallery image storage
const galleryStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/gallery/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  }
});

// Feedback image storage
const feedbackStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/feedback/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-feedback${ext}`);
  }
});

const uploadGallery = multer({
  storage: galleryStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

const uploadFeedback = multer({
  storage: feedbackStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/admin/login');
}

// ===== ROUTES =====

// Public: get gallery manifest
app.get('/api/gallery', (req, res) => {
  const galleryDir = 'public/gallery';
  const manifestFile = 'data/gallery-manifest.json';

  let manifest = [];
  if (fs.existsSync(manifestFile)) {
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  }
  res.json(manifest);
});

// Public: get feedbacks
app.get('/api/feedbacks', (req, res) => {
  const file = 'data/feedbacks.json';
  if (fs.existsSync(file)) {
    res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
  } else {
    res.json([]);
  }
});

// ===== ADMIN ROUTES =====

// Login page
app.get('/admin/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'views/admin-login.html'));
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.admin = true;
    res.redirect('/admin');
  } else {
    res.redirect('/admin/login?error=1');
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Admin dashboard
app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/admin.html'));
});

// Upload gallery images
app.post('/admin/upload-gallery', requireAuth, uploadGallery.array('images', 20), (req, res) => {
  const manifestFile = 'data/gallery-manifest.json';
  let manifest = [];
  if (fs.existsSync(manifestFile)) {
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  }

  const categories = ['wedding', 'birthday', 'corporate', 'babyshower', 'festive'];
  req.files.forEach(file => {
    manifest.push({
      src: `/gallery/${file.filename}`,
      cat: req.body.category || 'wedding',
      title: req.body.title || 'Event Photo',
      label: req.body.category ? req.body.category.charAt(0).toUpperCase() + req.body.category.slice(1) : 'Wedding',
      uploadedAt: new Date().toISOString()
    });
  });

  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  res.json({ success: true, count: req.files.length });
});

// Delete gallery image
app.delete('/admin/gallery/:filename', requireAuth, (req, res) => {
  const filename = req.params.filename;
  const filePath = `public/gallery/${filename}`;
  const manifestFile = 'data/gallery-manifest.json';

  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  if (fs.existsSync(manifestFile)) {
    let manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    manifest = manifest.filter(m => !m.src.includes(filename));
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  }

  res.json({ success: true });
});

// Add feedback (with optional image)
app.post('/admin/add-feedback', requireAuth, uploadFeedback.single('avatar'), (req, res) => {
  const feedbackFile = 'data/feedbacks.json';
  let feedbacks = [];
  if (fs.existsSync(feedbackFile)) {
    feedbacks = JSON.parse(fs.readFileSync(feedbackFile, 'utf8'));
  }

  const feedback = {
    id: Date.now(),
    name: req.body.name,
    role: req.body.role || 'Client',
    stars: parseInt(req.body.stars) || 5,
    text: req.body.text,
    avatar: req.file ? `/uploads/feedback/${req.file.filename}` : null,
    createdAt: new Date().toISOString()
  };

  feedbacks.unshift(feedback);
  fs.writeFileSync(feedbackFile, JSON.stringify(feedbacks, null, 2));
  res.json({ success: true });
});

// Delete feedback
app.delete('/admin/feedback/:id', requireAuth, (req, res) => {
  const feedbackFile = 'data/feedbacks.json';
  if (!fs.existsSync(feedbackFile)) return res.json({ success: true });

  let feedbacks = JSON.parse(fs.readFileSync(feedbackFile, 'utf8'));
  const fb = feedbacks.find(f => f.id == req.params.id);
  if (fb && fb.avatar) {
    const filePath = `public${fb.avatar}`;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  feedbacks = feedbacks.filter(f => f.id != req.params.id);
  fs.writeFileSync(feedbackFile, JSON.stringify(feedbacks, null, 2));
  res.json({ success: true });
});

// Get admin stats
app.get('/admin/stats', requireAuth, (req, res) => {
  const manifestFile = 'data/gallery-manifest.json';
  const feedbackFile = 'data/feedbacks.json';

  const galleryCount = fs.existsSync(manifestFile)
    ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')).length : 0;
  const feedbackCount = fs.existsSync(feedbackFile)
    ? JSON.parse(fs.readFileSync(feedbackFile, 'utf8')).length : 0;

  res.json({ galleryCount, feedbackCount });
});

app.listen(PORT, () => {
  console.log(`✅ Jaissri Decoration server running at http://localhost:${PORT}`);
  console.log(`🔐 Admin panel: http://localhost:${PORT}/admin`);
  console.log(`   Username: ${ADMIN_USER} | Password: ${ADMIN_PASS}`);
});
