# Mosaic

Mosaic is a fully static React + TypeScript PWA for arranging local images into printable ISO A-series mosaic layouts. It runs entirely in the browser, works offline after the first successful load, and stores project data locally in IndexedDB.

## Features

- Upload multiple local images from the file picker or drag-and-drop
- Arrange images in a CSS Grid using millimeter-based size presets
- Choose contain or cover image fitting
- Apply rectangle, rounded rectangle, circle, or ellipse masks
- Configure border style, width, and color
- Print to A0–A6 paper in portrait or landscape with configurable margins
- Persist images and editor settings locally in the current browser/device
- Use a light or dark appearance, with the initial theme following the device preference
- Install as a PWA on supported Android browsers and on iPhone/iPad via Add to Home Screen
- Deploy as a static site on GitHub Pages under `/mosaic/`

## Development

### Requirements

- Node.js 20+
- npm

### Install

```bash
npm ci
```

### Run locally

```bash
npm run dev
```

### Quality checks

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

## GitHub Pages setup

This project is configured for GitHub Pages with the Vite base path set to `/mosaic/`.

1. Push the repository to GitHub.
2. In **Settings → Pages**, select **GitHub Actions** as the source.
3. The `deploy-pages.yml` workflow will build and deploy `main` automatically.

## PWA installation

- **Android / Chromium browsers:** use the in-app **Install app** action when prompted.
- **iPhone / iPad:** use **Share → Add to Home Screen**.
- Once the application shell has been cached, Mosaic can reopen offline and continue editing locally stored projects.

## Local data behavior

- Uploaded images and project settings are stored in IndexedDB.
- Data remains only in the current browser on the current device.
- Clearing browser storage or using a different browser/device will not restore the project.

## Printing

- Choose an A-series paper size (A0–A6), portrait/landscape, and page margins.
- Use the **Print** button to open the system print dialog.
- For accurate output, print at **100% scale** and disable browser headers/footers.

## Known limitations

- Projects are limited to a single locally stored mosaic per browser profile.
- Image reordering is not implemented in this MVP.
- Google Drive import is intentionally deferred and is not part of this release.
