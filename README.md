# EstiMate — deploy to your own domain

This is a normal Vite + React project. No backend, no database — it runs
entirely in the browser and saves estimates to `localStorage`.

## 1. Run it locally (optional, to check it works)

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## 2. Push it to GitHub

Create a new repo (e.g. `estimate-app`) and push this folder to it. Both
Vercel and Netlify build straight from a GitHub repo, which also means every
future change you push redeploys automatically.

```bash
git init
git add .
git commit -m "EstiMate"
git branch -M main
git remote add origin https://github.com/<you>/estimate-app.git
git push -u origin main
```

## 3. Deploy (pick one — both are free for this)

### Option A — Vercel
1. Go to vercel.com → **New Project** → import your GitHub repo.
2. Framework preset: **Vite** (auto-detected). Build command `npm run build`,
   output directory `dist` — Vercel fills these in automatically.
3. Deploy. You'll get a URL like `estimate-app.vercel.app`.

### Option B — Netlify
1. Go to netlify.com → **Add new site** → **Import an existing project**.
2. Pick the repo. Build command `npm run build`, publish directory `dist`.
3. Deploy. You'll get a URL like `estimate-app.netlify.app`.

## 4. Connect your own domain

Once deployed, in the project's dashboard:

1. Go to **Domains** (Vercel) or **Domain management** (Netlify) → **Add
   domain** → enter e.g. `estimate.yoursite.com`.
2. It will show you a DNS record to add — normally a **CNAME** record:
   - Host: `estimate` (the subdomain part)
   - Value: the target it gives you (e.g. `cname.vercel-dns.com`)
3. Add that CNAME record at wherever your domain's DNS is managed (your
   domain registrar, or Cloudflare if you use it).
4. Wait for DNS to propagate (a few minutes to a few hours) — the host will
   show a green checkmark once it sees the record and issues an SSL
   certificate automatically.

If you want the bare root domain instead of a subdomain (`yoursite.com`
instead of `estimate.yoursite.com`), the host will give you an **A record**
to use instead of a CNAME — same process, just a different record type.

## Notes on data

- Estimates are saved in the visitor's own browser (`localStorage`), same as
  before — nobody else can see them, and clearing browser data clears them.
- If you later want estimates to sync across devices or be shared with
  other people, that needs a real backend (e.g. Supabase, same as your
  Postmark project) — happy to help wire that up when you're ready.
