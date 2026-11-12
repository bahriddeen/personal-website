import type { AppProps } from 'next/app';
import { Figtree } from 'next/font/google';
import '@/styles/globals.css';

const figtree = Figtree({
  subsets: ['latin'],
  display: 'swap',
  variable: '--figtree',
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      {/* Define the font variable on :root so dialogs and anything else rendered
          outside the page tree still get the site font. */}
      <style jsx global>{`
        :root {
          --figtree: ${figtree.style.fontFamily};
        }
      `}</style>
      <Component {...pageProps} />
    </>
  );
}
