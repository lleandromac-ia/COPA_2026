# AGENTS.md

## Cursor Cloud specific instructions

This is a **100% static** frontend app (vanilla HTML/CSS/JS ES Modules), no build step. It talks
directly to a live hosted **Supabase** (PostgreSQL) instance whose URL + public `anon` key are
committed in `js/config.js`. There is no local database to provision.

### Services
- **Web app (static)**: serve the repo root over HTTP because the code uses ES Modules.
  - Run: `python3 -m http.server 8080` (or `npm run dev`), then open `http://localhost:8080/index.html`.
  - In the browser, `@supabase/supabase-js` is loaded from a CDN (see `js/db.js`), so the app needs
    outbound network access to both the CDN and the Supabase instance.
- **Node utility/test scripts** (`scripts/*.mjs`): these import `@supabase/supabase-js` and `xlsx`
  from `node_modules`, declared as devDependencies in `package.json`. They connect to the same live
  Supabase instance.

### Lint / Test / Build / Run
- **Build**: none (static site, nothing to compile).
- **Lint**: no linter is configured in this repo.
- **Test**:
  - `npm test` / `node scripts/test-scoring.mjs` — pure scoring unit tests (no network).
  - `node scripts/test-supabase.mjs` — verifies Supabase connectivity + table access (network).
  - `node scripts/test-ranking.mjs` — recomputes ranking from live data (network).
- **Run**: `python3 -m http.server 8080`.

### Gotchas
- The live `configuracao.cadastro_bloqueado` flag is currently `true`, so the public
  "Novo Participante" registration form is intentionally disabled. Don't treat a blocked
  registration as a bug. Read-heavy flows (Dashboard, Ranking, Comparação, Perfil) work without it.
- These scripts read/write the **shared live** Supabase data. Avoid inserting throwaway test rows;
  prefer read-only flows (e.g. the Comparação feature) for smoke testing.
- Admin area: open the **Admin** tab and enter PIN `2026` (`ADMIN_PIN` in `js/config.js`).
