# Ganttalf — working notes for Claude

## Git workflow

- **Never commit directly to `main`.** Always work on a feature branch
  (e.g. `fancy-start-page`) and merge to `main` via a pull request.
- `main` is the production branch — what lands there is what gets deployed.

## Development

```sh
npm install
npm run template   # generates public/template.xlsx (needed before dev/build)
npm run dev        # http://localhost:5173 — needs .env.local (see .env.example)
npm run build      # production build to dist/
```

The app boots with placeholder Supabase values in `.env.local` (auth and
cloud saves just won't work) — good enough for UI work and screenshots.

## Constraints

- `src/lib/share.js` (`#g=` codec) is byte-compatible with an external tool —
  do not refactor it (see README).
