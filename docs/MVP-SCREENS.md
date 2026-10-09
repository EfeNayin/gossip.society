# Gossip Society — Ekran Envanteri ve MVP Geliştirme Sırası

İnceleme tarihi: 9 Ekim 2026.

Bu belge `prototype/` içindeki ekranları [ürün planıyla](PLAN.md) eşleştirir. Ürün planındaki fazları değiştirmez. İlk çalışan akış, tam MVP'nin bir ara teslimidir; Instagram doğrulaması, performans primi ve medya kiti tam MVP kapsamından çıkarılmamıştır.

Bu çalışmada uygulama kodu yazılmamıştır. Ekran durumları kaynak kod incelemesine dayanır; prototipin her etkileşiminin tarayıcıda çalıştığı iddia edilmez. Prototip görsel/akış referansıdır; bileşenleri, bağımlılıkları ve eski etkileşim kodu yeni uygulamalara kopyalanmaz.

## 1. Mevcut durum ve kapsam işaretleri

- **Faz 0:** Hesaplar, giriş, roller ve temel veri modeli.
- **Faz 1:** Mekan oluşturma, ilan, keşfet, başvuru, onay, zaman dilimi ve QR check-in.
- **Faz 2:** Instagram bağlantısı, içerik teslimi/doğrulama, gecikme ve no-show, iki taraflı puanlama.
- **Faz 3:** Performans kodu/prim, medya kiti, iyzico ve push bildirimleri.
- **Sürüm 2:** Seviyeler, boş saat pazarı/harita, etkinlikler, TikTok, mesajlaşma.
- **Karar bekliyor:** Ürün planında kesinleşmemiş veya yalnızca prototipte bulunan kapsam. MVP'ye otomatik eklenmez.

Yeni uygulamalarda şu anda yalnızca API/veritabanı bağlantı ekranı var: `apps/admin/app/page.tsx` ve `apps/mobile/src/app/index.tsx`. Prisma şeması henüz iş modelleri içermiyor. Docker/CI hazırlığı, Faz 0'ın hesap ve rol kısmının tamamlandığı anlamına gelmez.

## 2. Ortak giriş ve kayıt ekranları

**G01 — Açılış ve girişe yönlendirme · Faz 0**
Referans: `prototype/src/features/landing/LandingView.jsx`. Koyu zemin, pembe marka rengi, influencer/mekan kartları ve buton hiyerarşisi korunabilir. Mobilde girişten sonra rol sunucudaki hesaptan belirlenir; kullanıcı bir butonla admin veya mekan sahibi yetkisi kazanmaz. Admin girişi web panelinde bulunur.

**G02 — Influencer kayıt başvurusu · Faz 0**
Referans: `InfluencerRegistration.jsx`, `renderRegStep`, `regStepNext`. Prototipte iletişim → Instagram/TikTok kullanıcı adı → şehir → tamamlanma adımları var. Gerçek akışta e-posta/şifre, temel profil, gerekli bilgilendirmeler ve admin onayı bekleniyor durumu bulunmalı. Instagram kullanıcı adı girmek, hesabı doğrulamak değildir; gerçek bağlantı Faz 2'dir. TikTok alanı Sürüm 2'ye ayrılır. Kategori ve kabul şartları danışmanlık şirketinin kararıyla netleşir.

**G03 — Giriş, oturumun yeniden açılması, çıkış · Faz 0; prototipte gerçek akış yok**
E-posta/şifre girişi ve geçersiz bilgiler mesajı gerekir. Oturum süresi dolduğunda yeniden giriş istenir. Admin web girişi ayrı yüzeyde aynı hesap/rol kurallarını uygular. Şifre unutma ve davetle ilk şifre belirleme akışının yöntemi, hesap oluşturma kararıyla birlikte seçilecek.

**G04 — Onay bekleyen / erişimi askıya alınmış hesap · Faz 0; prototipte eksik**
Yeni influencer'a anında aktif profil yerine başvuru durumu gösterilir. Askıya alınmış hesap yetkili işlemleri yapamaz. Ret gerekçesi ve yeniden başvuru politikası karar bekler.

**G05 — Misafir keşfi · Karar bekliyor**
Referans: `navigate(..., true)`, `renderInfHome`, misafir profil görünümü. Misafir keşfi ürün planında kesinleşmiş bir gereksinim değildir. Karar alınana kadar ilk teslimin zorunlu parçası sayılmaz. Eklenirse yalnızca izin verilen ilan verileri görünür; başvuru için giriş gerekir ve influencer iletişim bilgileri açılmaz.

