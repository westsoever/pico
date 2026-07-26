import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CameraCapture,
  getResizedDimensions,
  MAX_PHOTO_BYTES,
  resizePhoto,
  validatePhotoFile,
} from './CameraCapture';

afterEach(cleanup);

function loadedImage(width: number, height: number): HTMLImageElement {
  const image = {
    naturalWidth: width,
    naturalHeight: height,
    onload: null as null | (() => void),
    onerror: null as null | (() => void),
    set src(_url: string) {
      queueMicrotask(() => image.onload?.());
    },
  };
  return image as unknown as HTMLImageElement;
}

function dataUrlReader(): FileReader {
  const reader = {
    result: null as string | ArrayBuffer | null,
    onload: null as null | (() => void),
    onerror: null,
    onabort: null,
    readAsDataURL(blob: Blob) {
      reader.result = `data:${blob.type};base64,dGVzdA==`;
      queueMicrotask(() => reader.onload?.());
    },
  };
  return reader as unknown as FileReader;
}

describe('photo processing helpers', () => {
  it('caps the longest dimension without enlarging small images', () => {
    expect(getResizedDimensions(3200, 2400)).toEqual({ width: 1600, height: 1200 });
    expect(getResizedDimensions(600, 900)).toEqual({ width: 600, height: 900 });
  });

  it('rejects unsupported, empty, and oversized input files', () => {
    expect(() => validatePhotoFile(new File(['text'], 'note.txt', { type: 'text/plain' })))
      .toThrow(/JPEG, PNG, WebP, HEIC, or HEIF/);
    expect(() => validatePhotoFile(new File([], 'empty.jpg', { type: 'image/jpeg' })))
      .toThrow(/empty/);

    const oversized = new File(['x'], 'large.jpg', { type: 'image/jpeg' });
    Object.defineProperty(oversized, 'size', { value: MAX_PHOTO_BYTES + 1 });
    expect(() => validatePhotoFile(oversized)).toThrow(/smaller than 15 MB/);
  });

  it('resizes and encodes opaque photos as quality-controlled JPEGs', async () => {
    const revokeObjectURL = vi.fn();
    const drawImage = vi.fn();
    const toBlob = vi.fn((
      callback: BlobCallback,
      type?: string,
      _quality?: number,
    ) => callback(new Blob(['resized'], { type })));
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage,
        getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }),
      }),
      toBlob,
    } as unknown as HTMLCanvasElement;

    const result = await resizePhoto(
      new File(['photo'], 'photo.png', { type: 'image/png' }),
      {
        createObjectURL: () => 'blob:test',
        revokeObjectURL,
        createImage: () => loadedImage(3200, 2400),
        createCanvas: () => canvas,
        createFileReader: dataUrlReader,
      },
    );

    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
    expect(drawImage).toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.82);
    expect(result).toMatch(/^data:image\/jpeg/);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  it('preserves transparency as PNG and revokes URLs after decode failures', async () => {
    const transparentCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: vi.fn(),
        getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 0]) }),
      }),
      toBlob: (callback: BlobCallback, type?: string) => {
        callback(new Blob(['resized'], { type }));
      },
    } as unknown as HTMLCanvasElement;
    const environment = {
      createObjectURL: () => 'blob:transparent',
      revokeObjectURL: vi.fn(),
      createImage: () => loadedImage(10, 10),
      createCanvas: () => transparentCanvas,
      createFileReader: dataUrlReader,
    };

    await expect(resizePhoto(
      new File(['photo'], 'photo.webp', { type: 'image/webp' }),
      environment,
    )).resolves.toMatch(/^data:image\/png/);

    const brokenImage = {
      onload: null,
      onerror: null as null | ((event: Event) => void),
      set src(_url: string) {
        queueMicrotask(() => brokenImage.onerror?.(new Event('error')));
      },
    } as unknown as HTMLImageElement;
    const revokeBrokenUrl = vi.fn();

    await expect(resizePhoto(
      new File(['photo'], 'broken.jpg', { type: 'image/jpeg' }),
      {
        ...environment,
        createObjectURL: () => 'blob:broken',
        revokeObjectURL: revokeBrokenUrl,
        createImage: () => brokenImage,
      },
    )).rejects.toThrow(/decoded/);
    expect(revokeBrokenUrl).toHaveBeenCalledWith('blob:broken');
  });

  it('reports canvas and FileReader failures without leaking object URLs', async () => {
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
    const baseEnvironment = {
      createObjectURL: () => 'blob:test',
      revokeObjectURL: vi.fn(),
      createImage: () => loadedImage(100, 100),
      createCanvas: () => ({
        width: 0,
        height: 0,
        getContext: () => null,
      } as unknown as HTMLCanvasElement),
      createFileReader: dataUrlReader,
    };

    await expect(resizePhoto(file, baseEnvironment)).rejects.toThrow(/could not prepare/);
    expect(baseEnvironment.revokeObjectURL).toHaveBeenCalledWith('blob:test');

    const readerFailureEnvironment = {
      ...baseEnvironment,
      revokeObjectURL: vi.fn(),
      createCanvas: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toBlob: (callback: BlobCallback) => callback(new Blob(['resized'], { type: 'image/jpeg' })),
      } as unknown as HTMLCanvasElement),
      createFileReader: () => ({
        readAsDataURL: () => {
          throw new Error('reader unavailable');
        },
      } as unknown as FileReader),
    };

    await expect(resizePhoto(file, readerFailureEnvironment)).rejects.toThrow(/could not be read/);
    expect(readerFailureEnvironment.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});

describe('CameraCapture', () => {
  it('shows an accessible error for invalid input and keeps mobile capture enabled', async () => {
    render(<CameraCapture onCapture={vi.fn()} />);
    const input = screen.getByLabelText('Choose a coffee label photo');

    expect(input).toHaveAttribute('capture', 'environment');
    fireEvent.change(input, {
      target: { files: [new File(['text'], 'note.txt', { type: 'text/plain' })] },
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Please choose a JPEG/);
    });
  });
});
