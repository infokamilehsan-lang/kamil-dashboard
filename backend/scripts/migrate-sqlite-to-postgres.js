const crypto = require('crypto');
const path = require('path');
const { createClient } = require('@libsql/client');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const sqlitePath = path.join(__dirname, '..', process.env.DB_FILE || 'kamil.db');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stable(value[key]);
      return result;
    }, {});
  }
  return value;
}

function checksum(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');

  const sqlite = createClient({ url: `file:${sqlitePath}` });
  const postgres = new Client({ connectionString: process.env.DATABASE_URL });

  const [sourceUsers, sourceShops, sourceBrand] = await Promise.all([
    sqlite.execute('SELECT email, password_hash, created_at FROM users ORDER BY email'),
    sqlite.execute('SELECT id, data, updated_at FROM shops ORDER BY id'),
    sqlite.execute('SELECT id, data, updated_at FROM brand WHERE id = 1'),
  ]);

  console.log(`SQLite source: ${sourceUsers.rows.length} users, ${sourceShops.rows.length} shops, ${sourceBrand.rows.length} brand`);
  await postgres.connect();
  await postgres.query('BEGIN');

  try {
    for (const user of sourceUsers.rows) {
      await postgres.query(
        `INSERT INTO users (email, password_hash, created_at)
         VALUES (LOWER(BTRIM($1)), $2, TO_TIMESTAMP($3 / 1000.0))
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, created_at = EXCLUDED.created_at`,
        [user.email, user.password_hash, Number(user.created_at) || Date.now()],
      );
    }

    for (const shop of sourceShops.rows) {
      const parsed = JSON.parse(shop.data);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`Shop ${shop.id} has invalid JSON data`);
      await postgres.query(
        `INSERT INTO shops (id, data, updated_at)
         VALUES ($1, $2::jsonb, TO_TIMESTAMP($3 / 1000.0))
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
        [shop.id, JSON.stringify(parsed), Number(shop.updated_at) || Date.now()],
      );
    }

    for (const brand of sourceBrand.rows) {
      await postgres.query(
        `INSERT INTO brand (id, data, updated_at)
         VALUES (1, $1::jsonb, TO_TIMESTAMP($2 / 1000.0))
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
        [JSON.stringify(JSON.parse(brand.data)), Number(brand.updated_at) || Date.now()],
      );
    }

    const targetUsers = await postgres.query('SELECT email, password_hash FROM users ORDER BY email');
    const targetShops = await postgres.query('SELECT id, data FROM shops ORDER BY id');
    const targetBrand = await postgres.query('SELECT id, data FROM brand WHERE id = 1');

    if (targetUsers.rows.length !== sourceUsers.rows.length) throw new Error('User count verification failed');
    if (targetShops.rows.length !== sourceShops.rows.length) throw new Error('Shop count verification failed');
    if (targetBrand.rows.length !== sourceBrand.rows.length) throw new Error('Brand count verification failed');

    const sourceUserHashes = new Map(sourceUsers.rows.map((row) => [String(row.email).trim().toLowerCase(), row.password_hash]));
    for (const user of targetUsers.rows) {
      if (sourceUserHashes.get(user.email) !== user.password_hash) throw new Error(`User verification failed for ${user.email}`);
    }

    const sourceShopHashes = new Map(sourceShops.rows.map((row) => [row.id, checksum(JSON.parse(row.data))]));
    for (const shop of targetShops.rows) {
      if (sourceShopHashes.get(shop.id) !== checksum(shop.data)) throw new Error(`Shop checksum verification failed for ${shop.id}`);
    }

    if (checksum(JSON.parse(sourceBrand.rows[0].data)) !== checksum(targetBrand.rows[0].data)) throw new Error('Brand checksum verification failed');

    await postgres.query(
      `INSERT INTO app_migrations (version) VALUES ('sqlite_data_import_v1') ON CONFLICT (version) DO NOTHING`,
    );
    await postgres.query('COMMIT');
    console.log(`Neon verified: ${targetUsers.rows.length} users, ${targetShops.rows.length} shops, ${targetBrand.rows.length} brand`);
    console.log('SQLite to PostgreSQL migration: COMPLETE');
  } catch (error) {
    await postgres.query('ROLLBACK');
    throw error;
  } finally {
    await Promise.allSettled([postgres.end(), sqlite.close()]);
  }
}

main().catch((error) => {
  console.error(`Data migration failed: ${error.code || error.message}`);
  process.exit(1);
});
