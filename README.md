<!---------------------------------------------------
this file is owned by JAMES CHRISTOPHER GUIRIBA
do not copy or re puvbish!
------------------------------------------------------>

# LPHS Digital Attendance System
## Local development
```powershell
Copy-Item .env.example .env   # then fill in the values
npm install
npm run dev
```

`.env` is gitignored and is the only place the real secrets belong.

## Deploying to Cloudflare
This app is deployed as a **Cloudflare Worker**, not Cloudflare Pages.
TanStack Start's server functions (`src/lib/staff-auth.server.ts`) mint Firebase
login tokens, so deploy both the server and static assets using the generated
Worker configuration, rather than publishing only the static output.

`vite build` writes the whole site to `.output/` — the Worker to
`.output/server/` and the static files to `.output/public/`. Nitro generates
`.output/server/wrangler.json` with the correct `main` and `ASSETS` binding, so
`wrangler.toml` only needs the worker `name`. Do not add `main`, `[assets]`, or
`pages_build_output_dir` to `wrangler.toml`: Nitro overrides them, and a
`pages_build_output_dir` pointing at `./dist` would deploy a directory this
project never creates.

### 1. First-time setup
```powershell
npx wrangler login
```

### 2. Set the server secrets
These never go in the repo. `FIREBASE_PRIVATE_KEY` should be the whole PEM
block, and `\n` escapes are fine — the server converts them back.

```powershell
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put STAFF_GUARD_PASSWORD
npx wrangler secret put STAFF_ADMIN_PASSWORD
npx wrangler secret put STAFF_ECLUB_PASSWORD
npx wrangler secret put STAFF_DEV_PASSWORD
npx wrangler secret put FIREBASE_CLIENT_EMAIL
npx wrangler secret put FIREBASE_PRIVATE_KEY
```

A role whose password is blank simply cannot sign in. There is no fallback.

### 3. Deploy
```powershell
npm run deploy
```

This builds the app and runs `wrangler deploy --config .output/server/wrangler.json`.
For Cloudflare Workers Builds, use `npm run build` as the build command and
`npx wrangler deploy --config .output/server/wrangler.json` as the deploy command.
Do not use `wrangler pages deploy`.

On Windows, if PowerShell blocks `npm.ps1` or `npx.ps1`, use `npm.cmd` and
`npx.cmd` instead; there is no need to change your execution policy.

### 4. Authorize the domain in Firebase
Firebase Console -> Authentication -> Settings -> Authorized domains -> add the
deployed `*.workers.dev` hostname and any custom domain.

Skipping this step makes login appear to fail in the browser even though the
server verified the password correctly.

### Checklist when login or the database looks unreachable
| Symptom | Cause |
| --- | --- |
| "Invalid access password" for a password you know is right | Secret not set, or the role's password is blank |
| Token minted but the browser still fails | Domain missing from Firebase authorized domains |
| `PERMISSION_DENIED` on data reads | Not signed in, or `database.rules.json` was never deployed |
| Everything works locally, not when deployed | Deployed as Pages instead of a Worker |

Deploy the database rules separately:

```powershell
npx firebase deploy --only database
```