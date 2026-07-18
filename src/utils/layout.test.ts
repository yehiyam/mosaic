import { describe, expect, it } from 'vitest';
import {
  getGridWidth,
  getMaxColumns,
  getMaskRadius,
  getOrientedPageSize,
  getPresentationSize,
  getPrintableWidth,
  getWidthOverflow,
} from './layout';

describe('layout helpers', () => {
  it('uses A-series dimensions and swaps them for landscape orientation', () => {
    expect(getOrientedPageSize('A4', 'portrait')).toEqual({ width: 210, height: 297 });
    expect(getOrientedPageSize('A4', 'landscape')).toEqual({ width: 297, height: 210 });
  });

  it('forces circle masks into a square presentation area', () => {
    expect(getPresentationSize(50, 70, 'circle')).toEqual({ width: 50, height: 50 });
    expect(getPresentationSize(50, 70, 'ellipse')).toEqual({ width: 50, height: 70 });
  });

  it('calculates printable width and overflow including gaps and borders', () => {
    expect(getPrintableWidth('A4', 'portrait', 10)).toBe(190);
    expect(
      getGridWidth({
        columns: 3,
        gapMm: 4,
        imageWidthMm: 50,
        imageHeightMm: 70,
        mask: 'rectangle',
        borderStyle: 'solid',
        borderWidthMm: 1,
      }),
    ).toBe(164);
    expect(
      getWidthOverflow({
        pageSize: 'A6',
        orientation: 'portrait',
        marginMm: 10,
        columns: 3,
        gapMm: 4,
        imageWidthMm: 35,
        imageHeightMm: 35,
        mask: 'rectangle',
        borderStyle: 'solid',
        borderWidthMm: 2,
      }),
    ).toBe(40);
  });

  it('returns mask radii that follow the selected shape', () => {
    expect(getMaskRadius('rectangle')).toBe('0');
    expect(getMaskRadius('rounded')).toBe('18%');
    expect(getMaskRadius('circle')).toBe('50%');
    expect(getMaskRadius('ellipse')).toBe('50%');
  });

  it('computes the maximum number of columns that fit within the printable width', () => {
    // A4 portrait, 10mm margin → 190mm printable; 50mm tile, 4mm gap → floor(194/54) = 3
    expect(
      getMaxColumns({
        pageSize: 'A4',
        orientation: 'portrait',
        marginMm: 10,
        gapMm: 4,
        imageWidthMm: 50,
        imageHeightMm: 50,
        mask: 'rectangle',
        borderStyle: 'none',
        borderWidthMm: 0,
      }),
    ).toBe(3);

    // A6 portrait, 10mm margin → 85mm printable; 35mm tile + 2mm border*2 = 39mm, 4mm gap → floor(89/43) = 2
    expect(
      getMaxColumns({
        pageSize: 'A6',
        orientation: 'portrait',
        marginMm: 10,
        gapMm: 4,
        imageWidthMm: 35,
        imageHeightMm: 35,
        mask: 'rectangle',
        borderStyle: 'solid',
        borderWidthMm: 2,
      }),
    ).toBe(2);

    // always returns at least 1 even when a single tile overflows
    expect(
      getMaxColumns({
        pageSize: 'A6',
        orientation: 'portrait',
        marginMm: 10,
        gapMm: 0,
        imageWidthMm: 100,
        imageHeightMm: 100,
        mask: 'rectangle',
        borderStyle: 'none',
        borderWidthMm: 0,
      }),
    ).toBe(1);
  });
});
