import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const coffee = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, roaster: 'Fixture Roasters', origin: 'Kenya', process: 'washed', roastLevel: 'light',
  flavorTags: ['berry'], description: 'x', ...extra,
});

it('merges batches by id, holds back duplicates and skips invalid entries', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pico-catalog-'));
  const catalogPath = join(dir, 'catalog.json');
  const batchDir = join(dir, 'batches');
  mkdirSync(batchDir);
  writeFileSync(catalogPath, JSON.stringify([coffee('kieni', 'Kieni', { imageUrl: 'https://example.com/k.png' })]));
  writeFileSync(join(batchDir, '01.json'), JSON.stringify([
    coffee('kieni', 'Kieni', { description: 'updated' }),
    coffee('kieni-copy', 'KIENI'),
    coffee('gatomboya', 'Gatomboya'),
    { id: 'broken', name: 'Broken' },
  ]));

  let output = '';
  try {
    execFileSync('node', [join(import.meta.dirname, 'build-catalog.ts'), '--write'], {
      env: { ...process.env, CATALOG_PATH: catalogPath, CATALOG_BATCH_DIR: batchDir },
      encoding: 'utf8',
    });
  } catch (error) {
    output = (error as { stdout: string }).stdout; // exits 1 because of the invalid entry
  }

  expect(output).toMatch(/kieni-copy looks like existing kieni/);
  expect(output).toMatch(/01\.json\[3\]: roaster must be non-empty text/);
  const written = JSON.parse(readFileSync(catalogPath, 'utf8'));
  expect(written.map((entry: { id: string }) => entry.id)).toEqual(['kieni', 'gatomboya']);
  // A partial update keeps fields the batch left out.
  expect(written[0]).toMatchObject({ description: 'updated', imageUrl: 'https://example.com/k.png' });
});
