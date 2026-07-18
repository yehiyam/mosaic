import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const loadProject = vi.fn();
const saveProject = vi.fn();
const clearProject = vi.fn();

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

vi.mock('./storage/projectDb', () => ({
  loadProject: (...args: unknown[]) => loadProject(...args),
  saveProject: (...args: unknown[]) => saveProject(...args),
  clearProject: (...args: unknown[]) => clearProject(...args),
}));

describe('App', () => {
  beforeEach(() => {
    vi.useRealTimers();
    loadProject.mockResolvedValue(null);
    saveProject.mockResolvedValue(undefined);
    clearProject.mockResolvedValue(undefined);
    window.confirm = vi.fn(() => true);
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uploads valid images, rejects invalid files, and removes an individual image', async () => {
    const user = userEvent.setup();
    render(<App />);

    const dropZone = screen.getByText(/Drop local images here/i).closest('div');
    const validImage = new File(['image'], 'flower.png', { type: 'image/png' });
    const invalidFile = new File(['text'], 'notes.txt', { type: 'text/plain' });

    if (!dropZone) {
      throw new Error('Drop zone not found');
    }

    fireEvent.drop(dropZone, { dataTransfer: { files: [validImage, invalidFile] } });

    expect(await screen.findByAltText(/Uploaded image flower\.png/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/notes\.txt is not a supported image file/i);

    await user.click(screen.getByRole('button', { name: /Remove flower\.png/i }));
    await waitFor(() => expect(screen.queryByAltText(/Uploaded image flower\.png/i)).not.toBeInTheDocument());

    await waitFor(() => expect(saveProject).toHaveBeenCalled());
  });

  it('removes all images after confirmation', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText(/Add images/i);
    const validImage = new File(['image'], 'scene.png', { type: 'image/png' });

    await user.upload(input, validImage);
    expect(await screen.findByAltText(/Uploaded image scene\.png/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Remove all/i }));

    await waitFor(() => expect(screen.queryByAltText(/Uploaded image scene\.png/i)).not.toBeInTheDocument());
    expect(clearProject).toHaveBeenCalled();
  });
});
