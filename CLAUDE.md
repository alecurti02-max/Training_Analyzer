# CLAUDE.md (repository root)

The actual product lives in **`training-analyzer/`** — treat it as the working
directory for almost every task. Its **`training-analyzer/CLAUDE.md` is the canonical
doc**: stack, project map, state/bridge layout, commands, constraints, conventions.
Read that first. This root file only keeps the few workspace-level gotchas that are not
in the app doc.

```
analisi allenamenti/            (workspace root — session docs, dumps, this pointer)
└── training-analyzer/          ← the app; see training-analyzer/CLAUDE.md
    ├── client/                 Preact + Vite (build → client/dist/); legacy vanilla JS in client/js/
    ├── server/                 Node 20 + Express 4 + Sequelize 6 + PostgreSQL
    └── docker-compose.yml
```

> Note: there now IS a client build (Vite) and a test suite (`vitest` for the client,
> `node --test` + supertest for the server). The old "no build / no tests / no linter"
> note was stale — see the app doc's **Comandi** section for the real commands.

## Local-dev setup (without Docker)

The `README` assumes Docker; the dev box actually uses **Postgres via Homebrew** +
**Node native**, with the Express server doubling as the static client host.

- Postgres: `brew services start postgresql@16`. Dev DB `training_analyzer` owned by
  role `ta_user` / password `ta_pass` (matches the `DATABASE_URL` placeholder in `.env`).
- A prod snapshot dump lives at `training-analyzer/training_analyzer_20260421_2029.dump`
  (gitignored). Restore with
  `pg_restore --no-owner --no-privileges -h localhost -U ta_user -d training_analyzer <file>`.
  Pre-seed `SequelizeMeta` with the migration names that pre-date the dump before running
  `npm run migrate`, otherwise migration 001 tries to recreate existing tables.
- Open the app at **`http://localhost:3000`** (Express serves `client/` itself), not a
  separate static server. For Vite HMR use `cd client && npm run dev` (:5173, proxies
  `/api` → :3000).

## .env loading (gotcha)

`.env` lives at `training-analyzer/.env` (NOT `training-analyzer/server/.env`). Both
`server/src/index.js` and `server/src/config/env.js` resolve it explicitly with
`path.resolve(__dirname, '../../.env')` (resp. `'../../../.env'`) and pass
`override: true`, so file values always win over shell env vars. This matters because
some shells (and Claude Code itself) inject an `ANTHROPIC_API_KEY` that would otherwise
shadow the project's key. To add a server-side env var: add it to
`server/src/config/env.js` (typed read), then `.env.example`, then Render's dashboard.

## Helmet in dev

`app.js` disables `strictTransportSecurity` and `upgradeInsecureRequests` when
`NODE_ENV !== 'production'`. Without this, browsers force the local HTTP origin to HTTPS
and the page renders unstyled. Don't re-enable them in dev.

## Deploying (prod migration trick)

Production is **Render** (server) + **Neon** (Postgres). Pushing to `main` auto-deploys;
`runMigrations()` in `server/src/index.js` applies pending migrations at boot (do not
remove). If you must apply one by hand, paste the equivalent SQL into Neon's web SQL
Editor and add the migration filename to `SequelizeMeta`. Env vars are managed in the
Render dashboard, not the repo.
