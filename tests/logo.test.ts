/**
 * The logo (FR-V.5): the M-check monogram replaces the blue placeholder in the
 * icon source, the icons' edge fill, the app's colour tokens and the website.
 */
import { describe, expect, it } from 'vitest';
import { ICON_FILL } from '../pwa-assets.config';
import favicon from '../public/favicon.svg?raw';
import tokens from '../src/tokens.css?raw';
import logo from '../src/components/Logo.svelte?raw';

/** Every page of the website, by path. */
const pages = import.meta.glob<string>('../site/**/*.html', { query: '?raw', import: 'default', eager: true });
const PLACEHOLDER = /2f6fdb/i;

describe('logo', () => {
  it('the icon file draws the monogram in both colour pairs', () => {
    for (const colour of ['#712B13', '#F5C4B3', '#993C1D', '#FAECE7']) expect(favicon).toContain(colour);
    expect(favicon).toContain('prefers-color-scheme:dark');
    expect(favicon).not.toMatch(PLACEHOLDER);
  });

  it('icons drawn on a full square are filled with the dark coral', () => {
    expect(ICON_FILL).toBe('#712B13');
  });

  it('the app logo uses colour tokens that follow Light or Dark', () => {
    expect(tokens).toContain('--logo-bg: light-dark(#712b13, #993c1d);');
    expect(tokens).toContain('--logo-fg: light-dark(#f5c4b3, #faece7);');
    expect(logo).toContain('var(--logo-bg)');
    expect(logo).toContain('var(--logo-fg)');
  });

  it('every website page shows the new logo', () => {
    const withLogo = Object.entries(pages).filter(([, html]) => html.includes('class="brand"'));
    expect(withLogo.length).toBeGreaterThan(0);
    for (const [path, html] of withLogo) {
      expect(html, path).toContain('fill="#712b13"');
      expect(html, path).not.toMatch(PLACEHOLDER);
    }
  });
});
