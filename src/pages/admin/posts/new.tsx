import type { GetServerSideProps } from 'next';
import dynamic from 'next/dynamic';
import { AdminShell } from '@/components/admin/AdminShell';
import { adminPage } from '@/lib/admin/server';

const PostEditor = dynamic(() => import('@/components/admin/PostEditor'), {
  ssr: false,
  loading: () => <p className="text-sm text-zinc-500">Loading editor…</p>,
});

export const getServerSideProps: GetServerSideProps = (ctx) => adminPage(ctx, async () => ({ props: {} }));

export default function NewPostPage() {
  return (
    <AdminShell title="New post" wide>
      <PostEditor initial={null} />
    </AdminShell>
  );
}
