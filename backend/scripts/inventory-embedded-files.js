const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const databasePath = path.join(__dirname, '..', process.env.DB_FILE || 'kamil.db');
const dataUrlPattern = /^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/s;

function extensionFor(mime) {
  const known = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'application/pdf': 'pdf',
  };
  return known[mime] || mime.split('/').at(-1)?.replace(/[^a-z0-9]/gi, '') || 'bin';
}

function walk(value, jsonPath, shopId, files) {
  if (typeof value === 'string') {
    const match = value.match(dataUrlPattern);
    if (!match) return;
    const bytes = Buffer.from(match[2], 'base64');
    files.push({
      shopId,
      path: jsonPath,
      mime: match[1].toLowerCase(),
      extension: extensionFor(match[1].toLowerCase()),
      bytes: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${jsonPath}[${index}]`, shopId, files));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => walk(item, jsonPath ? `${jsonPath}.${key}` : key, shopId, files));
  }
}

async function main() {
  const db = createClient({ url: `file:${databasePath}` });
  try {
    const result = await db.execute('SELECT id, data FROM shops ORDER BY id');
    const files = [];
    result.rows.forEach((shop) => walk(JSON.parse(shop.data), '', shop.id, files));
    const uniqueHashes = new Set(files.map((file) => file.sha256));
    const byMime = files.reduce((summary, file) => {
      const item = summary[file.mime] || { count: 0, bytes: 0 };
      item.count += 1;
      item.bytes += file.bytes;
      summary[file.mime] = item;
      return summary;
    }, {});
    const report = {
      generatedAt: new Date().toISOString(),
      source: path.basename(databasePath),
      totalFiles: files.length,
      uniqueFiles: uniqueHashes.size,
      duplicateReferences: files.length - uniqueHashes.size,
      totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
      byMime,
      files,
    };
    const outputPath = path.join(__dirname, '..', '..', 'backups', 'embedded-files-inventory.json');
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    console.log(`Embedded files: ${report.totalFiles}`);
    console.log(`Unique files: ${report.uniqueFiles}`);
    console.log(`Duplicate references: ${report.duplicateReferences}`);
    console.log(`Total size: ${(report.totalBytes / 1024 / 1024).toFixed(2)} MB`);
    Object.entries(byMime).forEach(([mime, item]) => console.log(`${mime}: ${item.count} files, ${(item.bytes / 1024 / 1024).toFixed(2)} MB`));
    console.log(`Private inventory: ${outputPath}`);
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(`Inventory failed: ${error.message}`);
  process.exit(1);
});
