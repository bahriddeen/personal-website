import { BlurReveal } from '@/components/extra/BlurReveal';
import { Marquee } from '@/components/extra/Marquee';
import { CoverflowCarousel } from '@/components/ui/CoverflowCarousel';
import type { Project } from '@/lib/db/queries';
import { projectToSlide } from '@/lib/projects';
import type { SiteSettings } from '@/lib/site';

/** Bio line and the tools strip at the top of the home page. */
export function Intro({ site }: { site: SiteSettings }) {
  return (
    <section className="mt-12 flex w-full max-w-[640px] flex-col items-center text-center sm:mt-24">
      <BlurReveal
        as="h1"
        className="text-balance text-2xl font-semibold leading-snug text-zinc-800 dark:text-zinc-100 sm:text-3xl sm:leading-snug"
      >
        {site.bio}
      </BlurReveal>

      {site.marquee.length > 0 && (
        <Marquee className="fade mt-10 animate-fadeLg" duration={Math.max(18, site.marquee.length * 4)}>
          {site.marquee.map((word) => (
            <span
              key={word}
              className="flex items-center whitespace-nowrap text-sm font-medium text-zinc-500 dark:text-zinc-400"
            >
              <span className="px-5">{word}</span>
              <span aria-hidden="true" className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            </span>
          ))}
        </Marquee>
      )}
    </section>
  );
}

/**
 * Products and startups from Admin → Projects, as a coverflow carousel.
 * No entrance animation on purpose: the centre card is the largest image on the first screen,
 * and fading it in would delay the page's largest contentful paint.
 */
export function Projects({ projects }: { projects: Project[] }) {
  if (projects.length === 0) return null;
  const slides = projects.map(projectToSlide);
  return (
    <section aria-labelledby="projects-heading" className="mt-16 w-full max-w-[1400px] sm:mt-20">
      <h2 id="projects-heading" className="sr-only">
        Projects
      </h2>
      <CoverflowCarousel
        slides={slides}
        label="Projects"
        showCaption
        showPagination={slides.length > 1}
        showNavigation={slides.length > 1}
        autoplay={5000}
        // Sized so five cards fit across a wide screen: centre, two each side.
        cardWidth="clamp(220px, 26cqw, 380px)"
        gap={-0.04}
        fade={0.14}
      />
    </section>
  );
}
