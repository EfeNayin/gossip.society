export default function InfluencerRegistration() {
    return (
        <div id="view-influencer-register" className="hidden-view flex flex-col h-full bg-zinc-950 slide-in-right">
                    <div className="px-5 pt-6 pb-4 border-b border-zinc-900 flex items-center justify-between">
                        <button onClick={() => window.regStepBack()} className="text-zinc-400 hover:text-white"><i data-lucide="arrow-left" className="w-6 h-6"></i></button>
                        <div className="text-sm font-bold text-zinc-300" id="reg-step-title">Profesyonel Başvuru (1/4)</div>
                        <div className="w-6"></div>
                    </div>
                    <div className="w-full bg-zinc-900 h-1"><div id="reg-progress" className="bg-[#FF007F] h-1 transition-all duration-300" style={{ width: "25%" }}></div></div>
        
                    <div className="flex-1 overflow-y-auto px-5 py-6 no-scrollbar" id="reg-content">
        
                    </div>
        
                    <div className="p-5 border-t border-zinc-900 bg-zinc-950">
                        <button id="reg-next-btn" onClick={() => window.regStepNext()} className="w-full bg-[#FF007F] text-white p-4 rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg shadow-[#FF007F]/20 active:scale-95 transition-all">
                            İleri <i data-lucide="arrow-right" className="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
    );
}
