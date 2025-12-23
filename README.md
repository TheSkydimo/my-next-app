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

## Cloudflare Turnstile (Register)

This project uses **Cloudflare Turnstile** on the register page.

- **Client (public)**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- **Server (secret)**: `TURNSTILE_SECRET_KEY`

For local preview on the Cloudflare runtime, copy `.dev.vars.example` to `.dev.vars` and fill values.
For production, set the secret via `wrangler secret put TURNSTILE_SECRET_KEY` (do not commit it).

## Secrets (SMTP / Mole API)

This repo expects the following **server-side secrets** (never commit them):

- `SMTP_PASS` (SMTP password)
- `MOLE_API_KEY` (optional; used by `/api/user/orders`)

For local preview on the Cloudflare runtime, put them in `.dev.vars`.
For production, set them via:

```bash
wrangler secret put SMTP_PASS
wrangler secret put MOLE_API_KEY
```

If these values were ever committed, treat them as **compromised** and rotate them immediately.

## Remember login (Session Cookie)

This project uses a **signed httpOnly cookie** (`user_session`) to persist login sessions.

- **Required**: set `SESSION_SECRET` (as a Wrangler secret in production, or in `.dev.vars` for local preview)

If `SESSION_SECRET` is not configured, `/api/login` will still work via email code, but the app **cannot remember login** and you will need to verify again next time.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
