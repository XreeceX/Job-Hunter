# Prompt Generation Flow

This document describes how the AI prompt is built and executed.

## Inputs

1. **Selected company row(s)** – One or more `CompanyRow` records from the DB. Each has `data` keyed by semantic keys (e.g. `company_name`, `email`, `role`).
2. **User profile** – Name, target role, experience summary, skills, resume text, custom Q&A (from `UserProfile`).
3. **User request** – Free-form text (e.g. “Create a cold email to this company”).
4. **Intent hint (optional)** – `cold_email` | `cover_letter` | `research` | `interview_qa` | `custom`. Used to prepend template-style instructions.

## Pipeline

1. **Load context**  
   - Fetch profile (getOrCreateProfile).  
   - Fetch company rows by ID; keep order consistent with selection.

2. **Build prompt** (`prompt-builder.service`)  
   - **System:** Fixed prefix (you are a job search assistant; be concise and use exact details).  
   - **User message:**  
     - “User profile & resume” block: name, target role, experience, skills, resume excerpt, custom Q&A.  
     - “Company/companies” block: each selected row formatted as `key: value` from semantic keys.  
     - “User request” block: optional intent instruction + user’s free-form request.  
   - No hardcoded column names; all company data comes from row `data` and semantic keys.

3. **Execute AI** (`ai-execution.service`)  
   - Single call to OpenAI (e.g. `gpt-4o`) with system + user.  
   - Returns `{ text, model, usage }`.

4. **Persist (optional)**  
   - Save to `GeneratedOutput`: prompt snippet, request, output, company IDs.

## Intent instructions (prepended when hint set)

- **cold_email:** Short professional cold email; mention role if provided.  
- **cover_letter:** Tailored cover letter; use resume to highlight experience.  
- **research:** Summarize company and role for application/interview.  
- **interview_qa:** Answer common interview questions for this role/company using profile and resume.

## Swapping AI provider

Implement a function with the same shape as `generate(options)` in `ai-execution.service`: accept `{ system, user, model?, maxTokens? }`, return `Promise<{ text, model, usage? }>`. Replace the OpenAI call inside that module; API route and prompt builder stay unchanged.
