// ============================================================
//  Kamil Dashboard — Express + Neon PostgreSQL Backend
//  No Firebase — pure JWT authentication
//  Uses the same PostgreSQL database locally and in production.
// ============================================================
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const { rateLimit } = require('express-rate-limit');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { Pool } = require('pg');
const { OAuth2Client } = require('google-auth-library');
const { generateSecret, generateURI, verify: verifyOtp } = require('otplib');
const QRCode   = require('qrcode');
const crypto   = require('crypto');
const fs       = require('fs');
const path     = require('path');
const { configured: storageConfigured, externalizeEmbeddedFiles, getObject, hydrateFileUrls } = require('./storage');

// ── Database setup ───────────────────────────────────────────
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_MAX) || 10 });

function postgresSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

const db = {
  async execute(input) {
    const sql = typeof input === 'string' ? input : input.sql;
    const args = typeof input === 'string' ? [] : (input.args || []);
    const result = await pool.query(postgresSql(sql), args);
    return {
      ...result,
      rows: result.rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, key === 'data' && value && typeof value === 'object' ? JSON.stringify(value) : value]))),
    };
  },
};

async function initDB() {
  const migration = fs.readFileSync(path.join(__dirname, 'migrations', '001_initial_postgres.sql'), 'utf8');
  await pool.query(migration);
}

// ── JWT secret ───────────────────────────────────────────────
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';
const JWT_ISSUER = 'kamil-dashboard-api';
const JWT_AUDIENCE = 'kamil-dashboard';
const MFA_ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY || '';

if (JWT_SECRET.length < 48 || JWT_SECRET.includes('change-this')) {
  throw new Error('JWT_SECRET must be a unique production secret with at least 48 characters');
}
if (!/^[a-f0-9]{64}$/i.test(MFA_ENCRYPTION_KEY)) {
  throw new Error('MFA_ENCRYPTION_KEY must contain exactly 64 hexadecimal characters');
}

const mfaKey = Buffer.from(MFA_ENCRYPTION_KEY, 'hex');

function encryptMfaSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', mfaKey, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

function decryptMfaSecret(encrypted) {
  const [iv, tag, ciphertext] = String(encrypted || '').split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv?.length || !tag?.length || !ciphertext?.length) throw new Error('Invalid MFA secret');
  const decipher = crypto.createDecipheriv('aes-256-gcm', mfaKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

// ── Express app ──────────────────────────────────────────────
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);

function isAllowedOrigin(origin) {
  if (allowedOrigins.includes(origin)) return true;
  if (IS_PRODUCTION) return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
  strictTransportSecurity: IS_PRODUCTION ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
}));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '20mb', strict: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
});
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/google', authLimiter);

function signToken(payload, expiresIn = JWT_EXPIRES) {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

function serverError(res, error, context) {
  console.error(`[${context}]`, error);
  return res.status(500).json({ error: 'Internal server error' });
}

// ── Auth middleware ──────────────────────────────────────────
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const payload = verifyToken(header.slice(7));
    if (!payload.email || typeof payload.email !== 'string' || !Number.isInteger(payload.ver)) throw new Error('Invalid session token');
    const result = await db.execute({ sql: 'SELECT auth_version FROM users WHERE email = ?', args: [payload.email] });
    const user = result.rows[0];
    if (!user || Number(user.auth_version) !== payload.ver) return res.status(401).json({ error: 'Session expired. Sign in again.' });
    req.userEmail = payload.email;
    req.authMethods = Array.isArray(payload.amr) ? payload.amr : [];
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requestBaseUrl(req) {
  return process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;
}

function fileToken(key) {
  return signToken({ file: key, scope: 'file:read' }, '15m');
}

function clientData(data, req) {
  return hydrateFileUrls(data, requestBaseUrl(req), fileToken);
}

// ─────────────────────────────────────────────────────────────
//  AUTH ROUTES
// ─────────────────────────────────────────────────────────────

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, ts: Date.now(), db: 'postgresql' });
  } catch {
    res.status(503).json({ ok: false, ts: Date.now(), db: 'unavailable' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    if (email.length > 254 || password.length > 256) return res.status(400).json({ error: 'Invalid credentials' });

    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email.toLowerCase().trim()] });
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    const challengeToken = signToken({ email: user.email, scope: 'mfa:login' }, '5m');
    if (user.mfa_enabled && user.mfa_secret_encrypted) {
      return res.json({ mfaRequired: true, challengeToken, email: user.email });
    }

    const secret = generateSecret();
    const encryptedSecret = encryptMfaSecret(secret);
    await db.execute({
      sql: 'UPDATE users SET mfa_secret_encrypted = ?, mfa_enabled = FALSE, mfa_enabled_at = NULL WHERE email = ?',
      args: [encryptedSecret, user.email],
    });
    const uri = generateURI({ issuer: 'Kamil Store Dashboard', label: user.email, secret });
    const qrCode = await QRCode.toDataURL(uri, { width: 240, margin: 1, errorCorrectionLevel: 'M' });
    return res.json({ mfaSetupRequired: true, challengeToken, email: user.email, qrCode, manualKey: secret });
  } catch (e) {
    serverError(res, e, 'auth:login');
  }
});

