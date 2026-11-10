import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { SiteSettings } from '@/lib/site';
import { BackToTop, ThemeToggle } from './FloatingControls';
import { Header } from './Header';
import { Seo, type SeoProps } from './Seo';

// Loaded on demand: it only matters once someone presses ⌘K.
const CommandPalette = dynamic(
  () => import('@/components/search/CommandPalette').then((m) => m.CommandPalette),
  { ssr: false },
);

type LayoutProps = {
  site: SiteSettings;
  seo: Omit<SeoProps, 'site'>;
  children: ReactNode;
};

export function Layout({ site, seo, children }: LayoutProps) {
  return (
    <>
      <Seo site={site} {...seo} />
      <a
        href="#content"
        className="sr-only z-[200] rounded-xl bg-zinc-900 px-4 py-2 font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 dark:bg-white dark:text-zinc-900"
      >
        Skip to content
      </a>
      <div className="grid min-h-screen grid-rows-[auto_1fr_auto] transition-colors duration-300">
        <Header title={site.title} />
        <main id="content" className="flex w-full flex-col items-center px-6 sm:px-10">
          {children}
        </main>
        <footer className="flex w-full items-center justify-center px-6 pb-12 pt-40 text-zinc-500 sm:px-10">
          <div className="fade flex w-full max-w-lg animate-fade items-center justify-center">
            <p className="dark:text-white">
              © {new Date().getFullYear()} {site.title}
            </p>
          </div>
        </footer>
      </div>
      <ThemeToggle />
      <BackToTop />
      <CommandPalette />
    </>
  );
}

/** Centred 512px content column with the reference's vertical rhythm. */
export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'my-20 flex w-full max-w-lg flex-col items-center text-zinc-800 sm:my-32',
        className,
      )}
    >
      {children}
    </section>
  );
}
