// ============================================================
//  Kamil Dashboard — Express + libSQL/SQLite Backend
//  No Firebase — pure JWT authentication
//  Works locally (file) AND on Railway/cloud (Turso URL)
// ============================================================
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { createClient } = require('@libsql/client');
const path     = require('path');

// ── Database setup ───────────────────────────────────────────
// Local: file:./kamil.db
// Cloud: libsql://... (Turso) — set TURSO_URL + TURSO_TOKEN in env
const dbUrl   = process.env.TURSO_URL  || `file:${path.join(__dirname, process.env.DB_FILE || 'kamil.db')}`;
const dbToken = process.env.TURSO_TOKEN || undefined;

const db = createClient({ url: dbUrl, authToken: dbToken });

async function initDB() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      email         TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      created_at    INTEGER DEFAULT (strftime('%s','now') * 1000)
    );
    CREATE TABLE IF NOT EXISTS brand (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      data       TEXT NOT NULL DEFAULT '{"name":"ShopManager","image":""}',
      updated_at INTEGER DEFAULT 0
    );
    INSERT OR IGNORE INTO brand (id) VALUES (1);
    CREATE TABLE IF NOT EXISTS shops (
      id         TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      updated_at INTEGER DEFAULT 0
    );
  `);
}

// ── JWT secret ───────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-to-a-long-random-string-in-production';
const JWT_EXPIRES = '30d';

// ── Express app ──────────────────────────────────────────────
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

// ── Auth middleware ──────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─────────────────────────────────────────────────────────────
//  AUTH ROUTES
// ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now(), db: 'ok' });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email.toLowerCase().trim()] });
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ token, email: user.email });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ email: req.userEmail });
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });

    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [req.userEmail] });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is wrong' });
    }

    const hash = bcrypt.hashSync(newPassword, 12);
    await db.execute({ sql: 'UPDATE users SET password_hash = ? WHERE email = ?', args: [hash, req.userEmail] });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Google Sign-In ──────────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

// Only these emails can login via Google. Add more as needed.
const ALLOWED_GOOGLE_EMAILS = (process.env.ALLOWED_GOOGLE_EMAILS || 'cheema30246@gmail.com')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (!credential) return res.status(400).json({ error: 'No credential provided' });

    // Verify the Google ID token with Google's tokeninfo endpoint
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!verifyRes.ok) return res.status(401).json({ error: 'Invalid Google token' });
    const payload = await verifyRes.json();

    // Check audience matches our client ID (if configured)
    if (GOOGLE_CLIENT_ID && payload.aud !== GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: 'Token audience mismatch' });
    }

    const email = payload.email?.toLowerCase().trim();
    if (!email || payload.email_verified !== 'true') {
      return res.status(401).json({ error: 'Email not verified' });
    }

    // Only allow whitelisted emails
    if (!ALLOWED_GOOGLE_EMAILS.includes(email)) {
      return res.status(403).json({ error: 'This Google account is not authorized' });
    }

    // Create user if not exists (Google users get a random password hash)
    const existing = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
    if (!existing.rows[0]) {
      const randomHash = bcrypt.hashSync(require('crypto').randomBytes(32).toString('hex'), 12);
      await db.execute({ sql: 'INSERT INTO users (email, password_hash) VALUES (?, ?)', args: [email, randomHash] });
    }

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ token, email });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  DATA ROUTES
// ─────────────────────────────────────────────────────────────

app.get('/api/all', requireAuth, async (_req, res) => {
  try {
    const shopRows = await db.execute('SELECT data FROM shops ORDER BY updated_at ASC');
    const brandRow = await db.execute('SELECT data FROM brand WHERE id = 1');
    const shops = shopRows.rows.map(r => JSON.parse(r.data));
    const brand = brandRow.rows[0] ? JSON.parse(brandRow.rows[0].data) : { name: 'ShopManager', image: '' };
    res.json({ shops, brand });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/shops', requireAuth, async (_req, res) => {
  try {
    const rows = await db.execute('SELECT data FROM shops ORDER BY updated_at ASC');
    res.json({ shops: rows.rows.map(r => JSON.parse(r.data)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/shops/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const shopData = req.body;
    if (!shopData || shopData.id !== id) return res.status(400).json({ error: 'Bad payload' });
    await db.execute({
      sql: `INSERT INTO shops (id, data, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      args: [id, JSON.stringify(shopData), Date.now()]
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/shops/:id', requireAuth, async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM shops WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/brand', requireAuth, async (_req, res) => {
  try {
    const row = await db.execute('SELECT data FROM brand WHERE id = 1');
    res.json({ brand: row.rows[0] ? JSON.parse(row.rows[0].data) : { name: 'ShopManager', image: '' } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/brand', requireAuth, async (req, res) => {
  try {
    if (!req.body) return res.status(400).json({ error: 'No brand data' });
    await db.execute({
      sql: `INSERT INTO brand (id, data, updated_at) VALUES (1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      args: [JSON.stringify(req.body), Date.now()]
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀  Backend running at http://localhost:${PORT}`);
    console.log(`   Database: ${dbUrl}`);
  });
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});

