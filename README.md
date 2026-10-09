# Gossip Society

Mekan–influencer iş birliği uygulaması. Ürün ve teknik kararlar: [docs/PLAN.md](docs/PLAN.md). Çalışma kuralları: [CLAUDE.md](CLAUDE.md).

## Yapı

- `apps/api` — NestJS + Prisma (port 3000)
- `apps/admin` — Next.js yönetim paneli (port 3001)
- `apps/mobile` — Expo + Expo Router (port 8081)
- `packages/shared` — Zod şemaları ve ortak tipler
- `prototype/` — eski demo; yalnızca ekran ve akış referansı

## Gereksinimler

Node 24, pnpm 11, Docker.

## Kurulum

```sh
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/mobile/.env.example apps/mobile/.env

pnpm install
docker compose up -d
pnpm --filter api prisma migrate dev
pnpm dev
```

Telefonda Expo Go ile denemek için `apps/mobile/.env` içindeki `EXPO_PUBLIC_API_URL` değerine bilgisayarın yerel ağ IP'sini yaz (ör. `http://192.168.1.10:3000`); telefon ve bilgisayar aynı ağda olmalı.

## Komutlar

- `pnpm dev` — üç uygulamayı birlikte başlatır
- `pnpm lint`, `pnpm typecheck`, `pnpm test`
- `pnpm --filter api prisma migrate dev` — migration
