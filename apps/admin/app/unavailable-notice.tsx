export function UnavailableNotice() {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-center">
        <h1 className="mb-2 text-lg font-bold text-white">
          Sunucuya ulaşılamıyor
        </h1>
        <p className="mb-5 text-sm text-zinc-400">
          Oturumunuz korunuyor. Bağlantı gelince sayfayı yenileyerek devam
          edebilirsiniz.
        </p>
        {/* A full reload, so the proxy gets another chance to renew the session. */}
        <a
          href=""
          className="inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white"
        >
          Tekrar Dene
        </a>
      </div>
    </main>
  );
}
