const crypto = require('crypto');
const { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const DATA_URL = /^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/s;
const R2_PREFIX = 'r2://';
const FILE_ROUTE = '/api/files/';

const extensions = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

function configured() {
  return ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'].every((key) => process.env[key]);
}

function endpoint() {
  const jurisdiction = String(process.env.R2_JURISDICTION || '').trim().toLowerCase();
  const suffix = jurisdiction && jurisdiction !== 'default' ? `.${jurisdiction}` : '';
  return `https://${process.env.R2_ACCOUNT_ID}${suffix}.r2.cloudflarestorage.com`;
}

let client;
function getClient() {
  if (!configured()) throw new Error('R2 object storage is not configured');
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: endpoint(),
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
    });
  }
  return client;
}

function safePart(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100);
}

async function uploadDataUrl(dataUrl, shopId = 'shared') {
  const match = String(dataUrl || '').match(DATA_URL);
  if (!match) return dataUrl;
  const mime = match[1].toLowerCase();
  const body = Buffer.from(match[2], 'base64');
  const sha256 = crypto.createHash('sha256').update(body).digest('hex');
  const extension = extensions[mime] || mime.split('/').at(-1)?.replace(/[^a-z0-9]/gi, '') || 'bin';
  const key = `shops/${safePart(shopId)}/${sha256}.${extension}`;
  const s3 = getClient();

  try {
    const existing = await s3.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
    if (existing.Metadata?.sha256 === sha256 && Number(existing.ContentLength) === body.length) return `${R2_PREFIX}${key}`;
  } catch (error) {
    const status = error.$metadata?.httpStatusCode;
    if (status && status !== 404) throw error;
  }

  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: mime,
    Metadata: { sha256, shopid: safePart(shopId) },
  }));
  const uploaded = await s3.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
  if (uploaded.Metadata?.sha256 !== sha256 || Number(uploaded.ContentLength) !== body.length) throw new Error(`R2 verification failed for ${key}`);
  return `${R2_PREFIX}${key}`;
}

async function externalizeEmbeddedFiles(value, shopId) {
  if (typeof value === 'string') return DATA_URL.test(value) ? uploadDataUrl(value, shopId) : internalizeFileUrl(value);
  if (Array.isArray(value)) return Promise.all(value.map((item) => externalizeEmbeddedFiles(item, shopId)));
  if (value && typeof value === 'object') {
    const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await externalizeEmbeddedFiles(item, shopId)]));
    return Object.fromEntries(entries);
  }
  return value;
}

function internalizeFileUrl(value) {
  if (typeof value !== 'string' || !value.includes(FILE_ROUTE)) return value;
  try {
    const url = new URL(value, 'http://local');
    const encoded = url.pathname.split(FILE_ROUTE)[1]?.split('/')[0];
    if (!encoded) return value;
    return `${R2_PREFIX}${Buffer.from(encoded, 'base64url').toString('utf8')}`;
  } catch {
    return value;
  }
}

function hydrateFileUrls(value, baseUrl, sign) {
  if (typeof value === 'string' && value.startsWith(R2_PREFIX)) {
    const key = value.slice(R2_PREFIX.length);
    const encoded = Buffer.from(key).toString('base64url');
    return `${baseUrl}${FILE_ROUTE}${encoded}?token=${encodeURIComponent(sign(key))}`;
  }
  if (Array.isArray(value)) return value.map((item) => hydrateFileUrls(item, baseUrl, sign));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, hydrateFileUrls(item, baseUrl, sign)]));
  return value;
}

async function getObject(key) {
  return getClient().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
}

module.exports = { configured, externalizeEmbeddedFiles, getObject, hydrateFileUrls };
