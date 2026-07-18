export type FitMode = 'contain' | 'cover';
export type MaskShape = 'rectangle' | 'rounded' | 'circle' | 'ellipse';
export type BorderStyleOption = 'none' | 'solid' | 'dashed' | 'dotted';
export type PageSizeName = 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6';
export type Orientation = 'portrait' | 'landscape';

export interface MosaicImage {
  id: string;
  name: string;
  type: string;
  addedAt: number;
  blob: Blob;
}

export interface EditorSettings {
  columns: number;
  gapMm: number;
  imageWidthMm: number;
  imageHeightMm: number;
  fit: FitMode;
  mask: MaskShape;
  borderStyle: BorderStyleOption;
  borderWidthMm: number;
  borderColor: string;
  pageSize: PageSizeName;
  orientation: Orientation;
  marginMm: number;
}

export interface ProjectState {
  version: number;
  settings: EditorSettings;
  images: MosaicImage[];
}

export interface StoredImageRecord {
  id: string;
  name: string;
  type: string;
  addedAt: number;
}

export interface StoredProject {
  version: number;
  settings: EditorSettings;
  images: StoredImageRecord[];
}
