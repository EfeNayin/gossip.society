// --- VERİTABANI SİMÜLASYONU ---
const CAMPAIGNS = [
    { id: 1, placeName: "Noir Coffee Roasters", type: "Cafe", icon: "coffee", image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=800", offer: "2 Kişilik Artisan Kahvaltı & Sınırsız Kahve", requirement: "1 Instagram Reels + 2 Story", isPremium: true },
    { id: 2, placeName: "Iron Gym Fitness", type: "Spor Salonu", icon: "dumbbell", image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=800", offer: "1 Aylık VIP Üyelik & Personal Trainer", requirement: "Haftada 1 Story (1 Ay Boyunca)", isPremium: false },
    { id: 3, placeName: "Gourmet Burger Co.", type: "Restoran", icon: "utensils", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800", offer: "Yeni Menü Tadımı (Yanında 1 Misafir)", requirement: "1 TikTok Videosu + Google Maps Yorumu", isPremium: false }
];

const INFLUENCERS = [
    { id: 1, name: "Lara Yılmaz", handle: "@laraylmz", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200", cover: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=800", category: "Lifestyle & Moda", followers: "125K", score: 4.9, jobs: 42, isTrending: true, bio: "İstanbul'da mekan keşfetmeyi, yeni tatlar denemeyi ve modayı yakından takip etmeyi seviyorum. 🌟", recent: ["Noir Coffee", "Gourmet Burger"] },
    { id: 2, name: "Caner Ercan", handle: "@canercn", avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200", cover: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800", category: "Gurme & Seyahat", followers: "89K", score: 4.8, jobs: 36, isTrending: true, bio: "Sokak lezzetlerinden fine-dining'e her şeyi dener, dürüstçe yorumlarım. 🍔✈️", recent: ["Gourmet Burger"] },
    { id: 3, name: "Selin Gök", handle: "@selingok_x", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200", cover: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&q=80&w=800", category: "Moda & Güzellik", followers: "210K", score: 4.7, jobs: 51, isTrending: false, bio: "Güzellik sırları ve kombin önerileri. ✨", recent: ["Vibe Club"] },
    { id: 4, name: "Berk Öz", handle: "@berkozzz", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200", cover: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800", category: "Gece Hayatı", followers: "45K", score: 4.5, jobs: 18, isTrending: false, bio: "Şehrin en iyi etkinlikleri benden sorulur. 🎧", recent: ["Soho House"] },
    { id: 5, name: "Ege Yücel", handle: "@egeyucel", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200", cover: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=800", category: "Seyahat", followers: "320K", score: 4.9, jobs: 64, isTrending: true, bio: "Dünyayı geziyor, en iyi rotaları paylaşıyorum. 🌍", recent: ["Vadi İzole Kamp"] },
    { id: 6, name: "Zeynep Demir", handle: "@zeynepmakeup", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200", cover: "https://images.unsplash.com/photo-1512496015851-a98fb38ba79e?auto=format&fit=crop&q=80&w=800", category: "Güzellik", followers: "450K", score: 4.6, jobs: 82, isTrending: false, bio: "Güzellik tüyoları ve ürün incelemelerim burada. 💄", recent: ["Glow Beauty Salon"] }
];

const EVENTS = [
    { id: 1, title: "Gossip Summer Fest '26", date: "15 Ağustos 2026", location: "Kilyos, İstanbul", image: "https://images.unsplash.com/photo-1540039155732-6762b51347cb?auto=format&fit=crop&q=80&w=800", status: "Gelecek" },
    { id: 2, title: "Gastro Weekend Tasting", date: "24 Kasım 2026", location: "Zorlu PSM, İstanbul", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=800", status: "Gelecek" },
    { id: 3, title: "Sneaker Pop-up", date: "05 Aralık 2026", location: "Bomontiada", image: "https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&q=80&w=800", status: "Gelecek" },
    { id: 4, title: "Influencer Networking", date: "20 Ekim 2025", location: "Soho House", image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800", status: "Geçmiş" }
];

// --- GLOBAL DURUMLAR ---
let isGuestUser = false;
let appliedCampaigns = [];
let eventContributions = [];
let currentUser = null; // Aktif profili tutacak değişken
let regData = { name: '', email: '', igHandle: '', tiktokHandle: '', city: 'İstanbul' }; // Kayıt verilerini toplayan obje

// --- GELİŞMİŞ NAVİGASYON (HISTORY STACK) ---
let navStack = [{ type: 'view', id: 'landing' }];
let isNavigating = false;

function goBack() {
    // Açık olan modalleri kontrol et, varsa kapat (bir nevi geri gitmek)
    const modals = ['inf-detail-modal', 'event-invite-modal', 'venue-detail-modal'];
    let modalClosed = false;
    modals.forEach(modalId => {
        const el = document.getElementById(modalId);
        if (el && !el.classList.contains('hidden-view')) {
            el.classList.add('hidden-view');
            modalClosed = true;
        }
    });
    if (modalClosed) return; // Modal kapandıysa işlemi sonlandır

    if (navStack.length > 1) {
        navStack.pop(); // Şu anki durumu çıkar
        const prev = navStack[navStack.length - 1]; // Önceki durumu al
        
        isNavigating = true; // Geri dönerken tekrar stack'e yazmayı engelle
        
        if (prev.type === 'view') {
            navigate(prev.id, prev.isGuest || false);
        } else if (prev.type === 'infTab') {
            navigate('influencer_app', prev.isGuest || false);
            switchInfTab(prev.id);
        } else if (prev.type === 'venueTab') {
            navigate('venue_app');
            switchVenueTab(prev.id);
        } else if (prev.type === 'adminTab') {
            navigate('admin_app');
            switchAdminTab(prev.id);
        }
        
        isNavigating = false;
    } else {
        isNavigating = true;
        navigate('landing');
        isNavigating = false;
    }
}

const VENUES = [
    { id: 1, name: "Noir Coffee Roasters", type: "Cafe", status: "Aktif", score: 4.8 },
    { id: 2, name: "Iron Gym Fitness", type: "Spor Salonu", status: "Aktif", score: 4.5 },
    { id: 3, name: "Gourmet Burger Co.", type: "Restoran", status: "Aktif", score: 4.9 },
    { id: 4, name: "Vibe Club & Lounge", type: "Gece Kulübü", status: "Onay Bekliyor", score: 0 }
];

function navigate(viewId, isGuest = false) {
    if (!isNavigating) {
        // Aynı sayfayı art arda eklememek için kontrol et
        const last = navStack[navStack.length - 1];
        if (!(last && last.type === 'view' && last.id === viewId)) {
            navStack.push({ type: 'view', id: viewId, isGuest: isGuest });
        }
    }

    isGuestUser = isGuest;
    document.querySelectorAll('#app-container > div').forEach(el => el.classList.add('hidden-view'));
    
    if (viewId === 'influencer_register') {
        regStep = 1;
        renderRegStep();
        document.getElementById('view-influencer-register').classList.remove('hidden-view');
    } else if (viewId === 'influencer_app') {
        document.getElementById('inf-header-subtitle').innerText = isGuest ? 'MİSAFİR GÖRÜNÜMÜ' : 'INFLUENCER PANELİ';
        document.getElementById('inf-bell').style.display = isGuest ? 'none' : 'block';
        isNavigating = true; switchInfTab('home'); isNavigating = false;
        document.getElementById('view-influencer-app').classList.remove('hidden-view');
    } else if (viewId === 'venue_app') {
        isNavigating = true; switchVenueTab('dashboard'); isNavigating = false;
        document.getElementById('view-venue-app').classList.remove('hidden-view');
    } else if (viewId === 'admin_app') {
        isNavigating = true; switchAdminTab('dashboard'); isNavigating = false;
        document.getElementById('view-admin-app').classList.remove('hidden-view');
    } else {
        document.getElementById('view-landing').classList.remove('hidden-view');
    }
    lucide.createIcons();
}

// --- INFLUENCER SEKME YÖNETİMİ ---
function switchInfTab(tab) {
    if (!isNavigating) {
        const last = navStack[navStack.length - 1];
        if (!(last && last.type === 'infTab' && last.id === tab)) {
            navStack.push({ type: 'infTab', id: tab, isGuest: isGuestUser });
        }
    }

    ['home', 'society', 'events', 'profile'].forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        btn.classList.remove('text-[#FF007F]');
        btn.classList.add('text-zinc-500');
    });
    document.getElementById(`tab-btn-${tab}`).classList.remove('text-zinc-500');
    document.getElementById(`tab-btn-${tab}`).classList.add('text-[#FF007F]');

    const container = document.getElementById('inf-main-content');
    if (tab === 'home') renderInfHome(container);
    else if (tab === 'society') renderInfSociety(container);
    else if (tab === 'events') renderInfEvents(container);
    else if (tab === 'profile') renderInfProfile(container);
    
    lucide.createIcons();
}

function renderInfHome(container) {
    let infCards = INFLUENCERS.map(inf => `
        <div onclick="openInfluencerModal(${inf.id})" class="snap-start flex-shrink-0 w-44 bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-3xl p-4 text-left relative overflow-hidden cursor-pointer active:scale-95 transition">
            ${inf.isTrending ? '<div class="absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl from-[#FF007F]/20 to-transparent flex justify-end p-2 opacity-80"><i data-lucide="zap" class="w-3 h-3 text-[#FF007F]"></i></div>' : ''}
            <img src="${inf.avatar}" class="w-14 h-14 rounded-full object-cover border-2 border-zinc-800 mb-3">
            <h3 class="text-white font-bold text-sm flex items-center gap-1.5 mb-0.5 truncate">${inf.name} ${inf.score > 4.7 ? '<i data-lucide="check-circle" class="w-3 h-3 text-[#FF007F]"></i>' : ''}</h3>
            <p class="text-zinc-500 text-[10px] font-medium mb-4 truncate">${inf.category}</p>
            <div class="flex justify-between border-t border-zinc-800 pt-3">
                <div><div class="text-zinc-600 text-[9px] font-bold uppercase tracking-wider">Takipçi</div><div class="text-zinc-300 text-xs font-black">${inf.followers}</div></div>
                <div class="text-right"><div class="text-zinc-600 text-[9px] font-bold uppercase tracking-wider">Skor</div><div class="text-[#FF007F] text-xs font-black flex items-center gap-0.5 justify-end"><i data-lucide="star" class="w-2.5 h-2.5 fill-current"></i>${inf.score}</div></div>
            </div>
        </div>
    `).join('');

    let campCards = CAMPAIGNS.map(c => `
        <div class="bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 relative shadow-xl">
            <div class="h-48 w-full relative">
                <img src="${c.image}" class="w-full h-full object-cover opacity-80">
                <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent"></div>
                ${c.isPremium ? '<div class="absolute top-4 right-4 bg-yellow-500 text-black text-xs font-black px-3 py-1.5 rounded-full flex items-center gap-1"><i data-lucide="star" class="w-3 h-3 fill-black"></i> VIP</div>' : ''}
            </div>
            <div class="p-5 relative -mt-10">
                <h3 class="text-xl font-bold mb-1 text-white">${c.placeName}</h3>
                <p class="text-zinc-400 text-sm flex items-center gap-1.5 mb-4"><i data-lucide="${c.icon}" class="w-4 h-4"></i> ${c.type}</p>
                <div class="bg-zinc-950 rounded-2xl p-4 border border-zinc-800/50">
                    <div class="mb-3"><div class="text-zinc-500 text-[10px] font-bold mb-1 uppercase">Mekanın Teklifi</div><div class="text-white font-medium text-sm">${c.offer}</div></div>
                    <div class="w-full h-px bg-zinc-800 my-3"></div>
                    <div><div class="text-zinc-500 text-[10px] font-bold mb-1 uppercase">Beklenen İçerik</div><div class="text-[#FF007F] font-bold text-sm">${c.requirement}</div></div>
                </div>
                <button onclick="applyCampaign(${c.id}, this)" class="mt-4 w-full py-3.5 rounded-xl font-bold transition-all ${appliedCampaigns.includes(c.id) ? 'bg-zinc-800 text-zinc-500 border border-zinc-700' : 'bg-[#FF007F] text-white shadow-lg shadow-[#FF007F]/20 active:scale-95'}">
                    ${isGuestUser ? 'Kayıt Ol ve Başvur' : (appliedCampaigns.includes(c.id) ? 'Başvuruldu ✓' : 'Hemen Başvur')}
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="slide-up">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-bold text-white">Öne Çıkan Sosyete Üyeleri</h2>
                <button onclick="document.getElementById('inf-scroll').scrollBy({left: 200, behavior: 'smooth'})" class="p-1.5 bg-zinc-900 border border-zinc-800 rounded-full hover:border-[#FF007F]/50 transition z-10"><i data-lucide="chevron-right" class="w-4 h-4 text-zinc-500"></i></button>
            </div>
            <div id="inf-scroll" class="flex overflow-x-auto gap-4 px-1 -mx-1 pb-4 no-scrollbar snap-x mb-6">${infCards}</div>
            
            <h2 class="text-lg font-bold mb-4 text-white">${isGuestUser ? 'Sistemdeki Güncel Fırsatlar' : 'Sana Özel Fırsatlar'}</h2>
            <div class="flex flex-col gap-6 pb-6">${campCards}</div>
        </div>
    `;
}

function renderInfSociety(container) {
    let sorted = [...INFLUENCERS].sort((a,b) => b.score - a.score);
    let html = sorted.map((inf, i) => `
        <button onclick="openInfluencerModal(${inf.id})" class="w-full text-left bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 flex items-center gap-4 active:scale-95 transition relative overflow-hidden">
            ${inf.isTrending ? '<div class="absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl from-blue-500/20 to-transparent flex justify-end p-2 opacity-50"><i data-lucide="zap" class="w-3 h-3 text-blue-400"></i></div>' : ''}
            <div class="w-8 h-8 flex items-center justify-center rounded-full font-black text-sm shadow-inner ${i === 0 ? 'bg-gradient-to-br from-yellow-300 to-yellow-600 text-black' : i === 1 ? 'bg-gradient-to-br from-zinc-300 to-zinc-500 text-black' : i === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-700 text-white' : 'bg-zinc-800 text-zinc-500'}">#${i+1}</div>
            <img src="${inf.avatar}" class="w-14 h-14 rounded-full object-cover border-2 border-zinc-800">
            <div class="flex-1">
                <h3 class="text-white font-bold flex items-center gap-1.5">${inf.name} ${inf.score > 4.7 ? '<i data-lucide="check-circle" class="w-3.5 h-3.5 text-[#FF007F]"></i>' : ''}</h3>
                <p class="text-zinc-500 text-xs">${inf.category}</p>
            </div>
            <div class="text-right">
                <div class="text-[#FF007F] font-black flex items-center justify-end gap-1"><i data-lucide="star" class="w-3 h-3 fill-current"></i>${inf.score}</div>
                <div class="text-[10px] text-zinc-500 font-bold mt-1">SKOR</div>
            </div>
        </button>
    `).join('');

    container.innerHTML = `
        <div class="slide-up pb-6">
            <div class="flex justify-between items-end mb-6">
                <div><h2 class="text-xl font-bold text-white">Sosyete Liderleri</h2><p class="text-xs text-zinc-500 mt-1">Sıralama puan ve aktifliğe göredir.</p></div>
                <div class="bg-[#FF007F]/10 text-[#FF007F] px-3 py-1 rounded-full text-xs font-bold border border-[#FF007F]/20 flex items-center gap-1"><i data-lucide="trending-up" class="w-3.5 h-3.5"></i> Canlı</div>
            </div>
            <div class="flex flex-col gap-3">${html}</div>
        </div>
    `;
}

function renderInfEvents(container) {
    let html = EVENTS.map(ev => `
        <div class="bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 relative">
            <div class="flex gap-4 p-4">
                <img src="${ev.image}" class="w-28 h-28 rounded-2xl object-cover">
                <div class="flex-1 flex flex-col justify-center">
                    <div class="text-[10px] font-black uppercase tracking-widest mb-1 ${ev.status === 'Gelecek' ? 'text-[#FF007F]' : 'text-zinc-500'}">${ev.status}</div>
                    <h3 class="text-white font-bold leading-snug mb-2">${ev.title}</h3>
                    <div class="flex items-center gap-1.5 text-zinc-400 text-xs mb-1"><i data-lucide="calendar" class="w-3 h-3"></i> ${ev.date}</div>
                    <div class="flex items-center gap-1.5 text-zinc-400 text-xs"><i data-lucide="map-pin" class="w-3 h-3"></i> ${ev.location}</div>
                </div>
            </div>
            ${ev.status === 'Gelecek' ? `<button onclick="openInviteModal(${ev.id})" class="w-full bg-zinc-950 py-3 text-sm font-bold text-white transition border-t border-zinc-800 active:bg-zinc-900">${isGuestUser ? 'Katılmak İçin Üye Ol' : 'Davetiye İste (Katkı Seç)'}</button>` : ''}
        </div>
    `).join('');
    container.innerHTML = `<div class="slide-up pb-6"><h2 class="text-xl font-bold text-white mb-6">Sosyete Etkinlikleri</h2><div class="flex flex-col gap-4">${html}</div></div>`;
}

function renderInfProfile(container) {
    if (isGuestUser) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 text-center slide-up">
                <div class="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-800"><i data-lucide="user" class="w-10 h-10 text-zinc-600"></i></div>
                <h2 class="text-2xl font-black text-white mb-3">Profiliniz Yok</h2>
                <p class="text-zinc-400 text-sm mb-8 px-4 leading-relaxed">Sosyete'ye katılarak portfolyonuzu oluşturabilir ve mekanların size ulaşmasını sağlayabilirsiniz.</p>
                <button onclick="navigate('influencer_register')" class="bg-[#FF007F] text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(255,0,127,0.3)] active:scale-95">Hemen Kayıt Ol <i data-lucide="arrow-right" class="w-4 h-4"></i></button>
            </div>`;
    } else {
        const user = currentUser || INFLUENCERS[0]; // Kayıtlı profil (currentUser) varsa onu, yoksa ilk profili göster
        container.innerHTML = `
            <div class="slide-up pb-6">
                <div class="text-center mb-6 pt-2">
                    <div class="relative inline-block mb-4">
                        <img src="${user.avatar}" class="w-24 h-24 rounded-full border-2 border-[#FF007F] object-cover shadow-[0_0_20px_rgba(255,0,127,0.4)]">
                        <div class="absolute -bottom-2 -right-2 bg-[#FF007F] w-8 h-8 rounded-full flex items-center justify-center border-2 border-black shadow-lg"><i data-lucide="award" class="w-4 h-4 text-white"></i></div>
                    </div>
                    <h2 class="text-2xl font-black text-white flex justify-center items-center gap-1">${user.name} <i data-lucide="check-circle" class="w-4 h-4 text-[#FF007F]"></i></h2>
                    <p class="text-zinc-400 text-sm mt-1">${user.handle} • ${user.category}</p>
                    <p class="text-zinc-500 text-xs mt-3 px-4 leading-relaxed">${user.bio}</p>
                </div>
                <div class="flex gap-2 mb-6">
                    <button onclick="openQRModal()" class="flex-1 bg-gradient-to-r from-[#FF007F] to-purple-600 border border-[#FF007F]/50 text-white py-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition shadow-lg shadow-[#FF007F]/20"><i data-lucide="qr-code" class="w-4 h-4"></i> Gossip QR Kimlik</button>
                    <button onclick="openStatsModal()" class="flex-1 bg-zinc-900 border border-zinc-800 text-white py-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition hover:bg-zinc-800"><i data-lucide="bar-chart-3" class="w-4 h-4 text-zinc-400"></i> İstatistikler</button>
                </div>
                <button onclick="openAlgorithmModal()" class="w-full text-left bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/30 rounded-3xl p-5 mb-6 shadow-lg active:scale-95 transition cursor-pointer group block">
                    <div class="flex justify-between items-start mb-1">
                        <h3 class="text-white font-bold flex items-center gap-2"><i data-lucide="zap" class="w-4 h-4 text-blue-400"></i> Algoritma Sağlığı</h3>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-blue-400/50 group-hover:text-blue-400 transition"></i>
                    </div>
                    <p class="text-blue-200/70 text-xs mb-4">Mekanlardan aldığın puanlar ve görev teslimlerinle hesaplanır.</p>
                    <div class="flex justify-between items-end mb-2"><span class="text-sm font-bold text-zinc-300">Sistem Puanın</span><span class="text-xl font-black text-white">%100</span></div>
                    <div class="w-full bg-black/50 h-2 rounded-full overflow-hidden"><div class="bg-gradient-to-r from-blue-500 to-[#FF007F] w-full h-full"></div></div>
                </button>
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <button onclick="openScoreModal()" class="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 text-center hover:border-yellow-500/50 active:scale-95 transition group cursor-pointer"><i data-lucide="star" class="w-6 h-6 text-yellow-500 mx-auto mb-2 group-hover:scale-110 transition"></i><div class="text-2xl font-black text-white">${user.score}</div><div class="text-[10px] text-zinc-500 font-bold uppercase mt-1">Profil Puanı</div></button>
                    <button onclick="openJobsModal()" class="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 text-center hover:border-green-500/50 active:scale-95 transition group cursor-pointer"><i data-lucide="check-circle" class="w-6 h-6 text-green-500 mx-auto mb-2 group-hover:scale-110 transition"></i><div class="text-2xl font-black text-white">${user.jobs}</div><div class="text-[10px] text-zinc-500 font-bold uppercase mt-1">Tamamlanan İş</div></button>
                </div>
                <h3 class="text-white font-bold mb-3 flex items-center gap-2"><i data-lucide="grid" class="w-4 h-4 text-[#FF007F]"></i> Portfolyo</h3>
                <div class="grid grid-cols-3 gap-3 mb-8">
                    <div class="aspect-square bg-zinc-900 rounded-xl border border-zinc-800 relative"><img src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=400" class="w-full h-full object-cover rounded-xl"></div>
                    <div class="aspect-square bg-zinc-900 rounded-xl border border-zinc-800 relative"><img src="https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=400" class="w-full h-full object-cover rounded-xl"></div>
                    <button class="aspect-square bg-zinc-900/50 rounded-xl border border-zinc-800 border-dashed flex flex-col items-center justify-center text-zinc-500 active:scale-95 transition"><i data-lucide="plus-circle" class="w-6 h-6 mb-1"></i><span class="text-[10px] font-bold">Yeni Ekle</span></button>
                </div>
            </div>`;
    }
}

function openQRModal() {
    const modal = document.getElementById('inf-detail-modal');
    const user = currentUser || INFLUENCERS[0];
    modal.innerHTML = `
        <div class="p-6 bg-zinc-950 h-full flex flex-col justify-center items-center slide-up relative pt-12">
            <button onclick="document.getElementById('inf-detail-modal').classList.add('hidden-view')" class="absolute top-6 right-6 p-2 bg-zinc-900 rounded-full text-white active:scale-95 z-10"><i data-lucide="x" class="w-5 h-5"></i></button>
            <h2 class="text-2xl font-black text-white mb-2">Gossip QR Kimlik</h2>
            <p class="text-zinc-400 text-sm mb-8 text-center px-4">Mekana giriş yaptığında bu kodu okutarak işbirliğini ve rezervasyonunu anında başlatabilirsin.</p>
            <div class="bg-white p-4 rounded-3xl mb-6 shadow-[0_0_40px_rgba(255,0,127,0.3)]">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=gossip_society_${user.handle}" class="w-48 h-48 rounded-xl">
            </div>
            <div class="text-center">
                <div class="text-lg font-bold text-white">${user.name}</div>
                <div class="text-[#FF007F] text-sm font-medium">${user.handle}</div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

function openJobsModal() {
    const modal = document.getElementById('inf-detail-modal');
    const user = currentUser || INFLUENCERS[0];
    
    let jobsHtml = [
        { venue: "Noir Coffee Roasters", rating: 5.0, date: "2 gün önce", comment: "İçerikler harikaydı, tam zamanında geldi ve çok profesyoneldi." },
        { venue: "Gourmet Burger Co.", rating: 4.8, date: "1 hafta önce", comment: "Enerjisi çok yüksek, takipçileri mekanımıza akın etti. Kesinlikle tekrar çalışacağız." },
        { venue: "Soho House", rating: 5.0, date: "3 hafta önce", comment: "Etkinliğimizin ruhunu yansıtan kusursuz bir Story serisi hazırladı." },
        { venue: "Vibe Club & Lounge", rating: 4.5, date: "1 ay önce", comment: "Güzel bir reels videosu oldu, mekan tanıtımı başarılıydı." }
    ].map(job => `
        <div class="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 mb-3">
            <div class="flex justify-between items-start mb-2">
                <div class="font-bold text-white text-sm">${job.venue}</div>
                <div class="flex items-center gap-1 text-[#FF007F] font-black text-sm"><i data-lucide="star" class="w-3.5 h-3.5 fill-[#FF007F]"></i>${job.rating}</div>
            </div>
            <p class="text-zinc-400 text-xs italic mb-3 leading-relaxed">"${job.comment}"</p>
            <div class="text-zinc-600 text-[10px] font-bold uppercase">${job.date}</div>
        </div>
    `).join('');

    modal.innerHTML = `
        <div class="p-6 bg-zinc-950 h-full overflow-y-auto slide-up flex flex-col relative pt-16">
            <button onclick="document.getElementById('inf-detail-modal').classList.add('hidden-view')" class="absolute top-6 right-6 p-2 bg-zinc-900 rounded-full text-white active:scale-95 z-10"><i data-lucide="x" class="w-5 h-5"></i></button>
            <h2 class="text-2xl font-black text-white mb-2">Geçmiş İşbirlikleri</h2>
            <p class="text-zinc-400 text-sm mb-6">Mekanların işbirliği sonrası senin hakkında yaptığı özel değerlendirmeler ve puanlar.</p>
            <div class="flex flex-col pb-8">${jobsHtml}</div>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

function openScoreModal() {
    const modal = document.getElementById('inf-detail-modal');
    const user = currentUser || INFLUENCERS[0];
    
    modal.innerHTML = `
        <div class="p-6 bg-zinc-950 h-full overflow-y-auto slide-up flex flex-col relative pt-16">
            <button onclick="document.getElementById('inf-detail-modal').classList.add('hidden-view')" class="absolute top-6 right-6 p-2 bg-zinc-900 rounded-full text-white active:scale-95 z-10"><i data-lucide="x" class="w-5 h-5"></i></button>
            <h2 class="text-2xl font-black text-white mb-2">Profil Puanı Analizi</h2>
            <p class="text-zinc-400 text-sm mb-6">İşbirlikleri sonrası mekanların verdiği puanların detaylı ortalaması ve performans kriterlerin.</p>
            
            <div class="bg-zinc-900 p-5 rounded-3xl border border-zinc-800 mb-6 shadow-xl relative overflow-hidden">
                <div class="absolute -right-4 -top-4 opacity-10"><i data-lucide="award" class="w-32 h-32 text-yellow-500"></i></div>
                
                <div class="flex items-center gap-4 mb-6 relative z-10">
                    <div class="w-16 h-16 bg-yellow-500/10 rounded-2xl border border-yellow-500/20 flex items-center justify-center">
                        <span class="text-2xl font-black text-yellow-500">${user.score}</span>
                    </div>
                    <div>
                        <div class="text-white font-bold text-lg mb-1">Mükemmel Seviye</div>
                        <div class="flex gap-1">
                            <i data-lucide="star" class="w-4 h-4 text-yellow-500 fill-yellow-500"></i>
                            <i data-lucide="star" class="w-4 h-4 text-yellow-500 fill-yellow-500"></i>
                            <i data-lucide="star" class="w-4 h-4 text-yellow-500 fill-yellow-500"></i>
                            <i data-lucide="star" class="w-4 h-4 text-yellow-500 fill-yellow-500"></i>
                            <i data-lucide="star-half" class="w-4 h-4 text-yellow-500 fill-yellow-500"></i>
                        </div>
                    </div>
                </div>

                <div class="space-y-4 relative z-10">
                    <div>
                        <div class="flex justify-between text-xs font-bold mb-1"><span class="text-zinc-300">İçerik Kalitesi</span> <span class="text-yellow-500">4.9</span></div>
                        <div class="w-full bg-zinc-950 h-1.5 rounded-full"><div class="bg-yellow-500 h-full w-[98%] rounded-full"></div></div>
                    </div>
                    <div>
                        <div class="flex justify-between text-xs font-bold mb-1"><span class="text-zinc-300">İletişim & Nezaket</span> <span class="text-yellow-500">5.0</span></div>
                        <div class="w-full bg-zinc-950 h-1.5 rounded-full"><div class="bg-yellow-500 h-full w-[100%] rounded-full"></div></div>
                    </div>
                    <div>
                        <div class="flex justify-between text-xs font-bold mb-1"><span class="text-zinc-300">Etkileşim (Geri Dönüş)</span> <span class="text-yellow-500">4.7</span></div>
                        <div class="w-full bg-zinc-950 h-1.5 rounded-full"><div class="bg-yellow-500 h-full w-[94%] rounded-full"></div></div>
                    </div>
                    <div>
                        <div class="flex justify-between text-xs font-bold mb-1"><span class="text-zinc-300">Zamanlama (Dakiklik)</span> <span class="text-yellow-500">4.5</span></div>
                        <div class="w-full bg-zinc-950 h-1.5 rounded-full"><div class="bg-yellow-500 h-full w-[90%] rounded-full"></div></div>
                    </div>
                </div>
            </div>

            <div class="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 flex gap-3">
                <i data-lucide="info" class="w-5 h-5 text-blue-400 shrink-0"></i>
                <p class="text-xs text-blue-200/80 leading-relaxed font-medium">Profil puanın, sistemdeki "Sosyete" sıralamanı büyük ölçüde etkiler. Puanı 4.5'in altına düşen kullanıcıların bazı Premium mekanlara başvuruları sistem tarafından kısıtlanır.</p>
            </div>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

function openStatsModal() {
    // Aktif istatistik penceresi
    const modal = document.getElementById('inf-detail-modal');
    const user = currentUser || INFLUENCERS[0];
    modal.innerHTML = `
        <div class="p-6 bg-zinc-950 h-full overflow-y-auto slide-up flex flex-col pt-12 relative pb-10">
            <button onclick="document.getElementById('inf-detail-modal').classList.add('hidden-view')" class="absolute top-6 right-6 p-2 bg-zinc-900 rounded-full text-white active:scale-95 z-10"><i data-lucide="x" class="w-5 h-5"></i></button>
            <h2 class="text-2xl font-bold text-white mb-6">Detaylı İstatistikler</h2>
            
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
                        <div class="text-zinc-500 text-[10px] font-bold uppercase mb-1 flex items-center gap-1.5"><i data-lucide="mouse-pointer-click" class="w-3.5 h-3.5 text-blue-400"></i> Etkileşim Oranı</div>
                        <div class="text-xl font-black text-white">%14.2</div>
                    </div>
                    <div class="bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
                        <div class="text-zinc-500 text-[10px] font-bold uppercase mb-1 flex items-center gap-1.5"><i data-lucide="eye" class="w-3.5 h-3.5 text-purple-400"></i> Görüntülenme</div>
                        <div class="text-xl font-black text-white">+850K</div>
                    </div>
                </div>

                <div class="bg-zinc-900 p-5 rounded-2xl border border-zinc-800">
                    <h3 class="text-white font-bold text-sm mb-4 flex items-center gap-2"><i data-lucide="pie-chart" class="w-4 h-4 text-[#FF007F]"></i> Kitle Demografisi</h3>
                    
                    <div class="mb-4">
                        <div class="flex justify-between text-xs font-bold mb-1"><span class="text-pink-400">Kadın %65</span><span class="text-blue-400">%35 Erkek</span></div>
                        <div class="w-full h-2 rounded-full overflow-hidden flex">
                            <div class="bg-pink-400 h-full w-[65%]"></div>
                            <div class="bg-blue-400 h-full w-[35%]"></div>
                        </div>
                    </div>

                    <div class="space-y-2 mt-4">
                        <div class="flex items-center gap-3">
                            <div class="text-xs text-zinc-400 font-bold w-12">18-24</div>
                            <div class="flex-1 bg-zinc-950 h-2 rounded-full overflow-hidden"><div class="bg-[#FF007F] h-full w-[45%] rounded-full"></div></div>
                            <div class="text-xs text-white font-bold">%45</div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="text-xs text-zinc-400 font-bold w-12">25-34</div>
                            <div class="flex-1 bg-zinc-950 h-2 rounded-full overflow-hidden"><div class="bg-[#FF007F] h-full w-[35%] rounded-full opacity-80"></div></div>
                            <div class="text-xs text-white font-bold">%35</div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="text-xs text-zinc-400 font-bold w-12">35-44</div>
                            <div class="flex-1 bg-zinc-950 h-2 rounded-full overflow-hidden"><div class="bg-[#FF007F] h-full w-[15%] rounded-full opacity-60"></div></div>
                            <div class="text-xs text-white font-bold">%15</div>
                        </div>
                    </div>
                </div>
                
                <div class="bg-gradient-to-r from-green-500/10 to-transparent p-4 rounded-2xl border border-green-500/20 flex items-start gap-3 mt-4">
                    <i data-lucide="trending-up" class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"></i>
                    <div>
                        <div class="text-sm font-bold text-white mb-1">Hesap Büyüme Hızın Yüksek!</div>
                        <div class="text-xs text-zinc-400 leading-relaxed">Son 1 ayda profilin bölgedeki diğer hesaplara göre %24 daha fazla mekan aramalarında öne çıktı.</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

function openAlgorithmModal() {
    const modal = document.getElementById('inf-detail-modal');
    modal.innerHTML = `
        <div class="p-6 bg-zinc-950 h-full overflow-y-auto slide-up flex flex-col pt-12 relative pb-10">
            <button onclick="document.getElementById('inf-detail-modal').classList.add('hidden-view')" class="absolute top-6 right-6 p-2 bg-zinc-900 rounded-full text-white active:scale-95 z-10"><i data-lucide="x" class="w-5 h-5"></i></button>
            
            <div class="w-16 h-16 bg-blue-500/10 rounded-2xl border border-blue-500/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                <i data-lucide="activity" class="w-8 h-8 text-blue-400"></i>
            </div>
            
            <h2 class="text-2xl font-black text-white mb-2">Algoritma Analizi</h2>
            <p class="text-zinc-400 text-sm mb-8 leading-relaxed">Sistemdeki görünürlüğünüz, kampanya eşleşme önceliğiniz ve güvenilirlik endeksiniz yapay zeka tarafından sürekli analiz edilir.</p>
            
            <div class="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-5 mb-6">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-blue-100 font-bold">Genel Sağlık Durumu</span>
                    <span class="bg-blue-500 text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider">Mükemmel</span>
                </div>
                <p class="text-blue-300/70 text-xs">Profilin şu an mekan arama sonuçlarında <strong class="text-blue-400">ilk %5'lik dilimde</strong> sergileniyor.</p>
            </div>

            <div class="space-y-5">
                <div>
                    <div class="flex justify-between text-xs font-bold mb-2"><span class="text-zinc-300 flex items-center gap-1.5"><i data-lucide="clock" class="w-3.5 h-3.5 text-green-400"></i> Randevu Sadakati</span> <span class="text-white">%100</span></div>
                    <div class="w-full bg-zinc-900 h-2 rounded-full overflow-hidden"><div class="bg-green-400 h-full w-[100%] rounded-full shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div></div>
                    <p class="text-[10px] text-zinc-500 mt-1.5">Gecikme ve habersiz iptal oranınız çok düşük.</p>
                </div>
                
                <div>
                    <div class="flex justify-between text-xs font-bold mb-2"><span class="text-zinc-300 flex items-center gap-1.5"><i data-lucide="camera" class="w-3.5 h-3.5 text-[#FF007F]"></i> İçerik Teslim Hızı</span> <span class="text-white">%94</span></div>
                    <div class="w-full bg-zinc-900 h-2 rounded-full overflow-hidden"><div class="bg-[#FF007F] h-full w-[94%] rounded-full shadow-[0_0_10px_rgba(255,0,127,0.5)]"></div></div>
                    <p class="text-[10px] text-zinc-500 mt-1.5">Mekan ziyaretinden sonra ilk 48 saat içinde paylaşım oranınız.</p>
                </div>

                <div>
                    <div class="flex justify-between text-xs font-bold mb-2"><span class="text-zinc-300 flex items-center gap-1.5"><i data-lucide="message-circle" class="w-3.5 h-3.5 text-purple-400"></i> Yanıt Süresi</span> <span class="text-white">Ort. 2 Saat</span></div>
                    <div class="w-full bg-zinc-900 h-2 rounded-full overflow-hidden"><div class="bg-purple-400 h-full w-[85%] rounded-full"></div></div>
                    <p class="text-[10px] text-zinc-500 mt-1.5">Mekanlardan gelen mesajlara ve tekliflere dönüş hızınız.</p>
                </div>
            </div>
            
            <div class="mt-8 bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex gap-3">
                <i data-lucide="shield-alert" class="w-5 h-5 text-zinc-500 shrink-0"></i>
                <p class="text-xs text-zinc-400 leading-relaxed font-medium">Algoritma sağlığınızın %70'in altına düşmesi durumunda Premium mekanların kampanyalarına başvurunuz kısıtlanabilir.</p>
            </div>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

function openNotificationsModal() {
    const modal = document.getElementById('inf-detail-modal');
    modal.innerHTML = `
        <div class="p-6 bg-zinc-950 h-full overflow-y-auto slide-in-right flex flex-col pt-12 relative pb-10">
            <button onclick="document.getElementById('inf-detail-modal').classList.add('hidden-view')" class="absolute top-6 right-6 p-2 bg-zinc-900 rounded-full text-white active:scale-95 z-10"><i data-lucide="x" class="w-5 h-5"></i></button>
            
            <div class="flex items-center gap-3 mb-8">
                <h2 class="text-2xl font-black text-white">Bildirimler</h2>
                <span class="bg-[#FF007F]/20 text-[#FF007F] text-xs font-black px-2 py-0.5 rounded-md border border-[#FF007F]/30">3 Yeni</span>
            </div>

            <div class="space-y-4">
                <!-- Bildirim 1 (Yeni Eşleşme) -->
                <div class="bg-zinc-900/80 p-4 rounded-2xl border border-[#FF007F]/30 flex gap-4 relative overflow-hidden group cursor-pointer active:scale-[0.98] transition">
                    <div class="absolute left-0 top-0 w-1 h-full bg-[#FF007F]"></div>
                    <div class="w-10 h-10 rounded-full bg-[#FF007F]/10 flex items-center justify-center shrink-0">
                        <i data-lucide="check-circle" class="w-5 h-5 text-[#FF007F]"></i>
                    </div>
                    <div>
                        <div class="text-white text-sm font-bold mb-1">Başvurunuz Onaylandı!</div>
                        <p class="text-zinc-400 text-xs leading-relaxed mb-2"><strong class="text-zinc-300">Noir Coffee Roasters</strong> kampanyası için seçildiniz. Mekan sizi bekliyor.</p>
                        <div class="text-[10px] text-zinc-500 font-bold uppercase">2 saat önce</div>
                    </div>
                </div>

                <!-- Bildirim 2 (Hatırlatma) -->
                <div class="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex gap-4 cursor-pointer active:scale-[0.98] transition">
                    <div class="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0 border border-yellow-500/20">
                        <i data-lucide="calendar-clock" class="w-5 h-5 text-yellow-500"></i>
                    </div>
                    <div>
                        <div class="text-white text-sm font-bold mb-1">Yaklaşan Ziyaret</div>
                        <p class="text-zinc-400 text-xs leading-relaxed mb-2">Yarın saat 14:00'da <strong class="text-zinc-300">Gourmet Burger Co.</strong> rezervasyonunuz bulunmaktadır. Lütfen zamanında orada olun.</p>
                        <div class="text-[10px] text-zinc-500 font-bold uppercase">5 saat önce</div>
                    </div>
                </div>

                <!-- Bildirim 3 (Sistem / Algoritma) -->
                <div class="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex gap-4 cursor-pointer active:scale-[0.98] transition">
                    <div class="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                        <i data-lucide="trending-up" class="w-5 h-5 text-blue-400"></i>
                    </div>
                    <div>
                        <div class="text-white text-sm font-bold mb-1">Algoritma Puanınız Arttı</div>
                        <p class="text-zinc-400 text-xs leading-relaxed mb-2">Son yaptığınız işbirliklerindeki üstün performansınız sayesinde görünürlüğünüz <strong class="text-blue-400">%5 arttı</strong>.</p>
                        <div class="text-[10px] text-zinc-500 font-bold uppercase">1 gün önce</div>
                    </div>
                </div>

                <!-- Bildirim 4 (Etkinlik Onayı) -->
                <div class="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex gap-4 opacity-70 cursor-pointer active:scale-[0.98] transition">
                    <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                        <i data-lucide="ticket" class="w-5 h-5 text-zinc-400"></i>
                    </div>
                    <div>
                        <div class="text-zinc-300 text-sm font-bold mb-1">Etkinlik Davetiniz Onaylandı</div>
                        <p class="text-zinc-500 text-xs leading-relaxed mb-2"><strong class="text-zinc-400">Sneaker Pop-up</strong> etkinliği için biletiniz QR kod olarak tanımlandı.</p>
                        <div class="text-[10px] text-zinc-600 font-bold uppercase">3 gün önce</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

// --- YÖNETİCİ (ADMIN) PANELİ YÖNETİMİ ---
function switchAdminTab(tab) {
    if (!isNavigating) {
        const last = navStack[navStack.length - 1];
        if (!(last && last.type === 'adminTab' && last.id === tab)) {
            navStack.push({ type: 'adminTab', id: tab });
        }
    }

    ['dashboard', 'users', 'venues', 'campaigns'].forEach(t => {
        const btn = document.getElementById(`a-tab-btn-${t}`);
        if(btn) { btn.classList.remove('text-red-500'); btn.classList.add('text-zinc-500'); }
    });
    const btn = document.getElementById(`a-tab-btn-${tab}`);
    if(btn) { btn.classList.remove('text-zinc-500'); btn.classList.add('text-red-500'); }

    const container = document.getElementById('admin-main-content');
    if (tab === 'dashboard') renderAdminDash(container);
    else if (tab === 'users') renderAdminUsers(container);
    else if (tab === 'venues') renderAdminVenues(container);
    else if (tab === 'campaigns') renderAdminCampaigns(container);
    
    lucide.createIcons();
}

function renderAdminDash(container) {
    container.innerHTML = `
        <div class="slide-up pb-8">
            <h2 class="text-xl font-bold text-white mb-4">Sistem Özeti</h2>
            <div class="grid grid-cols-2 gap-3 mb-6">
                <button onclick="switchAdminTab('users')" class="w-full text-left bg-zinc-900 border border-zinc-800 hover:border-blue-500/50 hover:bg-zinc-900/80 p-4 rounded-2xl transition active:scale-95 group">
                    <div class="flex justify-between items-start mb-2">
                        <i data-lucide="users" class="w-6 h-6 text-blue-400"></i>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-600 group-hover:text-blue-400 transition"></i>
                    </div>
                    <div class="text-2xl font-black text-white">1,248</div>
                    <div class="text-[10px] text-zinc-500 font-bold uppercase mt-1">Kayıtlı Influencer</div>
                </button>
                <button onclick="switchAdminTab('venues')" class="w-full text-left bg-zinc-900 border border-zinc-800 hover:border-green-500/50 hover:bg-zinc-900/80 p-4 rounded-2xl transition active:scale-95 group">
                    <div class="flex justify-between items-start mb-2">
                        <i data-lucide="store" class="w-6 h-6 text-green-400"></i>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-600 group-hover:text-green-400 transition"></i>
                    </div>
                    <div class="text-2xl font-black text-white">142</div>
                    <div class="text-[10px] text-zinc-500 font-bold uppercase mt-1">Onaylı Mekan</div>
                </button>
                <button onclick="switchAdminTab('campaigns')" class="w-full text-left bg-zinc-900 border border-zinc-800 hover:border-purple-500/50 hover:bg-zinc-900/80 p-4 rounded-2xl transition active:scale-95 group">
                    <div class="flex justify-between items-start mb-2">
                        <i data-lucide="megaphone" class="w-6 h-6 text-purple-400"></i>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-600 group-hover:text-purple-400 transition"></i>
                    </div>
                    <div class="text-2xl font-black text-white">56</div>
                    <div class="text-[10px] text-zinc-500 font-bold uppercase mt-1">Aktif İlan</div>
                </button>
                <button onclick="document.getElementById('quick-actions-panel').scrollIntoView({behavior: 'smooth'})" class="w-full text-left bg-zinc-900 border border-red-900/50 hover:border-red-500/50 hover:bg-red-950/30 p-4 rounded-2xl relative transition active:scale-95 group">
                    <div class="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                    <div class="flex justify-between items-start mb-2">
                        <i data-lucide="bell" class="w-6 h-6 text-red-400"></i>
                        <i data-lucide="chevron-down" class="w-4 h-4 text-red-500/50 group-hover:text-red-400 transition"></i>
                    </div>
                    <div class="text-2xl font-black text-red-500">14</div>
                    <div class="text-[10px] text-red-400/80 font-bold uppercase mt-1">Onay Bekleyen İşlem</div>
                </button>
            </div>

            <h3 id="quick-actions-panel" class="font-bold text-white mb-3 pt-2">Hızlı İşlemler</h3>
            <div class="space-y-2">
                <button onclick="switchAdminTab('users')" class="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 p-4 rounded-xl flex items-center justify-between transition group">
                    <div class="flex items-center gap-3"><i data-lucide="user-plus" class="text-zinc-400 w-5 h-5 group-hover:text-blue-400 transition"></i> <span class="text-sm font-bold text-white">Yeni Influencer Başvuruları (8)</span></div>
                    <div class="flex items-center gap-2"><span class="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">YENİ</span><i data-lucide="chevron-right" class="w-4 h-4 text-zinc-600"></i></div>
                </button>
                <button onclick="switchAdminTab('venues')" class="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 p-4 rounded-xl flex items-center justify-between transition group">
                    <div class="flex items-center gap-3"><i data-lucide="store" class="text-zinc-400 w-5 h-5 group-hover:text-green-400 transition"></i> <span class="text-sm font-bold text-white">Mekan Kayıt Talepleri (3)</span></div>
                    <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-600"></i>
                </button>
                <button class="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 p-4 rounded-xl flex items-center justify-between transition group">
                    <div class="flex items-center gap-3"><i data-lucide="alert-triangle" class="text-zinc-400 w-5 h-5 group-hover:text-yellow-500 transition"></i> <span class="text-sm font-bold text-white">Şikayet ve İhlaller (2)</span></div>
                    <div class="flex items-center gap-2"><span class="bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 text-[10px] font-black px-2 py-0.5 rounded-full">ACİL</span><i data-lucide="chevron-right" class="w-4 h-4 text-zinc-600"></i></div>
                </button>
            </div>
        </div>
    `;
}

function renderAdminUsers(container) {
    let html = INFLUENCERS.map(inf => `
        <div class="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center gap-3 mb-3">
            <img src="${inf.avatar}" class="w-12 h-12 rounded-full object-cover">
            <div class="flex-1">
                <div class="text-white font-bold text-sm flex items-center gap-1">${inf.name} <span class="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">${inf.score} <i data-lucide="star" class="w-2.5 h-2.5 inline pb-0.5 text-yellow-500"></i></span></div>
                <div class="text-zinc-500 text-xs">${inf.handle}</div>
            </div>
            <div class="flex gap-2">
                <button class="p-2 bg-zinc-800 rounded-lg hover:bg-blue-600/20 hover:text-blue-500 text-zinc-400 transition" title="Düzenle"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                <button class="p-2 bg-zinc-800 rounded-lg hover:bg-red-600/20 hover:text-red-500 text-zinc-400 transition" title="Hesabı Askıya Al"><i data-lucide="ban" class="w-4 h-4"></i></button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = `
        <div class="slide-up pb-6">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-bold text-white">İçerik Üreticileri</h2>
                <div class="bg-zinc-900 border border-zinc-800 flex items-center px-3 py-1.5 rounded-lg gap-2 text-zinc-400"><i data-lucide="search" class="w-4 h-4"></i><input type="text" placeholder="Ara..." class="bg-transparent outline-none w-20 text-xs text-white"></div>
            </div>
            ${html}
        </div>
    `;
}

function renderAdminVenues(container) {
    let html = VENUES.map(v => `
        <div class="bg-zinc-900 border ${v.status === 'Onay Bekliyor' ? 'border-yellow-500/50' : 'border-zinc-800'} p-4 rounded-2xl flex items-center gap-3 mb-3">
            <div class="w-12 h-12 rounded-xl bg-zinc-950 flex items-center justify-center border border-zinc-800"><i data-lucide="store" class="w-5 h-5 text-zinc-500"></i></div>
            <div class="flex-1">
                <div class="text-white font-bold text-sm">${v.name}</div>
                <div class="text-xs ${v.status === 'Aktif' ? 'text-green-500' : 'text-yellow-500'} font-bold">${v.status}</div>
            </div>
            <div class="flex gap-2">
                ${v.status === 'Onay Bekliyor' ? `<button class="px-3 py-1.5 bg-green-500/20 text-green-500 font-bold text-xs rounded-lg transition hover:bg-green-500/30">Onayla</button>` : `<button class="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-zinc-400 transition" title="Mekan Ayarları"><i data-lucide="settings" class="w-4 h-4"></i></button>`}
            </div>
        </div>
    `).join('');

    container.innerHTML = `<div class="slide-up pb-6"><h2 class="text-lg font-bold text-white mb-4">Mekanlar & İşletmeler</h2>${html}</div>`;
}

function renderAdminCampaigns(container) {
    let html = CAMPAIGNS.map(c => `
        <div class="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl mb-3">
            <div class="flex justify-between items-start mb-2">
                <div class="font-bold text-white text-sm">${c.placeName}</div>
                <span class="text-[9px] bg-green-500/20 text-green-400 px-2 py-1 rounded uppercase font-bold">Yayında</span>
            </div>
            <div class="text-xs text-zinc-400 mb-3">${c.offer}</div>
            <div class="flex gap-2 border-t border-zinc-800 pt-3">
                <button class="flex-1 bg-zinc-950 border border-zinc-800 py-2 rounded-lg text-xs font-bold text-zinc-300 hover:text-white transition">İlanı Düzenle</button>
                <button class="flex-1 bg-red-500/10 border border-red-500/20 py-2 rounded-lg text-xs font-bold text-red-500 hover:bg-red-500/20 transition">Askıya Al</button>
            </div>
        </div>
    `).join('');

    container.innerHTML = `<div class="slide-up pb-6"><h2 class="text-lg font-bold text-white mb-4">Aktif Kampanyalar</h2>${html}</div>`;
}

// --- MEKAN PANELİ YÖNETİMİ ---
function switchVenueTab(tab) {
    if (!isNavigating) {
        const last = navStack[navStack.length - 1];
        if (!(last && last.type === 'venueTab' && last.id === tab)) {
            navStack.push({ type: 'venueTab', id: tab });
        }
    }

    ['dash', 'apps', 'profile', 'settings'].forEach(t => {
        const btn = document.getElementById(`v-tab-btn-${t}`);
        if(btn) { btn.classList.remove('text-[#FF007F]'); btn.classList.add('text-zinc-500'); }
    });
    // Dashboard sekmesinin buton ID'sini v-tab-btn-dash olarak tanımlamıştık
    const btn = document.getElementById(tab === 'dashboard' ? 'v-tab-btn-dash' : `v-tab-btn-${tab}`);
    if(btn) { btn.classList.remove('text-zinc-500'); btn.classList.add('text-[#FF007F]'); }

    const container = document.getElementById('venue-main-content');
    if (tab === 'dashboard') renderVenueDashboard(container);
    else if (tab === 'create') renderVenueCreate(container);
    else if (tab === 'apps') renderVenueApps(container);
    else if (tab === 'profile') renderVenueProfile(container);
    else if (tab === 'settings') renderVenueMenu(container);
    
    lucide.createIcons();
}

function renderVenueMenu(container) {
    container.innerHTML = `
        <div class="slide-up pb-8">
            <!-- Cüzdan / Bakiye Alanı -->
            <div class="bg-gradient-to-r from-purple-900/40 to-[#FF007F]/40 border border-[#FF007F]/30 p-5 rounded-3xl mb-6 flex justify-between items-center shadow-[0_0_30px_rgba(255,0,127,0.1)]">
                <div>
                    <div class="text-[10px] text-white/70 font-bold mb-1 uppercase tracking-widest">Kurumsal Bakiye</div>
                    <div class="text-2xl font-black text-white flex items-center gap-2">
                        <i data-lucide="coins" class="text-yellow-500 w-6 h-6"></i> 1.250 ₺
                    </div>
                </div>
                <button onclick="alert('Ödeme altyapısına yönlendiriliyorsunuz...')" class="bg-[#FF007F] text-white px-4 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition shadow-lg shadow-[#FF007F]/20 flex items-center gap-2">
                    <i data-lucide="plus" class="w-4 h-4"></i> Bakiye Yükle
                </button>
            </div>

            <h3 class="font-bold text-white mb-3 flex items-center gap-2"><i data-lucide="zap" class="w-5 h-5 text-yellow-500"></i> Satış & Görünürlük Artırıcılar</h3>
            <div class="space-y-3 mb-8">
                
                <!-- Boost İşlemi -->
                <div onclick="openBoostModal()" class="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center gap-4 hover:border-yellow-500/50 hover:bg-zinc-800 transition cursor-pointer active:scale-[0.98] group">
                    <div class="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 shrink-0 shadow-inner">
                        <i data-lucide="rocket" class="text-yellow-500 w-6 h-6 group-hover:-translate-y-1 transition-transform"></i>
                    </div>
                    <div class="flex-1">
                        <h4 class="text-white font-bold text-sm">İlanı Vitrine Çıkar (Boost)</h4>
                        <p class="text-zinc-400 text-xs mt-0.5 leading-relaxed">İlanınızı 24 saat boyunca Influencer keşfet sayfasının en üstünde tutun.</p>
                    </div>
                    <div class="text-yellow-500 font-bold text-sm bg-yellow-500/10 px-3 py-1.5 rounded-lg border border-yellow-500/20 shrink-0">250 ₺</div>
                </div>
                
                <!-- Profesyonel Çekim Satışı -->
                <div onclick="openProductionModal()" class="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center gap-4 hover:border-blue-500/50 hover:bg-zinc-800 transition cursor-pointer active:scale-[0.98] group">
                    <div class="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0 shadow-inner">
                        <i data-lucide="camera" class="text-blue-400 w-6 h-6 group-hover:scale-110 transition-transform"></i>
                    </div>
                    <div class="flex-1">
                        <h4 class="text-white font-bold text-sm">Profesyonel Mekan Çekimi</h4>
                        <p class="text-zinc-400 text-xs mt-0.5 leading-relaxed">Profiliniz için profesyonel prodüksiyon ekibimizden fotoğraf ve drone çekimi.</p>
                    </div>
                    <div class="text-blue-400 font-bold text-xs bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 uppercase shrink-0">İncele</div>
                </div>

                <!-- Son Dakika Influencer -->
                <div onclick="openLastMinuteModal()" class="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center gap-4 hover:border-[#FF007F]/50 hover:bg-zinc-800 transition cursor-pointer active:scale-[0.98] group relative overflow-hidden">
                    <div class="absolute right-0 top-0 w-16 h-full bg-gradient-to-l from-[#FF007F]/10 to-transparent pointer-events-none"></div>
                    <div class="w-12 h-12 rounded-full bg-[#FF007F]/10 flex items-center justify-center border border-[#FF007F]/20 shrink-0 shadow-inner relative z-10">
                        <i data-lucide="siren" class="text-[#FF007F] w-6 h-6 group-hover:animate-pulse"></i>
                    </div>
                    <div class="flex-1 relative z-10">
                        <h4 class="text-white font-bold text-sm">Son Dakika Influencer Çağrısı</h4>
                        <p class="text-zinc-400 text-xs mt-0.5 leading-relaxed">Etkinliğinize saatler kala acil katılımcı bulmak için bölgeye bildirim yollayın.</p>
                    </div>
                    <div class="text-[#FF007F] font-bold text-[10px] uppercase bg-[#FF007F]/10 px-2 py-1.5 rounded-lg border border-[#FF007F]/30 shrink-0 relative z-10 flex items-center gap-1">
                        <i data-lucide="crown" class="w-3 h-3"></i> Premium
                    </div>
                </div>
            </div>

            <h3 class="font-bold text-white mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                <i data-lucide="settings" class="w-4 h-4 text-zinc-500"></i> Kurumsal Ayarlar
            </h3>
            <div class="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden mb-8">
                <button onclick="openBillingModal()" class="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-800 transition border-b border-zinc-800 active:bg-zinc-950">
                    <div class="flex items-center gap-3"><i data-lucide="file-text" class="w-5 h-5 text-zinc-400"></i> <span class="text-sm font-medium text-white">Fatura ve Vergi Bilgileri</span></div>
                    <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-600"></i>
                </button>
                <button onclick="openTeamModal()" class="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-800 transition border-b border-zinc-800 active:bg-zinc-950">
                    <div class="flex items-center gap-3"><i data-lucide="users-2" class="w-5 h-5 text-zinc-400"></i> <span class="text-sm font-medium text-white">Personel ve Yetki Yönetimi</span></div>
                    <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-600"></i>
                </button>
                 <button onclick="openSupportModal()" class="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-800 transition active:bg-zinc-950">
                    <div class="flex items-center gap-3"><i data-lucide="headset" class="w-5 h-5 text-blue-400"></i> <span class="text-sm font-medium text-white">Canlı Müşteri Hizmetleri</span></div>
                    <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-600"></i>
                </button>
            </div>
            
            <button onclick="navigate('landing')" class="w-full py-4 flex items-center justify-center gap-2 text-red-500 bg-zinc-900 hover:bg-red-500/10 rounded-xl transition text-sm font-bold border border-zinc-800 hover:border-red-500/30 active:scale-95 shadow-sm">
                <i data-lucide="log-out" class="w-5 h-5"></i> Kurumsal Hesaptan Çıkış Yap
            </button>
        </div>
    `;
}

function renderVenueProfile(container) {
    container.innerHTML = `
        <div class="slide-up pb-8">
            <!-- Cover & Avatar -->
            <div class="relative mb-8">
                <div class="h-40 w-full rounded-3xl overflow-hidden relative group border border-zinc-800 shadow-xl">
                    <img src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=800" class="w-full h-full object-cover opacity-80">
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer">
                        <button class="bg-black/50 text-white p-3 rounded-full backdrop-blur-sm"><i data-lucide="camera" class="w-5 h-5"></i></button>
                    </div>
                </div>
                <div class="absolute -bottom-6 left-6 flex items-end gap-4">
                    <div class="w-20 h-20 rounded-2xl bg-zinc-950 border-4 border-zinc-950 overflow-hidden relative group shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                        <img src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=200" class="w-full h-full object-cover">
                        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer">
                            <i data-lucide="camera" class="w-5 h-5 text-white"></i>
                        </div>
                    </div>
                </div>
                <button class="absolute -bottom-2 right-2 bg-zinc-900 border border-zinc-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-zinc-800 active:scale-95 transition shadow-lg">
                    <i data-lucide="edit-2" class="w-3.5 h-3.5"></i> Profili Düzenle
                </button>
            </div>

            <!-- Info -->
            <div class="px-2 mb-8">
                <h2 class="text-2xl font-black text-white flex items-center gap-2">Noir Coffee Roasters <i data-lucide="check-circle" class="w-5 h-5 text-blue-500"></i></h2>
                <p class="text-[#FF007F] text-sm font-bold mt-1 uppercase tracking-wider">Artisan Cafe & Roastery</p>
                <p class="text-zinc-400 text-xs mt-2 flex items-center gap-1.5"><i data-lucide="map-pin" class="w-4 h-4"></i> Kadıköy, İstanbul (Moda Cad. No:12)</p>
                <p class="text-zinc-300 text-sm mt-4 leading-relaxed bg-zinc-900 p-4 rounded-2xl border border-zinc-800 shadow-inner">
                    Nitelikli kahve çekirdeklerini kendi kavuran, modern ve ferah tasarımlı 3. nesil kahve dükkanı. Ziyaretçilerimize sadece kahve değil, fotoğraflanmaya değer estetik bir deneyim sunuyoruz.
                </p>
            </div>

            <!-- Beklentiler (Expectations) -->
            <div class="mb-8 px-2">
                <h3 class="text-white font-bold mb-3 flex items-center gap-2"><i data-lucide="target" class="w-5 h-5 text-[#FF007F]"></i> İşbirliği Beklentilerimiz</h3>
                <div class="space-y-3">
                    <div class="bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800 p-4 rounded-2xl flex items-start gap-3 shadow-md">
                        <div class="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20"><i data-lucide="camera" class="w-4 h-4 text-blue-400"></i></div>
                        <div>
                            <div class="text-sm font-bold text-zinc-200 mb-0.5">Kaliteli ve Estetik Çekim</div>
                            <div class="text-xs text-zinc-500 leading-relaxed">Mekanımızın ambiyansını yansıtan ışığı iyi ayarlanmış, profesyonel reels videoları ve story paylaşımları.</div>
                        </div>
                    </div>
                    <div class="bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800 p-4 rounded-2xl flex items-start gap-3 shadow-md">
                        <div class="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 border border-green-500/20"><i data-lucide="clock" class="w-4 h-4 text-green-400"></i></div>
                        <div>
                            <div class="text-sm font-bold text-zinc-200 mb-0.5">Zamanlama ve Dakiklik</div>
                            <div class="text-xs text-zinc-500 leading-relaxed">Rezervasyon saatlerine tam uyum ve ziyaret sonrası 48 saat içinde içeriklerin onaya sunulup paylaşılması.</div>
                        </div>
                    </div>
                    <div class="bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800 p-4 rounded-2xl flex items-start gap-3 shadow-md">
                        <div class="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0 border border-purple-500/20"><i data-lucide="users" class="w-4 h-4 text-purple-400"></i></div>
                        <div>
                            <div class="text-sm font-bold text-zinc-200 mb-0.5">Doğru Hedef Kitle</div>
                            <div class="text-xs text-zinc-500 leading-relaxed">Kahve kültürüne ilgi duyan, İstanbul içi ve etkileşim oranı yüksek (bot olmayan) takipçi kitlesi.</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Medya Galerisi (Fotoğraf & Video) -->
            <div class="px-2">
                <div class="flex justify-between items-end mb-4">
                    <h3 class="text-white font-bold flex items-center gap-2"><i data-lucide="image" class="w-5 h-5 text-[#FF007F]"></i> Mekan Medyası</h3>
                    <span class="text-[10px] text-zinc-500 font-bold uppercase bg-zinc-900 px-2 py-1 rounded border border-zinc-800">3 Görsel</span>
                </div>
                <div class="grid grid-cols-3 gap-3">
                    <div class="aspect-square bg-zinc-900 rounded-xl overflow-hidden relative group shadow-md border border-zinc-800">
                        <img src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=400" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                    </div>
                    <div class="aspect-square bg-zinc-900 rounded-xl overflow-hidden relative group shadow-md border border-zinc-800 flex items-center justify-center">
                        <img src="https://images.unsplash.com/photo-1600093463592-8e36ae95ef56?auto=format&fit=crop&q=80&w=400" class="w-full h-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-110">
                        <div class="absolute inset-0 flex items-center justify-center"><i data-lucide="play-circle" class="w-8 h-8 text-white drop-shadow-md"></i></div>
                    </div>
                    <button class="aspect-square bg-zinc-900/30 rounded-xl border-2 border-zinc-800 border-dashed flex flex-col items-center justify-center text-zinc-500 hover:text-[#FF007F] hover:border-[#FF007F] hover:bg-[#FF007F]/5 transition-all active:scale-95 group">
                        <i data-lucide="plus" class="w-8 h-8 mb-1 transition-transform group-hover:scale-110"></i>
                        <span class="text-xs font-bold">Medya Ekle</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderVenueDashboard(container) {
    const packagesHtml = [
        { name: "Gossip Signature", price: "Özel Teklif", theme: "from-amber-500 to-amber-700", icon: "crown", desc: "Özel işbirlikleri ve premium marka konumlandırması." },
        { name: "Gossip Elite", price: "75.000 ₺", theme: "from-[#FF007F] to-purple-600", icon: "sparkles", desc: "Sınırsız eşleşme ve ana sayfada üst sıra garantisi." },
        { name: "Gossip Pro", price: "50.000 ₺", theme: "from-purple-500 to-indigo-600", icon: "zap", desc: "Detaylı influencer demografi analizleri." },
        { name: "Gossip Starter", price: "30.000 ₺", theme: "from-cyan-500 to-blue-600", icon: "rocket", desc: "Sisteme giriş ve standart eşleşmeler." }
    ].map(p => `
        <div onclick="openPackageModal('${p.name}')" class="snap-start flex-shrink-0 w-64 bg-gradient-to-br ${p.theme} p-5 rounded-3xl relative overflow-hidden cursor-pointer group active:scale-[0.98] transition-all shadow-xl">
            <div class="absolute -right-4 -bottom-4 opacity-20 group-hover:scale-110 transition-transform"><i data-lucide="${p.icon}" class="w-24 h-24 text-white"></i></div>
            <div class="relative z-10">
                <div class="text-white/80 text-[10px] font-black tracking-widest uppercase mb-1">PAKET</div>
                <h3 class="text-2xl font-black text-white mb-1">${p.name}</h3>
                <p class="text-white/90 text-xs mb-4 h-8 leading-snug">${p.desc}</p>
                <div class="text-xl font-black text-white mb-4">${p.price}</div>
                <button class="w-full py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl text-white text-xs font-bold transition flex items-center justify-center gap-1">Detayları Gör <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i></button>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="slide-up pb-8">
            <!-- Üst İstatistikler -->
            <div class="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl mb-6 relative overflow-hidden shadow-lg">
                <h2 class="text-xl font-bold text-white mb-4">Mekan Özeti</h2>
                <div class="grid grid-cols-2 gap-4">
                    <button onclick="switchVenueTab('apps')" class="w-full bg-black/50 p-4 rounded-2xl border border-zinc-800/50 text-left hover:border-[#FF007F]/50 transition group active:scale-95">
                        <div class="text-xs text-zinc-500 font-bold uppercase mb-1 flex justify-between items-center">Bekleyen <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-600 group-hover:text-[#FF007F] transition"></i></div>
                        <div class="text-3xl font-black text-[#FF007F]">12</div>
                    </button>
                    <button onclick="openVenueScoreModal()" class="w-full bg-black/50 p-4 rounded-2xl border border-zinc-800/50 text-left hover:border-yellow-500/50 transition group active:scale-95">
                        <div class="text-xs text-zinc-500 font-bold uppercase mb-1 flex justify-between items-center">Mekan Puanı <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-600 group-hover:text-yellow-500 transition"></i></div>
                        <div class="text-3xl font-black text-yellow-500 flex items-center gap-1.5">4.8 <i data-lucide="star" class="w-5 h-5 fill-yellow-500 group-hover:scale-110 transition"></i></div>
                    </button>
                </div>
            </div>

            <!-- Üyelik Paketleri -->
            <div class="mb-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-bold text-white">Üyelik Paketleri</h3>
                    <button onclick="document.getElementById('packages-scroll').scrollBy({left: 250, behavior: 'smooth'})" class="p-1.5 bg-zinc-900 border border-zinc-800 rounded-full hover:border-[#FF007F]/50 transition z-10"><i data-lucide="chevron-right" class="w-4 h-4 text-zinc-500"></i></button>
                </div>
                <div id="packages-scroll" class="flex overflow-x-auto gap-4 px-1 -mx-1 pb-4 no-scrollbar snap-x">
                    ${packagesHtml}
                </div>
                
                <!-- Ek Sosyal Medya Paketi -->
                <button onclick="openPackageModal('Sosyal Medya')" class="w-full text-left mt-2 bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between shadow-xl hover:border-[#FF007F]/50 transition active:scale-[0.98] group">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-[#FF007F]/10 rounded-xl flex items-center justify-center border border-[#FF007F]/20 group-hover:bg-[#FF007F]/20 transition">
                            <i data-lucide="at-sign" class="w-5 h-5 text-[#FF007F]"></i>
                        </div>
                        <div>
                            <div class="text-sm font-bold text-white flex items-center gap-1">Sosyal Medya Yönetimi <i data-lucide="info" class="w-3.5 h-3.5 text-zinc-500"></i></div>
                            <div class="text-xs text-zinc-400">Tüm paketlere eklenebilir ek hizmet.</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm font-black text-[#FF007F]">+25.000 ₺</div>
                    </div>
                </button>
            </div>
        </div>
    `;
}

// --- YENİ EKLENEN MEKAN MODAL FONKSİYONLARI ---

function openPackageModal(packageName) {
    const modal = document.getElementById('venue-detail-modal');
    let data = {};
    
    if(packageName === 'Gossip Signature') {
        data = { price: 'Özel Teklif', theme: 'from-amber-500 to-amber-700', text: 'text-amber-500', icon: 'crown', desc: 'Sektör liderleri ve premium markalar için tasarlanmış özel işbirliği modeli.', features: ['Özel Temsilci & Danışmanlık', 'VIP Influencer Ağına Doğrudan Erişim', 'Özel Konsept Etkinlik Kurguları', 'Algoritmada Her Zaman 1. Sıra', 'Rakip Analizi & Detaylı PR Raporlaması'] };
    } else if(packageName === 'Gossip Elite') {
        data = { price: '75.000 ₺ / Ay', theme: 'from-[#FF007F] to-purple-600', text: 'text-[#FF007F]', icon: 'sparkles', desc: 'Şehrin en popüler mekanlarından biri olmak isteyen işletmeler için sınırsız paket.', features: ['Sınırsız İlan Oluşturma', 'Sınırsız Eşleşme ve Başvuru Onayı', 'Ana Sayfada "Öne Çıkan Fırsat" Rozeti', 'Influencer Kitle Demografisi Raporları', 'Öncelikli Müşteri Desteği'] };
    } else if(packageName === 'Gossip Pro') {
        data = { price: '50.000 ₺ / Ay', theme: 'from-purple-500 to-indigo-600', text: 'text-purple-500', icon: 'zap', desc: 'Düzenli influencer sirkülasyonu sağlamak isteyen büyüyen işletmeler için.', features: ['Aylık 3 Aktif İlan Hakkı', 'Aylık 30 Influencer Eşleşmesi', 'Standart Performans Raporları', 'Gelişmiş Filtreleme (Yaş/Cinsiyet/Şehir)', 'Standart Görünürlük'] };
    } else if(packageName === 'Gossip Starter') {
        data = { price: '30.000 ₺ / Ay', theme: 'from-cyan-500 to-blue-600', text: 'text-cyan-500', icon: 'rocket', desc: 'Gossip Society ağına ilk adımını atan mekanlar için temel eşleşme paketi.', features: ['Aylık 1 Aktif İlan Hakkı', 'Aylık 10 Influencer Eşleşmesi', 'Temel Liste Görünürlüğü', 'Standart İlan Şablonları'] };
    } else if(packageName === 'Sosyal Medya') {
        data = { price: '+25.000 ₺ / Ay', theme: 'from-zinc-800 to-zinc-900', text: 'text-[#FF007F]', icon: 'instagram', desc: 'Sosyal medya hesaplarınızın profesyonel ekibimiz tarafından yönetilmesi.', features: ['Haftalık 3 Post, 5 Story Tasarımı', 'İçerik Stratejisi ve Planlama', 'Yorum ve Mesaj (DM) Moderasyonu', 'Aylık Çekim (Fotoğraf & Kısa Video)', 'Aylık Büyüme Raporlaması'] };
    }

    let featuresHtml = data.features.map(f => `
        <div class="flex items-start gap-3 mb-3">
            <div class="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700 mt-0.5"><i data-lucide="check" class="w-3 h-3 ${data.text}"></i></div>
            <div class="text-zinc-300 text-sm">${f}</div>
        </div>
    `).join('');

    modal.innerHTML = `
        <div class="bg-zinc-950 w-full rounded-t-3xl border-t border-zinc-800 slide-up max-h-[90vh] flex flex-col relative">
            <div class="absolute -top-12 right-4"><button onclick="document.getElementById('venue-detail-modal').classList.add('hidden-view')" class="p-2 bg-zinc-900 border border-zinc-700 rounded-full text-white active:scale-95"><i data-lucide="x" class="w-5 h-5"></i></button></div>
            
            <div class="bg-gradient-to-br ${data.theme} p-8 rounded-t-3xl relative overflow-hidden">
                <div class="absolute right-0 bottom-0 opacity-20 transform translate-x-1/4 translate-y-1/4"><i data-lucide="${data.icon}" class="w-48 h-48 text-white"></i></div>
                <div class="relative z-10">
                    <div class="text-white/80 text-[10px] font-black tracking-widest uppercase mb-1">PAKET DETAYI</div>
                    <h2 class="text-3xl font-black text-white mb-2">${packageName}</h2>
                    <div class="text-2xl font-black text-white">${data.price}</div>
                </div>
            </div>
            
            <div class="p-6 overflow-y-auto no-scrollbar flex-1 bg-zinc-950">
                <p class="text-zinc-400 text-sm leading-relaxed mb-6">${data.desc}</p>
                <h3 class="text-white font-bold mb-4 uppercase text-xs tracking-wider border-b border-zinc-900 pb-2">Paket İçeriği</h3>
                <div>${featuresHtml}</div>
            </div>
            
            <div class="p-5 border-t border-zinc-900 bg-zinc-950">
                <button onclick="document.getElementById('venue-detail-modal').classList.add('hidden-view'); alert('Satış temsilcimize yönlendiriliyorsunuz...');" class="w-full bg-white text-black py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-all text-sm">
                    Paketi Satın Al / Temsilciyle Görüş
                </button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

function openVenueScoreModal() {
    const modal = document.getElementById('venue-detail-modal');
    modal.innerHTML = `
        <div class="bg-zinc-950 w-full rounded-t-3xl p-6 border-t border-zinc-800 slide-up max-h-[85vh] overflow-y-auto no-scrollbar relative">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-white flex items-center gap-2"><i data-lucide="bar-chart-2" class="w-6 h-6 text-yellow-500"></i> Kurumsal İtibar Endeksi</h3>
                <button onclick="document.getElementById('venue-detail-modal').classList.add('hidden-view')" class="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white active:scale-95"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>

            <p class="text-zinc-400 text-sm mb-6 leading-relaxed">İşletmenizin sistemdeki ortalama puanı. Bu puan, ağırladığınız influencerların ziyaret sonrası yaptıkları gizli değerlendirmelerle belirlenir.</p>
            
            <div class="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 mb-6 flex flex-col items-center justify-center shadow-xl relative overflow-hidden">
                <div class="absolute -right-6 -bottom-6 opacity-10"><i data-lucide="star" class="w-40 h-40 text-yellow-500"></i></div>
                <div class="relative z-10 text-center">
                    <div class="text-5xl font-black text-white mb-2 tracking-tighter">4.8</div>
                    <div class="flex gap-1 justify-center mb-3">
                        <i data-lucide="star" class="w-5 h-5 text-yellow-500 fill-yellow-500"></i>
                        <i data-lucide="star" class="w-5 h-5 text-yellow-500 fill-yellow-500"></i>
                        <i data-lucide="star" class="w-5 h-5 text-yellow-500 fill-yellow-500"></i>
                        <i data-lucide="star" class="w-5 h-5 text-yellow-500 fill-yellow-500"></i>
                        <i data-lucide="star" class="w-5 h-5 text-yellow-500 fill-yellow-500"></i>
                    </div>
                    <div class="text-xs text-yellow-500 font-bold uppercase tracking-widest bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20 inline-block">Mükemmel Seviye</div>
                </div>
            </div>

            <h4 class="text-white font-bold mb-4 text-sm uppercase tracking-wider">Kriter Kırılımları</h4>
            <div class="space-y-5">
                <div>
                    <div class="flex justify-between text-xs font-bold mb-1"><span class="text-zinc-300">Karşılama ve Ağırlama</span> <span class="text-yellow-500">4.9 / 5.0</span></div>
                    <div class="w-full bg-zinc-900 h-2 rounded-full overflow-hidden"><div class="bg-yellow-500 h-full w-[98%] rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div></div>
                </div>
                <div>
                    <div class="flex justify-between text-xs font-bold mb-1"><span class="text-zinc-300">Teklifin / Hizmetin Kalitesi</span> <span class="text-yellow-500">4.8 / 5.0</span></div>
                    <div class="w-full bg-zinc-900 h-2 rounded-full overflow-hidden"><div class="bg-yellow-500 h-full w-[96%] rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div></div>
                </div>
                <div>
                    <div class="flex justify-between text-xs font-bold mb-1"><span class="text-zinc-300">İletişim Hızı</span> <span class="text-yellow-500">4.6 / 5.0</span></div>
                    <div class="w-full bg-zinc-900 h-2 rounded-full overflow-hidden"><div class="bg-yellow-500 h-full w-[92%] rounded-full"></div></div>
                </div>
            </div>
            
            <div class="mt-8 bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 flex gap-3">
                <i data-lucide="info" class="w-5 h-5 text-blue-400 shrink-0"></i>
                <p class="text-xs text-blue-200/80 leading-relaxed font-medium">Mekan puanınız 4.5'in üzerinde olduğu için Premium Influencer listelerinde mekanınız <strong class="text-blue-400">öncelikli tavsiye</strong> olarak gösterilmektedir.</p>
            </div>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

// --- YENİ EKLENEN KURUMSAL MENU VE SATIŞ MODALLARI ---
function openBoostModal() {
    const modal = document.getElementById('venue-detail-modal');
    modal.innerHTML = `
        <div class="bg-zinc-950 w-full rounded-t-3xl border-t border-zinc-800 slide-up max-h-[90vh] flex flex-col relative overflow-hidden">
            <div class="absolute -top-12 right-4"><button onclick="document.getElementById('venue-detail-modal').classList.add('hidden-view')" class="p-2 bg-zinc-900 border border-zinc-700 rounded-full text-white active:scale-95"><i data-lucide="x" class="w-5 h-5"></i></button></div>
            
            <div class="bg-gradient-to-br from-yellow-500 to-orange-600 p-8 pt-10 relative text-center">
                <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <i data-lucide="rocket" class="w-16 h-16 text-white mx-auto mb-4 drop-shadow-lg"></i>
                <h2 class="text-3xl font-black text-white mb-2">Vitrin (Boost)</h2>
                <p class="text-yellow-100 text-sm">İlanınızı keşfet sayfasının en üstüne sabitleyin.</p>
            </div>
            
            <div class="p-6 overflow-y-auto no-scrollbar flex-1 bg-zinc-950">
                <div class="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 mb-6 flex gap-4 items-center">
                    <div class="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center border border-yellow-500/20 shrink-0">
                        <i data-lucide="eye" class="w-6 h-6 text-yellow-500"></i>
                    </div>
                    <div>
                        <h4 class="text-white font-bold text-sm">10x Görüntülenme</h4>
                        <p class="text-zinc-400 text-xs">Normal ilanlara göre bölgedeki tüm influencerlar ilk sizin mekanınızı görür.</p>
                    </div>
                </div>
                
                <h3 class="text-white font-bold mb-3 uppercase text-xs tracking-wider">Mevcut İlanı Seçin</h3>
                <div class="bg-zinc-900 border border-yellow-500 p-4 rounded-xl flex items-center justify-between mb-4 cursor-pointer">
                    <div>
                        <div class="font-bold text-white text-sm">Yaz Menüsü Tadımı</div>
                        <div class="text-xs text-zinc-400">Aktif İlan</div>
                    </div>
                    <div class="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center"><i data-lucide="check" class="w-3 h-3 text-black"></i></div>
                </div>
                
                <div class="flex justify-between items-center bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                    <span class="text-zinc-400 font-bold">24 Saatlik Ücret</span>
                    <span class="text-2xl font-black text-white">250 ₺</span>
                </div>
            </div>
            
            <div class="p-5 border-t border-zinc-900 bg-zinc-950">
                <button onclick="document.getElementById('venue-detail-modal').classList.add('hidden-view'); alert('Bakiye yetersiz. Ödeme sayfasına yönlendiriliyorsunuz.');" class="w-full bg-yellow-500 text-black py-4 rounded-xl font-bold shadow-lg shadow-yellow-500/20 active:scale-95 transition-all text-sm flex justify-center items-center gap-2">
                    Satın Al ve Başlat <i data-lucide="arrow-right" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

function openProductionModal() {
    const modal = document.getElementById('venue-detail-modal');
    modal.innerHTML = `
        <div class="bg-zinc-950 w-full rounded-t-3xl border-t border-zinc-800 slide-up max-h-[90vh] flex flex-col relative overflow-hidden">
            <div class="absolute -top-12 right-4"><button onclick="document.getElementById('venue-detail-modal').classList.add('hidden-view')" class="p-2 bg-zinc-900 border border-zinc-700 rounded-full text-white active:scale-95"><i data-lucide="x" class="w-5 h-5"></i></button></div>
            
            <div class="h-40 relative">
                <img src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=800" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent"></div>
                <div class="absolute bottom-4 left-6">
                    <h2 class="text-2xl font-black text-white">Gossip Prodüksiyon</h2>
                    <p class="text-blue-300 text-xs font-bold uppercase tracking-widest mt-1">Görsel Marka Danışmanlığı</p>
                </div>
            </div>
            
            <div class="p-6 overflow-y-auto no-scrollbar flex-1 bg-zinc-950 space-y-4">
                <p class="text-zinc-400 text-sm leading-relaxed mb-2">Mekanınızın dijital dünyada kusursuz görünmesi için kendi bünyemizdeki profesyonel film ve fotoğraf ekibiyle hizmetinizdeyiz.</p>
                
                <label class="flex items-start gap-4 bg-zinc-900 p-4 rounded-2xl border border-zinc-800 cursor-pointer hover:border-blue-500/50 transition">
                    <input type="radio" name="prod" class="mt-1 accent-blue-500 w-4 h-4">
                    <div>
                        <h4 class="text-white font-bold text-sm">Fotoğraf & Menü Çekimi</h4>
                        <p class="text-zinc-400 text-xs mt-1 leading-relaxed">Mekan detayları ve imza yemeklerinizin profesyonel ışıkla fotoğraflanması. (20 Kare)</p>
                        <div class="text-blue-400 font-bold text-sm mt-2">7.500 ₺</div>
                    </div>
                </label>
                
                <label class="flex items-start gap-4 bg-zinc-900 p-4 rounded-2xl border border-zinc-800 cursor-pointer hover:border-blue-500/50 transition">
                    <input type="radio" name="prod" class="mt-1 accent-blue-500 w-4 h-4">
                    <div>
                        <h4 class="text-white font-bold text-sm">Sosyal Medya Reels Paketi</h4>
                        <p class="text-zinc-400 text-xs mt-1 leading-relaxed">Yönetmen kurgulu, trend müziklere uyumlu 3 adet dikey video prodüksiyonu.</p>
                        <div class="text-blue-400 font-bold text-sm mt-2">12.000 ₺</div>
                    </div>
                </label>
                
                <label class="flex items-start gap-4 bg-zinc-900 p-4 rounded-2xl border border-zinc-800 cursor-pointer hover:border-blue-500/50 transition">
                    <input type="radio" name="prod" class="mt-1 accent-blue-500 w-4 h-4">
                    <div>
                        <h4 class="text-white font-bold text-sm">Drone & Tam Kapsamlı Mekan Filmi</h4>
                        <p class="text-zinc-400 text-xs mt-1 leading-relaxed">İç mekan, dış mekan drone ve sinematik tanıtım filmi (1 Dakika).</p>
                        <div class="text-blue-400 font-bold text-sm mt-2">25.000 ₺</div>
                    </div>
                </label>
            </div>
            
            <div class="p-5 border-t border-zinc-900 bg-zinc-950">
                <button onclick="document.getElementById('venue-detail-modal').classList.add('hidden-view'); alert('Çekim talebiniz alındı. Prodüksiyon ekibimiz sizi arayacaktır.');" class="w-full bg-blue-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-sm">
                    Prodüksiyon Talebi Oluştur
                </button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

function openLastMinuteModal() {
    const modal = document.getElementById('venue-detail-modal');
    modal.innerHTML = `
        <div class="bg-zinc-950 w-full rounded-t-3xl border-t border-zinc-800 slide-up max-h-[90vh] flex flex-col relative overflow-hidden">
            <div class="absolute -top-12 right-4"><button onclick="document.getElementById('venue-detail-modal').classList.add('hidden-view')" class="p-2 bg-zinc-900 border border-zinc-700 rounded-full text-white active:scale-95"><i data-lucide="x" class="w-5 h-5"></i></button></div>
            
            <div class="bg-zinc-900 p-8 pt-10 relative text-center overflow-hidden border-b border-zinc-800">
                <div class="absolute inset-0 flex items-center justify-center opacity-30">
                    <div class="w-32 h-32 border border-[#FF007F] rounded-full animate-ping"></div>
                    <div class="w-48 h-48 border border-[#FF007F] rounded-full absolute"></div>
                    <div class="w-64 h-64 border border-[#FF007F] rounded-full absolute opacity-50"></div>
                </div>
                <i data-lucide="radar" class="w-16 h-16 text-[#FF007F] mx-auto mb-4 relative z-10"></i>
                <h2 class="text-2xl font-black text-white mb-2 relative z-10">Acil Influencer Radarı</h2>
                <p class="text-zinc-400 text-xs relative z-10">Etkinliğinize saatler kala acil katılımcı bulun.</p>
            </div>
            
            <div class="p-6 overflow-y-auto no-scrollbar flex-1 bg-zinc-950 space-y-5">
                <div class="bg-gradient-to-r from-[#FF007F]/10 to-transparent p-4 rounded-2xl border border-[#FF007F]/20">
                    <div class="flex items-center gap-2 text-white font-bold text-sm mb-2"><i data-lucide="map-pin" class="w-4 h-4 text-[#FF007F]"></i> Kadıköy Bölgesi (5 KM)</div>
                    <p class="text-zinc-400 text-xs leading-relaxed">Mekanınıza en fazla 5 km uzaklıkta bulunan, algoritma sağlığı yüksek <strong class="text-white">42 müsait influencer</strong> tespit edildi.</p>
                </div>

                <div>
                    <label class="block text-zinc-400 text-xs font-bold mb-2 uppercase">Acil Davet Mesajı</label>
                    <textarea rows="3" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl p-4 focus:border-[#FF007F] outline-none text-sm resize-none">Bu akşam 20:00'da gerçekleşecek tadım etkinliğimizde boşalan 2 kişilik VIP masamız için seni aramızda görmek isteriz!</textarea>
                </div>
                
                <div class="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 flex justify-between items-center">
                    <div>
                        <div class="text-white font-bold text-sm">Push Bildirimi</div>
                        <div class="text-zinc-500 text-xs">Telefonlarına anında iletilir</div>
                    </div>
                    <div class="text-lg font-black text-[#FF007F]">450 ₺</div>
                </div>
            </div>
            
            <div class="p-5 border-t border-zinc-900 bg-zinc-950">
                <button onclick="document.getElementById('venue-detail-modal').classList.add('hidden-view'); alert('Acil davet 42 influencere başarıyla iletildi!');" class="w-full bg-[#FF007F] text-white py-4 rounded-xl font-bold shadow-lg shadow-[#FF007F]/20 active:scale-95 transition-all text-sm flex justify-center items-center gap-2">
                    Sinyali Gönder <i data-lucide="radio" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

function openBillingModal() {
    const modal = document.getElementById('venue-detail-modal');
    modal.innerHTML = `
        <div class="bg-zinc-950 w-full rounded-t-3xl p-6 border-t border-zinc-800 slide-up max-h-[85vh] overflow-y-auto no-scrollbar relative">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-white flex items-center gap-2"><i data-lucide="file-text" class="w-6 h-6 text-zinc-400"></i> Finans ve Faturalar</h3>
                <button onclick="document.getElementById('venue-detail-modal').classList.add('hidden-view')" class="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white active:scale-95"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>

            <div class="bg-gradient-to-r from-zinc-800 to-zinc-900 p-5 rounded-2xl border border-zinc-700 mb-6 shadow-md">
                <div class="text-xs text-zinc-400 uppercase font-bold tracking-widest mb-1">Mevcut Plan</div>
                <div class="text-2xl font-black text-white flex justify-between items-center">
                    <span>Gossip Pro</span>
                    <span class="text-sm font-bold text-zinc-400 border border-zinc-600 px-2 py-1 rounded-lg">Aktif</span>
                </div>
                <div class="text-zinc-500 text-xs mt-2">Gelecek ödeme tarihi: 24 Kasım 2026</div>
            </div>

            <h4 class="text-white font-bold mb-3 text-sm">Fatura Bilgileri</h4>
            <div class="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 mb-6 space-y-3">
                <div class="flex justify-between border-b border-zinc-800 pb-2"><span class="text-zinc-500 text-xs">Firma Ünvanı</span><span class="text-white text-xs font-medium text-right">Noir Gıda ve Tic. Ltd. Şti.</span></div>
                <div class="flex justify-between border-b border-zinc-800 pb-2"><span class="text-zinc-500 text-xs">Vergi Dairesi</span><span class="text-white text-xs font-medium text-right">Kadıköy V.D.</span></div>
                <div class="flex justify-between"><span class="text-zinc-500 text-xs">Vergi No</span><span class="text-white text-xs font-medium text-right">1234567890</span></div>
                <button class="w-full mt-2 py-2 bg-zinc-800 text-white rounded-lg text-xs font-bold hover:bg-zinc-700 transition">Bilgileri Güncelle</button>
            </div>

            <h4 class="text-white font-bold mb-3 text-sm">Geçmiş Faturalar</h4>
            <div class="space-y-2">
                <div class="bg-zinc-900 p-3 rounded-xl border border-zinc-800 flex justify-between items-center">
                    <div><div class="text-white text-sm font-bold">Ekim 2026 Üyeliği</div><div class="text-zinc-500 text-[10px]">INV-2026-1042</div></div>
                    <button class="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-lg text-zinc-400 hover:text-white"><i data-lucide="download" class="w-4 h-4"></i></button>
                </div>
                <div class="bg-zinc-900 p-3 rounded-xl border border-zinc-800 flex justify-between items-center">
                    <div><div class="text-white text-sm font-bold">Vitrin (Boost) Paketi</div><div class="text-zinc-500 text-[10px]">INV-2026-0988</div></div>
                    <button class="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-lg text-zinc-400 hover:text-white"><i data-lucide="download" class="w-4 h-4"></i></button>
                </div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

function openTeamModal() {
    const modal = document.getElementById('venue-detail-modal');
    modal.innerHTML = `
        <div class="bg-zinc-950 w-full rounded-t-3xl p-6 border-t border-zinc-800 slide-up max-h-[85vh] overflow-y-auto no-scrollbar relative">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-white flex items-center gap-2"><i data-lucide="users-2" class="w-6 h-6 text-purple-400"></i> Ekip ve Yetkiler</h3>
                <button onclick="document.getElementById('venue-detail-modal').classList.add('hidden-view')" class="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white active:scale-95"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>
            
            <p class="text-zinc-400 text-sm mb-6 leading-relaxed">Mekana gelen influencerların QR kodunu okutabilmesi için personel hesapları oluşturun.</p>

            <div class="space-y-3 mb-6">
                <div class="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center border border-purple-500/20"><i data-lucide="user" class="text-purple-400 w-5 h-5"></i></div>
                        <div><div class="text-white text-sm font-bold">Ahmet Y.</div><div class="text-zinc-500 text-xs">Yönetici (Kurucu)</div></div>
                    </div>
                    <span class="bg-purple-500/20 text-purple-400 text-[10px] font-black px-2 py-1 rounded">ADMİN</span>
                </div>
                
                <div class="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700"><i data-lucide="user" class="text-zinc-400 w-5 h-5"></i></div>
                        <div><div class="text-white text-sm font-bold">Kasa / Resepsiyon</div><div class="text-zinc-500 text-xs">kasa@noir.com</div></div>
                    </div>
                    <div class="flex gap-2">
                        <span class="bg-zinc-800 text-zinc-400 text-[10px] font-bold px-2 py-1 rounded">SADECE QR</span>
                        <button class="text-zinc-500 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </div>
            </div>

            <button class="w-full bg-zinc-900 border border-dashed border-zinc-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 hover:border-purple-500/50 transition">
                <i data-lucide="plus-circle" class="w-5 h-5"></i> Yeni Personel Ekle
            </button>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

function openSupportModal() {
    const modal = document.getElementById('venue-detail-modal');
    modal.innerHTML = `
        <div class="bg-zinc-950 w-full rounded-t-3xl border-t border-zinc-800 slide-up max-h-[85vh] flex flex-col relative overflow-hidden">
            <div class="px-6 py-5 border-b border-zinc-900 flex justify-between items-center bg-zinc-950 sticky top-0 z-10">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center relative">
                        <i data-lucide="headset" class="w-5 h-5 text-green-500"></i>
                        <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-zinc-950"></span>
                    </div>
                    <div>
                        <h3 class="font-bold text-white text-sm">Canlı Destek</h3>
                        <p class="text-green-500 text-[10px] font-bold uppercase">Çevrimiçi</p>
                    </div>
                </div>
                <button onclick="document.getElementById('venue-detail-modal').classList.add('hidden-view')" class="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white active:scale-95"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>

            <div class="flex-1 p-5 overflow-y-auto no-scrollbar bg-zinc-950 space-y-4">
                <div class="bg-zinc-900 p-4 rounded-2xl rounded-tl-none border border-zinc-800 max-w-[85%] self-start">
                    <p class="text-white text-sm">Merhaba, Noir Coffee. Size atanan kurumsal temsilciniz Merve ben. Size nasıl yardımcı olabilirim?</p>
                    <span class="text-zinc-600 text-[10px] mt-2 block">10:42</span>
                </div>
            </div>

            <div class="p-4 border-t border-zinc-900 bg-zinc-950 pb-6">
                <div class="flex gap-2 mb-3 overflow-x-auto no-scrollbar pb-1">
                    <button class="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-zinc-800">İlan Nasıl Açılır?</button>
                    <button class="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-zinc-800">Fatura Talebi</button>
                    <button class="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-zinc-800">Influencer Şikayeti</button>
                </div>
                <div class="flex items-center gap-2 bg-zinc-900 rounded-full p-1 pl-4 border border-zinc-800 focus-within:border-green-500/50">
                    <input type="text" placeholder="Mesajınızı yazın..." class="flex-1 bg-transparent border-none outline-none text-white text-sm">
                    <button class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white"><i data-lucide="send" class="w-4 h-4 ml-0.5"></i></button>
                </div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

function renderVenueCreate(container) {
    container.innerHTML = `
        <div class="slide-up pb-8">
            <h2 class="text-xl font-bold text-white mb-6">Yeni İlan Oluştur</h2>
            <div class="space-y-4">
                <div>
                    <label class="block text-zinc-400 text-xs font-bold mb-2">İLAN BAŞLIĞI</label>
                    <input type="text" placeholder="Örn: 2 Kişilik Akşam Yemeği" class="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-[#FF007F] transition">
                </div>
                <div>
                    <label class="block text-zinc-400 text-xs font-bold mb-2">BEKLENEN İÇERİK</label>
                    <select class="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-[#FF007F] transition">
                        <option>1 Reels + 2 Story</option>
                        <option>Sadece Story</option>
                        <option>TikTok Videosu</option>
                        <option>Google Haritalar Yorumu</option>
                    </select>
                </div>
                <div>
                    <label class="block text-zinc-400 text-xs font-bold mb-2">MİNİMUM TAKİPÇİ (BİN)</label>
                    <input type="number" placeholder="Örn: 10" class="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-white outline-none focus:border-[#FF007F] transition">
                </div>
                <button onclick="alert('İlan başarıyla yayınlandı!'); switchVenueTab('dashboard');" class="w-full bg-[#FF007F] text-white py-4 rounded-xl font-bold shadow-lg shadow-[#FF007F]/20 active:scale-95 transition-all mt-4">
                    İlanı Yayınla
                </button>
            </div>
        </div>
    `;
}

function renderVenueApps(container) {
    const appsHtml = INFLUENCERS.slice(0, 3).map(inf => `
        <div class="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 mb-3 flex items-center gap-4">
            <img src="${inf.avatar}" class="w-12 h-12 rounded-full object-cover">
            <div class="flex-1">
                <div class="text-white font-bold text-sm">${inf.name}</div>
                <div class="text-zinc-500 text-xs">${inf.followers} Takipçi • ${inf.score} Skor</div>
            </div>
            <div class="flex gap-2">
                <button class="w-8 h-8 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center hover:bg-green-500/30 transition"><i data-lucide="check" class="w-4 h-4"></i></button>
                <button class="w-8 h-8 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500/30 transition"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="slide-up pb-8">
            <h2 class="text-xl font-bold text-white mb-6">Bekleyen Başvurular</h2>
            ${appsHtml}
        </div>
    `;
}

// --- INFLUENCER KAYIT SİHİRBAZI ---
let regStep = 1;
function renderRegStep() {
    document.getElementById('reg-step-title').innerText = `Profesyonel Başvuru (${regStep}/4)`;
    document.getElementById('reg-progress').style.width = `${(regStep/4)*100}%`;
    const content = document.getElementById('reg-content');
    
    if(regStep === 1) content.innerHTML = `
        <div class="space-y-6 fade-in">
            <div class="mb-8"><h2 class="text-2xl font-bold text-white mb-2">Temel İletişim</h2><p class="text-zinc-400 text-sm">Mekanların seninle iletişim kurabilmesi için.</p></div>
            <div class="space-y-4">
                <div><label class="block text-zinc-400 text-xs font-bold mb-2 uppercase">Ad Soyad</label><input type="text" id="reg-name" value="${regData.name}" placeholder="Örn: Ayşe Yılmaz" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl p-4 outline-none"></div>
                <div><label class="block text-zinc-400 text-xs font-bold mb-2 uppercase">E-Posta</label><input type="email" id="reg-email" value="${regData.email}" placeholder="ornek@mail.com" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl p-4 outline-none"></div>
            </div>
        </div>`;
    else if(regStep === 2) content.innerHTML = `
        <div class="space-y-6 fade-in">
            <h2 class="text-2xl font-bold text-white mb-2">Sosyal Kimlik</h2>
            <div class="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 mb-4"><label class="flex items-center gap-2 text-white font-bold mb-3"><i data-lucide="at-sign" class="w-4 h-4 text-[#E1306C]"></i> Instagram</label><input type="text" id="reg-ig" value="${regData.igHandle}" placeholder="@kullaniciadi" class="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl py-3 px-4 outline-none text-sm"></div>
            <div class="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800"><label class="flex items-center gap-2 text-white font-bold mb-3"><i data-lucide="video" class="w-4 h-4 text-cyan-400"></i> TikTok</label><input type="text" id="reg-tk" value="${regData.tiktokHandle}" placeholder="@kullaniciadi" class="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl py-3 px-4 outline-none text-sm"></div>
        </div>`;
    else if(regStep === 3) content.innerHTML = `
        <div class="space-y-6 fade-in">
            <h2 class="text-2xl font-bold text-white mb-2">Kitle Analizi</h2>
            <div><label class="block text-zinc-400 text-xs font-bold mb-3 uppercase">Ağırlıklı Şehir</label>
                <select id="reg-city" class="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl p-4 outline-none appearance-none">
                    <option ${regData.city === 'İstanbul' ? 'selected' : ''}>İstanbul</option>
                    <option ${regData.city === 'Ankara' ? 'selected' : ''}>Ankara</option>
                    <option ${regData.city === 'İzmir' ? 'selected' : ''}>İzmir</option>
                    <option ${regData.city === 'Antalya' ? 'selected' : ''}>Antalya</option>
                </select>
            </div>
        </div>`;
    else if(regStep === 4) content.innerHTML = `
        <div class="space-y-6 fade-in text-center py-10">
            <div class="w-20 h-20 bg-[#FF007F]/20 rounded-full flex items-center justify-center mx-auto mb-6"><i data-lucide="shield-check" class="w-10 h-10 text-[#FF007F]"></i></div>
            <h2 class="text-2xl font-bold text-white mb-2">Sisteme Hoş Geldin!</h2>
            <p class="text-zinc-400 text-sm">Kuralları okudum ve algoritma şartlarını kabul ediyorum. Başvuruyu tamamladığında profilin anında oluşturulacak.</p>
        </div>`;
    
    const btn = document.getElementById('reg-next-btn');
    if(regStep < 4) btn.innerHTML = `İleri <i data-lucide="arrow-right" class="w-4 h-4"></i>`;
    else btn.innerHTML = `Profili Oluştur ve Gir`;
    
    lucide.createIcons();
}

function regStepNext() {
    // Mevcut adımdaki verileri kaydet (State Data Binding)
    if(regStep === 1) {
        regData.name = document.getElementById('reg-name')?.value || regData.name;
        regData.email = document.getElementById('reg-email')?.value || regData.email;
    } else if(regStep === 2) {
        regData.igHandle = document.getElementById('reg-ig')?.value || regData.igHandle;
        regData.tiktokHandle = document.getElementById('reg-tk')?.value || regData.tiktokHandle;
    } else if(regStep === 3) {
        regData.city = document.getElementById('reg-city')?.value || regData.city;
    }

    if(regStep < 4) { 
        regStep++; 
        renderRegStep(); 
    } else { 
        // Gerçek Profili Oluştur (Veritabanı Simülasyonu)
        let username = regData.igHandle ? regData.igHandle.replace('@', '') : 'yeni_uye';
        currentUser = {
            id: 999, // Benzersiz Kullanıcı ID
            name: regData.name || "Yeni Sosyete Üyesi",
            handle: "@" + username,
            avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200", // Yeni üye avatarı
            cover: "https://images.unsplash.com/photo-1512496015851-a98fb38ba79e?auto=format&fit=crop&q=80&w=800", // Varsayılan kapak
            category: "Lifestyle",
            followers: "10K",
            score: 5.0, // Başlangıç sistem puanı
            jobs: 0,
            isTrending: true,
            bio: `${regData.city} merkezli içerik üreticisi. Yeni iş birliklerine açığım! 🌟`,
            recent: []
        };
        
        // Oluşturulan bu profili ana Liderlik Tablosuna (Society) ekle
        INFLUENCERS.unshift(currentUser);
        
        // Giriş yap ve ana uygulamaya yönlendir
        isGuestUser = false;
        navigate('influencer_app', false); 
    }
}


function regStepBack() {
    if(regStep > 1) { regStep--; renderRegStep(); }
    else goBack();
}

// --- EKSİK OLAN MODAL VE BAŞVURU FONKSİYONLARI ---

function openInfluencerModal(id) {
    const inf = INFLUENCERS.find(i => i.id === id);
    if (!inf) return;
    
    const modal = document.getElementById('inf-detail-modal');
    modal.innerHTML = `
        <div class="relative h-64 flex-shrink-0">
            <img src="${inf.cover}" class="w-full h-full object-cover opacity-60">
            <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent"></div>
            <button onclick="document.getElementById('inf-detail-modal').classList.add('hidden-view')" class="absolute top-8 left-5 p-2 bg-black/50 backdrop-blur-md rounded-full text-white active:scale-95 transition z-10"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
            <div class="absolute -bottom-10 left-5 flex items-end gap-4">
                <img src="${inf.avatar}" class="w-24 h-24 rounded-full border-4 border-zinc-950 object-cover shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                <div class="mb-2">
                    <h2 class="text-2xl font-black text-white leading-none flex items-center gap-1">${inf.name} ${inf.score > 4.7 ? '<i data-lucide="check-circle" class="w-4 h-4 text-[#FF007F]"></i>' : ''}</h2>
                    <p class="text-[#FF007F] font-medium text-sm mt-1">${inf.handle}</p>
                </div>
            </div>
        </div>
        
        <div class="flex-1 overflow-y-auto px-5 pt-14 pb-6 no-scrollbar">
            <div class="flex gap-4 mb-6">
                <div class="flex-1 bg-zinc-900 rounded-2xl p-3 border border-zinc-800 text-center">
                    <div class="text-xs text-zinc-500 font-bold mb-1 uppercase">Takipçi</div>
                    <div class="text-lg font-black text-white">${inf.followers}</div>
                </div>
                <div class="flex-1 bg-zinc-900 rounded-2xl p-3 border border-zinc-800 text-center">
                    <div class="text-xs text-zinc-500 font-bold mb-1 uppercase">Kategori</div>
                    <div class="text-sm font-bold text-white mt-1.5">${inf.category}</div>
                </div>
            </div>

            <div class="bg-gradient-to-br from-[#FF007F]/20 to-black rounded-3xl p-5 border border-[#FF007F]/30 mb-6 flex items-center gap-4">
                <div class="w-14 h-14 bg-black rounded-full flex items-center justify-center border-2 border-[#FF007F] flex-shrink-0 shadow-[0_0_15px_rgba(255,0,127,0.3)]">
                    <i data-lucide="star" class="w-6 h-6 text-[#FF007F] fill-[#FF007F]"></i>
                </div>
                <div>
                    <div class="text-sm text-zinc-400 font-bold mb-0.5">MEKAN DEĞERLENDİRMESİ</div>
                    <div class="flex items-end gap-2">
                        <span class="text-3xl font-black text-white leading-none">${inf.score}</span>
                        <span class="text-sm text-zinc-500 mb-1">/ 5.0</span>
                    </div>
                </div>
            </div>

            <h3 class="font-bold text-lg mb-3 text-white">Hakkında</h3>
            <p class="text-zinc-400 text-sm leading-relaxed mb-6 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
                ${inf.bio}
            </p>

            <h3 class="font-bold text-lg mb-3 text-white">Son İş Birlikleri</h3>
            <div class="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                ${inf.recent && inf.recent.length > 0 ? inf.recent.map(collab => `<div class="whitespace-nowrap px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-sm text-zinc-300">${collab}</div>`).join('') : '<span class="text-zinc-500 text-sm">Henüz veri yok.</span>'}
            </div>
        </div>
        
        <div class="p-5 border-t border-zinc-900 bg-zinc-950">
            <button onclick="${isGuestUser ? 'navigate(\'influencer_register\')' : 'alert(\'İş birliği teklifiniz Influencer\\\'a iletildi.\')'}" class="w-full bg-white text-black py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition">
                ${isGuestUser ? 'İletişim İçin Kayıt Ol' : 'İş Birliği Teklif Et'}
            </button>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

function applyCampaign(id, btnElement) {
    if (isGuestUser) {
        navigate('influencer_register');
        return;
    }
    if (appliedCampaigns.includes(id)) {
        alert("Bu kampanyaya zaten başvurdunuz.");
        return;
    }
    
    const modal = document.getElementById('inf-detail-modal');
    modal.innerHTML = `
        <div class="p-6 bg-zinc-950 h-full overflow-y-auto slide-up flex flex-col pt-12 relative">
            <button onclick="document.getElementById('inf-detail-modal').classList.add('hidden-view')" class="absolute top-6 right-6 p-2 bg-zinc-900 rounded-full text-white active:scale-95 z-10"><i data-lucide="x" class="w-5 h-5"></i></button>
            
            <h2 class="text-2xl font-black text-white mb-2">Hizmet Şartları</h2>
            <p class="text-zinc-400 text-sm mb-6">Başvurunu tamamlamadan önce lütfen mekan kurallarını onayla.</p>
            
            <div class="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 mb-6 space-y-4 text-sm text-zinc-300">
                <div class="flex gap-3"><i data-lucide="clock" class="w-5 h-5 text-yellow-500 shrink-0"></i> <span>Gecikme süresi 15 dakikayı aşarsa rezervasyon iptal olur.</span></div>
                <div class="flex gap-3"><i data-lucide="camera" class="w-5 h-5 text-blue-500 shrink-0"></i> <span>İçeriklerin 48 saat içerisinde paylaşılması zorunludur.</span></div>
                <div class="flex gap-3"><i data-lucide="shield-alert" class="w-5 h-5 text-red-500 shrink-0"></i> <span>Mazeretsiz iptaller algoritma puanını %10 düşürür.</span></div>
            </div>
            
            <div class="mt-auto pt-6 border-t border-zinc-900">
                <button onclick="confirmCampaign(${id})" class="w-full bg-[#FF007F] text-white p-4 rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg shadow-[#FF007F]/20 active:scale-95 transition-all">
                    Şartları Kabul Et ve Başvur
                </button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

function confirmCampaign(id) {
    appliedCampaigns.push(id);
    const modal = document.getElementById('inf-detail-modal');
    modal.innerHTML = `
        <div class="p-6 bg-zinc-950 h-full flex flex-col justify-center items-center text-center slide-up">
            <div class="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6"><i data-lucide="check-circle" class="w-10 h-10 text-green-500"></i></div>
            <h2 class="text-2xl font-black text-white mb-2">Başvurunuz Alındı!</h2>
            <p class="text-zinc-400 text-sm mb-8 px-4 leading-relaxed">Mekan yetkilisi profilini inceleyip sana uygulama üzerinden dönüş yapacaktır.</p>
            <button onclick="document.getElementById('inf-detail-modal').classList.add('hidden-view'); switchInfTab('home');" class="w-full bg-white text-black p-4 rounded-xl font-bold active:scale-95 transition-all">
                Keşfete Dön
            </button>
        </div>
    `;
    lucide.createIcons();
}

function openInviteModal(id) {
    if (isGuestUser) {
        navigate('influencer_register');
        return;
    }
    const event = EVENTS.find(e => e.id === id);
    if(!event) return;
    
    const modal = document.getElementById('event-invite-modal');
    modal.innerHTML = `
        <div class="bg-zinc-900 w-full rounded-t-3xl p-6 border-t border-zinc-800 slide-up max-h-[85vh] overflow-y-auto no-scrollbar">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-lg font-bold text-white">Davetiye Talebi</h3>
                <button onclick="document.getElementById('event-invite-modal').classList.add('hidden-view')" class="text-zinc-500 hover:text-white p-2 active:scale-95"><i data-lucide="chevron-down" class="w-6 h-6"></i></button>
            </div>
            
            <div class="flex items-center gap-3 mb-6 p-3 bg-zinc-950 rounded-2xl border border-zinc-800">
                <img src="${event.image}" class="w-12 h-12 rounded-xl object-cover">
                <div>
                    <div class="text-white font-bold text-sm">${event.title}</div>
                    <div class="text-zinc-500 text-xs">${event.date}</div>
                </div>
            </div>

            <p class="text-zinc-300 text-sm mb-4 font-medium">Bu etkinliğe katılımınız karşılığında markaya veya organizatöre nasıl bir içerik üretebilirsiniz?</p>
            
            <div class="space-y-3 mb-8">
                ${['1 Instagram Story', '1 Instagram Reels', '1 TikTok Videosu', 'Youtube / Vlog İçeriği', 'Sadece Katılım'].map((type) => `
                    <label class="flex items-center gap-3 p-4 rounded-xl border bg-zinc-950 border-zinc-800 cursor-pointer active:scale-[0.98] transition-all">
                        <input type="checkbox" class="w-5 h-5 accent-[#FF007F] bg-zinc-900 border-zinc-700 rounded">
                        <span class="text-sm font-medium text-zinc-300">${type}</span>
                    </label>
                `).join('')}
            </div>

            <button onclick="sendEventInvite()" class="w-full bg-[#FF007F] text-white py-4 rounded-xl font-bold shadow-lg shadow-[#FF007F]/20 active:scale-95 transition-all">
                Talebi Gönder
            </button>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

function sendEventInvite() {
    const modal = document.getElementById('event-invite-modal');
    modal.innerHTML = `
        <div class="bg-zinc-900 w-full rounded-t-3xl p-8 border-t border-zinc-800 slide-up text-center">
            <div class="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6"><i data-lucide="check-circle" class="w-10 h-10 text-green-500"></i></div>
            <h4 class="text-white font-bold text-2xl mb-2">Talebiniz Alındı!</h4>
            <p class="text-zinc-400 text-sm mb-8 px-4 leading-relaxed">
                Organizatör profilini inceledikten sonra bilet onayı için sana bildirim gönderecek.
            </p>
            <button onclick="document.getElementById('event-invite-modal').classList.add('hidden-view')" class="w-full bg-white text-black py-4 rounded-xl font-bold active:scale-95 transition-transform">
                Kapat ve Devam Et
            </button>
        </div>
    `;
    lucide.createIcons();
}

// --- MEKAN (VENUE) YÖNETİMİ VE CANLI DESTEK ---
function switchVenueTab(tab) {
    ['dashboard', 'create', 'apps', 'profile', 'menu'].forEach(t => {
        const btn = document.getElementById(`v-tab-btn-${t}`);
        if(btn) {
            btn.classList.remove('text-[#FF007F]');
            btn.classList.add('text-zinc-500');
        }
    });
    
    const activeBtn = document.getElementById(`v-tab-btn-${tab}`);
    if(activeBtn) {
        activeBtn.classList.remove('text-zinc-500');
        activeBtn.classList.add('text-[#FF007F]');
    }

    const container = document.getElementById('venue-main-content');
    if (tab === 'dashboard') renderVenueDash(container);
    else if (tab === 'create') renderVenueCreate(container);
    else if (tab === 'apps') renderVenueApps(container);
    else if (tab === 'profile') renderVenueProfile(container);
    else if (tab === 'menu') renderVenueMenu(container);
    
    lucide.createIcons();
}

function renderVenueDash(container) {
    container.innerHTML = `
        <div class="slide-up pb-6">
            <div class="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 p-6 rounded-3xl mb-6 shadow-xl relative overflow-hidden">
                <div class="absolute top-0 right-0 p-4 opacity-10"><i data-lucide="layout-dashboard" class="w-24 h-24 text-white"></i></div>
                <h2 class="text-xl font-bold text-white mb-1">Mekanınıza Hoş Geldiniz</h2>
                <p class="text-zinc-400 text-sm mb-6">Şu anda aktif 1 kampanyanız bulunuyor.</p>
                
                <div class="flex gap-4">
                    <div class="flex-1 bg-black/50 p-4 rounded-2xl border border-zinc-800/50">
                        <div class="text-3xl font-black text-[#FF007F] mb-1">3</div>
                        <div class="text-[10px] text-zinc-500 uppercase font-bold">Yeni Başvuru</div>
                    </div>
                    <div class="flex-1 bg-black/50 p-4 rounded-2xl border border-zinc-800/50 cursor-pointer hover:bg-black transition">
                        <div class="text-3xl font-black text-white mb-1 flex items-center gap-1">4.8 <i data-lucide="star" class="w-4 h-4 text-yellow-500 fill-yellow-500 mb-1"></i></div>
                        <div class="text-[10px] text-zinc-500 uppercase font-bold">İtibar Endeksi</div>
                    </div>
                </div>
            </div>
            <h3 class="font-bold text-white mb-4">Aktif Kampanyalarım</h3>
            <div onclick="switchVenueTab('apps')" class="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex justify-between items-center cursor-pointer hover:bg-zinc-800 transition active:scale-95">
                <div>
                    <div class="font-bold text-white">2 Kişilik Artisan Kahvaltı</div>
                    <div class="text-xs text-[#FF007F] font-semibold mt-1">3 Başvuru Bekliyor</div>
                </div>
                <i data-lucide="chevron-right" class="text-zinc-500 w-5 h-5"></i>
            </div>
        </div>
    `;
}

function renderVenueCreate(container) {
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-center py-10 slide-up">
            <div class="w-16 h-16 bg-[#FF007F]/20 rounded-full flex items-center justify-center mb-4 border border-[#FF007F]/30">
                <i data-lucide="plus-circle" class="w-8 h-8 text-[#FF007F]"></i>
            </div>
            <h2 class="text-xl font-bold mb-2 text-white">Yeni İlan Oluştur</h2>
            <p class="text-zinc-400 text-sm mb-6 max-w-[250px] mx-auto">Influencerlar için yeni bir kampanya teklifi hazırlayın.</p>
            <button class="bg-[#FF007F] text-white px-6 py-3 rounded-xl font-bold shadow-lg active:scale-95 transition">Sihirbazı Başlat</button>
        </div>
    `;
}

function renderVenueApps(container) {
    let html = INFLUENCERS.slice(0,3).map(inf => `
        <div onclick="openVenueInfModal(${inf.id})" class="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center gap-3 mb-3 cursor-pointer hover:border-[#FF007F]/50 active:scale-95 transition group">
            <img src="${inf.avatar}" class="w-12 h-12 rounded-full object-cover">
            <div class="flex-1">
                <div class="text-white font-bold text-sm flex items-center gap-1">${inf.name} <i data-lucide="check-circle" class="w-3 h-3 text-[#FF007F]"></i></div>
                <div class="text-zinc-500 text-xs">${inf.handle}</div>
            </div>
            <div class="text-right">
                <div class="text-[#FF007F] font-black flex items-center justify-end gap-1"><i data-lucide="star" class="w-3 h-3 fill-current"></i>${inf.score}</div>
                <span class="bg-yellow-500/20 text-yellow-500 text-[9px] font-bold px-2 py-0.5 rounded uppercase mt-1 inline-block border border-yellow-500/30">Bekliyor</span>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="slide-up pb-6">
            <h2 class="text-xl font-bold text-white mb-6">Bekleyen Başvurular (3)</h2>
            <p class="text-zinc-400 text-xs mb-4">Profiline tıklayarak influencer'ın detaylarını inceleyebilir ve onaylayabilirsiniz.</p>
            ${html}
        </div>
    `;
}

function renderVenueProfile(container) {
    container.innerHTML = `
        <div class="slide-up pb-6">
            <h2 class="text-xl font-bold text-white mb-6">Mekan Profili</h2>
            <div class="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 text-center">
                <div class="w-20 h-20 bg-zinc-950 rounded-full mx-auto mb-4 border border-zinc-800 flex items-center justify-center"><i data-lucide="store" class="text-zinc-500 w-8 h-8"></i></div>
                <h3 class="text-white font-bold text-lg mb-1">Noir Coffee Roasters</h3>
                <p class="text-zinc-400 text-sm mb-4">Kadıköy, İstanbul • Cafe</p>
                <button class="bg-white text-black px-4 py-2 rounded-lg text-sm font-bold active:scale-95">Profili Düzenle</button>
            </div>
        </div>
    `;
}

function renderVenueMenu(container) {
    container.innerHTML = `
        <div class="slide-up pb-6">
            <h2 class="text-xl font-bold text-white mb-6">Ayarlar & Hizmetler</h2>
            
            <button onclick="openLiveSupport()" class="w-full bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 p-4 rounded-2xl flex items-center justify-between mb-4 active:scale-95 transition group shadow-lg">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/50 group-hover:scale-110 transition"><i data-lucide="bot" class="text-blue-400 w-6 h-6"></i></div>
                    <div class="text-left">
                        <div class="text-white font-bold text-sm">Canlı Destek Asistanı</div>
                        <div class="text-blue-300/70 text-xs mt-0.5">Yapay Zeka Destekli 7/24 Bot</div>
                    </div>
                </div>
                <i data-lucide="chevron-right" class="text-blue-400 w-5 h-5"></i>
            </button>

            <div class="space-y-2">
                <div class="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between opacity-70">
                    <div class="flex items-center gap-3"><i data-lucide="zap" class="text-yellow-500 w-5 h-5"></i> <span class="text-white text-sm font-bold">İlanı Vitrine Çıkar</span></div>
                    <i data-lucide="chevron-right" class="text-zinc-600 w-4 h-4"></i>
                </div>
                <div class="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between opacity-70">
                    <div class="flex items-center gap-3"><i data-lucide="camera" class="text-[#FF007F] w-5 h-5"></i> <span class="text-white text-sm font-bold">Profesyonel Mekan Çekimi</span></div>
                    <i data-lucide="chevron-right" class="text-zinc-600 w-4 h-4"></i>
                </div>
                <div class="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between opacity-70">
                    <div class="flex items-center gap-3"><i data-lucide="file-text" class="text-zinc-400 w-5 h-5"></i> <span class="text-white text-sm font-bold">Fatura ve Vergi Bilgileri</span></div>
                    <i data-lucide="chevron-right" class="text-zinc-600 w-4 h-4"></i>
                </div>
            </div>
        </div>
    `;
}

function openVenueInfModal(id) {
    const inf = INFLUENCERS.find(i => i.id === id);
    if (!inf) return;
    
    const modal = document.getElementById('venue-detail-modal');
    modal.innerHTML = `
        <div class="bg-zinc-950 w-full h-full flex flex-col slide-up relative overflow-y-auto no-scrollbar">
            <div class="relative h-64 flex-shrink-0">
                <img src="${inf.cover}" class="w-full h-full object-cover opacity-60">
                <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent"></div>
                <button onclick="document.getElementById('venue-detail-modal').classList.add('hidden-view')" class="absolute top-8 left-5 p-2 bg-black/50 backdrop-blur-md rounded-full text-white active:scale-95 transition z-10"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
                <div class="absolute -bottom-10 left-5 flex items-end gap-4">
                    <img src="${inf.avatar}" class="w-24 h-24 rounded-full border-4 border-zinc-950 object-cover shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                    <div class="mb-2">
                        <h2 class="text-2xl font-black text-white leading-none flex items-center gap-1">${inf.name} <i data-lucide="check-circle" class="w-4 h-4 text-[#FF007F]"></i></h2>
                        <p class="text-[#FF007F] font-medium text-sm mt-1">${inf.handle}</p>
                    </div>
                </div>
            </div>
            
            <div class="px-5 pt-14 pb-6">
                <div class="flex gap-4 mb-6">
                    <div class="flex-1 bg-zinc-900 rounded-2xl p-3 border border-zinc-800 text-center">
                        <div class="text-xs text-zinc-500 font-bold mb-1 uppercase">Takipçi</div>
                        <div class="text-lg font-black text-white">${inf.followers}</div>
                    </div>
                    <div class="flex-1 bg-zinc-900 rounded-2xl p-3 border border-zinc-800 text-center">
                        <div class="text-xs text-zinc-500 font-bold mb-1 uppercase">Kategori</div>
                        <div class="text-sm font-bold text-white mt-1.5">${inf.category}</div>
                    </div>
                </div>

                <div class="bg-gradient-to-br from-[#FF007F]/10 to-transparent rounded-3xl p-5 border border-[#FF007F]/20 mb-6 flex items-center justify-between">
                    <div>
                        <div class="text-[10px] text-zinc-400 font-bold mb-1 uppercase">Sistem Puanı</div>
                        <div class="text-2xl font-black text-white flex items-center gap-2">${inf.score} <i data-lucide="star" class="w-5 h-5 text-[#FF007F] fill-[#FF007F]"></i></div>
                    </div>
                    <div class="text-right">
                        <div class="text-[10px] text-zinc-400 font-bold mb-1 uppercase">Tamamlanan İş</div>
                        <div class="text-xl font-black text-white">${inf.jobs}</div>
                    </div>
                </div>

                <h3 class="font-bold text-lg mb-3 text-white">Biyografi</h3>
                <p class="text-zinc-400 text-sm leading-relaxed mb-6 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
                    ${inf.bio}
                </p>
            </div>
            
            <div class="p-5 border-t border-zinc-900 bg-zinc-950 mt-auto flex gap-3 sticky bottom-0">
                <button onclick="document.getElementById('venue-detail-modal').classList.add('hidden-view')" class="flex-1 bg-zinc-900 text-zinc-300 py-4 rounded-xl font-bold shadow-lg active:scale-95 transition border border-zinc-800">
                    Reddet
                </button>
                <button onclick="approveInf(${inf.id})" class="flex-[2] bg-green-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-500/20 active:scale-95 transition flex items-center justify-center gap-2">
                    <i data-lucide="check" class="w-5 h-5"></i> Başvuruyu Onayla
                </button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

function approveInf(id) {
    const modal = document.getElementById('venue-detail-modal');
    modal.innerHTML = `
        <div class="p-6 bg-zinc-950 w-full h-full flex flex-col justify-center items-center text-center slide-up">
            <div class="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/30"><i data-lucide="check-circle" class="w-12 h-12 text-green-500"></i></div>
            <h2 class="text-3xl font-black text-white mb-3">Eşleşme Başarılı!</h2>
            <p class="text-zinc-400 text-sm mb-8 px-4 leading-relaxed">Influencer'a onay bildirimi ve QR giriş kodu gönderildi. Mekanınızda harika içerikler çıkmasını dileriz!</p>
            <button onclick="document.getElementById('venue-detail-modal').classList.add('hidden-view')" class="w-full bg-white text-black p-4 rounded-xl font-bold active:scale-95 transition">
                Başvurulara Dön
            </button>
        </div>
    `;
    lucide.createIcons();
}

function openLiveSupport() {
    const modal = document.getElementById('venue-detail-modal');
    modal.innerHTML = `
        <div class="bg-zinc-950 w-full h-full flex flex-col slide-up relative">
            <div class="p-4 border-b border-zinc-900 flex justify-between items-center bg-zinc-950 z-10 shadow-md">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/30"><i data-lucide="bot" class="text-blue-400 w-5 h-5"></i></div>
                    <div>
                        <h3 class="text-white font-bold text-sm">Gossip Asistan</h3>
                        <div class="text-green-500 text-[10px] font-bold flex items-center gap-1"><span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Çevrimiçi</div>
                    </div>
                </div>
                <button onclick="document.getElementById('venue-detail-modal').classList.add('hidden-view')" class="text-zinc-500 hover:text-white p-2 active:scale-95"><i data-lucide="x" class="w-6 h-6"></i></button>
            </div>
            
            <div id="chat-messages" class="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar pb-20">
                <div class="flex gap-3">
                    <div class="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0"><i data-lucide="bot" class="text-blue-400 w-4 h-4"></i></div>
                    <div class="bg-zinc-900 p-3 rounded-2xl rounded-tl-none text-sm text-zinc-300 max-w-[85%] border border-zinc-800 leading-relaxed shadow-sm">
                        Merhaba! Gossip Society mekan paneline hoş geldiniz. Ben yapay zeka asistanınızım. Aşağıdaki hızlı sorulardan birini seçebilir veya sorunuzu yazabilirsiniz.
                    </div>
                </div>
                
                <div class="flex flex-col gap-2 pl-11" id="chat-options">
                    <button onclick="sendChatMessage('Nasıl ilan oluşturabilirim?')" class="bg-zinc-800/80 border border-zinc-700 text-left px-4 py-2.5 rounded-xl text-xs text-zinc-300 hover:bg-zinc-700 transition shadow-sm active:scale-95">Nasıl ilan oluşturabilirim?</button>
                    <button onclick="sendChatMessage('Influencer onay süreci nasıl işliyor?')" class="bg-zinc-800/80 border border-zinc-700 text-left px-4 py-2.5 rounded-xl text-xs text-zinc-300 hover:bg-zinc-700 transition shadow-sm active:scale-95">Influencer onay süreci nasıl işliyor?</button>
                    <button onclick="sendChatMessage('Ücretlendirme ve komisyon var mı?')" class="bg-zinc-800/80 border border-zinc-700 text-left px-4 py-2.5 rounded-xl text-xs text-zinc-300 hover:bg-zinc-700 transition shadow-sm active:scale-95">Ücretlendirme ve komisyon var mı?</button>
                </div>
            </div>
            
            <div class="p-4 border-t border-zinc-900 bg-zinc-950 flex gap-2">
                <input type="text" placeholder="Şimdilik sadece butonları kullanabilirsiniz..." class="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-xs text-zinc-500 outline-none" disabled>
                <button class="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white opacity-50 cursor-not-allowed"><i data-lucide="send" class="w-5 h-5"></i></button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden-view');
    lucide.createIcons();
}

function sendChatMessage(text) {
    const msgs = document.getElementById('chat-messages');
    const opts = document.getElementById('chat-options');
    if(opts) opts.remove();
    
    msgs.innerHTML += `
        <div class="flex gap-3 justify-end slide-up">
            <div class="bg-blue-600 p-3 rounded-2xl rounded-tr-none text-sm text-white max-w-[85%] shadow-md leading-relaxed">${text}</div>
        </div>
    `;
    
    msgs.scrollTop = msgs.scrollHeight;
    
    const loadingId = 'loading-' + Date.now();
    msgs.innerHTML += `
        <div id="${loadingId}" class="flex gap-3 slide-up">
            <div class="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0"><i data-lucide="bot" class="text-blue-400 w-4 h-4"></i></div>
            <div class="bg-zinc-900 p-3 rounded-2xl rounded-tl-none text-sm text-zinc-400 border border-zinc-800 flex items-center gap-1">
                <div class="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                <div class="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                <div class="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
            </div>
        </div>
    `;
    msgs.scrollTop = msgs.scrollHeight;
    lucide.createIcons();

    setTimeout(() => {
        document.getElementById(loadingId).remove();
        
        let reply = "";
        if(text.includes('ilan')) reply = "Alt menüdeki ortada bulunan '+' (İlan Oluştur) butonuna tıklayarak mekanınız için yeni bir kampanya oluşturabilirsiniz. İlanınız onaylandıktan sonra keşfet bölümünde influencerlara gösterilecektir.";
        else if(text.includes('onay')) reply = "Başvurular sekmesinden mekanınıza başvuran içerik üreticilerini görebilirsiniz. Profillerini detaylı inceleyip (Puanı, Kitle Analizi) uygun bulduklarınızı 'Onayla' butonuna basarak mekanınıza davet edebilirsiniz.";
        else if(text.includes('Ücret')) reply = "Gossip Society'ye katılım mekanlar için tamamen <strong>ücretsizdir!</strong> Herhangi bir komisyon ödemezsiniz. Sadece influencerlara sunduğunuz hizmet/ürün karşılığında profesyonel reklam almış olursunuz. Ekstra görünürlük için 'Vitrin' paketlerimizi satın alabilirsiniz.";
        else reply = "Anlıyorum. Size daha iyi yardımcı olabilmem için lütfen canlı destek uzmanımıza bağlanmayı bekleyin.";
        
        msgs.innerHTML += `
            <div class="flex gap-3 slide-up">
                <div class="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0"><i data-lucide="bot" class="text-blue-400 w-4 h-4"></i></div>
                <div class="bg-zinc-900 p-3 rounded-2xl rounded-tl-none text-sm text-zinc-300 max-w-[85%] border border-zinc-800 leading-relaxed shadow-sm">${reply}</div>
            </div>
        `;
        
        msgs.innerHTML += `
            <div class="flex flex-col gap-2 pl-11 slide-up mt-2" id="chat-options">
                <button onclick="sendChatMessage('Nasıl ilan oluşturabilirim?')" class="bg-zinc-800/80 border border-zinc-700 text-left px-4 py-2.5 rounded-xl text-xs text-zinc-300 hover:bg-zinc-700 transition shadow-sm active:scale-95">Nasıl ilan oluşturabilirim?</button>
                <button onclick="sendChatMessage('Influencer onay süreci nasıl işliyor?')" class="bg-zinc-800/80 border border-zinc-700 text-left px-4 py-2.5 rounded-xl text-xs text-zinc-300 hover:bg-zinc-700 transition shadow-sm active:scale-95">Influencer onay süreci nasıl işliyor?</button>
                <button onclick="sendChatMessage('Ücretlendirme ve komisyon var mı?')" class="bg-zinc-800/80 border border-zinc-700 text-left px-4 py-2.5 rounded-xl text-xs text-zinc-300 hover:bg-zinc-700 transition shadow-sm active:scale-95">Ücretlendirme ve komisyon var mı?</button>
            </div>
        `;
        msgs.scrollTop = msgs.scrollHeight;
        lucide.createIcons();
    }, 1200);
}

// BAŞLANGIÇ
window.addEventListener("load", () => {
    lucide.createIcons();
});
