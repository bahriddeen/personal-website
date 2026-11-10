import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // Post bodies and user-uploaded covers are plain <img> on purpose in a few places
      // (Markdown output, admin previews); next/image is used for layout images.
      '@next/next/no-img-element': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'next-env.d.ts', 'analysis/**', 'drizzle/**']),
]);
