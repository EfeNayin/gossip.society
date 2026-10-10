import type { Metadata } from 'next';
import { AdminPage } from '../../admin-page';
import { VenueForm } from './venue-form';

export const metadata: Metadata = { title: 'Yeni Mekan · Yönetim Paneli' };

export default function NewVenuePage() {
  return (
    <AdminPage>
      {() => (
        <main className="flex flex-1 flex-col gap-6 p-6">
          <div>
            <h1 className="text-2xl font-semibold text-white">Yeni Mekan</h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Yeni bir mekan sahibi hesabı, mekan ve ilk şube oluşturur.
              Uygulama e-posta veya mesaj göndermez: başlangıç parolasını mekan
              sahibine kendiniz iletmelisiniz. Parola değiştirme ve sıfırlama
              henüz yoktur.
            </p>
          </div>
          <div className="max-w-2xl">
            <VenueForm />
          </div>
        </main>
      )}
    </AdminPage>
  );
}
