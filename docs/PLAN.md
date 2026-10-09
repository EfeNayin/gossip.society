# Gossip Society — Ürün ve Teknik Plan

Bu dosya alınmış kararları içerir. Teknoloji yığını kesindir; değiştirmeden önce iki geliştirici birlikte karar verir.
İş modeline dair bazı noktalar danışmanlık şirketiyle teyit bekliyor (bkz. "Açık konular"). Teyit gelene kadar aşağıdaki varsayımlarla ilerlenir.

## 1. Ürün

Danışmanlık şirketi mekanlarla (restoran, kafe, spor salonu vb.) uygulama dışında anlaşır ve onları sisteme ekler.
Mekanlar iş birliği ilanı (Offer) açar. Influencer'lar başvurur, mekan onaylar, influencer mekanı ziyaret eder,
içerik üretip paylaşır, iki taraf birbirini puanlar.

Gelir modeli (varsayım):
- Temel takas barter: influencer mekanın hizmetini ücretsiz alır.
- Mekan platforma aylık abonelik öder. Abonelik uygulama içinden satılmaz (fatura veya web).
- Fark yaratan ek: performans primi. Influencer'ın getirdiği gerçek müşteri başına ek kazanç.

## 2. Roller

| Rol | Uygulama | Yetki |
|---|---|---|
| ADMIN | Admin web paneli | Mekan hesabı açar, influencer onaylar, ilan denetler, şikayet yönetir |
| VENUE_OWNER | Mobil | İlan açar, başvuru onaylar/reddeder, mekan profilini yönetir, personel ekler |
| VENUE_STAFF | Mobil | Yalnızca QR okutma (check-in) ve performans kodu kullanımı kaydı |
| INFLUENCER | Mobil | İlanları görür, başvurur, QR kimliği, içerik teslimi, profil ve portföy |

Mobil tek uygulamadır; giriş yapan kullanıcının rolüne göre farklı navigasyon gösterilir.

## 3. Farklılaşma özellikleri

