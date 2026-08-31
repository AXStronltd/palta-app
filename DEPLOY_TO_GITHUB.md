# Deploy Palta to GitHub → Live Backend

This guide takes the Palta monorepo from your computer to GitHub, then to a
live backend on Render — with auto-deploy on every push.

Everything here is safe: no secret keys ever go into git.

---

## Part 1 — Push the code to GitHub (~5 min)

### 1. Create the repo on GitHub
- Go to https://github.com/new
- Name it `palta` (or anything you like)
- Keep it **Private** for now
- Do **NOT** tick "Add a README" (this repo already has one)
- Click **Create repository**

### 2. Push from your computer
Open a terminal in the `palta` folder and run:

```bash
# start git if not already started
git init
git add .
git commit -m "Initial commit — Palta full stack"

# connect to your new GitHub repo (replace YOUR-USERNAME)
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/palta.git
git push -u origin main
```

If it asks for a password, use a **GitHub Personal Access Token**
(GitHub → Settings → Developer settings → Personal access tokens),
not your account password.

Done — your code is now on GitHub, and the CI (tests + Docker build)
runs automatically on every push. Check the **Actions** tab to see it.

---

## Part 2 — Deploy the backend live on Render (~5 min)

Render gives you a free Node host + PostgreSQL + Redis, which is exactly
what the backend needs. The `render.yaml` in this repo sets it all up.

### 1. Create the services
- Go to https://render.com and sign in with GitHub
- Click **New → Blueprint**
- Select your `palta` repo
- Render reads `render.yaml` and shows 3 services to create:
  `palta-backend`, `palta-postgres`, `palta-redis`
- Click **Apply**

### 2. Fill in your secret keys
Render will prompt for the secrets marked `sync: false` in `render.yaml`.
Paste your real values (these live in Render, never in git):

| Key | What it is |
|-----|-----------|
| `ANTHROPIC_API_KEY` | Your Claude API key (for AI dispatch/support) |
| `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` | M-Pesa Daraja app credentials |
| `MPESA_SHORTCODE` / `MPESA_PASSKEY` | Your M-Pesa till/paybill config |
| `AFRICASTALKING_API_KEY` / `AFRICASTALKING_USERNAME` | SMS provider |

`JWT_SECRET` and `DATABASE_URL` / `REDIS_URL` are set automatically —
you don't touch those.

### 3. First deploy
Render builds the Docker image, runs migrations, and starts the API.
When it's live you'll get a URL like `https://palta-backend.onrender.com`.
Test it: open `https://palta-backend.onrender.com/health` — you should
see a healthy response.

### 4. Auto-deploy is now on
Every `git push` to `main` automatically redeploys the backend.
No manual steps ever again.

---

## Part 3 — Point the apps at the live backend

In the React Native apps (`apps/customer`, `apps/driver`), set the API
base URL to your Render URL. Look for the API config (usually an
`.env` or a `lib/api.js`) and set:

```
API_URL=https://palta-backend.onrender.com
```

Then rebuild the apps (Expo) and they talk to the live backend.

---

## What deploys where (summary)

| Piece | Host | How |
|-------|------|-----|
| Backend API + Postgres + Redis | **Render** | `render.yaml` blueprint, auto-deploy on push |
| HTML demo (`palta-index.html`) | **Netlify** | drag-and-drop, as you already do |
| Customer + Driver apps | **Expo / App stores** | `eas build` when ready to publish |

---

## Notes on cost & production

- The **free** Render tier is perfect for testing. It sleeps after
  inactivity (first request wakes it, ~30s). For real users, upgrade
  `palta-backend`, `palta-postgres`, and `palta-redis` to paid tiers
  (change `plan:` in `render.yaml` or in the dashboard).
- Add a custom domain (e.g. `api.paltas.io`) in Render → Settings → Custom Domains.
- The database is created empty. Run the seed once from Render's shell
  if you want demo data: `npm run seed --workspace=backend`.

---

## If you'd rather use Railway or Fly.io

The Docker image works anywhere. Render is the simplest because
`render.yaml` provisions the database + redis for you. Railway and Fly
also work — you'd just create the Postgres/Redis add-ons manually and
point `DATABASE_URL` / `REDIS_URL` at them.
