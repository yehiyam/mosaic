import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { clearProject, loadProject, saveProject } from './projectDb';
import type { ProjectState } from '../types';

const sampleProject: ProjectState = {
  version: 1,
  settings: {
    columns: 2,
    gapMm: 3,
    imageWidthMm: 50,
    imageHeightMm: 50,
    fit: 'contain',
    mask: 'rectangle',
    borderStyle: 'solid',
    borderWidthMm: 1,
    borderColor: '#000000',
    pageSize: 'A4',
    orientation: 'portrait',
    marginMm: 10,
  },
  images: [
    {
      id: 'first',
      name: 'first.png',
      type: 'image/png',
      addedAt: 1,
      blob: new Blob(['first'], { type: 'image/png' }),
    },
    {
      id: 'second',
      name: 'second.png',
      type: 'image/png',
      addedAt: 2,
      blob: new Blob(['second'], { type: 'image/png' }),
    },
  ],
};

afterEach(async () => {
  await clearProject();
});

describe('projectDb', () => {
  it('saves and restores images plus settings from IndexedDB', async () => {
    await saveProject(sampleProject);

    const restored = await loadProject();

    expect(restored?.settings).toEqual(sampleProject.settings);
    expect(restored?.images).toHaveLength(2);
    expect(restored?.images[0].blob).toBeDefined();
    expect(restored?.images[0].type).toBe('image/png');
  });

  it('removes deleted images from IndexedDB on save', async () => {
    await saveProject(sampleProject);
    await saveProject({
      ...sampleProject,
      images: [sampleProject.images[1]],
    });

    const restored = await loadProject();

    expect(restored?.images).toHaveLength(1);
    expect(restored?.images[0].id).toBe('second');
  });
});
