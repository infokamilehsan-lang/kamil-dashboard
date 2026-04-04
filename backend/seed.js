// ============================================================
//  Seed users into the SQLite database
//  Usage:  node seed.js
// ============================================================
require('dotenv').config();
const { createClient } = require('@libsql/client');
const bcrypt   = require('bcryptjs');
const path     = require('path');
const readline = require('readline');

const dbUrl   = process.env.TURSO_URL  || `file:${path.join(__dirname, process.env.DB_FILE || 'kamil.db')}`;
const dbToken = process.env.TURSO_TOKEN || undefined;
const db = createClient({ url: dbUrl, authToken: dbToken });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

async function main() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    );
  `);

  console.log('\n=== Kamil Dashboard — User Setup ===\n');

  const users = [
    { email: 'kamilstoreitalia@gmail.com', label: 'Kamil (main account)' },
    { email: 'cheema30246@gmail.com',      label: 'Second account' },
  ];

  for (const u of users) {
    const exists = await db.execute({ sql: 'SELECT email FROM users WHERE email = ?', args: [u.email] });
    if (exists.rows.length > 0) {
      const update = await ask(`User ${u.email} already exists. Password update karna hai? (y/n): `);
      if (update.trim().toLowerCase() !== 'y') continue;
    } else {
      console.log(`\nUser: ${u.email} (${u.label})`);
    }

    let pw1, pw2;
    do {
      pw1 = await ask(`  Password daalo (min 6 chars): `);
      pw2 = await ask(`  Password dobara daalo:        `);
      if (pw1 !== pw2) console.log('  ❌ Passwords match nahi karte — dobara try karo');
      if (pw1.length < 6) console.log('  ❌ Password zyada chota hai');
    } while (pw1 !== pw2 || pw1.length < 6);

    const hash = bcrypt.hashSync(pw1, 12);
    await db.execute({
      sql: `INSERT INTO users (email, password_hash) VALUES (?, ?)
            ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash`,
      args: [u.email, hash]
    });
    console.log(`  ✅ ${u.email} saved!\n`);
  }

  const all = await db.execute('SELECT email FROM users');
  console.log('\n=== Users in database ===');
  all.rows.forEach(u => console.log(' •', u.email));
  console.log('\nSetup complete! Backend start karo:  npm run dev\n');
  rl.close();
}

main().catch(err => { console.error(err); process.exit(1); });
