export default function LandingView() {
    return (
        <div id="view-landing" className="w-full h-full relative overflow-y-auto no-scrollbar pb-10 fade-in">
                    <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-[#FF007F]/20 via-zinc-950 to-zinc-950 pointer-events-none"></div>
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#FF007F]/30 rounded-full blur-[120px] pointer-events-none"></div>
        
                    <div className="px-6 pt-16 pb-8 z-10 flex flex-col items-center text-center relative">
                        <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-6 border border-[#FF007F]/30 shadow-[0_0_40px_rgba(255,0,127,0.4)]">
                            <i data-lucide="sparkles" className="text-[#FF007F] w-8 h-8"></i>
                        </div>
        
                        <h1 className="text-4xl font-black tracking-tighter text-white mb-4 leading-tight">
                            GOSSIP<span className="text-[#FF007F]">.</span>SOCIETY
                        </h1>
        
                        <p className="text-zinc-400 text-sm font-medium leading-relaxed max-w-[280px] mx-auto mb-8">
                            Dijital etkiyi fiziksel lükse dönüştürün. Markanızı doğru kitleyle buluşturan, içerik üreticileri ve prestijli işletmeler için tasarlanmış <span className="text-white">yeni nesil</span> davet ekosistemi.
                        </p>
        
                        <div className="flex items-center justify-center gap-4 mb-12 w-full max-w-xs">
                            <div className="flex flex-col items-center">
                                <div className="w-14 h-14 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 shadow-lg">
                                    <i data-lucide="store" className="text-zinc-300 w-6 h-6"></i>
                                </div>
                                <span className="text-[10px] text-zinc-500 font-bold mt-2 uppercase tracking-wider">Mekanlar</span>
                            </div>
                            <div className="flex-1 flex items-center justify-center relative">
                                <div className="w-full h-px bg-gradient-to-r from-zinc-800 via-[#FF007F] to-zinc-800"></div>
                                <i data-lucide="arrow-right" className="text-[#FF007F] absolute w-4 h-4"></i>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-14 h-14 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 shadow-lg">
                                    <i data-lucide="user" className="text-zinc-300 w-6 h-6"></i>
                                </div>
                                <span className="text-[10px] text-zinc-500 font-bold mt-2 uppercase tracking-wider">Influencer</span>
                            </div>
                        </div>
        
                        <div className="w-full max-w-sm space-y-4">
                            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 p-5 rounded-3xl border border-zinc-800 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF007F]/5 rounded-full blur-3xl"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="bg-[#FF007F]/10 p-2 rounded-xl text-[#FF007F]"><i data-lucide="camera" className="w-5 h-5"></i></div>
                                        <h2 className="text-white font-bold text-lg">İçerik Üreticisi Misin?</h2>
                                    </div>
                                    <p className="text-zinc-400 text-xs mb-5 leading-relaxed text-left">Davetlere katıl, seçkin mekanları ücretsiz deneyimle ve içerik üret.</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => window.navigate('influencer_register')} className="flex-1 bg-[#FF007F] text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-[#FF007F]/20 active:scale-95 transition-all">Sosyete'ye Katıl</button>
                                        <button onClick={() => window.navigate('influencer_app', false)} className="flex-1 bg-zinc-800 text-white py-3 rounded-xl font-bold text-sm active:scale-95 transition-all border border-zinc-700">Giriş Yap</button>
                                    </div>
                                </div>
                            </div>
        
                            <div className="bg-gradient-to-br from-blue-900/10 to-zinc-950 p-5 rounded-3xl border border-blue-900/30 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="bg-blue-500/10 p-2 rounded-xl text-blue-400"><i data-lucide="store" className="w-5 h-5"></i></div>
                                        <h2 className="text-white font-bold text-lg">Mekan Sahibi Misin?</h2>
                                    </div>
                                    <p className="text-zinc-400 text-xs mb-5 leading-relaxed text-left">Doğru kitleye hitap eden influencerları bulun ve mekanınızı büyütün.</p>
                                    <button onClick={() => window.navigate('venue_app')} className="w-full bg-white text-black py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
                                        Mekan Paneline Git <i data-lucide="arrow-right" className="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>
        
                            <button onClick={() => window.navigate('influencer_app', true)} className="mt-4 w-full py-4 text-zinc-500 text-sm font-medium hover:text-white transition flex items-center justify-center gap-2 active:scale-95">
                                <i data-lucide="globe" className="w-4 h-4"></i> Sistemi Misafir Olarak Keşfet
                            </button>
        
        
                            <button onClick={() => window.navigate('admin_app')} className="mt-4 w-full py-2 text-zinc-700 text-xs font-medium hover:text-zinc-500 transition flex items-center justify-center gap-2 active:scale-95">
                                <i data-lucide="shield-alert" className="w-3 h-3"></i> Yönetici Paneline Git
                            </button>
                        </div>
                    </div>
                </div>
    );
}
