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

Yalnızca yerel geliştirme içindir; hiçbir migration, CI veya deployment adımında otomatik çalışmaz ve `NODE_ENV=production` iken çalışmayı reddeder. Bir admin, bir mekan sahibi, bir personel, bir aktif ve bir onay bekleyen influencer, iki şubeli bir örnek mekan oluşturur. E-postalar `@gossip-society.example` uzantılıdır ve hesapların şifresi yoktur (giriş henüz yok). Tekrar çalıştırmak güvenlidir: eksik kayıtları ekler, mevcut kayıtları değiştirmez veya silmez (elle değiştirdiğiniz hesap durumu dahil).

## Açılacak adresler

- API kontrolü: <http://localhost:3000/health> — beklenen yanıt `{"status":"ok","db":"up"}`.
- Yönetim paneli: <http://localhost:3001> — API ve veritabanı bağlı görünmeli.
- Mobil tarayıcı önizlemesi: <http://localhost:8081>. Expo terminalinde `w` de kullanılabilir. Ayrı bir mobil oturum gerekirse önce mevcut `pnpm dev` oturumunu durdurun; `pnpm --filter @gossip/shared build` sonrasında ayrı terminallerde `pnpm --filter api dev`, `pnpm --filter admin dev` ve `pnpm --filter mobile web` çalıştırın.

`prototype/` bu adreslerdeki uygulamadan ayrıdır. Buradaki bağlantı ekranını görmek, prototip tasarımının aktarılmış olduğu anlamına gelmez.

## Fiziksel telefonla deneme

1. Telefon ve bilgisayar aynı yerel ağda olsun; telefon üzerindeki Expo Go sürümü projenin Expo SDK sürümüyle uyumlu olmalı.
2. `apps/mobile/.env` içindeki `EXPO_PUBLIC_API_URL` değerini bilgisayarın yerel ağ adresine çevirin: örneğin `http://192.168.1.10:3000`. Telefonda `localhost` telefonun kendisidir.
3. Expo'yu yeniden başlatın. Telefonun tarayıcısından önce `http://BILGISAYAR_IP:3000/health` adresini kontrol edin.
4. Windows Güvenlik Duvarı gerekirse özel ağda Node için API 3000 ve Expo 8081 bağlantılarına izin vermelidir. PostgreSQL/Redis portlarını telefona açmak gerekmez.

Bilgisayarın IP adresi değişirse bu ayarı güncelleyin. Expo tunnel kullanmak API'yi otomatik olarak dışarı açmaz.

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
