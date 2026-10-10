# Gossip Society

Mekan–influencer iş birliği uygulaması. Ürün ve teknik kararlar: [docs/PLAN.md](docs/PLAN.md). Çalışma kuralları: [CLAUDE.md](CLAUDE.md).

## Şu anki durum

Monorepo temeli hazırdır. Admin ve mobil uygulama şu anda API/veritabanı bağlantı durumunu gösterir; gerçek ürün ekranları henüz geliştirilmemiştir. `prototype/` tasarım ve akış referansıdır, kökteki geliştirme komutuyla açılmaz ve yeni uygulamalara kod olarak kopyalanmaz.

## Geliştirme düzeni

- Docker: PostgreSQL 16 + PostGIS ve Redis 7.
- Bilgisayar üzerinde Node: NestJS API, Next.js admin ve Expo mobil uygulaması.
- `packages/shared`: Zod şemaları ve ortak tipler.
- Her geliştiricinin kendi yerel veritabanı ve `.env` dosyaları vardır. Kod ve migration dosyaları Git üzerinden paylaşılır.

## Bir kez hazırlanacak araçlar

Her iki bilgisayarda Node **24.x**, pnpm **11.28.2**, Git ve çalışan Docker Desktop gerekir. Node ana sürümü `.nvmrc`, pnpm sürümü `package.json` ile sabitlenmiştir. Proje kökünde npm/yarn ile paket kurmayın; `pnpm-lock.yaml` ortak bağımlılık kaydıdır.

### macOS

1. Node 24 ve Git kurulu olmalı.
2. Docker Desktop'ı açın ve motorun hazır olmasını bekleyin.
3. pnpm yoksa Node ile gelen Corepack üzerinden etkinleştirin: `corepack enable pnpm`, ardından `corepack install --global pnpm@11.28.2`. Corepack sistem dizinine yazamıyorsa kullanıcıya ait ve PATH içinde bulunan bir dizini `--install-directory` ile kullanın.
4. iOS simülatörü için Xcode ve Xcode içinden iOS Simulator bileşeni gerekir. Fiziksel telefonla ilk deneme için simülatör zorunlu değildir.

PostGIS'in mevcut imajı amd64 olduğundan Compose dosyasında `platform: linux/amd64` açıkça tanımlıdır. Apple Silicon üzerinde Docker emülasyon kullanır; ilk indirme ve ilk açılış daha uzun sürebilir.

### Windows

1. Desteklenen bir Windows sürümünde WSL 2 ve donanım sanallaştırmasını etkinleştirin; Docker Desktop'ı WSL 2 altyapısıyla, Linux container modunda çalıştırın.
2. Windows tarafında Git ve Node 24 kurun. PowerShell'de `npm install --global pnpm@11.28.2` ile pnpm'i hazırlayın.
3. Repoyu örneğin `C:\dev\gossip.society` içine klonlayın. Aşağıdaki Node/pnpm komutlarını aynı Windows PowerShell ortamında çalıştırın. Bu düzen için uygulamaları ayrıca WSL içine kurmanız gerekmez.
4. Android emülatörü istenirse Android Studio daha sonra kurulabilir. Yerel iOS simülatörü yalnızca Mac'te çalışır.

Windows ile WSL arasında aynı `node_modules` klasörünü paylaşmayın. Node işlemlerini WSL'de çalıştırmayı seçerseniz ayrı bir Linux checkout ve Linux Node/pnpm kurulumu kullanın; fiziksel telefon bağlantısındaki WSL ağ yönlendirmesini ayrıca ayarlayın.

