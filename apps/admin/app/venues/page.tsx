import { Suspense } from 'react';
import type { Metadata } from 'next';
import { parsePageParam } from '@/lib/venue-list';
import { AdminPage } from '../admin-page';
import { VenuesList } from './venues-list';

export const metadata: Metadata = { title: 'Mekanlar · Yönetim Paneli' };

// The page number and the "created" flag come from the URL, which is request
// data: read behind Suspense. Nothing sensitive is ever put in the URL.
async function Content({
  searchParams,
  accessToken,
}: Pick<PageProps<'/venues'>, 'searchParams'> & { accessToken: string }) {
  const params = await searchParams;
  return (
    <VenuesList
      accessToken={accessToken}
      page={parsePageParam(params.page)}
      created={params.created === '1'}
    />
  );
}

export default function VenuesPage(props: PageProps<'/venues'>) {
  return (
    <AdminPage>
      {({ accessToken }) => (
        <Suspense
          fallback={
            <main className="flex flex-1 items-center justify-center text-sm text-zinc-500">
              Mekanlar yükleniyor…
            </main>
          }
        >
          <Content
            searchParams={props.searchParams}
            accessToken={accessToken}
          />
        </Suspense>
      )}
    </AdminPage>
  );
}
