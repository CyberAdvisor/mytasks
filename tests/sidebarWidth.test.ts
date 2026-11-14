/** The resizable sidebar (Section 6, v1.1.2): its limits and this device's saved width. */
import { beforeEach, describe, expect, it } from 'vitest';
import { SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN, clampWidth, readSidebarWidth, saveSidebarWidth } from '../src/lib/sidebarWidth';

beforeEach(() => localStorage.clear());

describe('the sidebar width', () => {
  it('stays between 200 and 400 px, in whole pixels', () => {
    expect([SIDEBAR_MIN, SIDEBAR_DEFAULT, SIDEBAR_MAX]).toEqual([200, 260, 400]);
    expect(clampWidth(120)).toBe(200);
    expect(clampWidth(999)).toBe(400);
    expect(clampWidth(301.6)).toBe(302);
    expect(clampWidth(NaN)).toBe(260);
  });

  it('is 260 px until one is saved, then the saved width on this device', () => {
    expect(readSidebarWidth()).toBe(260);
    saveSidebarWidth(333);
    expect(readSidebarWidth()).toBe(333);
    localStorage.setItem('mytasks.sidebarWidth', 'wide');
    expect(readSidebarWidth()).toBe(260);
    localStorage.setItem('mytasks.sidebarWidth', '9000');
    expect(readSidebarWidth()).toBe(400);
  });
});
