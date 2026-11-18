import type { GetServerSideProps } from 'next';
import { AdminShell } from '@/components/admin/AdminShell';
import { CampaignEditor } from '@/components/admin/CampaignEditor';
import { emailMode } from '@/lib/admin/campaign-page';
import { adminPage } from '@/lib/admin/server';
import { countActiveSubscribers, getCampaign, type Campaign } from '@/lib/campaigns';
import { renderEmailMarkdown } from '@/lib/email-markdown';

type Props = {
  campaign: Campaign;
  activeSubscribers: number;
  emailMode: 'real' | 'log' | 'off';
  sentHtml: string | null;
};

export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  adminPage<Props>(ctx, async () => {
    const id = Number(ctx.params?.id);
    const campaign = Number.isInteger(id) && id > 0 ? await getCampaign(id) : null;
    if (!campaign) return { notFound: true };
    const [activeSubscribers, sentHtml] = await Promise.all([
      countActiveSubscribers(),
      campaign.status === 'draft' ? null : renderEmailMarkdown(campaign.bodyMd),
    ]);
    return { props: { campaign, activeSubscribers, emailMode: emailMode(), sentHtml } };
  });

export default function EditCampaignPage({ campaign, activeSubscribers, emailMode, sentHtml }: Props) {
  return (
    <AdminShell title={campaign.subject || 'Email'} wide>
      <CampaignEditor
        key={campaign.id}
        initial={campaign}
        activeSubscribers={activeSubscribers}
        emailMode={emailMode}
        sentHtml={sentHtml}
      />
    </AdminShell>
  );
}
