# Gossip Society

Mekan–influencer iş birliği uygulaması. Ürün kararları, roller, durum makinesi ve veri modeli: @docs/PLAN.md

## Stack (kesin, değiştirme)

- Monorepo: pnpm workspaces + Turborepo
- `apps/mobile`: Expo + Expo Router, TanStack Query, Zustand
- `apps/admin`: Next.js App Router + Tailwind + shadcn/ui
- `apps/api`: NestJS + Prisma + PostgreSQL (PostGIS) + Redis/BullMQ
- `packages/shared`: Zod şemaları, ortak tipler, enum'lar
- Her yerde TypeScript strict. Yeni bağımlılık eklemeden önce sor.

## Komutlar

- Kurulum: `pnpm install`
- Altyapı: `docker compose up -d`
- Geliştirme: `pnpm dev`
- Test: `pnpm test`
- Lint ve tip kontrolü: `pnpm lint && pnpm typecheck`
- Migration: `pnpm --filter api prisma migrate dev`

## Kurallar

- İstek ve yanıt şemaları `packages/shared` içindeki Zod şemalarından gelir; aynı şemayı iki yerde yazma.
- Collaboration durumu yalnızca `CollaborationService` üzerinden değişir. Her geçiş `CollaborationEvent` olarak kaydedilir. Controller veya istemci durumu doğrudan yazmaz.
- Yetki kontrolü backend'de rol guard'larıyla yapılır; mobilde rol kontrolü sadece arayüz içindir.
- Para tutarları kuruş cinsinden integer tutulur, float kullanılmaz.
- Zamanlar UTC saklanır, gösterimde Europe/Istanbul'a çevrilir.
- Danışmanlık şirketinin henüz karar vermediği değerler (paket kotaları, prim tutarı, süreler) config veya veritabanında tutulur, sabit kodlanmaz.
- Gizli bilgiler `.env` dosyasında; `.env.example` güncel tutulur, `.env` commit edilmez.
- Kod, değişken ve commit mesajları İngilizce; kullanıcıya görünen metinler Türkçe.
- prototype/ eski vibe-coding demosudur; yalnızca ekran ve akış referansıdır. Oradan kod kopyalama, onu düzenleme, bağımlılıklarını kullanma.

## Çalışma şekli

- Kodlamadan önce düşün: varsayımlarını açıkça yaz; belirsizlik varsa tahmin etme, sor. Birden fazla yorum varsa seçenekleri söyle.
- Önce basitlik: istenen işi çözen en az kodu yaz. İstenmemiş özellik, gereksiz soyutlama, "ileride lazım olur" esnekliği ekleme.
- Cerrahi değişiklik: sadece görevle ilgili yerlere dokun. İlgisiz kodu yeniden düzenleme, biçimlendirme veya yorumları değiştirme.
- Hedefe göre çalış: işe başlamadan "bitti" kriterini belirle (geçen test, çalışan komut) ve o sağlanana kadar doğrula.
- Büyük işlerde önce plan çıkar, onay al, sonra uygula.
- Her mantıksal adımı küçük bir commit olarak bitir.

## Git

- `main` korumalı; her iş kendi branch'inde (`feat/...`, `fix/...`), PR ile birleşir ve diğer geliştirici inceler.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.