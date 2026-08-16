const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      console.log(`Applied migration: ${file}`);
    }

    const result = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log(`PostgreSQL schema ready: ${result.rows.map((row) => row.table_name).join(', ')}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Migration failed: ${error.code || error.message}`);
  process.exit(1);
});
