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

## Job Tracker Integration (`/api/apply`)

Use this route when another project (like `Job Tracker`) sends job data and application questions for this project to curate answers.

- **Endpoint:** `POST /api/apply`
- **Behavior:** Returns a direct JSON reply to the same call.
  - `status: "completed"` with curated answers when context is sufficient.
  - `status: "needs_user_input"` with a single follow-up question when required information is missing.
- **Memory:** If caller sends `followUpAnswers`, answers are saved to profile `customQa` and reused later.

Example request:

```json
{
  "job": {
    "companyName": "Acme",
    "role": "Software Engineer Intern",
    "location": "Remote",
    "url": "https://acme.com/jobs/123",
    "description": "Build internal tools with React + Node."
  },
  "applicationQuestions": [
    { "id": "q1", "question": "Why do you want to join Acme?", "required": true },
    { "id": "q2", "question": "What is your expected graduation date?", "required": true }
  ]
}
```

`applicationQuestions` can also be plain strings:

```json
{
  "company": "Acme",
  "role": "Software Engineer Intern",
  "applicationQuestions": [
    "Are you legally authorized to work in the UK?",
    "What is your expected graduation date?"
  ]
}
```

Example follow-up request (after user answers):

```json
{
  "job": { "companyName": "Acme", "role": "Software Engineer Intern" },
  "applicationQuestions": [
    { "id": "q2", "question": "What is your expected graduation date?", "required": true }
  ],
  "followUpAnswers": [
    { "question": "What is your expected graduation date?", "answer": "May 2027" }
  ]
}
```

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

**Fix: Company list not loading (“No company list provided” / “Server returned an unexpected response”)**

Your uploads are saved in Neon, but the app can’t load the list. Do these in order:

1. **Use Neon’s pooled connection string on Vercel**
   - Open [Neon Console](https://console.neon.tech) → your **Job_hunter** project.
   - Go to **Connection details** (or Dashboard).
   - Copy the **“Pooled”** connection string (host must contain **`-pooler`**, e.g. `ep-xxx-pooler.eu-west-2.aws.neon.tech`). Do **not** use the direct (non-pooled) one for Vercel.
   - In **Vercel** → your project → **Settings** → **Environment Variables**:
     - Set **`DATABASE_URL`** to that pooled string (for **Production**, and **Preview** if you use it).
     - If `DATABASE_URL` already exists, edit it and replace with the pooled URL.
   - **Redeploy**: Deployments → … on latest → **Redeploy** (or push a commit). Env changes apply only after a new deployment.

2. **Confirm the list request in Vercel**
   - Open the deployed app and refresh (or click Retry in the Spreadsheet section).
   - In **Vercel** → **Logs**, filter or search for **`/api/uploads`**.
   - You should see **GET /api/uploads** with status **200**. If you see **500**, **502**, **---**, or no entry, the function is failing or timing out; the pooled URL from step 1 usually fixes that.

3. **If it still fails**
   - In Logs, open the **GET /api/uploads** entry and check the error message (e.g. connection refused, timeout).
   - Ensure **DATABASE_URL** in Vercel has no extra spaces and includes `?sslmode=require` at the end of the URL.

After the list loads, you’ll see “Recent uploads” and the company table; select an upload and one or more companies, then **Generate** will include the company list and the AI will use it.

---

**Already using the pooled URL but still getting an error page?**

- **Cold start / timeout:** On Vercel, the first request after a deploy (or after idle) can be slow. If the function doesn't respond in time, Vercel returns an HTML error (504 or 502) instead of JSON. **Vercel Hobby** has a **10 second** function limit; **Pro** allows 60s.
- **Test the DB:** Open **`https://your-app.vercel.app/api/health`** in a new tab. If you see `{"ok":true}`, the database connection works and the problem is likely the uploads request timing out. If you see an error page there too, the function is timing out or failing before it can run.
- **What to do:** Wait 10–15 seconds and click **Retry** (or refresh the page) so the next request may hit a warm function. If it keeps failing on Hobby, consider **Vercel Pro** for longer timeouts, or visit `/api/health` first to warm up, then open the dashboard.

**"Login required" / spreadsheets never load**

- If your Vercel project has **Deployment Protection** (e.g. "Vercel Authentication" or "Password"), the browser's request to `/api/uploads` gets a **401/403** and an HTML login page instead of JSON, so the app shows "Couldn't load spreadsheets."
- **Fix:** In **Vercel** → your project → **Settings** → **Deployment Protection**, either **disable protection for Production** (so the live app is public) or set it to **"Only Preview"** so Production deployments are public and the app can load data. Then redeploy or refresh the app.

**"Server returned an unexpected response" (same cause)**  
- The app’s **GET /api/uploads** is receiving an HTML error page instead of JSON. Follow the “Fix: Company list not loading” steps above (pooled Neon URL + redeploy). If you already use the pooled URL, see "Already using the pooled URL but still getting an error page?" above. If you see a login screen when opening the app, see "Login required" above.

**DeprecationWarning: `url.parse()` in logs (Error count)**  
- The `(node:10) [DEP0169] DeprecationWarning: url.parse()...` comes from a dependency (e.g. OpenAI or Groq SDK), not your code. It does not break upload or generate (both can still return 200). To hide it in Vercel logs, add an environment variable in Vercel → Project → Settings → Environment Variables: **`NODE_OPTIONS`** = **`--no-deprecation`**. Redeploy so it takes effect.
