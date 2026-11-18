import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { CampaignEditor } from '@/components/admin/CampaignEditor';
import { emailMode } from '@/lib/admin/campaign-page';
import { adminPage } from '@/lib/admin/server';
import { countActiveSubscribers } from '@/lib/campaigns';

type Props = { activeSubscribers: number; emailMode: 'real' | 'log' | 'off' };

export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  adminPage<Props>(ctx, async () => ({
    props: { activeSubscribers: await countActiveSubscribers(), emailMode: emailMode() },
  }));

export default function NewCampaignPage({ activeSubscribers, emailMode }: Props) {
  // Next keeps this page mounted when /admin/newsletter/new is opened again from itself (for
  // example after a first save moved the address to /admin/newsletter/<id>), which would keep
  // showing the email just created. A fresh key on every visit starts a blank one.
  const router = useRouter();
  const [visit, setVisit] = useState(0);
  useEffect(() => {
    const onDone = (url: string) => {
      if (url.split('?')[0] === '/admin/newsletter/new') setVisit((v) => v + 1);
    };
    router.events.on('routeChangeComplete', onDone);
    return () => router.events.off('routeChangeComplete', onDone);
  }, [router.events]);

  return (
    <AdminShell title="New email" wide>
      <CampaignEditor key={visit} initial={null} activeSubscribers={activeSubscribers} emailMode={emailMode} sentHtml={null} />
    </AdminShell>
  );
}
