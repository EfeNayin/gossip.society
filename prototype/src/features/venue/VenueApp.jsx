export default function VenueApp() {
    return (
        <div id="view-venue-app" className="hidden-view flex flex-col h-full w-full bg-zinc-950 fade-in">
        
                    <div className="px-5 pt-8 pb-4 bg-zinc-950 sticky top-0 z-40 border-b border-zinc-900 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <button onClick={() => window.goBack()} className="text-zinc-500 hover:text-white transition-colors"><i data-lucide="arrow-left" className="w-5 h-5"></i></button>
                            <div onClick={() => window.navigate('landing')} className="cursor-pointer hover:opacity-80 transition-opacity active:scale-[0.98]">
                                <h1 className="text-2xl font-black tracking-tighter">GOSSIP<span className="text-[#FF007F]">.</span>SOCIETY</h1>
                                <p className="text-zinc-500 text-[10px] font-bold tracking-widest mt-0.5">MEKAN PANELİ</p>
                            </div>
                        </div>
                    </div>
        
        
                    <div id="venue-main-content" className="flex-1 overflow-y-auto px-5 py-4 no-scrollbar relative">
        
                    </div>
        
        
                    <div className="bg-black/95 backdrop-blur-lg border-t border-zinc-900 flex justify-around items-center p-4 pb-6 z-40 relative">
                        <button onClick={() => window.switchVenueTab('dashboard')} id="v-tab-btn-dashboard" className="flex flex-col items-center gap-1 text-[#FF007F]">
                            <i data-lucide="layout-dashboard" className="w-6 h-6"></i><span className="text-[10px] font-semibold">Panel</span>
                        </button>
                        <button onClick={() => window.switchVenueTab('apps')} id="v-tab-btn-apps" className="flex flex-col items-center gap-1 relative text-zinc-500">
                            <i data-lucide="clipboard-list" className="w-6 h-6"></i>
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#FF007F] rounded-full"></span>
                            <span className="text-[10px] font-semibold">Başvurular</span>
                        </button>
                        <div className="relative -top-5">
                            <button onClick={() => window.switchVenueTab('create')} className="w-14 h-14 bg-[#FF007F] rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(255,0,127,0.4)] hover:scale-105 transition active:scale-95 border-4 border-black">
                                <i data-lucide="plus-circle" className="w-7 h-7"></i>
                            </button>
                            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white whitespace-nowrap">İlan Oluştur</span>
                        </div>
                        <button onClick={() => window.switchVenueTab('profile')} id="v-tab-btn-profile" className="flex flex-col items-center gap-1 text-zinc-500">
                            <i data-lucide="store" className="w-6 h-6"></i><span className="text-[10px] font-semibold">Profil</span>
                        </button>
                        <button onClick={() => window.switchVenueTab('menu')} id="v-tab-btn-menu" className="flex flex-col items-center gap-1 text-zinc-500">
                            <i data-lucide="menu" className="w-6 h-6"></i><span className="text-[10px] font-semibold">Menü</span>
                        </button>
                    </div>
        
        
                    <div id="venue-detail-modal" className="hidden-view absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center fade-in"></div>
                </div>
    );
}
