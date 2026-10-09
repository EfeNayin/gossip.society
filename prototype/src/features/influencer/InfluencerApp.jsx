export default function InfluencerApp() {
    return (
        <div id="view-influencer-app" className="hidden-view flex flex-col h-full w-full bg-zinc-950 fade-in relative">
        
                    <div className="px-5 pt-8 pb-4 bg-zinc-950 sticky top-0 z-30 border-b border-zinc-900 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <button onClick={() => window.goBack()} className="text-zinc-500 hover:text-white transition-colors"><i data-lucide="arrow-left" className="w-5 h-5"></i></button>
                            <div onClick={() => window.navigate('landing')} className="cursor-pointer hover:opacity-80 transition-opacity active:scale-[0.98]">
                                <h1 className="text-2xl font-black tracking-tighter">GOSSIP<span className="text-[#FF007F]">.</span>SOCIETY</h1>
                                <p id="inf-header-subtitle" className="text-zinc-500 text-[10px] font-bold tracking-widest mt-0.5">INFLUENCER PANELİ</p>
                            </div>
                        </div>
                        <button onClick={() => window.openNotificationsModal()} className="relative p-2 bg-zinc-900 rounded-full hover:bg-zinc-800 transition active:scale-95" id="inf-bell">
                            <i data-lucide="bell" className="text-zinc-300 w-5 h-5"></i>
                            <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-[#FF007F] rounded-full border-2 border-zinc-900"></span>
                        </button>
                    </div>
        
        
                    <div id="inf-main-content" className="flex-1 overflow-y-auto px-5 py-4 no-scrollbar relative">
        
                    </div>
        
        
                    <div className="bg-black/95 backdrop-blur-lg border-t border-zinc-900 flex justify-around items-center p-4 pb-6 z-40 relative">
                        <button onClick={() => window.switchInfTab('home')} id="tab-btn-home" className="flex flex-col items-center gap-1 text-[#FF007F]">
                            <i data-lucide="home" className="w-6 h-6"></i><span className="text-[10px] font-semibold">Keşfet</span>
                        </button>
                        <button onClick={() => window.switchInfTab('society')} id="tab-btn-society" className="flex flex-col items-center gap-1 text-zinc-500">
                            <i data-lucide="users" className="w-6 h-6"></i><span className="text-[10px] font-semibold">Sosyete</span>
                        </button>
                        <button onClick={() => window.switchInfTab('events')} id="tab-btn-events" className="flex flex-col items-center gap-1 text-zinc-500">
                            <i data-lucide="calendar" className="w-6 h-6"></i><span className="text-[10px] font-semibold">Etkinlikler</span>
                        </button>
                        <button onClick={() => window.switchInfTab('profile')} id="tab-btn-profile" className="flex flex-col items-center gap-1 text-zinc-500">
                            <i data-lucide="user" className="w-6 h-6"></i><span className="text-[10px] font-semibold">Profilim</span>
                        </button>
                    </div>
        
        
                    <div id="inf-detail-modal" className="hidden-view absolute inset-0 z-50 bg-zinc-950 slide-up flex flex-col"></div>
                    <div id="event-invite-modal" className="hidden-view absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end justify-center fade-in"></div>
                </div>
    );
}
