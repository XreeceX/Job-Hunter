# Job Hunter – Architecture Overview

## Design Philosophy

Single-user, AI-first job hunting assistant. All components are built to support **flexible inputs** (any Excel shape, any prompt) and **personalized outputs** (profile + resume + company context).

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           NEXT.JS APP (App Router)                       │
├─────────────────────────────────────────────────────────────────────────┤
│  Frontend (React)          │  API Routes / Server Actions                 │
│  - Upload UI               │  - POST /api/upload                          │
│  - Column mapping UI       │  - GET/POST /api/profile                     │
│  - Company table + select  │  - POST /api/infer-columns                   │
│  - Prompt input + output   │  - POST /api/generate                       │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SERVICE LAYER (TypeScript)                       │
├─────────────────────────────────────────────────────────────────────────┤
│  excelIngestionService     │  Parses .xlsx/.csv → headers + rows         │
│  columnInferenceService   │  Heuristics + optional AI → column meanings  │
│  userProfileService        │  CRUD profile, resume, Q&A                  │
│  promptBuilderService      │  Builds optimized prompt from context       │
│  aiExecutionService        │  Calls OpenAI (swappable), returns text     │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL (Prisma)       │  File storage (local / Vercel Blob)         │
│  - User, UserProfile       │  - Uploaded Excel, PDF resume                │
│  - Upload, ColumnMapping   │                                              │
│  - CompanyRow (JSONB)      │                                              │
│  - SavedPrompt, Output     │                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Excel Upload & Column Detection

1. User uploads file → **excelIngestionService** parses with SheetJS → raw headers + rows.
2. Headers (and optionally first row sample) → **columnInferenceService**:
   - **Heuristics**: normalize header names (lowercase, trim), match against known patterns (e.g. "company", "email", "phone", "role", "notes").
   - **AI fallback**: if confidence is low or column is ambiguous, call OpenAI to classify "company name | website | email | phone | role/title | notes | other".
3. Mappings and rows stored in DB: **Upload** (metadata), **ColumnMapping** (column index → semantic key), **CompanyRow** (one row per company, flexible JSONB).

### 2. User Profile & Resume

- **UserProfile**: name, target_role, experience_summary, skills (array or text), custom Q&A (JSON), preferences.
- **Resume**: file stored on disk or Vercel Blob; text extracted (PDF or plain text) and stored in `resume_text` for AI. No hardcoded column names or formats.

### 3. AI Prompt Engine

- **Inputs**: selected company row(s) (from DB), column mapping, user profile, resume text, free-form user prompt.
- **promptBuilderService**:
  - Injects: company context (from row + mapping), user profile, resume snippet, and user request.
  - Uses **templates** (e.g. "cold_email", "cover_letter", "research_summary", "interview_qa") selected by intent or a generic "custom" template.
  - Outputs a single structured prompt (system + user) for the model.
- **aiExecutionService**: sends to OpenAI (or swap provider), returns markdown/text; optionally save to **GeneratedOutput**.

### 4. Persistence

- Single user: one **User** and one **UserProfile** (or profile keyed by user id).
- All uploads, mappings, rows, saved prompts, and optional outputs are stored so the app "remembers" between sessions.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Flexible column mapping** | No hardcoded column names; works with any spreadsheet. Heuristics + AI inference. |
| **CompanyRow as JSONB** | Supports variable columns per upload; query by semantic keys derived from mapping. |
| **Modular prompt builder** | Easy to add templates and intents; clear separation between context assembly and AI call. |
| **Swappable AI provider** | Single interface (e.g. `generate(prompt) => string`); OpenAI first, others later. |
| **Next.js API + Server Actions** | API for upload/generate; Server Actions where they simplify forms and mutations. |

---

## Folder Structure (Target)

```
src/
  app/                    # App Router
    api/                  # API routes
    (dashboard)/          # Main app layout + pages
    layout.tsx, page.tsx
  lib/
    db/                   # Prisma client
    services/             # excel, column-inference, profile, prompt-builder, ai
    ai/
      prompts/            # Template functions
    types/                # Shared types
  components/             # React components
  hooks/
public/
prisma/
  schema.prisma
```

---

## Security & Deployment

- **Single-user**: no auth required for MVP; optional: simple password or NextAuth later.
- **File storage**: Vercel Blob or local `uploads/` with size limits; validate file types (xlsx, csv, pdf).
- **Env**: `DATABASE_URL`, `OPENAI_API_KEY`; no secrets in client.
- **Vercel**: serverless API routes; Prisma with connection pooling (e.g. PgBouncer) if needed.

This document is the blueprint; implementation follows in the codebase.