app.post('/api/auth/mfa/verify', authLimiter, async (req, res) => {
  try {
    const { challengeToken, code } = req.body || {};
    if (typeof challengeToken !== 'string' || !/^\d{6}$/.test(String(code || ''))) {
      return res.status(400).json({ error: 'Enter a valid 6-digit authenticator code' });
    }
    let challenge;
    try {
      challenge = verifyToken(challengeToken);
    } catch {
      return res.status(401).json({ error: 'Authenticator challenge expired. Sign in again.' });
    }
    if (challenge.scope !== 'mfa:login' || !challenge.email) {
      return res.status(401).json({ error: 'Invalid authenticator challenge' });
    }

    const result = await db.execute({
      sql: 'SELECT email, mfa_secret_encrypted, mfa_enabled, auth_version FROM users WHERE email = ?',
      args: [challenge.email],
    });
    const user = result.rows[0];
    if (!user?.mfa_secret_encrypted) return res.status(401).json({ error: 'Authenticator setup not found' });
    const secret = decryptMfaSecret(user.mfa_secret_encrypted);
    const verification = await verifyOtp({ secret, token: String(code), epochTolerance: 30 });
    if (!verification.valid) return res.status(401).json({ error: 'Authenticator code is incorrect or expired' });

    if (!user.mfa_enabled) {
      await db.execute({
        sql: 'UPDATE users SET mfa_enabled = TRUE, mfa_enabled_at = NOW() WHERE email = ?',
        args: [user.email],
      });
    }
    const authMethods = ['pwd', 'otp'];
    const token = signToken({ email: user.email, amr: authMethods, ver: Number(user.auth_version) || 0 });
    return res.json({ token, email: user.email, authMethods });
  } catch (error) {
    return serverError(res, error, 'auth:mfa:verify');
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ email: req.userEmail, authMethods: req.authMethods });
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, mfaCode } = req.body || {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Both passwords required' });
    }
    if (newPassword.length < 12 || newPassword.length > 128) {
      return res.status(400).json({ error: 'New password must be between 12 and 128 characters' });
    }
    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return res.status(400).json({ error: 'New password must include uppercase, lowercase and a number' });
    }
    if (!/^\d{6}$/.test(String(mfaCode || ''))) {
      return res.status(400).json({ error: 'Enter a valid 6-digit authenticator code' });
    }

    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [req.userEmail] });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is wrong' });
    }
    if (!user.mfa_enabled || !user.mfa_secret_encrypted) {
      return res.status(403).json({ error: 'Authenticator is not enabled for this account' });
    }
    const mfaVerification = await verifyOtp({ secret: decryptMfaSecret(user.mfa_secret_encrypted), token: String(mfaCode), epochTolerance: 30 });
    if (!mfaVerification.valid) return res.status(401).json({ error: 'Authenticator code is incorrect or expired' });

    const hash = bcrypt.hashSync(newPassword, 12);
    await db.execute({ sql: 'UPDATE users SET password_hash = ?, auth_version = auth_version + 1 WHERE email = ?', args: [hash, req.userEmail] });
    res.json({ ok: true, reauthenticationRequired: true });
  } catch (e) {
    serverError(res, e, 'auth:change-password');
  }
});

// ── Google Sign-In ──────────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// Only these emails can login via Google. Add more as needed.
const ALLOWED_GOOGLE_EMAILS = (process.env.ALLOWED_GOOGLE_EMAILS || 'cheema30246@gmail.com')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (typeof credential !== 'string' || !credential || credential.length > 8192) {
      return res.status(400).json({ error: 'No valid Google credential provided' });
    }
    if (!googleClient) return res.status(503).json({ error: 'Google Sign-In is not configured' });

    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    } catch {
      return res.status(401).json({ error: 'Invalid Google token' });
    }
    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: 'Invalid Google token' });

    const email = payload.email?.toLowerCase().trim();
    if (!email || payload.email_verified !== true) {
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

    const current = await db.execute({ sql: 'SELECT auth_version FROM users WHERE email = ?', args: [email] });
    const authMethods = ['google'];
    const token = signToken({ email, amr: authMethods, ver: Number(current.rows[0]?.auth_version) || 0 });
    res.json({ token, email, authMethods });
  } catch (e) {
    serverError(res, e, 'auth:google');
  }
});

