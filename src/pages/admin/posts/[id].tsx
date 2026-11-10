import type { GetServerSideProps } from 'next';
import dynamic from 'next/dynamic';
import { AdminShell } from '@/components/admin/AdminShell';
import { adminPage } from '@/lib/admin/server';
import { getPostById, type Post } from '@/lib/db/queries';

const PostEditor = dynamic(() => import('@/components/admin/PostEditor'), {
  ssr: false,
  loading: () => <p className="text-sm text-zinc-500">Loading editor…</p>,
});

type Props = { post: Post };

export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  adminPage<Props>(ctx, async () => {
    const id = Number(ctx.params?.id);
    const post = Number.isInteger(id) && id > 0 ? await getPostById(id) : null;
    return post ? { props: { post } } : { notFound: true };
  });

export default function EditPostPage({ post }: Props) {
  return (
    <AdminShell title={post.title} wide>
      <PostEditor key={post.id} initial={post} />
    </AdminShell>
  );
}
