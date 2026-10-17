import type { Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | undefined;

/**
 * Loads tesseract.js on first use only, so the OCR engine never lands in the
 * initial bundle. The worker, core, and English data come from tesseract.js's
 * default CDN; the photo itself is read in this browser and never uploaded.
 */
function getWorker(): Promise<Worker> {
  workerPromise ??= import('tesseract.js')
    .then(({ createWorker }) => createWorker('eng'))
    .catch((error: unknown) => {
      workerPromise = undefined;
      throw error;
    });
  return workerPromise;
}

/** Returns the text read from a label photo (an image data URL). */
export async function readLabelText(imageDataUrl: string): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(imageDataUrl);
  return data.text;
}