## 3. Influencer mobil ekranları

**I01 — Keşfet / ilan listesi · Faz 1**
Referans: `renderInfHome`. Mekan görseli, hizmet teklifi ve beklenen içerik kartlarının düzeni kullanılabilir. Gerçek kayıtlar gösterilir. Şehir/kategori filtreleri ilk sürüm için öneridir; kişiselleştirme algoritması, VIP rozeti ve öne çıkan influencer sıralaması ilk akışa dahil edilmez.

**I02 — İlan ve mekan detayı · Faz 1; prototipte kısmi**
İlanın hizmeti/TL değeri, beklenen içerik, koşulları, geçerlilik tarihleri, kontenjanı ve mekan/şube bilgisi gösterilir. Prototipte çoğu bilgi kart üzerindedir; ayrı detay ve başvuru öncesi bilgi ekranı tamamlanmalı. Mekan puanı Faz 2'de gerçek değerlendirmeler oluşunca gösterilir.

**I03 — Şartları kabul ederek başvurma ve başarı sonucu · Faz 1**
Referans: `applyCampaign`, `confirmCampaign`. Başvuru sunucuda `APPLIED` olarak kaydolur; tekrar başvuru ve uygunluk kontrolleri sunucudadır. Prototipteki 15 dakika gecikme ve %10 puan düşüşü kesin kural sayılmaz. Kabul edilen şartların hangi ilan/başvuruya ait olduğu kayıt altına alınmalı.

**I04 — Başvurularım / iş birliği detayı · Faz 1; prototipte eksik**
Bekliyor, onaylandı ve reddedildi durumları, mekan ve başvuru bilgileri görünür. Onay sonrası zaman seçimine geçilir. `openJobsModal` yalnızca geçmiş iş birliği taslağıdır; aktif başvuruların takibi için yeterli değildir.

**I05 — Zaman dilimi seçimi, iptal ve ziyaret bilgisi · Faz 1; prototipte eksik**
Uygun slot seçimiyle durum `APPROVED → SCHEDULED` olur. Dolan slot için tekrar seçim, iptal sonucu ve güncel durum gösterilir. Ayrı bir rezervasyon tarihinden bağımsız genel kullanıcı QR'ı kullanılmaz.

**I06 — İş birliğine özel QR · Faz 1**
Referans: `openQRModal`. Görsel düzen referans alınır; kullanıcı adını içeren örnek QR gerçek check-in sayılmaz. QR, planlandığı gibi zaman seçiminin ardından sunucuda üretilen iş birliği token'ını temsil eder. Geçersiz/iptal edilmiş iş birliğiyle check-in yapılamaz.

**I07 — Profil ve düzenleme · Temel bilgiler Faz 0/1; doğrulanmış bilgiler Faz 2/3**
Referans: `renderInfProfile`, `openInfluencerModal`. Ad, biyografi, şehir, kategori ve profil görseli için ekran gerekir. Sahte takipçi sayısı, başlangıçta 5.0 puan, doğrulama rozeti ve tamamlanmış iş sayısı üretilmez. Diğer kullanıcıların görebileceği profil alanları ayrıca tanımlanır. Profil üzerinden doğrudan teklif gönderme, mevcut ilan→başvuru modelinin dışında olduğundan karar bekler.

**I08 — İçerik teslimi ve doğrulama durumu · Faz 2; prototipte eksik**
Paylaşım bağlantısı, gerekli açıklama/etiketler, teslim süresi, kontrol sonucu ve başarısız kontrolde açıklama gösterilir. Planın 48 saatlik varsayılan süresi check-in ile başlar. Yeni Instagram API bağlantısının teknik gereksinimleri bu entegrasyon başlamadan ayrıca doğrulanacak.

**I09 — Geçmiş iş birlikleri ve iki taraflı puanlama · Faz 2**
Referans: `openJobsModal`, `openScoreModal`. Geçmiş işler gerçek kayıtlarla gösterilir; ayrıca değerlendirme gönderme ekranı gerekir. Puanlar iki taraf değerlendirdiğinde veya puanlama süresi dolduğunda görünür. Prototipteki özel skor formülü ve yorumlar iş kuralı olarak alınmaz.

