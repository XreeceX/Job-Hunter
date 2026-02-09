# Security Guide

## ⚠️ IMPORTANT: Secrets Rotation Required

**Before making this repository public**, you must rotate the following credentials that were previously committed to git history:

1. **GROQ_API_KEY** - Generate a new API key from [Groq Console](https://console.groq.com/)
2. **BLOB_READ_WRITE_TOKEN** - Generate a new token from Vercel Dashboard → Storage → Blob
3. **DATABASE_URL** - Consider rotating the database password in Neon console (optional but recommended)

## Environment Variables

All sensitive configuration is stored in environment variables. Never commit:
- `.env` files
- API keys
- Database connection strings with credentials
- Tokens or secrets

### Required Environment Variables

Set these in Vercel Dashboard → Project Settings → Environment Variables:

- `DATABASE_URL` - PostgreSQL connection string (from Neon or your database provider)
- `LLM_PROVIDER` - Either `groq` or `openai`
- `GROQ_API_KEY` - Your Groq API key (if using Groq)
- `OPENAI_API_KEY` - Your OpenAI API key (if using OpenAI)
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token (optional, for resume storage)

### Local Development

1. Copy `.env.example` to `.env`
2. Fill in your actual credentials (never commit `.env`)
3. The `.env` file is already in `.gitignore`

## Files Never to Commit

- `.env` and `.env.local` files
- `node_modules/`
- `uploads/` directory (local file storage)
- Any files containing API keys or secrets

## Making Repository Public

Before making this repo public:

1. ✅ Rotate all exposed credentials (see above)
2. ✅ Verify `.env.example` contains only placeholders
3. ✅ Ensure `.gitignore` includes all sensitive files
4. ✅ Update Vercel environment variables with new credentials
5. ✅ Test that the app still works on Vercel after rotation

## Vercel Deployment

The app will continue to work on Vercel after making the repo public because:
- Environment variables are set in Vercel Dashboard (not in the repo)
- The code reads from `process.env` which Vercel injects at runtime
- No secrets are hardcoded in the source code

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly.