Resmi kaynaklar: [Docker Mac](https://docs.docker.com/desktop/setup/install/mac-install/), [Docker Windows](https://docs.docker.com/desktop/setup/install/windows-install/), [Expo ortam kurulumu](https://docs.expo.dev/get-started/set-up-your-environment/).

## İlk kurulum — Mac Terminal ve Windows PowerShell

Proje kökünde:

```sh
node --version
pnpm --version
docker info
pnpm env:setup
pnpm install --frozen-lockfile
pnpm infra:up
pnpm db:migrate
pnpm dev
```

- `env:setup`, dört `.env.example` dosyasından yerel ayarları oluşturur. Tekrar çalıştırıldığında mevcut ayarları **üzerine yazmaz**.
- `apps/api/.env` içinde `JWT_SECRET` zorunludur (en az 32 karakter) ve boş bırakılırsa API başlamaz. Rastgele bir değer üretmek için (Mac ve Windows): `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`; çıktıyı `JWT_SECRET=` satırına yazın. `env:setup` mevcut `.env` dosyalarını güncellemediği için daha önce oluşturduysanız `.env.example` içindeki yeni satırları (`JWT_SECRET`, `JWT_ACCESS_TTL_SECONDS`, `SESSION_TTL_SECONDS`, `LOGIN_RATE_LIMIT`, `LOGIN_RATE_WINDOW_SECONDS`, `REFRESH_RATE_LIMIT`, `REFRESH_RATE_WINDOW_SECONDS`; son altısının varsayılanı olduğu için yalnızca `JWT_SECRET` zorunludur) elle ekleyin. Secret'ı commit etmeyin.
- `infra:up`, servislerin sağlık kontrolleri başarılı olana kadar bekler.
- `db:migrate`, repoda bulunan migration dosyalarını uygular. Başkasının branch'ini aldıktan sonra da bu komutu kullanın.
- Veri modelini değiştirirken yeni migration oluşturmak için `pnpm --filter api exec prisma migrate dev --name meaningful_name` kullanın ve oluşan migration dosyasını PR'a ekleyin.

## Veritabanı: migration ve geliştirme seed'i

Komutlar Mac Terminal'de ve Windows PowerShell'de aynıdır; proje kökünde, `pnpm infra:up` ile veritabanı çalışırken kullanılır.

### Mevcut migration'ları uygulama

```sh
pnpm db:migrate
```

Repoda bulunan migration dosyalarını yerel veritabanına uygular (`prisma migrate deploy`). Veriyi silmez, veritabanını sıfırlamaz. Başkasının branch'ini aldıktan sonra da bu komut kullanılır. Ardından Prisma istemcisi gerekirse yeniden üretilir: `pnpm --filter api exec prisma generate` (`pnpm install` de bunu çalıştırır).

### Yeni migration oluşturma

Bu, yukarıdaki uygulama adımından ayrıdır ve yalnızca `apps/api/prisma/schema.prisma` değiştiğinde yapılır:

```sh
pnpm --filter api exec prisma migrate dev --create-only --name meaningful_name
```

Oluşan SQL dosyasını gözden geçirin, sonra `pnpm db:migrate` ile uygulayın ve migration dosyasını PR'a ekleyin. Prisma veritabanını sıfırlamayı önerirse onaylamayın; önce sorunu ekibe bildirin.

### Geliştirme seed'i (isteğe bağlı)

```sh
pnpm db:seed:dev
```

Yalnızca yerel geliştirme içindir; hiçbir migration, CI veya deployment adımında otomatik çalışmaz ve `NODE_ENV=production` iken çalışmayı reddeder. Bir admin, bir mekan sahibi, bir personel, bir aktif ve bir onay bekleyen influencer, iki şubeli bir örnek mekan oluşturur. E-postalar `@gossip-society.example` uzantılıdır ve hesaplar parolasız oluşturulur; aşağıdaki ayrı geliştirme parola komutu çalıştırıldıktan sonra API üzerinden giriş yapılabilir. Tekrar çalıştırmak güvenlidir: eksik kayıtları ekler, mevcut kayıtları değiştirmez veya silmez (elle değiştirdiğiniz hesap durumu dahil).

## Kimlik doğrulama (API)

Her başarılı giriş ayrı bir **oturum** (`AuthSession`) oluşturur. Oturumun mutlak bir son kullanma zamanı vardır (`SESSION_TTL_SECONDS`, varsayılan 7 gün) ve **yenilemeyle uzamaz**; süre dolunca yeniden giriş gerekir. Kısa ömürlü access token (`JWT_ACCESS_TTL_SECONDS`, varsayılan 15 dk) süresi dolunca refresh token ile yenilenir.

- `POST /auth/login` — `{ "email", "password" }`. E-posta kırpılır ve küçük harfe çevrilir; parola argon2 ile doğrulanır. Yanlış e-posta, yanlış parola ve parolası olmayan hesap aynı `401` yanıtını verir. Parola doğruysa ve hesap `PENDING` ya da `SUSPENDED` ise oturum ve token oluşmaz; `403` ve `ACCOUNT_PENDING` / `ACCOUNT_SUSPENDED` kodu döner. `ACTIVE` hesap için `200` ve şu gövde döner:
  ```json
  {
    "accessToken": "<JWT>",
    "accessTokenExpiresAt": "2026-10-10T12:15:00.000Z",
    "refreshToken": "<opak, 43 karakter>",
    "refreshTokenExpiresAt": "2026-10-17T12:00:00.000Z",
    "user": { "id": "…", "email": "…", "name": "…", "role": "…", "status": "…" }
  }
  ```
  Zamanlar UTC ISO 8601'dir. `refreshTokenExpiresAt` oturumun mutlak bitişidir; `accessTokenExpiresAt` hiçbir zaman bunu aşmaz.
- `POST /auth/refresh` — access token istemez; gövde `{ "refreshToken" }`. Başarıda `200` ve login ile aynı biçimde yeni bir access + refresh token çifti döner; eski refresh token tüketilmiş olur. Bilinmeyen, süresi dolmuş veya iptal edilmiş token için genel `401`. Oturumun kullanıcısı `ACTIVE` değilse `403` + `ACCOUNT_PENDING` / `ACCOUNT_SUSPENDED` döner ve oturum iptal edilir. **Daha önce kullanılmış bir refresh token tekrar sunulursa `401` döner ve o oturum tamamen iptal edilir** (yeni token'lar dahil). Bilinmeyen bir token hiçbir oturumu iptal etmez. Ayrı bir hız sınırı vardır (`REFRESH_RATE_LIMIT` / `REFRESH_RATE_WINDOW_SECONDS`).
- `POST /auth/logout` — geçerli access token ister, **yalnızca o oturumu** iptal eder ve `204` döner. Sonrasında o oturumun access ve refresh token'ları reddedilir; aynı kullanıcının diğer oturumları etkilenmez. İstemcinin gövdede veya sorguda gönderdiği oturum/kullanıcı kimliği yok sayılır. Access token süresi dolmuşsa önce `POST /auth/refresh` ile yenilenmeli, sonra çıkış yapılmalıdır. Tüm cihazlardan çıkış ve oturum listesi bu aşamada yoktur.
- `GET /auth/me` — `Authorization: Bearer <accessToken>` ister. İmza, algoritma, `sub` / `sid` / `exp` alanları ve süre doğrulanır; oturumun var olması, iptal edilmemiş ve süresi dolmamış olması ve token'daki kullanıcıya ait olması gerekir. Kullanıcı ve rolü **her istekte** veritabanından okunur: silinen kullanıcı `401`, `ACTIVE` olmayan kullanıcı `403` alır. Refresh token Bearer olarak kullanılamaz (JWT değildir). **`sid` içermeyen eski access token'lar `401` alır; oturum sistemine geçişte bir kez yeniden giriş gerekir.**
- Tüm endpoint'ler varsayılan olarak access token ister. Herkese açık olanlar `@Public()` ile işaretlenir (`/health`, `/auth/login`, `/auth/refresh`). `@Roles(...)` yalnızca belirtilen rollere izin verir. İstemcinin gönderdiği `role` / `status` alanları yok sayılır.
- **Rol kontrolü sahiplik kontrolü değildir.** `@Roles('VENUE_OWNER')` bir kullanıcının *herhangi* bir mekan sahibi olduğunu söyler, *o* mekanın sahibi olduğunu değil. Mekan/şube verisine erişen servisler sahipliği veya personel ilişkisini ayrıca kontrol etmelidir.
- Giriş ve yenileme denemeleri istemci IP'sine göre ayrı ayrı sınırlanır; aşılırsa `429`. Sayaç API sürecinin belleğindedir: yeniden başlatmada sıfırlanır, birden çok API örneğinde paylaşılmaz. API bir proxy arkasına alınırsa gerçek istemci IP'si için proxy ayarı gerekir.

### Token politikaları

- **Refresh token** JWT değildir: `crypto.randomBytes(32)` ile üretilen 256 bitlik rastgele değer (base64url). Veritabanına yalnızca SHA-256 hash'i yazılır; ham değer ne veritabanında ne de günlüklerde bulunur. Tek kullanımlıktır: her yenilemede tüketilir ve yenisi verilir. Tüketilmiş hash'ler oturumla birlikte silinene kadar saklanır, böylece eski bir token'ın tekrar sunulması fark edilir.
- Bir oturumda aynı anda en fazla **bir** kullanılmamış refresh token olabilir (veritabanı kısıtı). Aynı token ile eşzamanlı iki yenileme isteğinden en fazla biri başarılı olur; diğeri tekrar kullanım sayılır ve oturumu iptal eder. Yenileme ile çıkış yarışırsa iptal edilmiş oturum asla yeniden etkinleşmez.
- Oturum, token ve kullanıcı kontrolleri her istekte veritabanından yapılır; bu nedenle çıkış, askıya alma ve rol değişikliği access token süresi dolmasını beklemeden etkilidir.
- Süresi dolmuş oturum satırlarını temizleyen bir iş henüz yoktur (sonraki iş).

### İstemci entegrasyonu için notlar (bu PR yalnızca API sözleşmesini kapsar)

- Admin web (cookie + sunucu katmanı) ve mobil (güvenli depolama) istemcileri bu sözleşmeye göre yazılmıştır; ayrıntılar aşağıda ve "Mobil uygulama girişi" bölümündedir.
- **İstemci aynı oturum için aynı anda yalnızca tek bir yenileme isteği yürütmelidir.** Birden çok istek aynı anda `401` alırsa hepsi ayrı ayrı yenilemeye kalkmamalı; tek bir yenileme beklenmeli, sonuçla yeniden denenmelidir. Aynı refresh token ile eşzamanlı iki istek tekrar kullanım sayılır ve oturumu iptal edebilir.
- Yenilemeden gelen yeni refresh token'ı, eskisini kullanmadan önce kalıcı olarak saklayın. Yenileme yanıtı istemciye ulaşmadan bağlantı kopar ve yeni token kaybolursa eski token artık geçersizdir; kullanıcı yeniden giriş yapar.
- `refreshTokenExpiresAt` geçtiğinde ya da yenileme `401` verdiğinde kullanıcı giriş ekranına yönlendirilmelidir; `403` + `ACCOUNT_*` kodu hesap durumu ekranını gösterir.

### Entegrasyon testleri (PostgreSQL)

`pnpm test` veritabanı gerektirmez. Yenileme/çıkış yarışlarını ve transaction davranışını gerçek PostgreSQL üzerinde sınayan testler ayrıdır ve CI'da otomatik çalışmaz:

```sh
pnpm infra:up
pnpm db:migrate
pnpm --filter api test:integration
```

Testler kendi `itest-…@gossip-society.example` kullanıcılarını oluşturur ve yalnızca onları siler; seed hesaplarına dokunmaz. `apps/api/.env` içindeki `DATABASE_URL` kullanılır.

### Geliştirme hesaplarına parola verme (isteğe bağlı)

`pnpm db:seed:dev` hesapları parolasız oluşturur. Giriş denemek için, seed'den sonra parolayı **ortam değişkeniyle** verin (12–256 karakter; kodda sabit parola yoktur ve parola loglanmaz). Komutu aynı satırda ortam değişkeniyle çalıştırın, değeri kendiniz seçin:

```sh
# macOS (Terminal)
DEV_SEED_PASSWORD='kendi-gelistirme-parolaniz' pnpm db:passwords:dev
```

```powershell
# Windows (PowerShell)
$env:DEV_SEED_PASSWORD = 'kendi-gelistirme-parolaniz'; pnpm db:passwords:dev; Remove-Item Env:DEV_SEED_PASSWORD
```

Yalnızca seed'deki beş e-postada ve `passwordHash` boşken argon2 hash'i yazar. Mevcut hash'leri, rolleri ve hesap durumlarını değiştirmez; tekrar çalıştırmak güvenlidir. `NODE_ENV=production` iken çalışmayı reddeder; migration, CI veya deployment içinde çalışmaz. `pnpm db:seed:dev` ve bu komut için `JWT_SECRET` gerekmez, yalnızca `DATABASE_URL` yeterlidir. Örnek giriş (bash/zsh):

```sh
curl -X POST http://localhost:3000/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@gossip-society.example","password":"kendi-gelistirme-parolaniz"}'
```

## Yönetim paneli girişi (admin web)

`apps/admin` (Next.js) yalnızca **ACTIVE ADMIN** hesaplarının girebildiği bir giriş ekranı ve sade bir panel kabuğu içerir (kullanıcı adı, çıkış, API durumu). Geliştirme hesabı için `pnpm db:seed:dev` ve `pnpm db:passwords:dev` sonrasında `admin@gossip-society.example` ve seçtiğiniz geliştirme parolası kullanılır.

**Ortam ayarı:** `apps/admin/.env` içinde `API_URL` (örn. `http://localhost:3000`). Bu değer yalnızca sunucu tarafındadır, tarayıcıya gönderilmez; production'da zorunludur. Eski `NEXT_PUBLIC_API_URL` artık kullanılmaz. `env:setup` mevcut `.env` dosyalarını güncellemediği için dosya zaten varsa satırı elle ekleyin (geliştirmede `localhost:3000` varsayılır).

### Nasıl çalışır

- **Tarayıcı API ile hiç konuşmaz.** Giriş, çıkış ve yenileme Next.js sunucusunda (Server Action ve `proxy.ts`) yapılır ve API'ye oradan gidilir; API için CORS gerekmez.
- **Token'lar yalnızca HttpOnly cookie'dedir** (`gs_admin_at` erişim, `gs_admin_rt` yenileme): JavaScript okuyamaz, `localStorage` / `sessionStorage` kullanılmaz, HTML'e, istemci yanıtına ve günlüklere yazılmaz. Cookie'ler `SameSite=Lax`, `Path=/`; production'da `Secure` ve `__Host-` önekli. `Expires` değerleri API'nin bildirdiği token/oturum sürelerine eşittir, onları aşmaz.
- **Yetki sunucuda kontrol edilir:** panel her render'da `GET /auth/me` çağırır; yalnızca `ACTIVE` ve `ADMIN` geçer. Rol veya durum değişirse (yükseltme, askıya alma, oturum iptali) bir sonraki istekte etkili olur. `proxy.ts` yalnızca iyimser yönlendirme yapar (cookie yoksa `/login`); yetkilendirme kararı değildir.
- **Giriş:** `POST /auth/login`, ardından `GET /auth/me` ile rol doğrulanır. ADMIN olmayan veya `ACTIVE` olmayan hesap için cookie yazılmaz ve o girişte oluşan API oturumu `POST /auth/logout` ile iptal edilir. Türkçe mesajlar: hatalı bilgiler, `PENDING` / `SUSPENDED`, hız sınırı, bağlantı hatası, erişim yok.
- **Çıkış:** önce oturum bu süreçte "sona erdi" diye işaretlenir (aşağıya bakın), sonra `POST /auth/logout` ile sunucu oturumu iptal edilir ve cookie'ler silinir. API'ye ulaşılamazsa yerel cookie'ler yine silinir ama kullanıcıya sunucudaki oturumun iptal **edilemediği** söylenir (başarılı çıkış gibi gösterilmez).
- **Geçersiz oturumu sonlandırma (`/session/end`):** panel kullanılamaz bir oturum bulursa (süresi dolmuş, iptal edilmiş, ADMIN değil, hesap etkin değil) `/session/end` sayfasına yönlendirir. Bu sayfa **GET ile yalnızca okur**: cookie yazmaz, silmez, API'de çıkış yapmaz; geçerli bir ADMIN oturumunda panele geri yollar. Sonlandırma, sayfadaki formun otomatik gönderdiği **POST Server Action** ile yapılır (aynı CSRF kontrolüyle): tarayıcının o anki cookie'lerine bakar, gerçekten kullanılamaz durumdaysa API'de best-effort çıkış yapar, cookie'leri siler ve `/login?reason=…` adresine gider. Giriş sayfasında cookie yoksa kalınır, bu yüzden yönlendirme döngüsü oluşmaz; JavaScript kapalıysa sayfadaki düğme aynı POST'u yapar.
- **Cache:** kullanıcıya özel hiçbir veri `use cache` içine girmez; oturum okuyan her şey `Suspense` altında dinamik render edilir ve API çağrıları `cache: 'no-store'` kullanır.
- **CSRF:** durum değiştiren işlemler yalnızca POST Server Action'dır. Next.js'in `Origin` / `Host` karşılaştırmasına ek olarak her action `Origin` başlığını **zorunlu** tutar (Next.js başlık hiç yoksa isteği uyarıyla geçirir), `Host` ile eşleşmesini ve `Sec-Fetch-Site: cross-site` olmamasını arar. Cookie'ler `SameSite=Lax` olduğu için siteler arası POST'larla gönderilmez. Oturumu değiştiren hiçbir GET yoktur; `/session/end` GET'i yan etkisizdir ve cookie temizleme / API çıkışı yalnızca bu kontrolden geçen POST'tadır.

### Access token yenileme ve eşzamanlılık

Erişim token'ı (varsayılan 15 dk) dolunca yenileme **yalnızca `proxy.ts` içinde** yapılır (Server Component'ler cookie yazamaz; action ve route handler'lar proxy'den geçtiği için taze token ile çalışır). Her 401 körlemesine yenilenmez: yalnızca erişim cookie'si yok / süresi dolmuşsa (30 sn pay ile) ve yenileme cookie'si varsa, istek başına en fazla bir kez denenir. Yeni cookie'lerle bile API 401 verirse oturum bitmiştir ve girişe gidilir (aşağıdaki "proxy cookie silmez" kuralına bakın).

API, kullanılmış bir refresh token'ı tekrar görünce oturumu iptal eder; cookie'ler tüm sekmelerde ortak olduğu için aynı token ile birden çok istek (sekmeler, RSC prefetch'leri) aynı anda gelebilir. Bu yüzden:

1. Yenileme tek yerde (proxy) yapılır;
2. aynı refresh token için eşzamanlı istekler **tek bir API çağrısını** paylaşır (single-flight);
3. sonuç 15 saniye boyunca bellekte tutulur: yeni cookie'yi henüz almamış bir sekmenin eski token'la gelen geç isteği, tekrar kullanım sayılmak yerine aynı yeni çifti alır;
4. ağ hatası, `429` veya `5xx` olursa cookie'ler korunur ve sayfa "Sunucuya ulaşılamıyor" durumunu gösterir.

**Çıkış ile yenilemenin birlikte çalışması.** Çıkıştan sonra önbellekteki veya devam eden bir yenileme sonucu cookie'leri geri yazmamalı; ayrıca çıkıştan sonra yeniden giriş yapılmışsa eski bir yanıt yeni oturumun cookie'lerinin üzerine yazmamalıdır. Bunun için:

- Koordinatör her girişin refresh token zincirini (**oturum soyağacı**) bilir; çıkış bu soyağacını "sona erdi" diye işaretler (`end()`). İşaret yalnızca Map kaydını silmek değildir: devam eden ve önbellekteki sonuçlar da `ended` döner, soyağacındaki her token (eski ve yeni) için. Yeni bir giriş ayrı bir soyağacıdır, etkilenmez.
- Proxy, yenileme yanıtını cookie'ye yazmadan hemen önce (aynı senkron adımda) soyağacının bitip bitmediğini yeniden kontrol eder; bu adımın arasına bir çıkış giremez. Çıkış action'ı API'ye gitmeden **önce** soyağacını bitirir.
- **Proxy cookie silmez ve reddedilen/bitmiş oturumda cookie yazmaz.** Yalnızca yenileme başarılıysa ve oturum bitmemişse cookie yazar; aksi halde isteği "oturum yok" bilgisiyle sayfaya iletir. Cookie silme yalnızca tarayıcının *o anki* cookie'lerini gören Server Action'dadır. Böylece eski bir isteğin yanıtı, sonradan yapılmış bir girişin cookie'lerini silemez.
- **Paylaşılan durum `globalThis` üzerindedir.** Next.js `proxy.ts` ile Server Action'ı ayrı paketler halinde derler; bir üretim derlemesinde ikisinin modül örneklerinin **farklı** olduğu ölçüldü (aynı süreç, ayrı modül kopyaları). Modül düzeyinde bir koordinatör bu yüzden proxy ile logout arasında paylaşılmaz; koordinatör `globalThis[Symbol.for(...)]` üzerinde tek örnek olarak tutulur. Gerçek sunucuda modül düzeyine döndürüldüğünde üç çıkış senaryosunun üçü de başarısız olur, `globalThis` ile geçer.

**Sınırlar:**

- Bu durum **süreç içidir**: tek bir Node örneği için çalışır. Admin birden çok örnek / load balancer arkasında çalışırsa aynı token'ı aynı anda iki örnek yenileyebilir ve API oturumu iptal eder; bir örnekte yapılan çıkışı diğeri de göremez. Çözüm sticky routing veya paylaşımlı kilit/depo (örn. Redis) gerektirir; şimdilik eklenmedi.
- Bitmiş oturum işareti 10 dakika tutulur; daha geç gelen eski bir token API'ye gider ve oturum zaten iptal edildiği için reddedilir. Çıkış sırasında API'ye ulaşılamamışsa sunucu oturumu açık kalır ve bu süreden sonra gelen eski bir istek onu yeniden kullanabilir.
- Zaten tarayıcıya gönderilmiş bir yanıtı geri almak mümkün değildir: çıkıştan **önce** üretilmiş bir yenileme yanıtı çıkış yanıtından **sonra** tarayıcıya ulaşırsa yeni cookie'ler yazılır; ama o oturum sunucuda iptal edilmiştir, sonraki istekte `401` alır ve `/session/end` ile temizlenir.
- 15 saniyelik pencerede yeni token çifti sunucu belleğinde durur ve o sürede eski token'ın tekrar sunulması iptal tetiklemez.
- Pencereden sonra gelen eski token gerçek tekrar kullanım sayılır ve API oturumu iptal eder (meşru sahibin oturumu da kapanır, yeniden giriş gerekir). Yenileme yanıtı tarayıcıya ulaşmadan kaybolursa da kullanıcı yeniden giriş yapar.
- Panelin sayfaları Suspense içinde akışla geldiği için oturumu geçersiz bir ziyaretçiye önce kısa bir "Yükleniyor…" gösterilir, sonra `/session/end`'e yönlendirilir; veri sızmaz.

### Doğrulama

`pnpm --filter admin test`:

- yardımcı modüller (cookie ayarları, CSRF kontrolü, koordinatör, API istemcisi, yönlendirme kararları);
- **gerçek `proxy.ts` + Server Action bağlantısı** (`app/session-flow.test.ts`): proxy ve action'lar, Next.js'teki gibi ayrı modül kayıtlarından yüklenir; sahte bir API ve cookie jar'ı olan bir "tarayıcı" ile başarılı yenileme → çıkış → geç gelen eski token, çıkış sırasında devam eden yenileme, çıkıştan sonra yeniden giriş ve yönlendirme döngüsü olmaması sınanır. Backend oturumunun iptal kalması ve tarayıcı cookie'lerinin yeniden kurulmaması ayrı ayrı doğrulanır;
- Server Action'ların CSRF kontrolü (Origin yok / cross-site / başka host) ve `/session/end` GET'inin yan etkisizliği (`app/actions/auth.test.ts`, `app/session/end/session-end.test.ts`).

Gerçek tarayıcı akışı (giriş, yenileme, çıkış, cookie öznitelikleri, eşzamanlı yenileme/çıkış yarışları) Chrome (CDP) ve API'nin yanıtını geciktiren bir ara sunucuyla elle doğrulanmıştır; bu betikler depoda değildir, otomatik bir tarayıcı testi henüz yoktur.

## Mobil uygulama girişi

Tek mobil uygulama (`apps/mobile`, Expo SDK 57 + Expo Router) e-posta/parola ile girer ve **API'nin döndürdüğü kullanıcı kaydındaki role göre** sade bir ana ekran açar: `INFLUENCER`, `VENUE_OWNER`, `VENUE_STAFF`. Ekranlarda yalnızca ad, rol ve çıkış vardır (sahte ilan/istatistik/QR yok). `ADMIN` mobilde yetkili alan açmaz: giriş hemen `POST /auth/logout` ile iptal edilir, hiçbir şey saklanmaz ve "yönetim paneli web üzerinden kullanılır" mesajı gösterilir. Gezinti korumaları (`Stack.Protected`) yalnızca arayüzdür; her isteği API kendi yetki kontrolleriyle denetler. Geliştirme hesapları için `pnpm db:seed:dev` ve `pnpm db:passwords:dev` sonrasında `owner@`, `staff@`, `influencer@gossip-society.example` kullanılabilir.

### Token'lar nasıl saklanır ve yenilenir

- **Native (iOS/Android):** token'lar işletim sisteminin güvenli depolamasındadır (`expo-secure-store`: Keychain / Keystore), AsyncStorage'da değil. Erişim ve yenileme token'ı ile süreleri **tek bir kayıtta** saklanır; böylece çift her zaman birlikte yazılır, yarım yazılamaz. Okunurken doğrulanır; bozuk, eksik veya eski biçimli kayıt silinir ve giriş ekranı açılır. Token'lar günlüklere yazılmaz, arayüzde gösterilmez.
- **Web önizlemesi (`pnpm --filter mobile web`):** güvenli depolama web'de yoktur; token'lar yalnızca **bellekte** tutulur, `localStorage` / `sessionStorage` kullanılmaz. Sayfa yenilenince yeniden giriş gerekir. Kalıcı web oturumu ve BFF bu görevin dışındadır.
- **Açılışta ve arka plandan dönüşte** oturum `GET /auth/me` ile doğrulanır (arka plandan dönüşte en fazla 15 sn'de bir). Erişim token'ının süresi (30 sn payla) dolmuşsa önce yenilenir.
- **Yenileme:** aynı refresh token için aynı anda tek istek yürütülür (eşzamanlı çağrılar onu paylaşır); API `401` verirse token bir kez yenilenir ve çağrı **bir kez** tekrarlanır, yeni token da reddedilirse oturum biter (sonsuz döngü yok). Yenileme `401`/`403` ile reddedilirse oturum silinir ve girişe dönülür. Ağ hatası, `429` veya `5xx` ise oturum **silinmez**; "Sunucuya ulaşılamıyor" ekranı ve **Tekrar Dene** gösterilir.
- **Yarışlar:** her giriş, çıkış ve oturum sonu bir "nesil" sayacını artırır; eski nesilde başlamış bir yenileme/giriş sonucu, durumu veya depoyu değiştirmeden hemen önce senkron olarak kontrol edilir ve gerekiyorsa atılır. Depo yazmaları tek sıralı kuyruktan geçer. Böylece çıkıştan sonra gelen eski yenileme yanıtı oturumu yeniden kuramaz ve çıkış → yeniden giriş sonrasında yeni oturumu ezemez.
- **Çıkış:** yerel oturum ve depo anında temizlenir, sonra eldeki token'larla sunucu oturumu iptal edilir. Erişim token'ı dolmuşsa (logout için gerekir) önce yenilenir; yenileme reddedilirse oturum zaten geçersizdir. API'ye ulaşılamazsa yerel çıkış tamamlanır ve giriş ekranında sunucudaki oturumun iptal **edilemediği** yazar. Uygulama bu sırada kapatılırsa sunucu oturumu süresi dolana kadar açık kalabilir.

### Sınırlamalar

- **Native güvenli depolama ve "uygulamayı kapatıp yeniden açma" bu ortamda doğrulanmadı** (iOS simülatörü ve Android SDK/emülatörü yoktu); native paketlerin yalnızca derlendiği (`expo export`) görüldü. Gerçek cihazda/simülatörde şunlar elle denenmelidir: giriş → uygulamayı tamamen kapat → aç (oturum sürmeli), Keychain/Keystore'a yazılması, çıkış sonrası kayıt silinmesi. Tarayıcı önizlemesi native cihaz testi yerine geçmez.
- iOS Keychain kayıtları uygulama silinip aynı bundle ID ile yeniden kurulunca kalabilir (iOS davranışı); eski oturum API tarafından geçersizse ilk açılışta giriş ekranına düşülür.
- Yenilenen token çifti güvenli depoya yazılamazsa (nadir) oturum o çalışma boyunca bellekte sürer, bir sonraki açılışta eski (kullanılmış) refresh token reddedilir ve yeniden giriş gerekir.
- Mobil için otomatik arayüz testi yoktur; oturum mantığı Vitest ile test edilir (`pnpm --filter mobile test`), ekranlar tarayıcı önizlemesinde elle doğrulanmıştır.

## Açılacak adresler

- API kontrolü: <http://localhost:3000/health> — beklenen yanıt `{"status":"ok","db":"up"}`.
- Yönetim paneli: <http://localhost:3001> — önce giriş ekranı açılır; ADMIN hesabıyla girince API ve veritabanı durumu görünmeli.
- Mobil tarayıcı önizlemesi: <http://localhost:8081>. Expo terminalinde `w` de kullanılabilir. Ayrı bir mobil oturum gerekirse önce mevcut `pnpm dev` oturumunu durdurun; `pnpm --filter @gossip/shared build` sonrasında ayrı terminallerde `pnpm --filter api dev`, `pnpm --filter admin dev` ve `pnpm --filter mobile web` çalıştırın.

`prototype/` bu adreslerdeki uygulamadan ayrıdır. Buradaki bağlantı ekranını görmek, prototip tasarımının aktarılmış olduğu anlamına gelmez.

## Fiziksel telefonla deneme

1. Telefon ve bilgisayar aynı yerel ağda olsun; telefon üzerindeki Expo Go sürümü projenin Expo SDK sürümüyle uyumlu olmalı.
2. `apps/mobile/.env` içindeki `EXPO_PUBLIC_API_URL` değerini bilgisayarın yerel ağ adresine çevirin: örneğin `http://192.168.1.10:3000`. Telefonda `localhost` telefonun kendisidir.
3. Expo'yu yeniden başlatın. Telefonun tarayıcısından önce `http://BILGISAYAR_IP:3000/health` adresini kontrol edin.
4. Windows Güvenlik Duvarı gerekirse özel ağda Node için API 3000 ve Expo 8081 bağlantılarına izin vermelidir. PostgreSQL/Redis portlarını telefona açmak gerekmez.

Bilgisayarın IP adresi değişirse bu ayarı güncelleyin. Expo tunnel kullanmak API'yi otomatik olarak dışarı açmaz.

**API adresi, hangi ortamda ne yazılır (`apps/mobile/.env` → `EXPO_PUBLIC_API_URL`):**

| Ortam | Değer |
|---|---|
| Tarayıcı önizlemesi, iOS simülatörü | `http://localhost:3000` |
| Android emülatörü | `http://10.0.2.2:3000` (emülatörde `localhost` emülatörün kendisidir) |
| Fiziksel cihaz (Expo Go) | `http://BILGISAYAR_IP:3000` |

Değişiklikten sonra Expo'yu yeniden başlatın (`EXPO_PUBLIC_*` değerleri paket derlenirken gömülür). Tarayıcı önizlemesi API'ye tarayıcıdan gittiği için API'nin `CORS_ORIGINS` listesinde `http://localhost:8081` bulunmalıdır (varsayılan öyledir); native uygulamada CORS yoktur. `expo-secure-store` Expo Go'da çalışır, ayrıca yerel derleme gerekmez.

## Günlük çalışma

```sh
pnpm infra:up
pnpm db:migrate
pnpm dev
```

Uygulamaları durdurmak için terminalde `Ctrl+C`; veritabanı servislerini durdurmak için `pnpm infra:down`. Normal durdurma verileri korur. `docker compose down -v` yerel veritabanını siler; günlük durdurma için kullanmayın.

- Servis durumu: `pnpm infra:status`
- Servis günlükleri: `docker compose logs --tail=100 postgres redis`
- Kod kontrolleri: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`

## Sık karşılaşılan durumlar

- Docker bağlantı hatası: Docker Desktop'ın açık ve motorun hazır olduğunu kontrol edin.
- 5432 veya 6379 dolu: önce başka projenin servisi olup olmadığını kontrol edin. `.env` içindeki `POSTGRES_PORT` değişirse `apps/api/.env` içindeki `DATABASE_URL` portu da aynı olmalı.
- PostgreSQL kullanıcı/şifresini sonradan değiştirme: `.env` değişikliği mevcut Docker volume içindeki hesabı değiştirmez. Veriyi koruyacak hesap güncellemesini ayrıca yapın.
- API'ye ulaşılamıyor: API terminalindeki hatayı ve `/health` yanıtını kontrol edin; `.env` oluşturulduğundan ve migration'ların uygulandığından emin olun.
- Eski prototip paketleri veya eksik modül: proje kökünde `pnpm install --frozen-lockfile` çalıştırın. İşletim sistemleri arasında `node_modules` kopyalamayın.

## İki kişilik Git düzeni

Her iş ayrı `feat/...` veya `fix/...` branch'inde geliştirilir. Küçük PR açılır, diğer geliştirici inceler, kontroller geçince `main` ile birleştirilir. Kilit dosyası ve migration'lar paylaşılır; `.env`, `node_modules` ve yerel veritabanı paylaşılmaz. Branch koruması GitHub ayarlarında ayrıca etkinleştirilmelidir; yalnızca bu kuralın yazılı olması koruma sağlamaz.
