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

## Mekan sahibi, mekan ve ilk şube oluşturma (admin)

Admin panelinde **Mekanlar** (`/venues`, sayfalı liste) ve **Yeni Mekan** (`/venues/new`) bulunur. Form tek işlemde yeni bir mekan sahibi hesabı (`VENUE_OWNER`, `ACTIVE`), ona bağlı mekanı ve ilk şubeyi oluşturur. Sahip daha sonra mobil uygulamada **mevcut girişle** (e-posta + başlangıç parolası) girer.

### Başlangıç parolası (önemli)

- **Parolayı admin belirler** (en az 12, en fazla 256 karakter; baş/son boşluklar kırpılmaz). Uygulama **e-posta veya mesaj göndermez**: parolayı mekan sahibine **uygulama dışında** siz iletirsiniz.
- Parola yalnızca argon2id hash'i olarak saklanır ve **sonradan görüntülenemez**; form bunu açıkça yazar. Parola; yanıtlarda, listede, URL'de, başarı mesajında, hata durumunda Server Action yanıtıyla geri gönderilen form verisinde ve günlüklerde yer almaz (hata sonrası parola alanı boşalır).
- Bu parola **geçici veya tek kullanımlık değildir** ve değiştirmeyi zorunlu kılan bir akış yoktur. **Parola değiştirme/sıfırlama ve e-posta daveti sonraki görevlerdir.**

### API

| Uç nokta | Rol | Açıklama |
|---|---|---|
| `POST /admin/venues` | `ADMIN` | `{ owner: {name, email, password}, venue: {name, description?}, branch: {name, city, address} }`. `201` ile güvenli mekan kaydı (sahip/şube özeti, parola veya hash yok). Rol ve durum her zaman sunucuda `VENUE_OWNER` / `ACTIVE` olarak atanır; istemcinin gönderdiği `role`, `status`, `ownerId` yok sayılır. |
| `GET /admin/venues?page&pageSize` | `ADMIN` | Yeniden eskiye, kararlı sıralı (`createdAt`, ardından `id`); `pageSize` en fazla 50 (varsayılan 20), aşılırsa `400`. `total` / `totalPages` döner. |
| `GET /venues/mine` | yalnızca `VENUE_OWNER` | Oturumdaki kullanıcının **kendi** mekan ve şubeleri; `ownerId` istemciden alınmaz. ADMIN, INFLUENCER ve VENUE_STAFF için bu uç nokta şimdilik kapalıdır (`403`). Sonraki mobil mekan ekranının temelidir. |

- Hesap, mekan ve şube **tek transaction**'da oluşur; hata olursa hiçbiri kalmaz. Argon2 hash'i transaction'dan önce hesaplanır.
- **E-posta** kırpılır ve küçük harfe çevrilir. Zaten kullanılan e-posta `409` + `EMAIL_ALREADY_EXISTS` döner; mevcut hesap **değiştirilmez**, mekan sahibi yapılmaz, ona mekan bağlanmaz. Eşzamanlı aynı e-posta isteklerinde veritabanı unique kısıtı korur: biri `201`, diğerleri `409` alır.
- Sahip başına birden fazla mekan modeli korunur, ama **mevcut sahibe mekan ekleme** bu görevde yoktur. Ek şube, mekan düzenleme/silme, personel, abonelik/kota, ilan ve konum da yoktur.
- Rol kontrolü sahiplik kontrolü değildir: `/venues/mine` hangi mekanların döneceğini oturumdaki kullanıcı kimliğiyle belirler.

### Admin formunun davranışı

- Her sayfa ve her işlem sunucuda, o istek için admin doğrulamasıyla başlar; durum değiştiren işlem aynı CSRF kontrolünden (zorunlu `Origin`) geçer. Token'lar tarayıcıya açılmaz.
- Alan hataları, e-posta çakışması (e-posta alanında), yükleme durumu, boş liste, bağlantı hatası ve başarı Türkçe gösterilir. Çift gönderim engellenir; parola alanı maskelidir (isteğe bağlı Göster/Gizle).
- **Yanıt kaybolursa otomatik tekrar yoktur**: istek bir hesap oluşturduğu için, ikinci bir deneme yinelenen kayıttan ayırt edilemez. Form "oluşturulup oluşturulmadığı bilinmiyor" der ve önce **mekan listesini kontrol etmenizi** önerir.
- Başarıda listeye (`/venues?created=1`) yönlendirilir; form ve içindeki parola kaybolur.

### Doğrulama

`pnpm test` (HTTP testleri ve admin testleri) ve gerçek PostgreSQL üzerinde `pnpm --filter api test:integration` (transaction geri alma, unique kısıtı, 8 eşzamanlı aynı e-posta, e-posta yazım farkları, oluşturulan sahibin gerçek girişi, sahip yalıtımı, sayfalama; yalnızca `itest-` verileriyle) kullanılır. Admin akışı ayrıca gerçek Chrome ile üretim derlemesinde elle doğrulanmıştır (otomatik tarayıcı testi yoktur; CSRF reddi tarayıcıda değil birim testlerle doğrulanmıştır).

## İlanlar, abonelik ve kota (yalnızca API)

Bu aşama **yalnızca API ve ortak şemalardır**: mobil/admin ekranı, influencer keşfi, başvuru/onay, ziyaret saatleri/slotlar, QR ve ödeme yoktur. Gerçek paket fiyatları ve kota değerleri henüz belirlenmemiştir; kota değerleri veritabanındaki paket satırından okunur, kodda sabit değildir.

### Durumlar ve akış

`Offer` bir **şubeye** bağlıdır (mekan, dolayısıyla sahip şube üzerinden bulunur; `ownerId`/`venueId` tekrarlanmaz). Durumlar: `DRAFT` → `PUBLISHED` → `SUSPENDED`.

- Mekan sahibi taslak oluşturur ve düzenler (**yalnızca `DRAFT` düzenlenebilir**), sonra ayrı **Yayınla** işlemiyle doğrudan yayınlar. Yayın öncesi admin onayı yoktur.
- Admin yayındaki ilanı **zorunlu gerekçeyle** askıya alabilir (`PUBLISHED → SUSPENDED`); işlemi yapan admin ve zaman kaydedilir. Sahip askıdaki ilanı yeniden yayınlayamaz; admin için yeniden açma, silme veya içerik düzenleme yoktur.
- Geçerlilik başlangıç/bitiş tarihleri vardır (UTC saklanır, `Z` veya ofsetli ISO 8601 kabul edilir). Hizmet değeri **kuruş cinsinden integer**dır (pozitif), kontenjan pozitif, minimum takipçi negatif olmayan tamsayıdır. Bu kurallar hem şemada hem veritabanında `CHECK` ile korunur.
- İstemci `status`, `ownerId`, `venueId`, yayın/askıya alma alanları gönderse de yok sayılır.

