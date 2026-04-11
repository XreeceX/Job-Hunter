# Job Hunter

[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)

Personal **job-hunting assistant**: import spreadsheets with automatic column detection, store your **profile and resume**, generate outreach copy with AI, and use the **Job Application Copilot** to track roles, analyze job descriptions, and draft tailored bullets and cover letters.

**This app does not** automate employer logins, mass-submit forms, or click “Apply” for you. You review everything and paste into career sites yourself.

---

## Contents

- [Features](#features)
- [Security & secrets (GitHub)](#security--secrets-github)
- [Deploy on Vercel](#deploy-on-vercel)
- [Environment variables (Vercel)](#environment-variables-vercel)
- [Local development](#local-development)
- [Job Application Copilot](#job-application-copilot)
- [API overview](#api-overview)
- [Job Tracker integration (`/api/apply`)](#job-tracker-integration-apiapply)
- [AI providers](#ai-providers)
- [Troubleshooting](#troubleshooting)
- [Publishing a GitHub release](#publishing-a-github-release)

---

## Features

| Area | What it does |
|------|----------------|
| **Spreadsheet import** | Upload CSV/Excel; columns inferred (company, email, role, etc.) without fixed column names. |
| **Profile & resume** | Name, skills, PDF/text resume (text extracted for prompts). |
| **AI prompt panel** | Cold email, cover letter, research, interview Q&A from selected rows + profile. |
| **Application Copilot** | Per-role JD analysis, tailored resume bullets, cover letter drafts, short answers; export Markdown. |

**Stack:** Next.js 14 (App Router), React, TypeScript, Tailwind, Prisma, PostgreSQL, Groq or OpenAI-compatible LLMs.

---

## Security & secrets (GitHub)

- **Never commit** real API keys, database passwords, or connection strings. This repo uses **`.env.example`** as a template only.
- **Ignored by Git:** `.env`, `.env.local`, and other env files (see `.gitignore`). Only `.env.example` is meant to be tracked.
- **Production:** Set all secrets in **Vercel → Project → Settings → Environment Variables** (or your host). Rotate any key that was ever pasted into a commit, issue, or screenshot.
- **Repository settings:** On GitHub, avoid putting tokens in **public** repo descriptions, wiki, or gists.

---

## Deploy on Vercel

1. Push this repo to GitHub (without `.env`).
2. Import the repo in [Vercel](https://vercel.com/new) and use the default Next.js settings.
3. Add a **hosted PostgreSQL** database (e.g. Neon via Vercel Storage, or Supabase/Railway). Use a **pooled** connection string for serverless where the provider recommends it.
4. Set **environment variables** below for **Production** (and **Preview** if you use preview deployments).
5. Run **`npx prisma generate`** is part of `npm run build` already; ensure `DATABASE_URL` is set so Prisma can connect at build/runtime.
6. After changing env vars, **redeploy** so new values apply.

Resume PDFs on Vercel need **Vercel Blob** (or similar): add Blob storage and set `BLOB_READ_WRITE_TOKEN` as documented by Vercel—local dev can use `./uploads` without Blob.

---

## Environment variables (Vercel)

Set these in **Vercel → Project → Settings → Environment Variables**.  
**Do not** paste real values into GitHub—only names and purpose are listed here.

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | **Yes** | PostgreSQL URL (`sslmode=require` for Neon and many hosts). |
| `LLM_PROVIDER` | **Yes** (for AI features) | `groq` or `openai`. |
| `GROQ_API_KEY` | If using Groq | Server-side only; never expose to the browser. |
| `OPENAI_API_KEY` | If using OpenAI | Same as above. |
| `LLM_MODEL` | No | Override model ID/name; otherwise the code uses provider defaults. |
| `BLOB_READ_WRITE_TOKEN` | Recommended on Vercel | From Vercel Blob; resume/cover uploads use Blob instead of disk. |
| `POSTGRES_URL` | Only if you map it | Some templates inject `POSTGRES_URL`; this app reads **`DATABASE_URL`**—point `DATABASE_URL` at your DB or duplicate the value in Vercel. |
| `CORS_ORIGIN` | No | e.g. `https://your-app.vercel.app` if you need CORS for `/api/*` from another origin. |
| `NODE_OPTIONS` | No | e.g. `--no-deprecation` to quiet Node deprecation noise in logs. |

Optional (see `.env.example`): web search keys, `PORTFOLIO_URL`, `UPLOAD_DIR` (local only).

Copy **`.env.example` → `.env`** locally; mirror the same **names** in Vercel with **your** secret values.

---

## Local development

```bash
git clone <your-repo-url>
cd job-hunter
npm install
cp .env.example .env
# Edit .env: DATABASE_URL, LLM_PROVIDER, and the matching API key

npx prisma generate
npx prisma db push

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Windows:** Quote paths with spaces, e.g. `cd "C:\path\to\job-hunter"`.

**Tests (optional):** `npm test`

---

## Job Application Copilot

- **Baseline resume:** Home → **Profile & resume** (paste or upload PDF).
- **Applications:** Top nav → **Applications** → create a role, paste JD → **Analyze JD** → **Generate**. Edit, copy, or **Export .md**.
- **Settings:** Top nav → **Settings** — checks `/api/health` and `/api/test-llm`.

Without an LLM API key, analysis/generation fall back to **offline keyword/template** mode with clear warnings.

Architecture: one Next.js app and Prisma schema (no separate FastAPI server). Copilot routes live under `src/app/api/applications/` and pages under `src/app/applications/`.

---

## API overview

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Database connectivity |
| GET | `/api/settings` | Non-secret LLM summary (provider, model override, whether a key is set) |
| POST | `/api/test-llm` | Minimal LLM check |
| POST/GET | `/api/applications` | Create / list applications |
| GET/PATCH | `/api/applications/{id}` | Read / update |
| POST | `/api/applications/{id}/analyze-jd` | Store JD + structured analysis |
| POST | `/api/applications/{id}/generate` | Tailored drafts (+ optional `jdText` in body) |
| GET | `/api/applications/{id}/export-md` | Markdown download |

Longer internal docs: `ARCHITECTURE.md`, `PROMPT_FLOW.md`, `SECURITY.md`.

---

## Job Tracker integration (`/api/apply`)

External tools can POST job data and application questions; responses may be `completed` or `needs_user_input`. See examples in older docs or `src/app/api/apply/` — request/response shapes are JSON.

---

## AI providers

- **Groq** (common on Vercel): `LLM_PROVIDER=groq`, `GROQ_API_KEY`.
- **OpenAI:** `LLM_PROVIDER=openai`, `OPENAI_API_KEY`.

Only one provider is active at a time (`src/lib/services/ai/`).

---

## Troubleshooting

- **DB / uploads errors on Vercel:** Use your host’s **pooled** connection string for serverless; set `DATABASE_URL` in Vercel; redeploy. Check `GET /api/health` on your deployment.
- **401/403 HTML instead of JSON:** Turn off **Deployment Protection** for Production if the app must be public, or allow API routes accordingly.
- **Timeouts (Hobby 10s limit):** Cold starts or heavy LLM calls may need retries or a Pro plan with longer limits.

---

## Publishing a GitHub release

1. **Commit and push** your changes to the default branch (e.g. `main`).
2. On GitHub: **Releases** → **Create a new release** (or **Draft a new release**).
3. **Choose a tag:** e.g. `v1.0.0` — select **Create new tag on publish** if the tag does not exist yet.
4. **Release title:** e.g. `v1.0.0`.
5. **Describe** what changed (changelog). You can use **Generate release notes** if GitHub offers it.
6. **Publish release.**

**From the command line (GitHub CLI):**

```bash
# Install: https://cli.github.com/
git tag -a v1.0.0 -m "v1.0.0"
git push origin v1.0.0
gh release create v1.0.0 --generate-notes
```

Optional: attach build artifacts (e.g. `zip` of source **without** `.env`) — not required for a Next.js app deployed from the repo.

---

## Project layout

- `src/app/` — Pages and API routes  
- `src/lib/services/` — Excel, profile, AI, job copilot  
- `src/components/` — UI  
- `prisma/schema.prisma` — Data models  

---

## License

No license file is included in this repository; add a `LICENSE` file if you want to specify terms for others.