**I10 — Instagram bağlantısı, portföy, medya kiti ve istatistikler · Faz 2/3**
Referans: profil portföy alanı, `openStatsModal`, `openInfluencerModal`. Instagram bağlantısı Faz 2; doğrulanmış portföy/medya kiti Faz 3. Kitle demografisi ve etkileşim metrikleri ancak erişilebilir ve doğrulanmış veri varsa gösterilir. Boş veya henüz doğrulanmamış veri için açıklayıcı durum gerekir.

**I11 — Bildirimler · Push Faz 3; uygulama içi liste önerisi**
Referans: `openNotificationsModal`. Başvuru sonucu ve teslim süresi gibi olaylara dayalı içerik gerekir. Faz 1'de başvuru ekranından güncel durum görülebilmeli; erken teslim push sistemine bağlı bırakılmaz. Prototipteki etkinlik bildirimleri Sürüm 2'dir.

**I12 — Performans kodu ve prim kayıtları · Faz 3; prototipte eksik**
İş birliğine bağlı kod, kullanım sayısı ve ödeme durumu gösterilir. Prim tutarı/komisyon ve ödeme yöntemi danışmanlık kararına bağlıdır.

**I13 — Sosyete liderleri, statü/seviye · Sürüm 2**
Referans: `renderInfSociety`. Liderlik ve seviye ekranı ilk akışa dahil edilmez. Temel güvenilirlik ve değerlendirme kayıtları Faz 2'de kalır.

**I14 — Etkinlikler ve davetiye/katkı talebi · Sürüm 2**
Referans: `renderInfEvents`, `openInviteModal`, `sendEventInvite`.

**I15 — Algoritma sağlığı / özel analiz · Karar bekliyor**
Referans: `openAlgorithmModal`. Prototipteki %70 premium erişim sınırı, yanıt süresi skoru ve %100 sağlık göstergesi planın kesin kararları değildir. Güvenilirlik kayıtlarını tutmak bu ekranın formülünü onaylamak anlamına gelmez.

## 4. Mekan sahibi mobil ekranları

**V01 — Mekan özeti ve ilanlarım · Faz 1**
Referans: etkin `renderVenueDash`. Gerçek aktif ilan ve bekleyen başvuru sayıları gösterilir; ilandan kendi başvurularına gidilir. İtibar puanı ancak değerlendirme verisi oluşunca gösterilir.

**V02 — İlan oluşturma / düzenleme / durum · Faz 1**
Referans: iki `renderVenueCreate` sürümü. Etkin sürüm yalnızca çalıştırma eylemi olmayan “Sihirbazı Başlat” butonudur. Form tamamlanmalı: başlık, teklif/TL değeri, beklenen içerik, min. takipçi, kontenjan, geçerlilik tarihleri ve zaman dilimleri. Paket kotası sunucuda kontrol edilir. Taslak/yayın/denetim sırası ürün kararı gerektirir; `PLAN.md` admin denetimi ister ancak yayın öncesi onay şartını kesinleştirmez.

**V03 — Başvuru listesi, aday detayı, onay/ret · Faz 1**
Referans: etkin `renderVenueApps`, `openVenueInfModal`, `approveInf`. Liste ilanla ilişkili gerçek başvurular olmalı. Onay ve ret kalıcı sunucu işlemleri olmalı; prototipte “Reddet” yalnızca pencereyi kapatıyor, “Onayla” başarı mesajı gösteriyor. Onay tek başına QR/check-in oluşturmaz.

**V04 — Mekan/şube profili ve düzenleme · Faz 1**
Referans: etkin ve önceki `renderVenueProfile`. Ad, kategori, adres/konum ve tanıtım bilgileri gerekir. Profil düzenleme butonunun gerçek işlemi yok. Şube modeli korunur; çoklu şube yönetimi ekranının ilk teslim kapsamı karar bekler. Tam medya galerisi dosya altyapısıyla aşamalı eklenir.

**V05 — Personel ve yetkiler · Faz 1**
Referans: `openTeamModal` (önceki menüden bağlı). Mekan sahibi personel ekler ve erişimini yönetir. Mekan sahibi, sistemdeki `ADMIN` rolüyle karıştırılmaz. Prototipteki butonlar personel hesabı oluşturmaz.

**V06 — İş birliği / rezervasyon takibi, içerik sonucu ve puanlama · Faz 1/2; prototipte eksik**
Onaylanan başvurunun ziyaret ve teslim durumu gösterilir. İçerik süreci ve influencer değerlendirme ekranı Faz 2'de tamamlanır.

