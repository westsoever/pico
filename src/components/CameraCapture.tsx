/* eslint-disable react/only-export-components -- Keep browser processing helpers directly testable in jsdom. */
import { useEffect, useId, useRef, useState } from 'react';

interface CameraCaptureProps {
  photoDataUrl?: string;
  onCapture: (dataUrl: string | undefined) => void;
}

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const MAX_PHOTO_DIMENSION = 1600;

const JPEG_QUALITY = 0.82;
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

type CaptureState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string };

interface PhotoProcessingEnvironment {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  createImage: () => HTMLImageElement;
  createCanvas: () => HTMLCanvasElement;
  createFileReader: () => FileReader;
}

function processingEnvironment(): PhotoProcessingEnvironment {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    createImage: () => new Image(),
    createCanvas: () => document.createElement('canvas'),
    createFileReader: () => new FileReader(),
  };
}

export function validatePhotoFile(file: File): void {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    throw new Error('Please choose a JPEG, PNG, WebP, HEIC, or HEIF image.');
  }
  if (file.size === 0) {
    throw new Error('That photo is empty. Please choose another image.');
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error('That photo is too large. Please choose one smaller than 15 MB.');
  }
}

export function getResizedDimensions(
  width: number,
  height: number,
  maxDimension = MAX_PHOTO_DIMENSION,
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('That photo has invalid dimensions.');
  }

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function loadImage(image: HTMLImageElement, url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That photo could not be decoded.'));

    try {
      image.src = url;
    } catch {
      reject(new Error('That photo could not be decoded.'));
    }
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('The resized photo could not be encoded.'));
        },
        type,
        type === 'image/jpeg' ? JPEG_QUALITY : undefined,
      );
    } catch {
      reject(new Error('The resized photo could not be encoded.'));
    }
  });
}

function blobToDataUrl(blob: Blob, reader: FileReader): Promise<string> {
  return new Promise((resolve, reject) => {
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('The resized photo could not be read.'));
    };
    reader.onerror = () => reject(new Error('The resized photo could not be read.'));
    reader.onabort = () => reject(new Error('Reading the resized photo was cancelled.'));

    try {
      reader.readAsDataURL(blob);
    } catch {
      reject(new Error('The resized photo could not be read.'));
    }
  });
}

function hasTransparentPixels(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  const pixels = context.getImageData(0, 0, width, height).data;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 255) return true;
  }
  return false;
}

export async function resizePhoto(
  file: File,
  environment: PhotoProcessingEnvironment = processingEnvironment(),
): Promise<string> {
  validatePhotoFile(file);

  let objectUrl: string | undefined;
  try {
    objectUrl = environment.createObjectURL(file);
    const image = await loadImage(environment.createImage(), objectUrl);
    const dimensions = getResizedDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = environment.createCanvas();
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the photo.');

    try {
      context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
      const needsTransparency = file.type !== 'image/jpeg'
        && hasTransparentPixels(context, dimensions.width, dimensions.height);
      const outputType = needsTransparency ? 'image/png' : 'image/jpeg';
      const output = await canvasToBlob(canvas, outputType);
      return await blobToDataUrl(output, environment.createFileReader());
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('This browser could not prepare the photo.');
    }
  } finally {
    if (objectUrl !== undefined) {
      try {
        environment.revokeObjectURL(objectUrl);
      } catch {
        // Revocation is best-effort and must not hide a processing error.
      }
    }
  }
}

export function CameraCapture({ photoDataUrl, onCapture }: CameraCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<CaptureState>({ kind: 'idle' });
  const statusId = useId();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  const handleFile = async (file: File) => {
    const requestId = ++requestIdRef.current;
    setStatus({ kind: 'loading' });

    try {
      const dataUrl = await resizePhoto(file);
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      onCapture(dataUrl);
      setStatus({ kind: 'idle' });
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setStatus({
        kind: 'error',
        message: error instanceof Error
          ? error.message
          : 'That photo could not be opened. Please choose another image.',
      });
    }
  };

  return (
    <div className="space-y-3">
      {photoDataUrl ? (
        <figure className="relative overflow-hidden rounded-2xl border border-[#dfd2c7] bg-white">
          <img src={photoDataUrl} alt="Selected coffee bag label" className="h-44 w-full object-cover" />
          <figcaption className="px-3 py-2 text-xs text-[#78675d]">Photo ready to save with your rating</figcaption>
          <button
            type="button"
            onClick={() => {
              requestIdRef.current += 1;
              onCapture(undefined);
              setStatus({ kind: 'idle' });
            }}
            className="absolute right-2 top-2 rounded-full bg-[#1c1410]/80 px-3 py-1.5 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-white"
          >
            Remove photo
          </button>
        </figure>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={status.kind === 'loading'}
          aria-describedby={statusId}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-[#bd9d87] bg-white px-4 py-6 text-[#6b3a2a] transition hover:border-[#6b3a2a] hover:bg-[#fffaf5] focus:outline-none focus:ring-2 focus:ring-[#6b3a2a]/30 disabled:opacity-60"
        >
          <span aria-hidden="true" className="text-xl">▣</span>
          <span className="text-left">
            <span className="block font-semibold">{status.kind === 'loading' ? 'Preparing photo…' : 'Add label photo'}</span>
            <span className="block text-xs font-normal text-[#766257]">Take a photo or choose one</span>
          </span>
        </button>
      )}

      <p
        id={statusId}
        role={status.kind === 'error' ? 'alert' : 'status'}
        aria-live="polite"
        className={`text-xs ${status.kind === 'error' ? 'text-[#9b2c2c]' : 'sr-only'}`}
      >
        {status.kind === 'error' ? status.message : status.kind === 'loading' ? 'Preparing photo.' : ''}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        className="hidden"
        aria-label="Choose a coffee label photo"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