### Uç noktalar

| Uç nokta | Rol | Açıklama |
|---|---|---|
| `POST /offers/mine` | `VENUE_OWNER` | Kendi şubelerinden birinde `DRAFT` oluşturur (`branchId` gövdede). Başkasının/olmayan şube → `404`. İsteğe bağlı `Idempotency-Key` başlığı: aşağıya bakın. |
| `GET /offers/mine?page&pageSize&status` | `VENUE_OWNER` | Kendi ilanları, yeniden eskiye, kararlı sıralı; `pageSize` ≤ 50. |
| `GET /offers/mine/:id` | `VENUE_OWNER` | Kendi ilanı; başkasınınki `404`. |
| `PUT /offers/mine/:id` | `VENUE_OWNER` | Taslağı düzenler (şube değişmez). `DRAFT` değilse `409 OFFER_NOT_DRAFT`. |
| `POST /offers/mine/:id/publish` | `VENUE_OWNER` | `DRAFT → PUBLISHED`, kota kontrolüyle. |
| `GET /admin/offers?page&pageSize&status` | `ADMIN` | Tüm ilanlar (mekan, sahip ve askıya alma bilgisiyle). |
| `GET /admin/offers/:id` | `ADMIN` | Tek ilan. |
| `POST /admin/offers/:id/suspend` | `ADMIN` | `{ "reason" }` zorunlu; yalnızca `PUBLISHED`. |

Sahip uç noktaları `ACTIVE` `VENUE_OWNER` ister; ADMIN/INFLUENCER/VENUE_STAFF `403`. İş kuralı hataları `409` ve şu kodlarla döner: `NO_ACTIVE_SUBSCRIPTION`, `QUOTA_EXCEEDED`, `OFFER_NOT_DRAFT`, `OFFER_EXPIRED`, `OFFER_NOT_PUBLISHED`.

### Abonelik ve kota kuralları