**V07 — Abonelik/kota bilgisi, fatura/tahsilat · Kota Faz 1; ödeme Faz 3**
Referans: önceki `renderVenueDashboard`, `openPackageModal`, `openBillingModal`. Başvuru onayındaki kota kontrolü ilk çekirdek akışta gereklidir; örnek paketler/fiyatlar kesin değildir. Mobilde abonelik satın alma akışı kurulmaz; tahsilat planın varsayımı doğrultusunda fatura veya web üzerinden tasarlanır. iyzico entegrasyonunun kullanım amacı ve tahsilat akışı karara bağlıdır.

**V08 — Ayarlar / çıkış · Faz 0/1; destek kapsamı karar bekliyor**
Referans: etkin `renderVenueMenu`, önceki menü, `openSupportModal`, `openLiveSupport`, `sendChatMessage`. Hesap/çıkış temel kapsamdır. Basit yardım içeriği önerilebilir; AI bot, canlı destek ve mesajlaşma ilk akış için gerekli değildir. Sabit cevap gösteren prototip botu gerçek AI/canlı destek değildir.

**V09 — Boost, prodüksiyon, sosyal medya yönetimi · Karar bekliyor**
Referans: `openBoostModal`, `openProductionModal`, önceki paket ekranı. Danışmanlık şirketi kapsam/fiyat kararını vermeden MVP'ye eklenmez.

**V10 — Son dakika radar / boş saat çağrısı · Sürüm 2**
Referans: `openLastMinuteModal`. Bildirim ve yakınlık/harita akışları ayrıca tasarlanmalı.

**V11 — Mekan puan detayı · Faz 2; özel itibar endeksi karar bekliyor**
Referans: `openVenueScoreModal`. Gerçek karşılıklı puanlama MVP'dedir; prototipteki ağırlıklı endeks ve kriter formülü kesinleşmiş değildir.

## 5. Mekan personeli mobil ekranları — prototipte eksik

**S01 — Personel girişi ve sınırlı ana ekran · Faz 0/1**
Personel mekan/şubesiyle ilişkilidir. İlan oluşturma, başvuru onaylama ve admin işlemleri yapamaz. Rol kontrolleri sunucudadır.

**S02 — QR okutma ve işlem sonucu · Faz 1**
Kamera izni, QR okuma, yanlış mekan, geçersiz kod, daha önce kullanılmış kod ve başarı durumları gerekir. Uygun iş birliği `SCHEDULED → CHECKED_IN` olur; aynı kod iki kez giriş oluşturmaz. Kamera gerçek telefonda ayrıca test edilir.

**S03 — Performans kodu kullanımı kaydı · Faz 3**
Personel kodu doğrular ve kullanım kaydını oluşturur. Hatalı/tekrarlı kullanım kuralları prim modeline göre belirlenir.

## 6. Admin web ekranları

**A01 — Özet ve bekleyen işler · Faz 0/1**
Referans: `renderAdminDash`. Gerçek influencer başvuru, mekan ve ilan sayıları; ilgili listeye geçiş. Prototip mobil genişliktedir; gerçek admin paneli masaüstü kullanımına göre uyarlanır.

**A02 — Influencer başvuruları, detay, onay ve hesap durumu · Faz 0/1**
Referans: `renderAdminUsers`, özetin başvuru butonu. Profil incelemesi ve kalıcı onay/ret/askıya alma işlemleri gerekir. Kabul koşulları ve ret sonrası süreç açık karardır.

**A03 — Mekan sahibi hesabı / mekan / şube oluşturma ve yönetimi · Faz 1**
Referans: `renderAdminVenues`. Listede “Onayla” var; yeni mekan ve hesap oluşturma formu eksik. İlk akış planın admin oluşturur varsayımıyla tasarlanır; kendi kendine mekan kaydı açılmaz. İlk hesap erişiminin davet/parola teslim yöntemi seçilmeli.

**A04 — İlan listesi, detay ve denetim · Faz 1**
Referans: `renderAdminCampaigns`. Düzenle/askıya al eylemleri sunucuda kayıtlı ve yetkili olmalı. Yayın öncesi onay zorunluluğu açık karar olarak kalır.

