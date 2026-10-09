import { Suspense } from "react";
import { healthResponseSchema, type HealthResponse } from "@gossip/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

async function fetchHealth(): Promise<HealthResponse | null> {
  try {
    const response = await fetch(`${API_URL}/health`);
    return healthResponseSchema.parse(await response.json());
  } catch {
    return null;
  }
}

async function ApiStatus() {
  const health = await fetchHealth();

  if (!health) {
    return <p className="text-red-600">API&apos;ye ulaşılamıyor.</p>;
  }

  return (
    <ul>
      <li>API: {health.status === "ok" ? "çalışıyor" : "hata"}</li>
      <li>Veritabanı: {health.db === "up" ? "bağlı" : "bağlı değil"}</li>
    </ul>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Gossip Society Yönetim Paneli</h1>
      <Suspense fallback={<p>API durumu kontrol ediliyor…</p>}>
        <ApiStatus />
      </Suspense>
    </main>
  );
}
