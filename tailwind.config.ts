import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

// Design tokens measured from the reference (see ANALYSIS.md §2 and §5).
// Colours are the stock Tailwind zinc scale; the custom parts are the font,
// the "bounce" easing and the entrance keyframes.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--figtree)',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ],
      },
      colors: {
        // Prose link colours (light / dark) and the code block surface.
        link: { DEFAULT: '#61829a', hover: '#618e9a', visited: '#6247aa', 'visited-hover': '#4a3786' },
        'link-dark': {
          DEFAULT: '#87c7e0',
          hover: '#9fdcf5',
          visited: '#a78fec',
          'visited-hover': '#b9a8f0',
        },
        code: { bg: '#282a36', bar: '#1e1f29', line: '#44475a' },
      },
      transitionTimingFunction: {
        bounce: 'cubic-bezier(.2, -.25, 0, 1.6)',
        spring: 'cubic-bezier(.34, 1.56, .64, 1)',
      },
      keyframes: {
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        reveal: {
          from: { opacity: '0', transform: 'translateY(40px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleFade: {
          from: { opacity: '0', transform: 'scale(.75)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        modalReveal: {
          from: { opacity: '0', transform: 'scale(.7) translateY(100px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        blurReveal: {
          from: { opacity: '0', filter: 'blur(8px)', transform: 'translateY(6px)' },
          to: { opacity: '1', filter: 'blur(0)', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeSm: 'fade .4s forwards',
        fade: 'fade .8s forwards',
        fadeMd: 'fade 1.2s forwards',
        fadeLg: 'fade 1.6s forwards',
        revealSm: 'reveal .8s cubic-bezier(.5,-.2,.1,1.2) forwards',
        scaleFadeBlog: 'scaleFade .8s cubic-bezier(.2,0,0,1.2) forwards',
        modalReveal: 'modalReveal .6s cubic-bezier(0,1,0,1.1) forwards',
        marquee: 'marquee var(--marquee-duration, 30s) linear infinite',
        blurReveal: 'blurReveal .7s cubic-bezier(.2,.6,.2,1) forwards',
      },
    },
  },
  plugins: [typography],
};

export default config;