// ─────────────────────────────────────────────────────────────
//  DATA ROUTES
// ─────────────────────────────────────────────────────────────

app.get('/api/all', requireAuth, async (req, res) => {
  try {
    const shopRows = await db.execute('SELECT data FROM shops ORDER BY updated_at ASC');
    const brandRow = await db.execute('SELECT data FROM brand WHERE id = 1');
    const shops = shopRows.rows.map(r => JSON.parse(r.data));
    const brand = brandRow.rows[0] ? JSON.parse(brandRow.rows[0].data) : { name: 'ShopManager', image: '' };
    res.json({ shops: clientData(shops, req), brand: clientData(brand, req) });
  } catch (e) {
    serverError(res, e, 'data:all');
  }
});

app.get('/api/shops', requireAuth, async (req, res) => {
  try {
    const rows = await db.execute('SELECT data FROM shops ORDER BY updated_at ASC');
    res.json({ shops: clientData(rows.rows.map(r => JSON.parse(r.data)), req) });
  } catch (e) {
    serverError(res, e, 'data:shops:list');
  }
});

app.put('/api/shops/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const shopData = req.body;
    if (!shopData || shopData.id !== id) return res.status(400).json({ error: 'Bad payload' });
    const storedShop = storageConfigured() ? await externalizeEmbeddedFiles(shopData, id) : shopData;
    await db.execute({
      sql: `INSERT INTO shops (id, data, updated_at) VALUES (?, ?::jsonb, TO_TIMESTAMP(? / 1000.0))
            ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      args: [id, JSON.stringify(storedShop), Date.now()]
    });
    res.json({ ok: true });
  } catch (e) {
    serverError(res, e, 'data:shops:update');
  }
});

app.delete('/api/shops/:id', requireAuth, async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM shops WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (e) {
    serverError(res, e, 'data:shops:delete');
  }
});

app.get('/api/brand', requireAuth, async (req, res) => {
  try {
    const row = await db.execute('SELECT data FROM brand WHERE id = 1');
    const brand = row.rows[0] ? JSON.parse(row.rows[0].data) : { name: 'ShopManager', image: '' };
    res.json({ brand: clientData(brand, req) });
  } catch (e) {
    serverError(res, e, 'data:brand:get');
  }
});

app.put('/api/brand', requireAuth, async (req, res) => {
  try {
    if (!req.body) return res.status(400).json({ error: 'No brand data' });
    const storedBrand = storageConfigured() ? await externalizeEmbeddedFiles(req.body, 'brand') : req.body;
    await db.execute({
      sql: `INSERT INTO brand (id, data, updated_at) VALUES (1, ?::jsonb, TO_TIMESTAMP(? / 1000.0))
            ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      args: [JSON.stringify(storedBrand), Date.now()]
    });
    res.json({ ok: true });
  } catch (e) {
    serverError(res, e, 'data:brand:update');
  }
});

app.get('/api/files/:encodedKey', async (req, res) => {
  try {
    const key = Buffer.from(req.params.encodedKey, 'base64url').toString('utf8');
    const payload = verifyToken(String(req.query.token || ''));
    if (!key || payload.file !== key || payload.scope !== 'file:read') return res.status(403).json({ error: 'Invalid file token' });
    const object = await getObject(key);
    res.setHeader('Content-Type', object.ContentType || 'application/octet-stream');
    res.setHeader('Content-Length', String(object.ContentLength || ''));
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    object.Body.pipe(res);
  } catch (error) {
    const status = error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError' ? 403 : 404;
    res.status(status).json({ error: status === 403 ? 'Invalid or expired file link' : 'File not found' });
  }
});

app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' });
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: 'Invalid JSON body' });
  if (error?.message === 'Origin not allowed by CORS') return res.status(403).json({ error: 'Origin not allowed' });
  return serverError(res, error, 'request');
});

// ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀  Backend running at http://localhost:${PORT}`);
    console.log('   Database: Neon PostgreSQL');
  });
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
