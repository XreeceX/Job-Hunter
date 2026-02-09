# Job Hunter

AI-powered job hunting web app for a single user: upload spreadsheets, map columns automatically, store profile and resume, and generate personalized content (cold emails, cover letters, research, interview Q&A) via natural-language prompts.

## Stack

- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes
- **Database:** PostgreSQL with Prisma
- **AI:** Provider-agnostic (Groq default, OpenAI optional) via `src/lib/services/ai/`
- **Excel:** SheetJS (xlsx)
- **Deploy:** Vercel-ready

## Setup

1. **Clone and install**

   ```bash
   cd "Job hunter"
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env` and set:

   - `DATABASE_URL` – PostgreSQL connection string
   - **AI:** Set `LLM_PROVIDER` and the matching API key (see below).

3. **Database**

   ```bash
   npx prisma generate
   npx prisma db push
   ```

   **First time with Neon (or any new empty DB):** The tables (`User`, `Upload`, etc.) must exist. From your machine, run the above **once** with `DATABASE_URL` pointing at your Neon DB (copy from Vercel → Project → Settings → Environment Variables, or from Neon dashboard). After `prisma db push` succeeds, the app and Vercel will work.

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Usage

1. **Upload** – Drag or select an Excel (.xlsx/.xls) or CSV file. Headers and columns are parsed and inferred (company, email, role, etc.) without assuming column names.
2. **Profile** – Open “Profile & Resume” to set name, target role, experience, skills, and upload a PDF resume (text is extracted for AI).
3. **Companies** – Pick an upload and select one or more rows (companies).
4. **Prompt** – Choose an optional intent (cold email, cover letter, research, interview Q&A) and type a request. Click Generate to get personalized, editable output; copy as needed.

## Project layout

- `src/app/` – App Router pages and API routes
- `src/lib/services/` – Excel ingestion, column inference, profile, prompt builder, AI execution
- `src/lib/types/` – Shared types and semantic keys
- `src/components/` – React UI (dashboard, upload, company table, prompt panel, profile)
- `prisma/schema.prisma` – Data models

See `ARCHITECTURE.md` for design and data flow.

## Example prompt flow

- **Cold email:** Select one company → Intent “Cold email” → Request: “Write a short cold email introducing me and my interest in the role.” → Generate.
- **Cover letter:** Select one company → Intent “Cover letter” → Request: “Write a one-page cover letter.” → Generate.
- **Research:** Select one company → Intent “Research company” → Request: “Summarize this company and role for interview prep.” → Generate.

All outputs use your profile and resume and the selected company row(s); no column names are hardcoded.

## AI: Local dev vs Vercel production

The app uses a **provider-agnostic** AI layer (`src/lib/services/ai/`). No OpenAI (or Groq) is imported outside that folder.

- **Production default (Vercel):** **Groq**  
  Set `LLM_PROVIDER=groq` and `GROQ_API_KEY`. Groq offers a free hosted tier, OpenAI-compatible chat API, and is serverless-friendly (no cold-start issues). Default model: `llama-3.3-70b-versatile`.

- **Local / fallback:** **OpenAI**  
  Set `LLM_PROVIDER=openai` and `OPENAI_API_KEY` if you prefer GPT for generation or column inference.

Only one provider is active at a time; the rest of the app calls `runLLM()` and does not depend on which provider is configured.

## Running 24/7 (no Postgres on your laptop)

To run the app 24/7 without keeping Postgres (or your laptop) on:

1. **Deploy to Vercel**  
   Connect the repo to Vercel and deploy. The app runs on Vercel’s infra.

2. **Use a hosted database**  
   You don’t run Postgres locally. Use a hosted Postgres and set `DATABASE_URL`:
   - **Vercel Marketplace:** In the Vercel project, go to Storage (or Integrations), add **Neon** (or another Postgres). Vercel will add `POSTGRES_URL` or `DATABASE_URL` to the project. If the provider exposes `POSTGRES_URL`, set `DATABASE_URL` in Project Settings → Environment Variables to that value (or use the variable name your provider gives).
   - **Any other host:** Neon, Supabase, Railway, etc. Create a database, copy the connection string, and set `DATABASE_URL` in Vercel (and in `.env` for local dev against the same DB).

3. **Resume storage**  
   On Vercel, serverless has no persistent disk. Add a **Vercel Blob** store in the project (Storage → Create → Blob). The `BLOB_READ_WRITE_TOKEN` is set automatically; resume uploads will use Blob instead of local files. For local dev, omit the token and resumes are stored in `./uploads` (or `UPLOAD_DIR`).

4. **Env summary for 24/7**  
   In Vercel: `DATABASE_URL` (hosted Postgres), `LLM_PROVIDER` + `GROQ_API_KEY` (or OpenAI), and Blob token if you use a Blob store. No need to run Postgres (or the app) on your laptop.

## Troubleshooting

**"Server returned an unexpected response" when loading spreadsheets (list is empty)**  
- Your data is in Neon (you can confirm in Neon dashboard or Prisma Studio), but the app’s **GET /api/uploads** is receiving an HTML error page instead of JSON.
- **Fix 1 – Use Neon’s pooled connection string:** In Neon, use the **pooled** connection string (host usually contains `-pooler`, e.g. `ep-xxx-pooler.region.aws.neon.tech`) and set that as `DATABASE_URL` in Vercel. Pooled connections work better with serverless and avoid connection limits.
- **Fix 2 – Check Vercel logs:** In Vercel → your project → Logs (or Functions), find the request to **GET /api/uploads**. Check the response status and any error message (e.g. timeout, DB connection failed). That will show why the platform might be returning HTML.
- **Fix 3 – Redeploy:** Ensure the latest code (with `maxDuration` and safe JSON handling) is deployed, then try again or click Retry in the app.
