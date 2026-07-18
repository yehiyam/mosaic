import type { Orientation, PageSizeName } from '../types';

export function buildPageRule(pageSize: PageSizeName, orientation: Orientation, marginMm: number) {
  return `@page { size: ${pageSize} ${orientation}; margin: ${marginMm}mm; }`;
}
