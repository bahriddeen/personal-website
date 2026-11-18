import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { SOCIAL_ICONS } from '@/components/ui/Social';
import { cn } from '@/lib/cn';
import type { SiteSettings } from '@/lib/site';
import { BackToTop, ThemeToggle } from './FloatingControls';
import { Header } from './Header';
import { NewsletterPopup } from './NewsletterPopup';
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
      <div className="grid min-h-screen grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto] transition-colors duration-300">
        <Header title={site.title} headline={site.headline} avatarUrl={site.avatarUrl} chat={site.chat} />
        <main id="content" className="flex w-full flex-col items-center px-6 sm:px-10">
          {children}
        </main>
        <footer className="flex w-full items-center justify-center px-6 pb-12 pt-40 text-zinc-500 sm:px-10">
          <div className="fade flex w-full max-w-[640px] animate-fade flex-col items-center justify-center gap-6">
            {site.links.length > 0 && (
              <ul className="flex flex-wrap justify-center gap-2">
                {site.links.map((link) => {
                  const IconComponent = SOCIAL_ICONS[link.kind];
                  return (
                    <li key={link.url}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={link.label}
                        title={link.label}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition-all duration-200 hover:bg-zinc-200 active:scale-95 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      >
                        <IconComponent size={20} weight="fill" aria-hidden="true" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="dark:text-white">
              © {new Date().getFullYear()} {site.title}
            </p>
          </div>
        </footer>
      </div>
      <NewsletterPopup name={site.title} />
      <ThemeToggle />
      <BackToTop />
      <CommandPalette />
    </>
  );
}

/** Centred 640px content column with the reference's vertical rhythm. */
export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'my-20 flex w-full max-w-[640px] flex-col items-center text-zinc-800 sm:my-32',
        className,
      )}
    >
      {children}
    </section>
  );
}
