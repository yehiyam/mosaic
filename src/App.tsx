import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { clearProject, loadProject, saveProject } from './storage/projectDb';
import {
  getGridWidth,
  getMaxColumns,
  getMaskRadius,
  getOrientedPageSize,
  getPresetLabel,
  getTileOuterSize,
  getWidthOverflow,
  IMAGE_SIZE_PRESETS,
  PROJECT_VERSION,
} from './utils/layout';
import { buildPageRule } from './utils/print';
import type { EditorSettings, MosaicImage, ProjectState } from './types';

const DEFAULT_SETTINGS: EditorSettings = {
  columns: 3,
  gapMm: 4,
  imageWidthMm: 50,
  imageHeightMm: 50,
  fit: 'contain',
  mask: 'rectangle',
  borderStyle: 'none',
  borderWidthMm: 1,
  borderColor: '#1f2937',
  pageSize: 'A4',
  orientation: 'portrait',
  marginMm: 10,
};

const DEFAULT_PROJECT: ProjectState = {
  version: PROJECT_VERSION,
  settings: DEFAULT_SETTINGS,
  images: [],
};

const IOS_GUIDE_KEY = 'mosaic-ios-install-dismissed';
const SAVE_DELAY_MS = 400;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function readDismissedFlag(key: string) {
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function writeDismissedFlag(key: string, dismissed: boolean) {
  try {
    window.localStorage.setItem(key, String(dismissed));
  } catch {
    // ignore localStorage failures and rely on the current session only
  }
}

function isStandaloneMode() {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || Boolean(navigatorWithStandalone.standalone);
}

function isAppleMobile() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

function createImageId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function useObjectUrl(blob: Blob) {
  const objectUrl = useMemo(() => URL.createObjectURL(blob), [blob]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  return objectUrl;
}

function MosaicCard({
  image,
  fit,
  frameWidthMm,
  frameHeightMm,
  borderStyle,
  borderWidthMm,
  borderColor,
  mask,
  outerWidthMm,
  outerHeightMm,
  onRemove,
}: {
  image: MosaicImage;
  fit: ProjectState['settings']['fit'];
  frameWidthMm: number;
  frameHeightMm: number;
  borderStyle: ProjectState['settings']['borderStyle'];
  borderWidthMm: number;
  borderColor: string;
  mask: ProjectState['settings']['mask'];
  outerWidthMm: number;
  outerHeightMm: number;
  onRemove: (id: string) => void;
}) {
  const objectUrl = useObjectUrl(image.blob);

  return (
    <article className="mosaic-item" style={{ width: `${outerWidthMm}mm`, minHeight: `${outerHeightMm}mm` }}>
      <div
        className="mosaic-frame"
        style={{
          width: `${frameWidthMm}mm`,
          height: `${frameHeightMm}mm`,
          borderStyle,
          borderWidth: `${borderWidthMm}mm`,
          borderColor,
          borderRadius: getMaskRadius(mask),
        }}
      >
        <img src={objectUrl} alt={`Uploaded image ${image.name}`} style={{ objectFit: fit }} />
      </div>
      <div className="mosaic-item__footer screen-only">
        <span className="mosaic-item__name" title={image.name}>
          {image.name}
        </span>
        <button
          type="button"
          className="secondary-button"
          aria-label={`Remove ${image.name}`}
          onClick={() => onRemove(image.id)}
        >
          Remove
        </button>
      </div>
    </article>
  );
}

export default function App() {
  const fileInputId = useId();
  const [project, setProject] = useState<ProjectState>(DEFAULT_PROJECT);
  const [statusMessage, setStatusMessage] = useState('Ready to add images.');
  const [isLoading, setIsLoading] = useState(true);
  const [dropActive, setDropActive] = useState(false);
  const [beforeInstallPrompt, setBeforeInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [iosGuideDismissed, setIosGuideDismissed] = useState(() => readDismissedFlag(IOS_GUIDE_KEY));
  const hasLoadedProject = useRef(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    let isCancelled = false;
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const syncStandalone = () => setIsStandalone(isStandaloneMode());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setBeforeInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setBeforeInstallPrompt(null);
      syncStandalone();
      setStatusMessage('Mosaic is installed. The app shell can now open offline after the first successful load.');
    };

    syncStandalone();
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery.addEventListener?.('change', syncStandalone);

    void loadProject()
      .then((storedProject) => {
        if (isCancelled) {
          return;
        }

        if (storedProject) {
          setProject(storedProject);
          setStatusMessage('Project restored from this browser on this device.');
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setStatusMessage('Local storage is unavailable right now. Editing still works, but changes may not persist.');
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
          hasLoadedProject.current = true;
        }
      });

    return () => {
      isCancelled = true;
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener?.('change', syncStandalone);
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedProject.current || isLoading) {
      return;
    }

    const timer = window.setTimeout(() => {
      void saveProject(project).catch(() => {
        setStatusMessage('Unable to save changes to local storage. Check browser storage permissions and space.');
      });
    }, SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [project, isLoading]);

  useEffect(() => {
    const styleId = 'mosaic-page-rule';
    let styleTag = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }

    styleTag.textContent = buildPageRule(
      project.settings.pageSize,
      project.settings.orientation,
      project.settings.marginMm,
    );

    return () => {
      styleTag?.remove();
    };
  }, [project.settings.marginMm, project.settings.orientation, project.settings.pageSize]);

  const tileSize = useMemo(
    () =>
      getTileOuterSize(
        project.settings.imageWidthMm,
        project.settings.imageHeightMm,
        project.settings.mask,
        project.settings.borderStyle,
        project.settings.borderWidthMm,
      ),
    [
      project.settings.borderStyle,
      project.settings.borderWidthMm,
      project.settings.imageHeightMm,
      project.settings.imageWidthMm,
      project.settings.mask,
    ],
  );

  const pageSize = useMemo(
    () => getOrientedPageSize(project.settings.pageSize, project.settings.orientation),
    [project.settings.orientation, project.settings.pageSize],
  );

  const widthOverflowMm = useMemo(
    () => getWidthOverflow({ ...project.settings }),
    [project.settings],
  );

  const gridWidthMm = useMemo(
    () => getGridWidth({ ...project.settings }),
    [project.settings],
  );

  const previewScale = useMemo(
    () => Math.min(1, 185 / pageSize.width, 250 / pageSize.height),
    [pageSize.height, pageSize.width],
  );

  const presetValue = getPresetLabel(project.settings.imageWidthMm, project.settings.imageHeightMm);
  const showIosGuide = !beforeInstallPrompt && !isStandalone && !iosGuideDismissed && isAppleMobile();

  const updateSettings = <Key extends keyof EditorSettings>(key: Key, value: EditorSettings[Key]) => {
    setProject((currentProject) => {
      const updated: EditorSettings = {
        ...currentProject.settings,
        [key]: value,
      };
      const maxCols = getMaxColumns(updated);
      return {
        ...currentProject,
        settings: {
          ...updated,
          columns: Math.min(updated.columns, maxCols),
        },
      };
    });
  };

  const handleFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);

    if (!files.length) {
      return;
    }

    const addedImages: MosaicImage[] = [];
    const errors: string[] = [];

    files.forEach((file, index) => {
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name} is not a supported image file.`);
        return;
      }

      addedImages.push({
        id: createImageId(),
        name: file.name,
        type: file.type,
        addedAt: Date.now() + index,
        blob: file,
      });
    });

    if (addedImages.length > 0) {
      setProject((currentProject) => ({
        ...currentProject,
        images: [...currentProject.images, ...addedImages],
      }));
    }

    const statusParts: string[] = [];
    if (addedImages.length > 0) {
      statusParts.push(`Added ${addedImages.length} image${addedImages.length === 1 ? '' : 's'}.`);
    }
    if (errors.length > 0) {
      statusParts.push(errors.join(' '));
    }

    setStatusMessage(statusParts.join(' '));
  };

  const handleInstallApp = async () => {
    if (!beforeInstallPrompt) {
      return;
    }

    await beforeInstallPrompt.prompt();
    const choice = await beforeInstallPrompt.userChoice;
    setBeforeInstallPrompt(null);
    setStatusMessage(
      choice.outcome === 'accepted'
        ? 'Install started. Open Mosaic from your home screen once it finishes.'
        : 'Installation prompt dismissed. You can install later from the browser menu.',
    );
  };

  const handleRemoveImage = (imageId: string) => {
    setProject((currentProject) => ({
      ...currentProject,
      images: currentProject.images.filter((image) => image.id !== imageId),
    }));
    setStatusMessage('Removed image.');
  };

  const handleRemoveAllImages = async () => {
    if (!project.images.length) {
      return;
    }

    const confirmed = window.confirm('Remove all uploaded images from this device and browser?');
    if (!confirmed) {
      return;
    }

    setProject((currentProject) => ({
      ...currentProject,
      images: [],
    }));

    try {
      await clearProject();
      await saveProject({
        ...project,
        images: [],
      });
    } catch {
      // fall back to the regular debounced save path
    }

    setStatusMessage('Removed all images from the current project.');
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Printable photo mosaic</p>
          <h1>Mosaic</h1>
          <p className="intro">
            Upload local images, arrange them in millimeter-based A-series layouts, save everything in this
            browser, and print when you are ready.
          </p>
        </div>
        <div className="header-actions screen-only">
          <label className="primary-button" htmlFor={fileInputId}>
            Add images
          </label>
          <input
            id={fileInputId}
            className="visually-hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              if (event.currentTarget.files) {
                handleFiles(event.currentTarget.files);
              }
              event.currentTarget.value = '';
            }}
          />
          <button type="button" className="secondary-button" onClick={handleRemoveAllImages}>
            Remove all
          </button>
          <button type="button" className="secondary-button" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </header>

      <div className="status-strip" role="status" aria-live="polite">
        {isLoading ? 'Loading local project…' : statusMessage}
      </div>

      {(offlineReady || needRefresh) && (
        <section className="update-banner screen-only" aria-label="Application update status">
          {offlineReady && <p>Mosaic is ready to open offline after this page finishes caching.</p>}
          {needRefresh && <p>An updated version of Mosaic is available.</p>}
          <div className="inline-actions">
            {needRefresh && (
              <button type="button" className="primary-button" onClick={() => void updateServiceWorker(true)}>
                Reload update
              </button>
            )}
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setOfflineReady(false);
                setNeedRefresh(false);
              }}
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      {(beforeInstallPrompt || showIosGuide || isStandalone) && (
        <section className="install-card screen-only" aria-label="Install Mosaic">
          <div>
            <h2>Install app</h2>
            {isStandalone ? (
              <p>Mosaic is running in standalone mode.</p>
            ) : beforeInstallPrompt ? (
              <p>Install Mosaic for quick offline access from your home screen.</p>
            ) : (
              <p>On iPhone or iPad, use Share → Add to Home Screen to install Mosaic.</p>
            )}
          </div>
          {!isStandalone && (
            <div className="inline-actions">
              {beforeInstallPrompt ? (
                <button type="button" className="primary-button" onClick={() => void handleInstallApp()}>
                  Install app
                </button>
              ) : null}
              {showIosGuide ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setIosGuideDismissed(true);
                    writeDismissedFlag(IOS_GUIDE_KEY, true);
                  }}
                >
                  Hide tip
                </button>
              ) : null}
            </div>
          )}
        </section>
      )}

      <main className="app-layout">
        <aside className="control-panel screen-only" aria-label="Mosaic settings">
          <section className="panel-section upload-drop-zone-section">
            <h2>Upload</h2>
            <div
              className={`upload-drop-zone${dropActive ? ' upload-drop-zone--active' : ''}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setDropActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDropActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDropActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDropActive(false);
                if (event.dataTransfer.files) {
                  handleFiles(event.dataTransfer.files);
                }
              }}
            >
              <p>Drop local images here or use the Add images button.</p>
              <p className="supporting-text">Files stay in this browser on this device only.</p>
            </div>
          </section>

          <section className="panel-section">
            <h2>Layout</h2>
            <div className="field-grid">
              <label>
                <span>Columns</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={project.settings.columns}
                  onChange={(event) => updateSettings('columns', clampNumber(Number(event.target.value), 1, 12))}
                />
              </label>
              <label>
                <span>Gap (mm)</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.5}
                  value={project.settings.gapMm}
                  onChange={(event) => updateSettings('gapMm', clampNumber(Number(event.target.value), 0, 20))}
                />
              </label>
              <label>
                <span>Image size</span>
                <select
                  value={presetValue}
                  onChange={(event) => {
                    const preset = IMAGE_SIZE_PRESETS.find((item) => item.label === event.target.value);
                    if (!preset) {
                      return;
                    }
                    setProject((currentProject) => {
                      const updated: EditorSettings = {
                        ...currentProject.settings,
                        imageWidthMm: preset.width,
                        imageHeightMm: preset.height,
                      };
                      const maxCols = getMaxColumns(updated);
                      return {
                        ...currentProject,
                        settings: {
                          ...updated,
                          columns: Math.min(updated.columns, maxCols),
                        },
                      };
                    });
                  }}
                >
                  {IMAGE_SIZE_PRESETS.map((preset) => (
                    <option key={preset.label} value={preset.label}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Fit mode</span>
                <select value={project.settings.fit} onChange={(event) => updateSettings('fit', event.target.value as EditorSettings['fit'])}>
                  <option value="contain">Contain</option>
                  <option value="cover">Cover</option>
                </select>
              </label>
            </div>
          </section>

          <section className="panel-section">
            <h2>Masks &amp; borders</h2>
            <div className="field-grid">
              <label>
                <span>Mask</span>
                <select value={project.settings.mask} onChange={(event) => updateSettings('mask', event.target.value as EditorSettings['mask'])}>
                  <option value="rectangle">Rectangle</option>
                  <option value="rounded">Rounded rectangle</option>
                  <option value="circle">Circle</option>
                  <option value="ellipse">Ellipse</option>
                </select>
              </label>
              <label>
                <span>Border style</span>
                <select
                  value={project.settings.borderStyle}
                  onChange={(event) => updateSettings('borderStyle', event.target.value as EditorSettings['borderStyle'])}
                >
                  <option value="none">None</option>
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </label>
              <label>
                <span>Border width (mm)</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.5}
                  value={project.settings.borderWidthMm}
                  onChange={(event) => updateSettings('borderWidthMm', clampNumber(Number(event.target.value), 0, 5))}
                />
              </label>
              <label>
                <span>Border color</span>
                <input
                  type="color"
                  value={project.settings.borderColor}
                  onChange={(event) => updateSettings('borderColor', event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="panel-section">
            <h2>Page</h2>
            <div className="field-grid">
              <label>
                <span>Paper size</span>
                <select value={project.settings.pageSize} onChange={(event) => updateSettings('pageSize', event.target.value as EditorSettings['pageSize'])}>
                  {['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6'].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Orientation</span>
                <select
                  value={project.settings.orientation}
                  onChange={(event) => updateSettings('orientation', event.target.value as EditorSettings['orientation'])}
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>
              <label>
                <span>Margins (mm)</span>
                <input
                  type="number"
                  min={0}
                  max={40}
                  step={1}
                  value={project.settings.marginMm}
                  onChange={(event) => updateSettings('marginMm', clampNumber(Number(event.target.value), 0, 40))}
                />
              </label>
            </div>
            {widthOverflowMm > 0 ? (
              <p className="warning-text" role="alert">
                Current columns, gaps, borders, and margins overflow the printable width by {widthOverflowMm} mm.
              </p>
            ) : (
              <p className="supporting-text">
                Grid width {gridWidthMm.toFixed(1)} mm fits within the printable page width.
              </p>
            )}
          </section>

          <section className="panel-section">
            <h2>Printing guidance</h2>
            <ul className="supporting-list">
              <li>Print at 100% scale.</li>
              <li>Disable browser headers and footers.</li>
              <li>Keep the selected paper size and orientation in the print dialog.</li>
            </ul>
          </section>
        </aside>

        <section className="preview-panel" aria-label="Page preview">
          <div className="preview-header screen-only">
            <div>
              <h2>Page preview</h2>
              <p>
                {project.images.length} image{project.images.length === 1 ? '' : 's'} • {project.settings.pageSize}{' '}
                {project.settings.orientation}
              </p>
            </div>
          </div>
          <div className="preview-shell">
            <div className="preview-sizer" style={{ width: `${pageSize.width * previewScale}mm`, minHeight: `${pageSize.height * previewScale}mm` }}>
              <div
                className="page-preview"
                style={{
                  width: `${pageSize.width}mm`,
                  minHeight: `${pageSize.height}mm`,
                  padding: `${project.settings.marginMm}mm`,
                  transform: `scale(${previewScale})`,
                }}
              >
                {project.images.length > 0 ? (
                  <div
                    className="mosaic-grid"
                    style={{
                      gridTemplateColumns: `repeat(${project.settings.columns}, ${tileSize.width}mm)`,
                      gap: `${project.settings.gapMm}mm`,
                    }}
                  >
                    {project.images.map((image) => (
                      <MosaicCard
                        key={image.id}
                        image={image}
                        fit={project.settings.fit}
                        frameWidthMm={tileSize.presentation.width}
                        frameHeightMm={tileSize.presentation.height}
                        borderStyle={project.settings.borderStyle}
                        borderWidthMm={tileSize.border}
                        borderColor={project.settings.borderColor}
                        mask={project.settings.mask}
                        outerWidthMm={tileSize.width}
                        outerHeightMm={tileSize.height}
                        onRemove={handleRemoveImage}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No images yet.</p>
                    <p className="supporting-text">Upload local images to start building your printable mosaic.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
