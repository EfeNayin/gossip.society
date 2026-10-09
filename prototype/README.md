# Gossip Society

+Gossip Society, içerik üreticileri ile mekanları buluşturan mobil öncelikli bir React prototipidir.
+
+## Teknoloji
+
+- React
+- Vite
+- Tailwind CSS
+- Lucide Icons
+
+## Başlangıç
+
+```sh
+npm install
+npm run dev
+```
+
+Üretim derlemesi:
+
+```sh
+npm run build
+npm run preview
+```
+
+## Proje yapısı
+
+- `src/features/landing`: Açılış ekranı
+- `src/features/influencer`: Influencer kayıt ve uygulama ekranları
+- `src/features/venue`: Mekan paneli
+- `src/features/admin`: Yönetici paneli
+- `src/styles`: Tailwind ve uygulama stilleri
+- `public/legacy-app.js`: İlk geçişte korunan mevcut etkileşim katmanı
+
+## Geçiş notu
+
+Ekran kabuğu React bileşenlerine ayrılmıştır. Mevcut prototip davranışları, geçiş sırasında özellik kaybı yaşamamak için geçici olarak `public/legacy-app.js` içinde korunur. Sonraki geliştirmelerde bu dosyadaki ekran fonksiyonları React state ve bileşenlerine taşınabilir.
+
+İlk tek dosyalı prototip `canl_destek_ve_ba_vuru_detaylar.html` olarak yedekte tutulur.
+