- **Paket** (`SubscriptionPlan`) ve mekana bağlı dönemli **abonelik** (`Subscription`, `[başlangıç, bitiş)` UTC) veritabanında düzenlenebilir veridir; fiyat/tahsilat alanı yoktur. Paket `activeOfferQuota` (aktif ilan kotası) ve `monthlyMatchQuota` (aylık eşleşme) taşır; aylık eşleşme kotası **iş birliği onayında** uygulanır (aşağıdaki "İş birliği başvurusu ve onayı" bölümü).
- **Çakışma kuralı:** aynı mekanın abonelik dönemleri **çakışamaz**; bu, PostgreSQL **exclusion constraint** ile garanti edilir (`btree_gist` eklentisi gerekir; migration `CREATE EXTENSION IF NOT EXISTS btree_gist` çalıştırır, dolayısıyla migration'ı uygulayan veritabanı kullanıcısının buna yetkisi olmalıdır). Dönemler yarı açık olduğu için biri, öncekinin bittiği anda başlayabilir. Böylece bir anda en fazla bir geçerli abonelik vardır ve uygulanacak kota belirsiz kalmaz. `endsAt > startsAt` ayrıca `CHECK` ile zorunludur.
- **Yayınlama** için mekanın **şu an geçerli** bir aboneliği olmalı (`startsAt ≤ şimdi < endsAt`); yoksa `NO_ACTIVE_SUBSCRIPTION`. Yeni oluşturulan gerçek mekanlara otomatik abonelik verilmez.
- **Aktif ilan** = `PUBLISHED` ve `validUntil` henüz gelmemiş ilan; **gelecek başlangıç tarihli yayınlar da kotayı kullanır**. `DRAFT`, `SUSPENDED` ve süresi dolmuş ilanlar kotaya dahil değildir. Süre dolması için arka plan işi yoktur; sorgular tarihe bakar. Kota doluysa `QUOTA_EXCEEDED`. Bitişi geçmiş ilan yayınlanamaz (`OFFER_EXPIRED`).
- **Askıya alma** ilanı `PUBLISHED` olmaktan çıkardığı için kotadan hemen düşer.
- **Eşzamanlılık ve kilit düzeni:** taslak **düzenleme** ve **yayınlama** aynı düzeni kullanır: tek transaction ve işe ilgili **mekanın satırını `SELECT … FOR UPDATE` ile kilitleyerek** başlar. Aynı mekanın bu işlemleri bu yüzden sırayla çalışır; sahiplik, durum, tarihler, abonelik ve aktif ilan sayısı kilitten **sonra** güncel veriden okunur. Böylece (a) son boş hak için yarışan farklı ilanlar kotayı aşamaz ("say, sonra kilitsiz güncelle" yarışı yoktur) ve (b) yayınlama bir taslağı doğruladıktan sonra, yayınlamadan önce taslak değiştirilemez (düzenleme kilidi bekler, yayın bitince `OFFER_NOT_DRAFT` alır). Kilit sırası: önce mekan satırı, sonra ilan satırları; hiçbir işlem ikinci bir mekan kilidi almaz, ilan satırını mekandan önce tutmaz, askıya alma ise tek bir koşullu `UPDATE`'tir ve mekan kilidi almaz; bu yüzden döngü ve deadlock oluşmaz. Farklı mekanlar birbirini beklemez. Reddedilen işlem hiçbir şey yazmaz ve rollback ile kilidi bırakır.
- **Saat:** yayınlamada "şimdi" **kilit beklemesinden sonra** bir kez okunur; abonelik geçerliliği, ilanın bitişi ve kotadaki "aktif ilan" sayımı aynı güncel zamanı kullanır. Kilidi beklerken aboneliği veya ilanın süresi dolan bir istek eski zamanla kabul edilmez; beklerken süresi dolan bir ilanın boşalttığı kota hakkı kullanılabilir.
- **Tekrar yayınlama:** aynı ilan için ikinci istek, ilan zaten `PUBLISHED` ise `200` ile ilanı **değişmeden** döndürür (yayın zamanı değişmez) ve ikinci bir kota tüketmez; `SUSPENDED` ilan için `409`.

### Influencer ilan keşfi (`/discover/offers`)

| Uç nokta | Rol | Açıklama |
|---|---|---|
| `GET /discover/offers?page&pageSize` | `INFLUENCER` | Şu anda görünür ilanlar, sayfalı (`pageSize` ≤ 50, varsayılan 20). |
| `GET /discover/offers/:id` | `INFLUENCER` | Tek ilanın ayrıntısı; görünür değilse `404`. |

- **Kim:** yalnızca `ACTIVE` `INFLUENCER` (global guard `ACTIVE` ister). Misafir keşfi yoktur: token olmadan `401`; mekan sahibi, personel ve admin `403`. Yol bilerek `/offers` altında değildir, `/offers/mine` ile çakışmaz. Salt okunurdur.
- **Görünürlük (tek kural, liste ve detay aynı):** `status = PUBLISHED` **ve** `validFrom <= şimdi < validUntil`. Taslak, askıdaki, henüz başlamamış ve süresi dolmuş ilanlar ne listede ne detayda görünür; "şimdi" istek başına bir kez okunur (başlangıç dahil, bitiş hariç). Listeden sonra askıya alınan veya süresi dolan ilan detayda **hemen** `404` olur; görünmeyen ile hiç olmayan ilan aynı `404`'tür. Aboneliğe bakılmaz: yayındaki ilan süresi bitene kadar görünür.
- **Sıralama:** `publishedAt` azalan, eşitlikte `id` azalan (kararlı). Canlı bir listeyi sayfalarken ilanlar arada yayınlanır/askıya alınır/biterse sayfa sınırı kayabilir; bu sayfalamanın doğasıdır.
- **Yanıt (`packages/shared`, `discover.ts`):** liste kartı: `id`, başlık, hizmet, değer (kuruş, integer), beklenen içerik, minimum takipçi, tarihler (UTC), mekan adı, şube adı/şehir. Detay ayrıca: açıklama, **toplam** kontenjan ve şube adresi. Yanıt şemayla ayrıştırılır, listelenmeyen her alan atılır: mekan sahibi e-postası/kimliği, kullanıcı, admin, abonelik/paket, durum geçmişi, mekan ve şube kimlikleri **yoktur**. Başvuru modeli olmadığı için kontenjan "kalan yer" olarak sunulmaz. Yeni model/migration yoktur.
- **Takipçi şartı:** `minFollowers` yalnızca koşul olarak gösterilir; doğrulanmış Instagram verisi olmadığı için otomatik uygunluk denetimi veya takipçi bilgisi üretilmez.

### İş birliği başvurusu ve onayı (`/collaborations`)

Influencer yayındaki bir ilana **bir kez** başvurur; mekan sahibi onaylar veya reddeder. Bu görev yalnızca `APPLIED`, `APPROVED` ve `REJECTED` durumlarını uygular; planın sonraki durumları (zaman dilimi, check-in, içerik, iptal, no-show...) **yoktur**. Mobil/admin ekranı yoktur, yalnızca API.

| Uç nokta | Rol | Açıklama |
|---|---|---|
| `POST /collaborations/mine` | `INFLUENCER` | Başvuru: `{ "offerId", "acceptTerms": true }`. `201`, `APPLIED`. |
| `GET /collaborations/mine?page&pageSize&status` | `INFLUENCER` | Kendi başvuruları, yeniden eskiye (≤ 50). |
| `GET /collaborations/mine/:id` | `INFLUENCER` | Kendi başvurusu: kabul edilen şartlar ve geçmiş. Başkasınınki `404`. |
| `GET /collaborations/received?page&pageSize&status&offerId` | `VENUE_OWNER` | Yalnızca kendi mekanlarının ilanlarına gelen başvurular. |
| `GET /collaborations/received/:id` | `VENUE_OWNER` | Ayrıntı: adayın temel profili, şartlar, geçmiş. Başkasınınki `404`. |
| `POST /collaborations/received/:id/approve` | `VENUE_OWNER` | `APPLIED → APPROVED`. Gövde yok. |
| `POST /collaborations/received/:id/reject` | `VENUE_OWNER` | `APPLIED → REJECTED`. Gövde yok. |

- **Kimlik:** influencer ve sahip her zaman oturumdan gelir; gövde/sorgu/yol hiçbir kullanıcı, durum, şart, zaman veya event kabul etmez (bilinmeyen alanlar atılır). `ACTIVE` hesap ve rol global guard'larla denetlenir.
- **Başvuru kuralları:** ilan **yayında ve şu an geçerli** olmalı (`PUBLISHED` ve `validFrom <= şimdi < validUntil`, keşifle aynı kural); görünmeyen/olmayan ilan `404`. `(offerId, influencerId)` **benzersizdir**: ikinci başvuru (ret sonrası dahil) mevcut kaydı değiştirmez, `409 ALREADY_APPLIED`; eşzamanlı başvurular tekil indekste yarışır ve tek kayıt bırakır. Başvuru **yer ayırmaz**.
- **Koşul kabulü:** `acceptTerms` tam olarak `true` olmalı (aksi `400`). Kabul zamanı (`termsAcceptedAt`) ve kabul edilen şartlar (başlık, hizmet, değer [kuruş], beklenen içerik, minimum takipçi, geçerlilik) **sunucuda ilandan** kopyalanıp başvuruyla saklanır (`termsSnapshot`); istemci şart gönderemez. İlan sonradan değişse de anlık görüntü değişmez. Minimum takipçi otomatik doğrulanmaz, mekan sahibi değerlendirir.
- **Mekan sahibinin gördüğü aday:** ad ve (varsa) profil: şehir, biyografi, **kendi beyan ettiği** Instagram kullanıcı adı (doğrulanmamış). Takipçi sayısı, puan veya doğrulama **uydurulmaz**; e-posta, parola özeti, rol ve kimlikler yanıtta yoktur. Profili olmayan aday için `profile: null`.
- **Geçmiş:** her oluşum ve geçiş `CollaborationEvent` olarak (önceki/yeni durum, işlemi yapan kullanıcı, zaman) **aynı transaction'da** yazılır; oluşumda önceki durum `null`'dır. Durum yalnızca `CollaborationService` üzerinden değişir. Veritabanı `CHECK` kısıtları durum-alan tutarlılığını ve izinli geçişleri (`null → APPLIED`, `APPLIED → APPROVED | REJECTED`) korur.
- **Karar kuralları:** yalnızca `APPLIED` karara bağlanır. Aynı kararın tekrarı `200` döner, yeni event yazmaz ve kota kullanmaz; çelişen karar `409` (`COLLABORATION_ALREADY_REJECTED` / `COLLABORATION_ALREADY_APPROVED`). **Ret**, ilan görünmez olsa da veya abonelik bitse de mümkündür.
- **Onay kuralları** (her biri `409` koduyla; ihlalde hiçbir şey yazılmaz): ilan açık olmalı (`OFFER_NOT_OPEN`); mekanın şu an geçerli aboneliği olmalı (`NO_ACTIVE_SUBSCRIPTION`); aday hâlâ `ACTIVE` `INFLUENCER` olmalı (`APPLICANT_NOT_ELIGIBLE`); ilanın **onaylı** sayısı kontenjanı aşmamalı (`OFFER_CAPACITY_FULL`); aylık kota aşılmamalı (`MONTHLY_QUOTA_EXCEEDED`).
- **Aylık eşleşme kotası:** mekan geneldedir (tüm ilan ve şubeler birlikte). Sayaç, mekanın **Europe/Istanbul takvim ayında** onayladığı iş birliklerini `approvedAt` ile sayar; ay aralığı UTC sınırlarıyla `[ayın başı 00:00 +03:00, sonraki ayın başı)` sorgulanır (`istanbulMonthRange`, `packages/shared`; Türkiye 2016'dan beri yaz saati uygulamadığı için sabit +03:00). Sınır, **geçerli aboneliğin paketinden** (`monthlyMatchQuota`) okunur; sayaç abonelik değişse bile o aydaki tüm onayları kapsar.
- **Politika (iptal gelecekte kotayı kendiliğinden geri vermez):** `approvedAt` onayda **bir kez** yazılır ve hiçbir zaman silinmez; aylık kota yalnızca ona dayanır. **Kontenjan** ise o an `APPROVED` olanları sayar. İleride eklenecek iptal, kontenjan hakkını boşaltabilir ama onay kaydını ve aylık sayımı değiştirmez; kotayı geri vermek ayrı, açık bir ürün kararı ve migration ister (durum-alan `CHECK`'i o görevde güncellenir).
- **Kilit düzeni** (`apps/api/src/common/row-locks.ts`, tek sıra: mekan → ilan → iş birliği → kullanıcı):
  - **Onay:** mekan satırı `FOR UPDATE` (ilan yayınlama/düzenleme ile aynı kilit; kontenjan ve aylık kotayı sıraya sokar), ilan satırı `FOR SHARE`, iş birliği satırı `FOR UPDATE`, aday kullanıcı `FOR SHARE`. "Şimdi" ve karar verilerinin hepsi **kilitlerden sonra** okunur.
  - **Başvuru:** yalnızca ilan satırı `FOR SHARE` (aynı ilana birçok başvuru birbirini beklemez).
  - **Ret:** yalnızca iş birliği satırı (mekan kilidine ihtiyaç duymaz).
  - **Askıya alma** (admin) değişmedi: ilan satırına tek koşullu `UPDATE`, mekan kilidi yok. Onay/başvuru ilan satırını `FOR SHARE` tuttuğu için askıya alma onun bitmesini bekler; askıya alma önce commit olduysa onay/başvuru güncel durumu görür (`OFFER_NOT_OPEN` / `404`). Her işlem sıranın bir alt dizisini alır, döngü ve deadlock oluşmaz.
- **Testler:** `pnpm test` içinde HTTP testleri (bellek içi Prisma, CI'da çalışır: kurallar, yetki/yalıtım, sızıntı, ay sınırı, event yazma hatasında rollback). Gerçek PostgreSQL'de `collaborations.integration.spec.ts` (iş kuralları, saklanan veri, `CHECK` kısıtları, trigger ile zorlanan event hatasında rollback) ve **kontrollü sıralı** `collaborations-locking.integration.spec.ts` (test kilidi/kaydı tutar, istekler `pg_stat_activity`'de beklerken görülür, sonra bırakılır): kontenjanın son hakkı, farklı ilan/şubeler arasında aylık kotanın son hakkı, onay/yayın/düzenleme sırası, onay↔ret, askıya alma↔onay, askıya alma↔başvuru, eşzamanlı başvuru, onay sırasında askıya alınan aday ve karışık yarış. Kilitler tek tek kaldırıldığında ilgili testlerin kırıldığı doğrulandı. PostgreSQL testleri CI dışındadır.

### Tekrarlanabilir ilan oluşturma (`Idempotency-Key`)

`POST /offers/mine` isteğe bağlı bir `Idempotency-Key` başlığı kabul eder: istemcinin **bir mantıksal oluşturma denemesi** için uydurduğu, her tekrarda aynen gönderdiği 16–128 karakterlik (`A-Za-z0-9_-`; UUID uygundur) rastgele değer. Başlık yoksa eskisi gibi her istek yeni ilan oluşturur; biçimi bozuk veya tekrarlı başlık `400`'dür (sessizce yok sayılmaz).

- **Kapsam:** anahtar `(doğrulanmış kullanıcı, işlem, anahtar)` üçlüsüyle birlikte tekildir (`IdempotencyKey` tablosu; işlem adı `offer.create`). Kullanıcı kimliği token'dan gelir; başka kullanıcının aynı anahtarı ayrı bir istektir, başkasının sonucuna erişilemez (başkasının şubesiyle gelen istek `404`'tür ve anahtar yazılmaz).
- **Aynı anahtar + aynı içerik:** yeni kayıt oluşmaz, **aynı ilan** (o anki hâliyle: arada düzenlenmiş/yayınlanmışsa güncel durumu) `201` ile döner ve yanıtta `Idempotent-Replayed: true` başlığı bulunur. İçerik, doğrulanmış gövdenin (kırpılmış metin, UTC tarih) sabit alan sırasıyla SHA-256 özetidir; alan sırası, boşluklar, `+03:00` gibi yazım farkları sonucu değiştirmez.
- **Aynı anahtar + farklı içerik** (başlık, değer, kontenjan, tarih veya şube): `409` ve `code: IDEMPOTENCY_KEY_REUSED`; hiçbir şey yazılmaz.
- **Eşzamanlılık:** garanti veritabanındadır, süreç belleğinde değil. İlan ve anahtar kaydı **aynı transaction'da** yazılır (ikisi birlikte commit olur ya da ikisi birlikte geri alınır; ör. şube bulunamazsa anahtar da kalmaz). Aynı anahtarlı eşzamanlı istekler tekil indekste yarışır: kaybeden, kazananın commit'ini bekler, tekillik hatası alır, kendi transaction'ı (kendi ilanı dahil) geri alınır ve kazananın ilanını döndürür; kazanan geri alınırsa bekleyen istek kendisi oluşturur. Sonuçta tek ilan vardır.
- **Saklama:** kayıt **24 saat** (`IDEMPOTENCY_RETENTION_MS`, `offers.service.ts`) tutulur; süresi dolan kayıt yok sayılır ve aynı anahtarla gelen istek **yeni** bir oluşturma olur. Bu süre, uygulamanın kapanıp açılması veya gece çevrimdışı kalma gibi yeniden denemeleri kapsar; daha geç tekrar korunmaz.
- **Temizlik:** zamanlayıcı veya ek bağımlılık yoktur. Her anahtarlı oluşturma, süresi dolmuş kayıtlardan **en fazla 100** tanesini siler (sınırlı, en iyi çaba; hata oluşturmayı bozmaz) ve aynı anahtarın süresi dolmuş kaydını transaction içinde serbest bırakır. Tabloya yalnızca oluşturma yazdığı için büyüklüğü yaklaşık "oluşturma hızı × 24 saat" ile sınırlı kalır. İlan silinirse kaydı da silinir (`ON DELETE CASCADE`).
- **Tablo kısıtları:** `(userId, operation, key)` tekil; anahtar uzunluğu 16–128, özet uzunluğu 64, `expiresAt > createdAt` (`CHECK`, migration'da elle yazılmıştır).

### Geliştirme verisi (isteğe bağlı)

Aboneliği yönetecek bir uç nokta yoktur; yayınlamayı yerelde denemek için örnek bir paket/abonelik hazırlayan, **yalnızca geliştirme** amaçlı bir komut vardır (Mac Terminal ve Windows PowerShell'de aynı; `pnpm db:seed:dev` sonrasında):

```sh
pnpm db:subscription:dev
```

"Örnek Geliştirme Paketi"ni (aktif ilan kotası 3, aylık eşleşme 10; **bu sayılar uydurmadır, gerçek ürün kararı değildir**) oluşturur ve yalnızca seed'deki örnek mekâna 90 günlük abonelik verir. Eksik olanı oluşturur; aynı adlı mevcut paketi ve mekânın mevcut aboneliğini **değiştirmez**. `NODE_ENV=production` iken çalışmayı reddeder, CI/deployment'a bağlı değildir.

### Doğrulama

`pnpm test` (HTTP testleri: rol/sahiplik, istemciden durum/kimlik gönderme, abonelik yok/bitmiş/başlamamış, kota dolu, gelecek başlangıçlı ve süresi dolmuş ilanlar, tekrar yayınlama, askıya alma sonrası kota) ve gerçek PostgreSQL üzerinde `pnpm --filter api test:integration` (aynı mekan için 8 eşzamanlı aynı ilan yayını → kota bir kez; farklı ilanların son haklar için yarışı → kota aşılmaz; abonelik çakışma kısıtı; `CHECK` kısıtları; rollback sonrası kilidin bırakılması). Kilit satırı kaldırıldığında yarış testleri kırılır. Anahtarlı oluşturma `offers-idempotency.integration.spec.ts` ile sınanır: aynı anahtar/içerik, farklı içerik (`409`), 8 eşzamanlı aynı anahtar → tek ilan, **kontrollü sıra** (test kazananın açık transaction'ını tutar; istek tekil indekste `pg_stat_activity`'de bloklu görülünce commit ya da rollback edilir), kullanıcı yalıtımı, ilan+anahtar rollback'i (PostgreSQL'de anahtar yazımı trigger ile zorla başarısız kılınır), süresi dolan anahtar ve temizlik, `CHECK` kısıtları, **yanıt kaybı** (istemci isteği gönderip soketi kapatır, sonra aynı anahtarla tekrar eder → tek ilan) ve başka sahibin taslağını **tam ve geçerli gövdeyle** düzenleme denemesi (`404`, değişiklik yok). Uygulama kodundaki beş kritik nokta (özet karşılaştırması, kullanıcı kapsamı, ortak transaction, tekillik hatasının tekrar oynatmaya çevrilmesi, anahtarsız yol) tek tek bozularak testlerin yakaladığı doğrulanmıştır. Entegrasyon testleri ortak veritabanında tablo geneli sayım yapan testler (mekan listesi) olduğu için dosyalar **sırayla** çalışır (`fileParallelism: false`). Düzenleme/yayınlama sırası ayrıca **kontrollü** testlerle sınanır (`offers-locking.integration.spec.ts`): test kilidi kendisi tutar, istekleri tek tek başlatır, PostgreSQL'in (`pg_stat_activity`) her birini bloklu gördüğünü bekler ve ancak sonra bırakır. Senaryolar: önce biten düzenlemeyi yayının görmesi (bitişi geçmiş ilan reddedilir), önce biten yayından sonra düzenlemenin `OFFER_NOT_DRAFT` alması, yayının kontrolleri ortasındayken araya giren düzenlemenin bekletilmesi, kilit beklerken ilanın veya aboneliğin süresinin dolması ve beklerken boşalan kota hakkı.

## Mobil uygulama girişi

Tek mobil uygulama (`apps/mobile`, Expo SDK 57 + Expo Router) e-posta/parola ile girer ve **API'nin döndürdüğü kullanıcı kaydındaki role göre** bir ana ekran açar: `INFLUENCER` (ilan keşfi), `VENUE_OWNER` (mekan paneli), `VENUE_STAFF` (sade; yalnızca ad, rol ve çıkış). Sahte ilan/istatistik/QR yoktur. `ADMIN` mobilde yetkili alan açmaz: giriş hemen `POST /auth/logout` ile iptal edilir, hiçbir şey saklanmaz ve "yönetim paneli web üzerinden kullanılır" mesajı gösterilir. Gezinti korumaları (`Stack.Protected`) yalnızca arayüzdür; her isteği API kendi yetki kontrolleriyle denetler. Geliştirme hesapları için `pnpm db:seed:dev` ve `pnpm db:passwords:dev` sonrasında `owner@`, `staff@`, `influencer@gossip-society.example` kullanılabilir.

### Token'lar nasıl saklanır ve yenilenir

- **Native (iOS/Android):** token'lar işletim sisteminin güvenli depolamasındadır (`expo-secure-store`: Keychain / Keystore), AsyncStorage'da değil. Erişim ve yenileme token'ı ile süreleri **tek bir kayıtta** saklanır; böylece çift her zaman birlikte yazılır, yarım yazılamaz. Okunurken doğrulanır; bozuk, eksik veya eski biçimli kayıt silinir ve giriş ekranı açılır. Token'lar günlüklere yazılmaz, arayüzde gösterilmez.
- **Web önizlemesi (`pnpm --filter mobile web`):** güvenli depolama web'de yoktur; token'lar yalnızca **bellekte** tutulur, `localStorage` / `sessionStorage` kullanılmaz. Sayfa yenilenince yeniden giriş gerekir. Kalıcı web oturumu ve BFF bu görevin dışındadır.
- **Açılışta ve arka plandan dönüşte** oturum `GET /auth/me` ile doğrulanır (arka plandan dönüşte en fazla 15 sn'de bir). Erişim token'ının süresi (30 sn payla) dolmuşsa önce yenilenir.
- **Yenileme:** aynı refresh token için aynı anda tek istek yürütülür (eşzamanlı çağrılar onu paylaşır); Bir çağrı için **en fazla bir yenileme** yapılır (başka çağrılarla paylaşılan yenileme de sayılır): token baştan süresi dolmuşsa yenilenir ve yeni token'ın aldığı `401` oturumu bitirir, ikinci yenileme yapılmaz; token geçerli görünürken `401` gelirse bir kez yenilenir ve çağrı **bir kez** tekrarlanır, yeni token da reddedilirse oturum biter (sonsuz döngü yok). Yenileme `401`/`403` ile reddedilirse oturum silinir ve girişe dönülür. Ağ hatası, `429` veya `5xx` ise oturum **silinmez**; "Sunucuya ulaşılamıyor" ekranı ve **Tekrar Dene** gösterilir.
- **Yarışlar:** her giriş, çıkış ve oturum sonu bir "nesil" sayacını artırır; eski nesilde başlamış bir yenileme/giriş sonucu, durumu veya depoyu değiştirmeden hemen önce senkron olarak kontrol edilir ve gerekiyorsa atılır. Depo yazmaları tek sıralı kuyruktan geçer. Böylece çıkıştan sonra gelen eski yenileme yanıtı oturumu yeniden kuramaz ve çıkış → yeniden giriş sonrasında yeni oturumu ezemez.
- **Çıkış:** yerel oturum ve depo anında temizlenir, sonra eldeki token'larla sunucu oturumu iptal edilir. Erişim token'ı dolmuşsa (logout için gerekir) önce yenilenir; yenileme reddedilirse oturum zaten geçersizdir. API'ye ulaşılamazsa yerel çıkış tamamlanır ve giriş ekranında sunucudaki oturumun iptal **edilemediği** yazar. Uygulama bu sırada kapatılırsa sunucu oturumu süresi dolana kadar açık kalabilir.

### Mekan sahibi ekranı (`GET /venues/mine`)

`VENUE_OWNER` olarak giren kullanıcı, **kendi** mekanlarını ve her mekanın şubelerini (ad, şehir, adres) gerçek API verisiyle görür: mekan adı, açıklama ve kendi şubeleriyle ayrı kartlar. Ekranda ad, rol, çıkış, ilan ekranlarına giden iki düğme (aşağıya bakın) ve bu liste vardır; puan, ilan sayısı, abonelik, başvuru, personel veya QR gibi henüz geliştirilmemiş şeyler gösterilmez. Görsel yön `prototype/` içindeki mekan paneli başlığı ve mekan profili düzeninden alınmıştır (kod kopyalanmadan); kapak/medya, "Profili Düzenle", işbirliği beklentileri ve paket kartları sahte veya geliştirilmemiş olduğu için alınmamıştır.

- **Çağrı:** `SessionManager.request()` üzerinden yapılır (yenileme, çağrı başına en fazla bir yenileme, oturum sonlandırma orada). İstekte kullanıcı kimliği veya `ownerId` yoktur; kimliği API access token'dan alır. Yanıt `myVenuesResponseSchema` ile doğrulanır; şemaya uymayan yanıt kontrollü hata ("alınamadı" + tekrar dene) olur.
- **Durumlar:** yükleniyor, mekan yok, bağlantı hatası (+ **Tekrar Dene**), beklenmeyen yanıt/sunucu hatası, aşağı çekerek yenileme ve arka plandan dönüşte yeniden okuma. Yenileme başarısız olursa, daha önce gösterilen liste yerinde kalır ve altında "Yeniden Dene" çıkar.
- **Hata türleri ayrı ele alınır:** `401`/süresi dolmuş/iptal edilmiş oturum ve `403` + `ACCOUNT_*` (hesap etkin değil) oturum yöneticisi tarafından oturumu bitirir ve giriş ekranına götürür (bağlantı hatası gibi gösterilmez). Kodsuz `403` (rol politikası) ekranda "erişiminiz değişmiş olabilir" der ve oturum yöneticisine kullanıcının güncel kaydını sordurur; rol değişmişse gezinti yeni rolün ana ekranına geçer. Yenileme sırasında rol değişirse veya hesap `ADMIN` olursa aynı şekilde güncellenir / oturum reddedilip iptal edilir.
- **Kullanıcı yalıtımı:** sorgu anahtarı kullanıcıya bağlıdır (`['venues','mine',<kullanıcı id>]`); kullanıcı değişince veya çıkışta tüm `['venues']` sorguları iptal edilip silinir. Çıkıştan (veya başka bir girişten) önce başlamış bir isteğin geç yanıtı, `SessionManager.request()` çağrı döndüğünde oturum nesnesini yeniden kontrol ettiği için atılır; ayrıca o an oturum açmış kullanıcı, isteğin yapıldığı kullanıcı değilse yanıt "eski" sayılır. Böylece geç yanıt yeni kullanıcıya görünmez ve önbelleğe yazılmaz.
- Personel ana ekranı değişmemiştir; influencer ana ekranı artık ilan keşfidir (aşağıya bakın).

### Mekan sahibi ilan yönetimi

`VENUE_OWNER` ana ekranındaki **İlan Oluştur** ve **İlanlarım** düğmelerinden açılır (`apps/mobile/src/offers`, rotalar `src/app/offers/*`). Kullandığı uç noktalar yukarıdaki `/offers/mine…` uç noktalarıdır; API ve veri modeli değişmemiştir, istek/yanıt şemaları `packages/shared`'dan gelir.

- **Liste (`GET /offers/mine`):** yeniden eskiye, sayfa başına 10; **Daha Fazla Göster**, aşağı çekerek yenileme, yükleniyor / boş / bağlantı hatası / beklenmeyen hata + **Tekrar Dene** durumları. Kartta başlık, mekan · şube, hizmet değeri, kontenjan ve Türkiye saatiyle geçerlilik aralığı görünür.
- **Taslak oluşturma:** kendi mekanlarınızın şubelerinden biri seçilir (`GET /venues/mine`), alanlar paylaşılan `createOfferRequestSchema` ile aynı sınırlarla denetlenir, hata mesajları alanın altında Türkçe gösterilir. Bu ekran **yalnızca `DRAFT` oluşturur**; yayınlama otomatik yapılmaz.
- **Hizmet değeri (₺):** metin olarak girilir ve rakamlar üzerinden **tamsayı kuruşa** çevrilir (`1250` → 125000, `1250,50` / `1250.5` → 125050); float kullanılmaz, en fazla iki ondalık basamak kabul edilir, `1250,555` reddedilir. Gösterim `1.250,50 ₺`.
- **Tarih ve saat:** tarih seçici bağımlılığı eklenmedi; `GG.AA.YYYY SS:DD` biçiminde elle girilir ve **Türkiye saati** (UTC+03:00) kabul edilir. Takvimde olmayan günler (`31.02.2026`) reddedilir. API'ye UTC ISO olarak gider, gösterimde yine Türkiye saatine çevrilir. Türkiye 2016'dan beri yaz saati uygulamadığı için sabit +03:00 kullanılır (kural değişirse `istanbul-time.ts` güncellenmelidir).
- **Detay ve düzenleme (`GET/PUT /offers/mine/:id`):** yalnızca `DRAFT` düzenlenebilir; şube değişmez. Kaydedilmemiş değişiklik varken **Yayınla** kapalıdır. `PUBLISHED` ve `SUSPENDED` ilanlar salt okunurdur; askıdaki ilanda sebep ve zaman gösterilir. Bulunamayan / başkasına ait ilan "bulunamadı" durumu, yetkisiz durum ayrı bir mesaj gösterir.
- **Görünen durumlar:** *Taslak*, *Yayında*, *Yayında · henüz başlamadı* (başlangıç ileride), *Süresi doldu* (`PUBLISHED` ve bitişi geçmiş; **sunucuda yeni bir durum yoktur**, tarihten türetilir) ve *Askıya alındı*.
- **Yayınlama (`POST /offers/mine/:id/publish`):** ayrı bir adımdır ve onay ister ("… yayınlansın mı?" → **Evet, Yayınla** / **Vazgeç**). `NO_ACTIVE_SUBSCRIPTION`, `QUOTA_EXCEEDED`, `OFFER_EXPIRED`, `OFFER_NOT_DRAFT` ayrı Türkçe mesajlarla gösterilir. Başarıdan sonra liste ve detay yenilenir.
- **Çift gönderim:** kaydet/yayınla basışları bir `ref` ile anında engellenir (düğmenin devre dışı kalması beklenmez); aynı anda tek yazma çalışır. Yavaş sunucuyla dört hızlı basış tek istek üretti.
- **Yanıt kaybolursa:** ağ hatası, zaman aşımı, `5xx` veya sözleşmeye uymayan yanıtta işlemin yapılıp yapılmadığı **bilinmez**; ekran bunu "başarısız" demez: "Sunucudan yanıt alınamadı; … bilinmiyor…" der, ilanları kendiliğinden **yeniden okur** (GET güvenlidir) ve **Durumu Kontrol Et** düğmesi sunar. **Oluşturmada** mesaj ayrıca "aynı bilgilerle tekrar kaydetmek ikinci bir ilan oluşturmaz" der (aşağıdaki anahtar sayesinde). Düzenleme sunucuya ulaşmışsa form "Değişiklikler sunucuda kayıtlı görünüyor" der; yayın ulaşmışsa sayfa salt okunur olur. Yazma isteği **asla otomatik tekrarlanmaz**.
- **Yazmayı `401` sonrası yeniden denemek güvenli mi?** Evet, ve yalnızca bu durumda: `SessionManager.request()` bir yazmayı yalnızca `401` aldığında, token yenilendikten sonra **bir kez** tekrarlar. API `401`'i kimlik doğrulama guard'ında, denetleyici çalışmadan önce verir; yani o istek **hiçbir şey yazmamıştır** ve tekrarı çift kayıt üretemez (test: ilk `401`'de yürütme sayısı 0, tekrarda 1; tek ilan oluşur). Ağ hatası/zaman aşımı/`5xx` sonrası tekrar yoktur. Oluşturma isteğinde bu `401` tekrarı da **aynı** `Idempotency-Key`'i gönderir.
- **Oluşturmada `Idempotency-Key`:** her mantıksal oluşturma denemesi için bir UUID v4 anahtarı üretilir (`idempotency-key.ts`; platformun rastgele kaynağı, yoksa `Math.random` yedeği; anahtar gizli değildir, API onu kullanıcıya bağlar). Form içeriği **aynı** kaldıkça aynı anahtar kullanılır: yanıt kaybından sonra yeniden **Taslak Olarak Kaydet**'e basmak aynı işlemi sürdürür ve tek ilan bırakır. İçerik değişirse (başlık, tutar, tarih, şube…) bu **yeni bir işlem**dir ve yeni anahtar üretilir; yanıtı kaybolan önceki içerik sunucuda oluşmuşsa o ilan ayrı kalır (listede görünür). Başarıdan sonra deneme biter; aynı içerikle yeni bir kayıt bilerek yeni ilan oluşturur. **Otomatik tekrar eklenmemiştir**: yeniden gönderme yalnızca kullanıcı basınca olur. Düzenleme (`PUT`) ve yayınlama (`POST …/publish`) zaten aynı isteği tekrarlamaya dayanıklıdır (aynı gövde aynı sonucu verir; ikinci yayın ilanı değiştirmeden döner), bu yüzden anahtar kullanmazlar.
- **Oturum ve kullanıcı yalıtımı:** her çağrı `SessionManager.request()` üzerindendir (ayrı yenileme mantığı yoktur); sorgu anahtarları `['offers','mine',<kullanıcı id>,…]`; kullanıcı değişince veya çıkışta `['offers']` (ve `['venues']`) sorguları iptal edilip silinir. Çıkıştan/başka girişten sonra gelen eski liste, detay, oluşturma, düzenleme ve yayın yanıtları atılır; yeni kullanıcının önbelleğine yazılmaz ve gezintiyi değiştirmez (oluşturma sonrası ilana gitme, ekran hâlâ açıksa yapılır). `401` / oturum sonu / hesap durumu mevcut oturum akışına bırakılır; kodsuz `403` kullanıcı kaydını yeniden sorgulatır, rol değiştiyse gezinti yeni role geçer.

### Influencer ilan keşfi (mobil)

`INFLUENCER` ana ekranı (`apps/mobile/src/discover`, rotalar `src/app/influencer.tsx` ve `src/app/discover/[id].tsx`) gerçek API'den (`GET /discover/offers`) **şu anda geçerli yayınlanmış ilanları** listeler; karta basınca ayrıntı açılır, geri tuşu listeye döner. **Salt okunurdur: başvuru yok, "Başvur" düğmesi yok** ("Başvuru işlemi henüz uygulamada yok." yazar).

- **Görsel yön:** `prototype/` içindeki influencer paneli başlığı ("INFLUENCER PANELİ") ve tek `renderInfHome` içindeki fırsat kartı hiyerarşisi (mekan adı → mekanın teklifi → vurgu renginde beklenen içerik → koşullar) mevcut koyu tema, pembe vurgu ve kart bileşenleriyle yeniden yapıldı; kod kopyalanmadı. Prototipte ayrı bir ilan detayı yoktur, detay mevcut kart/ayrıntı bileşenleriyle tasarlandı. Fotoğraf, puan, VIP ve doğrulama rozeti **yoktur**: arkasında veri yok.
- **Detay:** mekan/şube/şehir/adres, açıklama, hizmet ve değeri, beklenen içerik, **takipçi şartı** (otomatik denetlenmez notuyla), **toplam** kontenjan ve Türkiye saatiyle geçerlilik. TL ve tarih gösterimi sahip ekranlarındaki yardımcıları kullanır (`formatKurusAsTl`, `formatIstanbul`).
- **Durumlar:** yükleniyor, boş liste ("Şu anda açık ilan yok"), bağlantı hatası ve beklenmeyen hata + **Tekrar Dene**, sayfalama (**Daha Fazla Göster**, sayfa başına 10), aşağı çekerek yenileme, arka plandan dönüşte yeniden okuma ve detaydan dönüşte eskimiş (15 sn) listenin yeniden okunması. Yenileme başarısız olursa eski liste yerinde kalır, altında **Yeniden Dene** çıkar.
- **Detay her açılışta API'den doğrulanır:** önbellek süresi yoktur ve listeden yer tutucu veri aktarılmaz. Listede görünen ama bu arada askıya alınan/süresi dolan ilan "Bu ilan artık yayında değil" der, eski içerik gösterilmez ve liste yenilenir. Bir yenileme "görünmüyor" derse daha önce yüklenen veri geçerliymiş gibi gösterilmez.
- **Oturum ve yalıtım:** çağrılar `SessionManager.request()` üzerindendir (`401`, hesap durumu ve oturum sonu mevcut akışla); sorgu anahtarları `['discover','offers',<kullanıcı id>,…]`, kullanıcı değişince/çıkışta `['discover']` sorguları iptal edilip silinir, sorgular yalnızca `INFLUENCER` rolünde çalışır. Çıkıştan/başka girişten sonra gelen eski liste ve detay yanıtları atılır; gezintiyi değiştirmez. Kodsuz `403` (rol değişti) kullanıcı kaydını yeniden sorgulatır ve gezinti yeni rolün ana ekranına geçer. Mekan sahibi, personel ve admin akışları değişmemiştir.

### Sınırlamalar

- **Native güvenli depolama ve "uygulamayı kapatıp yeniden açma" bu ortamda doğrulanmadı** (iOS simülatörü ve Android SDK/emülatörü yoktu); native paketlerin yalnızca derlendiği (`expo export`) görüldü. Gerçek cihazda/simülatörde şunlar elle denenmelidir: giriş → uygulamayı tamamen kapat → aç (oturum sürmeli), Keychain/Keystore'a yazılması, çıkış sonrası kayıt silinmesi. Tarayıcı önizlemesi native cihaz testi yerine geçmez.
- iOS Keychain kayıtları uygulama silinip aynı bundle ID ile yeniden kurulunca kalabilir (iOS davranışı); eski oturum API tarafından geçersizse ilk açılışta giriş ekranına düşülür.
- Yenilenen token çifti güvenli depoya yazılamazsa (nadir) oturum o çalışma boyunca bellekte sürer, bir sonraki açılışta eski (kullanılmış) refresh token reddedilir ve yeniden giriş gerekir.
- **İlan keşfi ve ilan ekranları yalnızca tarayıcı önizlemesinde (Expo web, gerçek API) denendi; native iOS/Android cihazda veya simülatörde denenmedi.** Klavye türleri (`decimal-pad`, `number-pad`), çok satırlı alan davranışı ve kaydırma native'de ayrıca elle denenmelidir.
- **Kalan kota/abonelik durumu gösterilmez:** API'de bunu veren bir uç nokta yok (`GET /offers/mine` yalnızca ilanları döner); kota/abonelik ancak yayınlama denemesinde `409` koduyla öğrenilir. Ekranda sahte bir kota göstergesi yoktur. İstenirse API'ye ayrı bir salt okunur uç nokta eklenmelidir.
- **Yinelenen kayıt (giderildi):** tarayıcı ağ katmanı, yeniden kullanılan bir bağlantı sıfırlanınca `POST`'u kendisi tekrar gönderebilir; önizlemede kasıtlı kesilen bir yanıtta Chrome isteği tekrar gönderdi ve eskiden iki ilan oluştu. `Idempotency-Key` ile aynı senaryoda sunucu iki istek görür ama **tek ilan** kalır (gerçek Chrome + gerçek API ile doğrulandı). Korunma yalnızca oluşturma içindir ve 24 saatle sınırlıdır: farklı içerikle (yeni anahtar) yapılan ikinci kayıt, anahtarsız eski istemciler ve süresi dolmuş anahtarlar korunmaz.
- Keşifte başvuru, ziyaret saati, QR, Instagram doğrulaması, harita, filtre ve öneri yoktur; görsel (fotoğraf) alanı ilan modelinde yoktur.
- Süresi dolan yayınlar için sunucuda durum değişmez; "Süresi doldu" yalnızca görünümdür.
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
