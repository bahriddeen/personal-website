/** Styles for the rendered About Markdown: body copy, full-width images, inline links. */
export const ABOUT_CONTENT_CLASS = [
  'w-full',
  '[&_p]:mb-4 [&_p]:leading-7 [&_p]:text-zinc-600 dark:[&_p]:text-zinc-200',
  '[&_strong]:font-semibold [&_strong]:text-zinc-800 dark:[&_strong]:text-zinc-100',
  '[&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-2',
  '[&_img]:mb-4 [&_img]:h-auto [&_img]:w-full',
  '[&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-medium dark:[&_h2]:text-zinc-100',
  '[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:leading-7 [&_ul]:text-zinc-600 dark:[&_ul]:text-zinc-200',
  '[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:leading-7 [&_ol]:text-zinc-600 dark:[&_ol]:text-zinc-200',
  '[&_blockquote]:mb-4 [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-200 [&_blockquote]:pl-4 [&_blockquote]:italic dark:[&_blockquote]:border-zinc-700',
].join(' ');
