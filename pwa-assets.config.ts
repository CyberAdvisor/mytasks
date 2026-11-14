// App icons (FR-0.1), made at build time by vite-plugin-pwa from the logo.
// The logo is the M-check monogram (design doc Section 6, FR-V.5); replacing
// public/favicon.svg replaces every icon.
import { defineConfig } from '@vite-pwa/assets-generator/config';

/** Icons drawn on a full square fill it with the logo's dark coral, not white. */
export const ICON_FILL = '#712B13';
const fill = { resizeOptions: { background: ICON_FILL } };

export default defineConfig({
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']] },
    maskable: { sizes: [192, 512, 1024], ...fill },
    apple: { sizes: [180], ...fill },
  },
  images: ['public/favicon.svg'],
});
