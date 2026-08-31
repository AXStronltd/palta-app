# Palta — Deployment Guide

How to run Palta locally with Docker, and how to deploy it to a real host.

---

## Local: the whole stack in one command

Prerequisites: Docker + Docker Compose.

```bash
cp backend/.env.example backend/.env    # fill in secrets (or use defaults)
docker compose up --build
```

This starts:
- **Postgres** (port 5432)
- **Redis** (port 6379)
- **API** (port 4000) — waits for Postgres + Redis to be healthy, runs
  `prisma migrate deploy`, then starts.

First run, seed demo data:
```bash
docker compose exec api npm run seed
```

> **First-time migration note:** the repo ships with the Prisma *schema* but
> no committed `migrations/` folder yet (it's generated on a machine with
> database access, which this build environment didn't have). Before the
> first deploy, run once locally to create it:
> ```bash
> cd backend && npx prisma migrate dev --name init
> git add prisma/migrations && git commit -m "Add initial migration"
> ```
> After that, `prisma migrate deploy` (used by compose + CI) applies it
> everywhere. Until then, compose will start the API but the schema won't be
> created — generate the migration first.

Check it's alive:
```bash
curl localhost:4000/health          # liveness
curl localhost:4000/health/ready    # readiness (db + redis)
```

Stop: `docker compose down` (add `-v` to wipe the database volume).

---

## The image

The backend ships as a multi-stage Docker image (`backend/Dockerfile`):
- **build stage** installs deps + runs `prisma generate`
- **runtime stage** is a lean `node:22-slim` image running as non-root
- built-in `HEALTHCHECK` hits `/health`

Build + run standalone:
```bash
docker build -t palta-backend ./backend
docker run -p 4000:4000 --env-file backend/.env palta-backend
```

---

## CI/CD (GitHub Actions)

`.github/workflows/ci.yml` runs on every push/PR to main:
1. Spins up real Postgres + Redis as service containers.
2. Installs deps, generates Prisma client, applies migrations.
3. Runs the Jest suite (`npm test`).
4. Builds the Docker image (only if tests pass).

To add **continuous deployment**, extend the `docker` job to push the image
to a registry (GHCR/ECR/Docker Hub) and trigger your host's deploy. Sketch:

```yaml
  deploy:
    needs: docker
    runs-on: ubuntu-latest
    steps:
      - run: echo "push image + call host deploy webhook / CLI here"
```

---

## Deploying to a cloud host

The image runs anywhere containers run. Common paths:

**Managed container hosts (simplest):** Fly.io, Render, Railway.
- Point them at the repo / `backend/Dockerfile`.
- Add a managed **Postgres** and **Redis** (each offers these).
- Set env vars from `.env.example` (real secrets, strong `JWT_SECRET`).
- Ensure the **WebSocket / Socket.IO** port is allowed (it shares port 4000).

**Kubernetes / ECS (scale):**
- Deploy the image with 2+ replicas behind a load balancer.
- Use `/health` for liveness and `/health/ready` for readiness probes.
- Redis is REQUIRED with multiple replicas (OTP, dispatch offers, and rate
  limits are shared through it — the in-memory fallback won't coordinate
  across pods).
- Run `prisma migrate deploy` as a pre-deploy job, not in every replica.

---

## Production checklist (deployment-specific)

- [ ] Strong `JWT_SECRET` (`openssl rand -hex 32`).
- [ ] `REDIS_URL` set (never rely on the in-memory fallback in prod).
- [ ] `NODE_ENV=production` (enables JSON logs, disables dev shortcuts).
- [ ] Remove dev shortcuts: `AUTO_APPROVE_KYC`, `devCode` in OTP responses.
- [ ] TLS termination in front of the API (host LB or a proxy).
- [ ] Lock CORS to your real app origins (currently `*`).
- [ ] Managed Postgres backups enabled.
- [ ] Log aggregation pointed at stdout (JSON lines) — Datadog, Loki, etc.
- [ ] Set `ENABLED_COUNTRIES` to only the countries whose providers are wired.

See `LAUNCH_CHECKLIST.md` for the full product/security launch list.