| Özellik | Aşama |
|---|---|
| Performans kodu ve prim (iş birliğine özel kod, mekanda kullanım kaydı, prim) | MVP |
| Otomatik içerik doğrulama (Instagram Graph API ile etiketli paylaşım tespiti) | MVP |
| Yasal etiket koruması (#Reklam / #İşbirliği / "hediye olarak alındı" kontrolü) | MVP |
| Doğrulanmış portföy / medya kiti | MVP |
| İki taraflı şeffaflık (ilanda TL değeri, açık mekan puanları, otomatik zaman dilimi) | MVP |
| Statü ve seviye sistemi | Sürüm 2 |
| Boş saat pazarı + harita ("şu an yakınında") | Sürüm 2 |

## 4. İş birliği yaşam döngüsü (Collaboration)

Durum geçişleri yalnızca backend'deki tek bir servis üzerinden yapılır ve her geçiş loglanır. İstemci durumu doğrudan yazamaz.

```
APPLIED -> APPROVED -> SCHEDULED -> CHECKED_IN -> CONTENT_SUBMITTED -> VERIFIED -> COMPLETED
APPLIED -> REJECTED
APPROVED | SCHEDULED -> CANCELLED
SCHEDULED -> NO_SHOW
CHECKED_IN -> CONTENT_OVERDUE        (48 saat içinde içerik yoksa)
```

- APPLIED -> APPROVED: kontenjan ve abonelik kotası kontrol edilir.
- SCHEDULED: zaman dilimi seçilir; QR token ve performans kodu üretilir.
- CHECKED_IN: personel QR okutur; 48 saatlik içerik süresi başlar (BullMQ gecikmeli iş).
- VERIFIED: paylaşım Instagram API ile bulunur, yasal etiket doğrulanır.
- COMPLETED: iki taraf puanladı ya da puanlama süresi doldu.
- NO_SHOW / CONTENT_OVERDUE: otomatik ceza, güvenilirlik puanı düşer.

## 5. Teknoloji yığını (kesin)

Her katmanda TypeScript (strict).

| Katman | Seçim |
|---|---|
| Mobil | React Native + Expo (güncel SDK), Expo Router, EAS Build |
| Mobil veri | TanStack Query (sunucu verisi), Zustand (küçük istemci durumu) |
| Admin paneli | Next.js (App Router) + Tailwind + shadcn/ui |
| Backend | NestJS (Node.js LTS), REST |
| Veritabanı | PostgreSQL 16 + PostGIS, Prisma |
| Validasyon | Zod, `packages/shared` içinde; mobil ve backend aynı şemayı kullanır |
| Auth | NestJS + JWT (access + refresh), argon2 |
| Arka plan işleri | Redis + BullMQ |
| Dosya | Cloudflare R2 (S3 API), presigned URL ile doğrudan yükleme |
| Push | Expo Notifications |
| Sosyal API | Instagram Graph API (creator/business hesap zorunlu). TikTok Sürüm 2 |
| Harita | react-native-maps + PostGIS |
| Ödeme | iyzico |
| Altyapı | Docker + Docker Compose, GitHub Actions |
| İzleme | Sentry |
| Repo | pnpm workspaces + Turborepo |

Neden Supabase değil: Uygulamanın kalbi iş kuralları (durum makinesi, kotalar, puan/ceza, prim muhasebesi,
zamanlanmış kontroller). Bunlar tek yerde, test edilebilir NestJS servislerinde durmalı.

## 6. Repo yapısı

```
gossip-society/
├── apps/
│   ├── mobile/      # Expo — influencer, mekan sahibi, mekan personeli
│   ├── admin/       # Next.js — danışmanlık şirketi paneli
│   └── api/         # NestJS + Prisma
├── packages/
│   └── shared/      # Zod şemaları, ortak tipler, enum'lar
├── docs/
│   └── PLAN.md
├── docker-compose.yml   # postgres (postgis), redis
└── CLAUDE.md
```

## 7. Veri modeli (ilk taslak)

| Varlık | İçerik |
|---|---|
| User | e-posta, şifre hash'i, rol, durum (ACTIVE / PENDING / SUSPENDED) |
| InfluencerProfile | bağlı Instagram hesabı, doğrulanmış takipçi/etkileşim, şehir, kategori, seviye, güvenilirlik puanı |
| Venue / VenueBranch | mekan bilgisi, şubeler, konum (PostGIS), puan |
| VenueStaff | mekan ile kullanıcı arasındaki personel ilişkisi |
| Subscription | paket, dönem, kota sayaçları (aktif ilan, aylık eşleşme) |
| Offer | başlık, TL değeri, beklenen içerik, min. takipçi, kontenjan, geçerlilik tarihleri, zaman dilimleri |
| Collaboration | durum makinesi, QR token, zaman dilimi, durum geçmişi (CollaborationEvent) |
| ContentSubmission | Instagram medya ID, link, yasal etiket kontrolü, istatistikler |
| PromoCode / Redemption | iş birliğine özel kod ve mekanda kullanım kayıtları |
| Payout | influencer prim kayıtları ve ödeme durumu |
| Review | iki yönlü puan; iki taraf puanlayınca veya süre dolunca görünür |

## 8. Yasal ve uyum

- Ticaret Bakanlığı sosyal medya etkileyicileri kılavuzu ücretsiz/hediye hizmeti de kapsar; açıklama etiketi içerik tesliminde zorunlu adım.
- KVKK: aydınlatma metni ve açık rıza ekranları; sunucu konumu danışmanlık şirketiyle netleşir. Altyapı Docker ile taşınabilir tutulur.
- Mağaza: mekan aboneliği uygulama içinden satılmaz.

## 9. Fazlar

| Faz | Kapsam |
|---|---|
| Faz 0 — Temel | Monorepo, Docker, CI, auth ve roller, Prisma şeması, admin paneli iskeleti |
| Faz 1 — Çekirdek akış | Mekan hesabı (admin açar), ilan, keşfet, başvuru, onay, zaman dilimi, QR check-in |
| Faz 2 — Doğrulama | Instagram bağlama, paylaşım tespiti, yasal etiket kontrolü, 48 saat ve no-show işleri, puanlama |
| Faz 3 — Fark | Performans kodu ve prim, medya kiti, iyzico, push bildirimleri |
| Sürüm 2 | Seviye sistemi, boş saat pazarı ve harita, etkinlikler, TikTok, mesajlaşma |

## 10. Açık konular (danışmanlık şirketinden yanıt bekleniyor)

Influencer ödemesi ve komisyon, mekan paket fiyatları ve tahsilat şekli, mekan hesaplarını kimin açacağı,
influencer kabul şartları, Instagram hesap türü şartı, TikTok'un ilk sürümde olup olmadığı, lansman şehri,
etkinlikler ve ek hizmetler (boost, radar, prodüksiyon), KVKK/sunucu konumu, takvim.
Bu konulara bağlı kod yazılırken değerler config/enum ile esnek tutulur, sabit kodlanmaz.