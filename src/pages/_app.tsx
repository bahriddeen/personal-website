import type { AppProps } from 'next/app';
import { Figtree } from 'next/font/google';
import { useRouter } from 'next/router';
import { BuyMeCoffee } from '@/components/layout/BuyMeCoffee';
import '@/styles/globals.css';

const figtree = Figtree({
  subsets: ['latin'],
  display: 'swap',
  variable: '--figtree',
});

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
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
      {/* Public pages only: never on the admin or its login. */}
      {!router.pathname.startsWith('/admin') && <BuyMeCoffee />}
    </>
  );
}
