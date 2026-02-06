# Job Hunter

AI-powered job hunting web app for a single user: upload spreadsheets, map columns automatically, store profile and resume, and generate personalized content (cold emails, cover letters, research, interview Q&A) via natural-language prompts.

## Stack

- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes
- **Database:** PostgreSQL with Prisma
- **AI:** OpenAI (modular; swappable)
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
   - `OPENAI_API_KEY` – for AI generation (and optional column inference)

3. **Database**

   ```bash
   npx prisma generate
   npx prisma db push
   ```

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
