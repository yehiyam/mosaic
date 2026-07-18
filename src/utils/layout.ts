import type { BorderStyleOption, MaskShape, Orientation, PageSizeName } from '../types';

export const PROJECT_VERSION = 1;

export const IMAGE_SIZE_PRESETS = [
  { label: '25 × 25 mm', width: 25, height: 25 },
  { label: '35 × 35 mm', width: 35, height: 35 },
  { label: '50 × 50 mm', width: 50, height: 50 },
  { label: '50 × 70 mm', width: 50, height: 70 },
  { label: '75 × 100 mm', width: 75, height: 100 },
  { label: '100 × 150 mm', width: 100, height: 150 },
] as const;

export const PAGE_DIMENSIONS_MM: Record<PageSizeName, { width: number; height: number }> = {
  A0: { width: 841, height: 1189 },
  A1: { width: 594, height: 841 },
  A2: { width: 420, height: 594 },
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  A6: { width: 105, height: 148 },
};

export function getOrientedPageSize(pageSize: PageSizeName, orientation: Orientation) {
  const size = PAGE_DIMENSIONS_MM[pageSize];
  return orientation === 'portrait'
    ? size
    : {
        width: size.height,
        height: size.width,
      };
}

export function getPresentationSize(widthMm: number, heightMm: number, mask: MaskShape) {
  if (mask !== 'circle') {
    return { width: widthMm, height: heightMm };
  }

  const edge = Math.min(widthMm, heightMm);
  return { width: edge, height: edge };
}

export function getEffectiveBorderWidth(borderStyle: BorderStyleOption, borderWidthMm: number) {
  return borderStyle === 'none' ? 0 : borderWidthMm;
}

export function getTileOuterSize(
  widthMm: number,
  heightMm: number,
  mask: MaskShape,
  borderStyle: BorderStyleOption,
  borderWidthMm: number,
) {
  const presentation = getPresentationSize(widthMm, heightMm, mask);
  const border = getEffectiveBorderWidth(borderStyle, borderWidthMm);

  return {
    width: presentation.width + border * 2,
    height: presentation.height + border * 2,
    border,
    presentation,
  };
}

export function getPrintableWidth(pageSize: PageSizeName, orientation: Orientation, marginMm: number) {
  const page = getOrientedPageSize(pageSize, orientation);
  return Math.max(0, page.width - marginMm * 2);
}

export function getGridWidth(options: {
  columns: number;
  gapMm: number;
  imageWidthMm: number;
  imageHeightMm: number;
  mask: MaskShape;
  borderStyle: BorderStyleOption;
  borderWidthMm: number;
}) {
  const tile = getTileOuterSize(
    options.imageWidthMm,
    options.imageHeightMm,
    options.mask,
    options.borderStyle,
    options.borderWidthMm,
  );

  return tile.width * options.columns + Math.max(0, options.columns - 1) * options.gapMm;
}

export function getWidthOverflow(options: {
  pageSize: PageSizeName;
  orientation: Orientation;
  marginMm: number;
  columns: number;
  gapMm: number;
  imageWidthMm: number;
  imageHeightMm: number;
  mask: MaskShape;
  borderStyle: BorderStyleOption;
  borderWidthMm: number;
}) {
  const printableWidth = getPrintableWidth(options.pageSize, options.orientation, options.marginMm);
  const gridWidth = getGridWidth(options);
  return Math.max(0, Number((gridWidth - printableWidth).toFixed(2)));
}

export function getMaskRadius(mask: MaskShape) {
  switch (mask) {
    case 'rounded':
      return '18%';
    case 'circle':
    case 'ellipse':
      return '50%';
    default:
      return '0';
  }
}

export function getPresetLabel(widthMm: number, heightMm: number) {
  return `${widthMm} × ${heightMm} mm`;
}
