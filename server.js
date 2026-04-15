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

// ===== STORAGE PATHS =====
const GALLERY_DIR   = 'public/gallery';           // images live here
const GALLERY_META  = 'data/gallery-meta';        // one .json per image
const FEEDBACK_DIR  = 'data/feedbacks';           // one folder per feedback
const FEEDBACK_IMG  = 'public/uploads/feedback';  // feedback avatars

// Ensure all folders exist
[GALLERY_DIR, GALLERY_META, FEEDBACK_DIR, FEEDBACK_IMG].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ===== STORAGE HELPERS =====

/**
 * Gallery: each uploaded image gets a sidecar meta file at
 *   data/gallery-meta/<filename>.json
 * Reading the gallery = reading all those .json files.
 */
function readGallery() {
  return fs.readdirSync(GALLERY_META)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(GALLERY_META, f), 'utf8'));
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

function writeGalleryMeta(filename, meta) {
  fs.writeFileSync(
    path.join(GALLERY_META, `${filename}.json`),
    JSON.stringify(meta, null, 2)
  );
}

function deleteGalleryMeta(filename) {
  const metaPath = path.join(GALLERY_META, `${filename}.json`);
  if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
}

/**
 * Feedbacks: each feedback lives in its own folder:
 *   data/feedbacks/<id>/meta.json
 *   data/feedbacks/<id>/avatar.<ext>   (optional, copied here from public/uploads/feedback)
 *
 * The avatar is ALSO kept in public/uploads/feedback/ so it's web-accessible.
 */
function readFeedbacks() {
  if (!fs.existsSync(FEEDBACK_DIR)) return [];
  return fs.readdirSync(FEEDBACK_DIR)
    .filter(name => {
      const p = path.join(FEEDBACK_DIR, name);
      return fs.statSync(p).isDirectory();
    })
    .map(name => {
      const metaPath = path.join(FEEDBACK_DIR, name, 'meta.json');
      try {
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function writeFeedback(feedback) {
  const dir = path.join(FEEDBACK_DIR, String(feedback.id));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(feedback, null, 2));
}

function deleteFeedback(id) {
  const dir = path.join(FEEDBACK_DIR, String(id));
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

// ===== MULTER =====

const galleryStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, GALLERY_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});

const feedbackStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, FEEDBACK_IMG),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-feedback${ext}`);
  }
});

const uploadGallery = multer({
  storage: galleryStorage,
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only images allowed')),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const uploadFeedback = multer({
  storage: feedbackStorage,
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only images allowed')),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ===== AUTH =====

function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/admin/login');
}

// ===== PUBLIC API =====

app.get('/api/gallery', (req, res) => {
  res.json(readGallery());
});

app.get('/api/feedbacks', (req, res) => {
  res.json(readFeedbacks());
});

// ===== ADMIN ROUTES =====

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

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/admin.html'));
});

// Upload gallery images — writes image + sidecar .json per file
app.post('/admin/upload-gallery', requireAuth, uploadGallery.array('images', 20), (req, res) => {
  const category = req.body.category || 'wedding';
  const title    = req.body.title || 'Event Photo';
  const label    = category.charAt(0).toUpperCase() + category.slice(1);

  req.files.forEach(file => {
    const meta = {
      src: `/gallery/${file.filename}`,
      filename: file.filename,
      cat: category,
      title,
      label,
      uploadedAt: new Date().toISOString()
    };
    writeGalleryMeta(file.filename, meta);  // data/gallery-meta/<filename>.json
  });

  res.json({ success: true, count: req.files.length });
});

// Delete gallery image + its sidecar meta file
app.delete('/admin/gallery/:filename', requireAuth, (req, res) => {
  const filename = req.params.filename;
  const imagePath = path.join(GALLERY_DIR, filename);

  if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  deleteGalleryMeta(filename);

  res.json({ success: true });
});

// Add feedback — saves meta.json inside its own folder; avatar stays web-accessible
app.post('/admin/add-feedback', requireAuth, uploadFeedback.single('avatar'), (req, res) => {
  const id = Date.now();

  const feedback = {
    id,
    name:      req.body.name,
    role:      req.body.role || 'Client',
    stars:     parseInt(req.body.stars) || 5,
    text:      req.body.text,
    avatar:    req.file ? `/uploads/feedback/${req.file.filename}` : null,
    createdAt: new Date().toISOString()
  };

  // If avatar was uploaded, also copy it into the feedback's own folder for permanence
  if (req.file) {
    const feedbackFolder = path.join(FEEDBACK_DIR, String(id));
    if (!fs.existsSync(feedbackFolder)) fs.mkdirSync(feedbackFolder, { recursive: true });
    fs.copyFileSync(
      path.join(FEEDBACK_IMG, req.file.filename),
      path.join(feedbackFolder, req.file.filename)
    );
  }

  writeFeedback(feedback);  // data/feedbacks/<id>/meta.json
  res.json({ success: true });
});

// Delete feedback folder (meta + avatar copy) and web-accessible avatar
app.delete('/admin/feedback/:id', requireAuth, (req, res) => {
  const feedbacks = readFeedbacks();
  const fb = feedbacks.find(f => f.id == req.params.id);

  if (fb && fb.avatar) {
    const webPath = path.join('public', fb.avatar);
    if (fs.existsSync(webPath)) fs.unlinkSync(webPath);
  }

  deleteFeedback(req.params.id);  // removes data/feedbacks/<id>/ entirely
  res.json({ success: true });
});

// Stats
app.get('/admin/stats', requireAuth, (req, res) => {
  const galleryCount  = fs.existsSync(GALLERY_META)
    ? fs.readdirSync(GALLERY_META).filter(f => f.endsWith('.json')).length : 0;
  const feedbackCount = fs.existsSync(FEEDBACK_DIR)
    ? fs.readdirSync(FEEDBACK_DIR).filter(name =>
        fs.statSync(path.join(FEEDBACK_DIR, name)).isDirectory()
      ).length : 0;

  res.json({ galleryCount, feedbackCount });
});

app.listen(PORT, () => {
  console.log(`✅ Jaissri Decoration server running at http://localhost:${PORT}`);
  console.log(`🔐 Admin panel: http://localhost:${PORT}/admin`);
  console.log(`   Username: ${ADMIN_USER} | Password: ${ADMIN_PASS}`);
});