// The photos a person takes when a scan leads to a coffee: their own picture of it, shown in their Journal and on
// the coffee page. In IndexedDB, not in the `pico-v2` localStorage blob (a few photos would fill its quota and
// then block cup saves). Fails soft everywhere: no IndexedDB, a full disk or a broken store only means no photos.
// shortcut: photos live only on this phone; move to the image store with accounts (DATA-MODEL.md)
import { useSyncExternalStore } from 'react';

export interface ScanPhoto { id: string; coffeeId: string; takenAt: string }
type Row = ScanPhoto & { blob: Blob };

const DB_NAME = 'pico-photos';
const STORE = 'photos';
/** Long side of a stored photo, in px. */
export const PHOTO_MAX = 1000;

// In memory, newest first, so screens read them synchronously; IndexedDB is written second.
let rows: Row[] = [];
const urls = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;
let ready = false; // the stored photos have been read (or could not be)
const changed = () => { version += 1; listeners.forEach((fn) => fn()); };

let dbPromise: Promise<IDBDatabase | null> | undefined;
function db(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => { request.result.createObjectStore(STORE, { keyPath: 'id' }); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  try {
    const database = await db();
    if (!database) return null;
    return await new Promise<T | null>((resolve) => {
      const tx = database.transaction(STORE, mode);
      const request = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// Loaded once, after the first paint: only blob handles, nothing is decoded until a tile shows it.
const loaded: Promise<void> = new Promise<void>((resolve) => setTimeout(resolve, 0))
  .then(() => run('readonly', (store) => store.getAll() as IDBRequest<Row[]>))
  .then((all) => {
    if (!all?.length) return;
    const known = new Set(rows.map((r) => r.id));
    rows = [...rows, ...all.filter((r) => !known.has(r.id))].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  })
  .finally(() => { ready = true; changed(); });

/** False until the stored photos are read: a screen holds its empty state until then. */
export const photosLoaded = (): boolean => ready;

/** A JPEG of at most PHOTO_MAX px on the long side. */
async function shrink(photo: Blob | string): Promise<Blob> {
  const src = typeof photo === 'string' ? photo : URL.createObjectURL(photo);
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const scale = Math.min(1, PHOTO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) throw new Error('no jpeg');
    return blob;
  } finally {
    if (typeof photo !== 'string') URL.revokeObjectURL(src);
  }
}

/** Saves a photo (a Blob or an image data URL) for a coffee. Its id, or null when it could not be kept. */
export async function addScanPhoto({ coffeeId, blob }: { coffeeId: string; blob: Blob | string }): Promise<string | null> {
  try {
    const row: Row = { id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`, coffeeId, takenAt: new Date().toISOString(), blob: await shrink(blob) };
    rows = [row, ...rows];
    changed();
    const ok = await run('readwrite', (store) => store.put(row));
    if (ok === null) return null; // shown until reload, not kept: the scan itself still worked
    void navigator.storage?.persist?.().catch(() => undefined);
    return row.id;
  } catch {
    return null;
  }
}

const meta = ({ id, coffeeId, takenAt }: Row): ScanPhoto => ({ id, coffeeId, takenAt });

/** Every photo, newest first. */
export async function listScanPhotos(): Promise<ScanPhoto[]> {
  await loaded;
  return rows.map(meta);
}

/** One coffee's photos, newest first. */
export async function photosFor(coffeeId: string): Promise<ScanPhoto[]> {
  await loaded;
  return rows.filter((r) => r.coffeeId === coffeeId).map(meta);
}

export async function deletePhoto(id: string): Promise<void> {
  rows = rows.filter((r) => r.id !== id);
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
  changed();
  await run('readwrite', (store) => store.delete(id));
}

/** An <img> src for a photo; made on first use and kept until the photo is deleted. */
export function photoUrl(id: string): string | undefined {
  let url = urls.get(id);
  const row = url ? undefined : rows.find((r) => r.id === id);
  if (row) { url = URL.createObjectURL(row.blob); urls.set(id, url); }
  return url;
}

/** Synchronous reads for rendering; call usePhotos() in the screen so it re-renders when photos change. */
export const photosOf = (coffeeId: string): ScanPhoto[] => rows.filter((r) => r.coffeeId === coffeeId).map(meta);
export const latestPhotoUrl = (coffeeId: string): string | undefined => {
  const row = rows.find((r) => r.coffeeId === coffeeId);
  return row && photoUrl(row.id);
};
/** Coffees with at least one photo, most recent photo first. */
export const photoCoffeeIds = (): string[] => [...new Set(rows.map((r) => r.coffeeId))];

export function usePhotos(): number {
  return useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => version);
}
