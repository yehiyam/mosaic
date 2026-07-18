import { PROJECT_VERSION } from '../utils/layout';
import type { ProjectState, StoredImageRecord, StoredProject } from '../types';

const DB_NAME = 'mosaic-project-db';
const DB_VERSION = 1;
const PROJECT_STORE = 'projects';
const IMAGE_STORE = 'images';
const CURRENT_PROJECT_KEY = 'current';

interface ImageBlobRecord {
  id: string;
  blob: Blob;
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionToPromise(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        database.createObjectStore(PROJECT_STORE);
      }

      if (!database.objectStoreNames.contains(IMAGE_STORE)) {
        database.createObjectStore(IMAGE_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB.'));
  });
}

function normalizeProject(project: StoredProject | null): StoredProject | null {
  if (!project) {
    return null;
  }

  if (project.version !== PROJECT_VERSION) {
    return {
      ...project,
      version: PROJECT_VERSION,
    };
  }

  return project;
}

export async function loadProject() {
  const database = await openDatabase();

  try {
    const transaction = database.transaction([PROJECT_STORE, IMAGE_STORE], 'readonly');
    const projectStore = transaction.objectStore(PROJECT_STORE);
    const imageStore = transaction.objectStore(IMAGE_STORE);
    const storedProject = normalizeProject(
      (await requestToPromise(projectStore.get(CURRENT_PROJECT_KEY))) as StoredProject | null,
    );

    if (!storedProject) {
      return null;
    }

    const imageRecords = await Promise.all(
      storedProject.images.map(async (image): Promise<ProjectState['images'][number] | null> => {
        const blobRecord = (await requestToPromise(imageStore.get(image.id))) as ImageBlobRecord | undefined;

        if (!blobRecord?.blob) {
          return null;
        }

        return {
          ...image,
          blob: blobRecord.blob,
        };
      }),
    );

    return {
      version: PROJECT_VERSION,
      settings: storedProject.settings,
      images: imageRecords.filter((image): image is ProjectState['images'][number] => image !== null),
    };
  } finally {
    database.close();
  }
}

export async function saveProject(project: ProjectState) {
  const database = await openDatabase();

  try {
    const existingProject = await loadStoredProject(database);
    const transaction = database.transaction([PROJECT_STORE, IMAGE_STORE], 'readwrite');
    const projectStore = transaction.objectStore(PROJECT_STORE);
    const imageStore = transaction.objectStore(IMAGE_STORE);
    const nextRecords: StoredImageRecord[] = project.images.map((image) => ({ id: image.id, name: image.name, type: image.type, addedAt: image.addedAt }));
    const previousIds = new Set(existingProject?.images.map((image) => image.id) ?? []);
    const nextIds = new Set(nextRecords.map((image) => image.id));

    for (const image of project.images) {
      if (!previousIds.has(image.id)) {
        imageStore.put({ id: image.id, blob: image.blob } satisfies ImageBlobRecord);
      }
    }

    for (const imageId of previousIds) {
      if (!nextIds.has(imageId)) {
        imageStore.delete(imageId);
      }
    }

    projectStore.put(
      {
        version: PROJECT_VERSION,
        settings: project.settings,
        images: nextRecords,
      } satisfies StoredProject,
      CURRENT_PROJECT_KEY,
    );

    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
}

async function loadStoredProject(database: IDBDatabase) {
  const transaction = database.transaction(PROJECT_STORE, 'readonly');
  const projectStore = transaction.objectStore(PROJECT_STORE);
  const project = normalizeProject(
    (await requestToPromise(projectStore.get(CURRENT_PROJECT_KEY))) as StoredProject | null,
  );
  await transactionToPromise(transaction);
  return project;
}

export async function clearProject() {
  const database = await openDatabase();

  try {
    const transaction = database.transaction([PROJECT_STORE, IMAGE_STORE], 'readwrite');
    transaction.objectStore(PROJECT_STORE).delete(CURRENT_PROJECT_KEY);
    transaction.objectStore(IMAGE_STORE).clear();
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
}
