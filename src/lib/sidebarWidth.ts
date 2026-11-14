/**
 * The sidebar's width (design doc, Section 6): resizable by dragging its
 * edge, between the limits below, and remembered on this device only, like
 * the theme, since screens differ between devices. Never synced.
 */
import { readNumber, writeNumber } from './state/flags';

export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 400;
export const SIDEBAR_DEFAULT = 260;

const KEY = 'mytasks.sidebarWidth';

/** A width within the limits, in whole pixels; anything else gives the default. */
export function clampWidth(width: number): number {
  if (!Number.isFinite(width)) return SIDEBAR_DEFAULT;
  return Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width)));
}

/** This device's saved width, or the default. */
export function readSidebarWidth(): number {
  return clampWidth(readNumber(KEY) ?? SIDEBAR_DEFAULT);
}

/** Save this device's width. */
export function saveSidebarWidth(width: number): void {
  writeNumber(KEY, clampWidth(width));
}
