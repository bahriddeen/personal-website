import { Head, Html, Main, NextScript } from 'next/document';
import { themeInitScript } from '@/lib/theme';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </Head>
      <body className="bg-white font-sans text-zinc-900 transition-colors duration-300 dark:bg-zinc-900 dark:text-zinc-100">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
