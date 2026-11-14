/* eslint-disable react/only-export-components -- Keep browser processing helpers directly testable in jsdom. */
import { useEffect, useId, useRef, useState } from 'react';
import { CameraIcon } from './ui/Icons';

interface CameraCaptureProps {
  photoDataUrl?: string;
  /**
   * `dataUrl` is the small copy kept with the rating; `readableDataUrl` is a
   * sharper copy for reading the label, never stored.
   */
  onCapture: (dataUrl: string | undefined, readableDataUrl?: string) => void;
  /** Main call to action on the button, e.g. "Scan a coffee bag". */
  title?: string;
  hint?: string;
}

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const MAX_PHOTO_DIMENSION = 1600;
/** Stored photos live in localStorage (~5 MB in total), so keep them small. */
export const STORED_PHOTO_DIMENSION = 800;

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
  maxDimension = MAX_PHOTO_DIMENSION,
): Promise<string> {
  validatePhotoFile(file);

  let objectUrl: string | undefined;
  try {
    objectUrl = environment.createObjectURL(file);
    const image = await loadImage(environment.createImage(), objectUrl);
    const dimensions = getResizedDimensions(image.naturalWidth, image.naturalHeight, maxDimension);
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

export function CameraCapture({
  photoDataUrl,
  onCapture,
  title = 'Add label photo',
  hint = 'Take a photo or choose one',
}: CameraCaptureProps) {
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
      const readable = await resizePhoto(file);
      const stored = await resizePhoto(file, undefined, STORED_PHOTO_DIMENSION);
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      onCapture(stored, readable);
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
    <div className="space-y-2">
      {photoDataUrl ? (
        <figure className="card relative flex items-center gap-3 overflow-hidden p-2 pr-3">
          <img src={photoDataUrl} alt="Selected coffee bag label" className="h-16 w-16 rounded-xl object-cover" />
          <figcaption className="min-w-0 flex-1 text-sm text-pico-muted">Your label photo. It is saved with your rating.</figcaption>
          <button
            type="button"
            onClick={() => {
              requestIdRef.current += 1;
              onCapture(undefined);
              setStatus({ kind: 'idle' });
            }}
            className="btn btn-secondary !min-h-9 !px-3 text-xs"
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
          className="flex w-full items-center gap-4 rounded-[var(--radius-lg)] bg-pico-brand px-5 py-5 text-left text-white shadow-md transition hover:bg-pico-brand-strong disabled:opacity-60"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
            <CameraIcon className="h-7 w-7" />
          </span>
          <span>
            <span className="block text-lg font-semibold">
              {status.kind === 'loading' ? 'Preparing photo…' : title}
            </span>
            <span className="block text-sm text-white/80">{hint}</span>
          </span>
        </button>
      )}

      <p
        id={statusId}
        role={status.kind === 'error' ? 'alert' : 'status'}
        aria-live="polite"
        className={`text-sm ${status.kind === 'error' ? 'text-pico-danger' : 'sr-only'}`}
      >
        {status.kind === 'error' ? status.message : status.kind === 'loading' ? 'Preparing photo.' : ''}
      </p>
      {/* No `capture` attribute: with it, iOS opens only the camera and the photo roll is unreachable. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
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
