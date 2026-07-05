export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-800 flex items-center justify-center shadow-lg shadow-red-900/40">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#1A0A08">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="text-3xl font-bold tracking-tight">
          ExPost <span className="bg-red-500 text-black text-xs font-bold px-2 py-1 rounded ml-1 align-middle">AI</span>
        </span>
      </div>
      <h1 className="text-xl font-semibold mb-3">O back-end está no ar 🎉</h1>
      <p className="text-sm text-neutral-400 max-w-md">
        Essa é a base do projeto (banco de dados, login com Google, webhook da
        Cakto). A interface completa do dashboard ainda está sendo portada do
        protótipo para cá.
      </p>
    </main>
  );
}
