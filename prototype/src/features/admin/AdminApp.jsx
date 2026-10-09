export default function AdminApp() {
    return (
        <div id="view-admin-app" className="hidden-view flex flex-col h-full w-full bg-zinc-950 fade-in">
        
                    <div className="px-5 pt-8 pb-4 bg-zinc-950 sticky top-0 z-40 border-b border-zinc-900 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <button onClick={() => window.goBack()} className="text-zinc-500 hover:text-white transition-colors"><i data-lucide="arrow-left" className="w-5 h-5"></i></button>
                            <div onClick={() => window.navigate('landing')} className="cursor-pointer hover:opacity-80 transition-opacity active:scale-[0.98]">
                                <h1 className="text-2xl font-black tracking-tighter text-red-500">GOSSIP<span className="text-white">.</span>ADMIN</h1>
                                <p className="text-zinc-500 text-[10px] font-bold tracking-widest mt-0.5">SİSTEM KONTROL MERKEZİ</p>
                            </div>
                        </div>
                    </div>
        
        
                    <div id="admin-main-content" className="flex-1 overflow-y-auto px-5 py-4 no-scrollbar relative">
        
                    </div>
        
        
                    <div className="bg-black/95 backdrop-blur-lg border-t border-zinc-900 flex justify-around items-center p-4 pb-6 z-40 relative">
                        <button onClick={() => window.switchAdminTab('dashboard')} id="a-tab-btn-dashboard" className="flex flex-col items-center gap-1 text-red-500">
                            <i data-lucide="activity" className="w-6 h-6"></i><span className="text-[10px] font-semibold">Özet</span>
                        </button>
                        <button onClick={() => window.switchAdminTab('users')} id="a-tab-btn-users" className="flex flex-col items-center gap-1 text-zinc-500">
                            <i data-lucide="users" className="w-6 h-6"></i><span className="text-[10px] font-semibold">Üyeler</span>
                        </button>
                        <button onClick={() => window.switchAdminTab('venues')} id="a-tab-btn-venues" className="flex flex-col items-center gap-1 text-zinc-500">
                            <i data-lucide="store" className="w-6 h-6"></i><span className="text-[10px] font-semibold">Mekanlar</span>
                        </button>
                        <button onClick={() => window.switchAdminTab('campaigns')} id="a-tab-btn-campaigns" className="flex flex-col items-center gap-1 text-zinc-500">
                            <i data-lucide="megaphone" className="w-6 h-6"></i><span className="text-[10px] font-semibold">İlanlar</span>
                        </button>
                    </div>
                </div>
    );
}
