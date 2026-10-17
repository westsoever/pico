import { describe, expect, it, vi } from 'vitest';

const recognize = vi.fn(async () => ({ data: { text: 'COFFEE COLLECTIVE\nKieni' } }));
const createWorker = vi.fn(async () => ({ recognize }));

vi.mock('tesseract.js', () => ({ createWorker }));

describe('readLabelText', () => {
  it('loads the English OCR worker on first use only and reuses it', async () => {
    const { readLabelText } = await import('./label-ocr');
    expect(createWorker).not.toHaveBeenCalled();

    await expect(readLabelText('data:image/png;base64,AAAA')).resolves.toBe('COFFEE COLLECTIVE\nKieni');
    await readLabelText('data:image/png;base64,BBBB');

    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(createWorker).toHaveBeenCalledWith('eng');
    expect(recognize).toHaveBeenLastCalledWith('data:image/png;base64,BBBB');
  });
});
