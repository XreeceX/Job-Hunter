# Run Job Hunter on your computer (non-technical guide)

This app is a normal website project. You do **not** need to write code, but you do need to install **Node.js** (the runtime) and set a few **environment variables** (passwords and connection strings the app reads from a file—not from GitHub).

---

## 1. Install Node.js

1. Open **[https://nodejs.org](https://nodejs.org)**.
2. Download the **LTS** version (recommended).
3. Run the installer. Leave the default options checked (including **Add to PATH** if offered).
4. Restart your terminal (or computer) after installing.

**Check it worked:** open **Terminal** (Mac) or **PowerShell** / **Command Prompt** (Windows) and run:

```bash
node -v
```

You should see a version number like `v20.x` or `v22.x`.

---

## 2. Get the project on your machine

**Option A — Git (if you use Git):**

```bash
git clone <your-repo-url>
cd job-hunter
```

**Option B — ZIP (no Git):**

1. On GitHub, open the repository.
2. Click the green **Code** button → **Download ZIP**.
3. Unzip the folder somewhere you can find it (e.g. Desktop).
4. Open a terminal **inside** that folder (`job-hunter`).

---

## 3. Install dependencies

In the project folder, run:

```bash
npm install
```

Wait until it finishes (may take a few minutes).

---

## 4. Create your `.env` file (secrets—never upload this)

1. In the project folder, find **`.env.example`**.
2. **Copy** it and rename the copy to **`.env`** (not `.env.txt` on Windows—enable “file name extensions” in File Explorer if needed).
3. Open `.env` in **Notepad**, **VS Code**, or any text editor.

You must fill at least:

| Variable | What it is |
|----------|------------|
| **`DATABASE_URL`** | Connection string for a **PostgreSQL** database (see step 5). |
| **`LLM_PROVIDER`** | `groq` or `openai`. |
| **`GROQ_API_KEY`** or **`OPENAI_API_KEY`** | API key for AI features (see step 6). |

**Never commit `.env` to Git**—it is listed in `.gitignore` for safety.

---

## 5. Database (PostgreSQL)

The app expects **PostgreSQL**. Easiest for beginners: a **free cloud database** so you do not install Postgres on your PC.

**Example: Neon**

1. Sign up at **[https://neon.tech](https://neon.tech)**.
2. Create a project and a database.
3. Copy the **connection string** (it looks like `postgresql://user:pass@host/db?sslmode=require`).
4. Paste it as **`DATABASE_URL`** in your `.env`**.

Then create the tables (one-time):

```bash
npx prisma generate
npx prisma db push
```

If this fails, double-check `DATABASE_URL` (no extra spaces, full string copied).

---

## 6. AI API key (Groq or OpenAI)

- **Groq:** sign up at **[https://console.groq.com](https://console.groq.com)**, create an API key, put it in **`GROQ_API_KEY`**, and set **`LLM_PROVIDER=groq`**.
- **OpenAI:** set **`LLM_PROVIDER=openai`** and **`OPENAI_API_KEY=...`**.

Without a key, some features fall back to **offline/template** mode with limited usefulness.

---

## 7. Resume and file storage (local vs Vercel)

- **On your computer:** leave **`BLOB_READ_WRITE_TOKEN`** empty. Uploaded resumes are stored in the **`uploads`** folder next to the project.
- **On Vercel:** you normally add **Vercel Blob** and set the token there—see the main **README.md**.

---

## 8. Start the app

```bash
npm run dev
```

Open a browser and go to **[http://localhost:3000](http://localhost:3000)**.

To stop the server, press **Ctrl+C** in the terminal.

---

## 9. What to do if something breaks

- **`command not found` for `node` or `npm`:** Node.js is not installed or not on PATH—reinstall Node and restart the terminal.
- **Database errors:** Check `DATABASE_URL` and run `npx prisma db push` again.
- **“API key” / AI errors:** Verify `LLM_PROVIDER` matches the key you set (Groq vs OpenAI).
- **Port 3000 in use:** Close other apps using that port or run `npx next dev -p 3001` and open `http://localhost:3001`.

---

## 10. Deploying to Vercel later

You can host the same project on **Vercel** and set the **same variable names** in **Project → Settings → Environment Variables** (no secrets in Git). See the main **README.md** for Vercel-specific notes (database pooling, Blob, etc.).