**A05 — Şikayet/ihlal listesi ve inceleme · MVP; detay tasarım eksik**
Referans: özetin “Şikayet ve İhlaller” butonu. Ayrı ekran bulunmuyor. Admin rolündeki şikayet yönetimi gereksinimi korunur; şikayeti kimin, hangi ekrandan oluşturacağı ayrıca tanımlanmalı. Otomatik ceza veya destek botuna bağlanmış kabul edilmez.

**A06 — Abonelik/kota yönetimi ve prim/ödeme takibi · Faz 1/3; prototipte eksik**
İlk çekirdek akış için örnek paket/kota ve admin yönetimi gerekir; gerçek fiyatlar sabitlenmez. Prim/tahsilat kayıtları Faz 3'te ödeme modeline göre tamamlanır.

## 7. Görsel referansta tutulacaklar

- Koyu zemin, pembe ana vurgu, kartlar, yuvarlak butonlar, görsel alanları ve metin hiyerarşisi.
- Influencer ve mekan için farklı mobil navigasyon; admin için ayrı web paneli.
- Kart → detay → işlem → sonuç düzeni; uzun formlarda adımlı ilerleme.
- Yeni ekranlar aynı görsel dili kullanır; personel ve eksik akışlar için yeni tasarım gerekir.
- Yükleniyor, boş liste, hata/yeniden dene, erişim yok ve başarılı işlem durumları ilgili ekranın parçasıdır. Örnek sayılar gerçek ürün verisi gibi gösterilmez.

## 8. Prototip ile ürün planı arasındaki önemli farklar

1. **Anında aktif kayıt:** `regStepNext` giriş yaptırıyor. Gerçek akış admin onayı bekleyen hesabı ayırmalı.
2. **Genel kullanıcı QR'ı ve erken QR:** `openQRModal` kullanıcı adından QR üretiyor; `approveInf` onay sonucu QR gönderildiğini söylüyor. Plan QR'ı slot seçimi sonrası iş birliğine bağlar.
3. **Ücretsiz kullanım / ücretli abonelik:** `sendChatMessage` mekan katılımı ücretsiz diyor; `PLAN.md` aylık aboneliği varsayıyor. Prototipteki ücret metni ürün kararı değildir.
4. **İki mekan sürümü:** `switchVenueTab`, `renderVenueCreate`, `renderVenueApps`, `renderVenueProfile`, `renderVenueMenu` dosyada iki kez tanımlı. Son tanımlar etkin; önceki paket/personel/fatura ekranları normal etkin menüden bağlı değil. Bu belge eski taslakları “çalışan ekran” olarak saymaz.
5. **Gerçek işlem olmayan butonlar:** İlan sihirbazı ve profil düzenleme eylemsiz; ret pencere kapatıyor; onay başarı mesajı gösteriyor. Başvurular ve kayıtlar tarayıcı belleğindeki örnek veridir.
6. **Kararsız kurallar:** 15 dakika gecikme, %10 ceza, %70 algoritma eşiği ve paket fiyatları ürün planına kesin kural olarak taşınmaz. 48 saat check-in sonrası içerik süresi planın mevcut varsayımıdır; süreler yapılandırılabilir tutulur.
7. **MVP/Sürüm 2 karışımı:** TikTok içerik şartı, etkinlikler, liderlik ve radar demo içinde var; ilk çekirdek teslimin parçası değildir.

## 9. İlk geliştirme teslimi ve bitiş ölçütleri

İlk çalışan teslim: admin mekan hesabı açar → mekan giriş yapar ve ilan oluşturur → onaylı influencer keşfeder ve başvurur → mekan onaylar/reddeder → influencer sonucu görür.

Bu akış Faz 1'in tamamı değildir. Slot seçimi, personel QR check-in ve iptal/no-show ekranları sonraki çekirdek teslimde tamamlanır. Tam MVP ayrıca Faz 2 ve Faz 3 gereksinimlerini kapsar.

Önerilen küçük iş sırası:

