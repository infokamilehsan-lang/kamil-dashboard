const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { externalizeEmbeddedFiles } = require('../storage');

function countReferences(value) {
  if (typeof value === 'string') return value.startsWith('r2://') ? 1 : 0;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countReferences(item), 0);
  if (value && typeof value === 'object') return Object.values(value).reduce((sum, item) => sum + countReferences(item), 0);
  return 0;
}

function countEmbedded(value) {
  if (typeof value === 'string') return /^data:[^;,]+(?:;[^,]*)?;base64,/s.test(value) ? 1 : 0;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countEmbedded(item), 0);
  if (value && typeof value === 'object') return Object.values(value).reduce((sum, item) => sum + countEmbedded(item), 0);
  return 0;
}

async function main() {
  const postgres = new Client({ connectionString: process.env.DATABASE_URL });
  await postgres.connect();
  const source = await postgres.query('SELECT id, data FROM shops ORDER BY id');
  const sourceBrand = await postgres.query('SELECT id, data FROM brand WHERE id = 1');
  const before = source.rows.reduce((sum, row) => sum + countEmbedded(row.data), 0) + sourceBrand.rows.reduce((sum, row) => sum + countEmbedded(row.data), 0);
  console.log(`Embedded files before migration: ${before}`);

  await postgres.query('BEGIN');
  try {
    for (const shop of source.rows) {
      const migrated = await externalizeEmbeddedFiles(shop.data, shop.id);
      await postgres.query('UPDATE shops SET data = $2::jsonb, updated_at = NOW() WHERE id = $1', [shop.id, JSON.stringify(migrated)]);
    }
    for (const brand of sourceBrand.rows) {
      const migrated = await externalizeEmbeddedFiles(brand.data, 'brand');
      await postgres.query('UPDATE brand SET data = $1::jsonb, updated_at = NOW() WHERE id = 1', [JSON.stringify(migrated)]);
    }

    const verifyShops = await postgres.query('SELECT data FROM shops');
    const verifyBrand = await postgres.query('SELECT data FROM brand WHERE id = 1');
    const remaining = verifyShops.rows.reduce((sum, row) => sum + countEmbedded(row.data), 0) + verifyBrand.rows.reduce((sum, row) => sum + countEmbedded(row.data), 0);
    const references = verifyShops.rows.reduce((sum, row) => sum + countReferences(row.data), 0) + verifyBrand.rows.reduce((sum, row) => sum + countReferences(row.data), 0);
    if (remaining !== 0 || references < before) throw new Error(`Verification failed: ${remaining} embedded, ${references} R2 references`);

    await postgres.query("INSERT INTO app_migrations (version) VALUES ('embedded_files_to_r2_v1') ON CONFLICT (version) DO NOTHING");
    await postgres.query('COMMIT');
    console.log(`R2 references verified: ${references}`);
    console.log('Embedded file migration: COMPLETE');
  } catch (error) {
    await postgres.query('ROLLBACK');
    throw error;
  } finally {
    await postgres.end();
  }
}

main().catch((error) => {
  console.error(`R2 migration failed: ${error.code || error.message}`);
  process.exit(1);
});
