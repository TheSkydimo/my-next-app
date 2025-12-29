# OpenNext Starter

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Read the documentation at https://opennext.js.org/cloudflare.

## Develop

Run the Next.js development server:

```bash
npm run dev
# or similar package manager command
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

### Dev notes (Cloudflare bindings + LAN access)

- For `npm run dev`, this repo initializes the OpenNext Cloudflare dev bridge so that API routes using `getCloudflareContext()` work locally.
- If you access the dev server from another device on your LAN (e.g. `http://192.168.1.102:3000`), you may need to allow the host for Next dev assets:
  - Set `DEV_ALLOWED_DEV_ORIGINS="192.168.1.102"` (comma-separated), or edit `allowedDevOrigins` in `next.config.ts`.

## Preview

Preview the application locally on the Cloudflare runtime:

```bash
npm run preview
# or similar package manager command
```

## Deploy

Deploy the application to Cloudflare:

```bash
npm run deploy
# or similar package manager command
```

## Observability (Sentry + R2 Log Archive)

### Sentry (Error Monitoring)

This project intentionally **does not bundle Sentry** for Cloudflare Workers to keep the Worker script under the free plan size limit.
Instead, rely on:
- structured console logs
- R2 log archive (NDJSON)

### Structured logs → Cloudflare R2 (NDJSON)

All `/api/*` routes are wrapped with a monitoring layer that:
- logs **structured JSON** to console (no cookies/auth/body)
- archives per-request logs as **NDJSON** objects into R2 (`APP_LOGS`)

- **Bucket binding**: `APP_LOGS` (see `wrangler.jsonc`)
- **Key format**: `logs/YYYY/MM/DD/HH/{requestId}.ndjson`
- **Optional prefix override**: `LOG_ARCHIVE_R2_PREFIX` (defaults to `logs/`)

Create the bucket (example):

```bash
wrangler r2 bucket create app-logs
```

## Cloudflare Turnstile (Register)

This project uses **Cloudflare Turnstile** on the register page.

- **Client (public)**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- **Server (secret)**: `TURNSTILE_SECRET_KEY`

For local preview on the Cloudflare runtime, copy `.dev.vars.example` to `.dev.vars` and fill values.
For production, set the secret via `wrangler secret put TURNSTILE_SECRET_KEY` (do not commit it).

### Local dev: bypass Turnstile (recommended for local testing)

You can bypass human verification **only in local dev**.

- **Next.js dev server** (`npm run dev`): set env vars in PowerShell before starting:

```bash
$env:DEV_BYPASS_TURNSTILE="1"
$env:DEV_RETURN_EMAIL_CODE="1"
npm run dev
```

- **Cloudflare runtime preview** (`npm run preview`): put these in `.dev.vars`:
  - `DEV_BYPASS_TURNSTILE="1"`
  - `DEV_RETURN_EMAIL_CODE="1"`
  
Tip (Windows): if you prefer not to set PowerShell env vars every time, you can also add these two keys into `.env.local` for `npm run dev` (do not commit `.env.local`).

Notes:
- When bypass is enabled, `/api/public-config` will return `turnstileRequired=false`, and the UI will skip the Turnstile step.
- These `DEV_*` helpers are **hard-disabled in production** by runtime checks.

## Secrets (SMTP / Mole API)

This repo expects the following **server-side secrets** (never commit them):

- `SMTP_PASS` (SMTP credential / app credential; required for verification emails)
- `MOLE_API_KEY` (optional; used by `/api/user/orders`)

For local preview on the Cloudflare runtime, put them in `.dev.vars`.
For production, set them via:

```bash
wrangler secret put SMTP_PASS
wrangler secret put MOLE_API_KEY
```

If these values were ever committed, treat them as **compromised** and rotate them immediately.

## Feedback email notifications

When a logged-in user submits quick feedback, the server will **store it in D1** and (best-effort) **send an email to the support mailbox**.

- **Required**: set `FEEDBACK_NOTIFY_TO` (support inbox recipients, comma-separated)
- **Required sender**: `SMTP_FROM`
- **Optional dedicated SMTP**: `FEEDBACK_SMTP_*` (override SMTP settings for feedback only)

## Remember login (Session Cookie)

This project uses a **signed httpOnly cookie** (`user_session`) to persist login sessions.

- **Required**: set `SESSION_SECRET` (as a Wrangler secret in production, or in `.dev.vars` for local preview)

If `SESSION_SECRET` is not configured, `/api/login` will still work via email code, but the app **cannot remember login** and you will need to verify again next time.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
