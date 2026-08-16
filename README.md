# Kamil Store Dashboard

Business dashboard with a React/Vite frontend and an Express/PostgreSQL backend.

## Project structure

```text
dashboard/
├── src/                 Frontend source
├── public/              Frontend static assets
├── backend/             API server
│   ├── migrations/      PostgreSQL schema migrations
│   ├── scripts/         Database and storage migration tools
│   ├── server.js        Express API
│   └── storage.js       Private Cloudflare R2 file storage
├── .env                 Frontend public configuration (VITE_* only)
└── backend/.env         Backend secrets (never exposed to the browser)
```

The two `.env` and `node_modules` locations are intentional: frontend and backend are separate applications. VS Code hides generated, backup, and legacy deployment files to keep the Explorer clean.

## Local development

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
npm run db:migrate
npm run dev
```

Use `.env.example` and `backend/.env.example` as configuration templates. Never commit the real `.env` files.

## Production

See `HOSTINGER_DEPLOYMENT.md`. Keep `backend/kamil.db`, `backups/`, and migration scripts until PostgreSQL production data and R2 files have been fully verified.