1. **Temel modeller ve örnek hesaplar:** User, rol/durum, InfluencerProfile, Venue, VenueBranch ve kullanıcı-mekan ilişkileri. Örnek admin/onaylı influencer/mekan sahibiyle çalışılır. Bitiş: migration uygulanır ve ilişkiler doğrulanır.
2. **Giriş ve yetki kuralları:** JWT access/refresh, çıkış, onay bekleyen/askıya alınmış hesap ve sunucu rol kontrolleri. Bitiş: yetkisiz kullanıcı admin/mekan işlemi yapamaz; oturumlar doğru role yönlenir.
3. **Ortak görsel dil ve giriş ekranları:** G01–G04 ile rol bazlı mobil/web kabukları. Bitiş: yükleniyor/hata/hesap durumu ekranları çalışır; sahte rol seçimiyle yetki alınmaz.
4. **Admin mekan oluşturma:** A02–A03 ve temel kota kaydı. Bitiş: oluşturulan mekan sahibi doğru mekana erişir, başka mekanın verisini değiştiremez.
5. **İlan oluşturma ve keşfet:** V01–V02, I01–I02, A04'ün temel denetimi; Offer ve Subscription. Bitiş: ilan kaydolur, uygun influencer'a görünür, kota/alan doğrulamaları geçer.
6. **Başvuru ve onay/ret:** I03–I04, V03; Collaboration ve CollaborationEvent. Bitiş: tekrar başvuru engellenir, durum geçişi sunucuda ve geçmiş kaydıyla yapılır, diğer kullanıcının ekranında kalıcı sonuç görünür.
7. **Faz 1 tamamlama:** I05–I06, V05–V06, S01–S02. Bitiş: slot → QR → check-in, iptal ve geçersiz/tekrarlı QR senaryoları doğrulanır.

İlk iki kişi için önerilen iş bölümü: bir geliştirici modeller/API/yetki kuralları; diğer geliştirici ortak görsel dil/ekranlar. Ortak şemalar ve durum isimleri önce kararlaştırılır. Her iş küçük branch/PR ile diğer kişi tarafından incelenir; iki kişi aynı migration'ı veya aynı ekran dosyasını eşzamanlı değiştirmez. Bu, kişi ataması değil iş bölümü önerisidir.

## 10. Karar bekleyen noktalar ve neyi etkiledikleri

- **Influencer kabul şartları ve Instagram hesap türü:** G02–G04, A02 ve ileride Instagram bağlantısı. İlk teknik denemede örnek onaylı hesap kullanılabilir.
- **Mekan hesabını kim açacak / ilk erişim yöntemi:** A03 ve G03. Mevcut planın admin oluşturur varsayımı geçerlidir; otomatik e-posta/davet için ayrıca karar gerekir.
- **Paket kotası, fiyatlar ve tahsilat:** V02–V03, V07 ve A06. Örnek yapılandırma kullanılabilir; gerçek fiyat/prim uydurulmaz.
- **İlan yayın öncesi admin onayı:** A04, V02, I01. Denetim gereksinimi belirli; yayın sırası belirli değil.
- **Lansman şehri / kategoriler / misafir görünümü:** G02, G05, I01. Başlangıçta çok şehirli pazaryeri ve gelişmiş arama varsayılmaz.
- **Şikayet oluşturma ve ret/yeniden başvuru politikası:** A05, A02, G04. Admin inceleme yetkisi bulunur; kullanıcı tarafındaki süreç seçilmelidir.
- **KVKK metinleri, gerekli rızalar ve sunucu konumu:** Kayıt ve dosya yükleme akışları. Metinler prototipteki genel “şartları kabul” cümlesinden üretilmez.
- **İptal/ceza, değerlendirme süresi ve prim/komisyon:** I03, I05, I09, I12 ve S03. Yapılandırma sınırları korunur; politikalar onaylandığında ilgili fazda uygulanır.
- **Boost, prodüksiyon, canlı destek ve özel istatistikler:** V08–V09 ve I15. Bu işler çekirdek akışın başlamasını engellemez; ayrıca kapsam kararı bekler.

## 11. Bu planın tamamlanma kontrolü

- Prototipin açılış, dört kayıt adımı, influencer sekme/modal grupları, etkin ve önceki mekan ekranları, admin ekranları envantere eşlendi.
- Eksik personel, auth, aktif başvuru, slot, içerik teslimi ve performans kodu ekranları ayrıca işaretlendi.
- Faz 1'in ilk ara teslimi ile tam MVP ve Sürüm 2 ayrımı açıklandı.
- Ürün planı değişmeden bırakıldı; prototipteki örnek kurallar kesin karar olarak benimsenmedi.
- Sonraki uygulama işi: 9. bölümdeki temel kullanıcı/rol/mekan modelleri ve örnek hesaplar. Bu belge onların uygulamasını başlatmaz.
