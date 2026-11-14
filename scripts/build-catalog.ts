/**
 * Merges coffee batches into the one catalog the app ships (src/data/coffees-dk.json).
 *
 *   npm run catalog          dry run: validate every batch and print what would change
 *   npm run catalog -- --write   also write the merged catalog
 *
 * Rules (see src/data/README.md):
 * - Batches are src/data/batches/*.json, each an array of catalog entries, applied in file-name order.
 * - An entry with a known id updates that coffee. Ids never change: saved ratings point at them.
 * - A new id whose roaster + name already exists under another id is held back as a likely duplicate.
 * - Invalid entries are reported and skipped. Nothing is ever deleted; mark sold-out coffees `available: false`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { catalogEntryProblems, parseCatalogCoffee } from '../src/lib/catalog-schema.ts';
import type { Coffee } from '../src/types/coffee.ts';

const root = join(import.meta.dirname, '..');
const catalogPath = process.env.CATALOG_PATH ?? join(root, 'src/data/coffees-dk.json');
const batchDir = process.env.CATALOG_BATCH_DIR ?? join(root, 'src/data/batches');
const write = process.argv.includes('--write');

/** Fields a coffee page looks bare without. */
const RECOMMENDED: (keyof Coffee)[] = ['imageUrl', 'sourceUrl', 'tastingNotes', 'region', 'roastStyle', 'roasterCity'];

function sameCoffeeKey(coffee: Pick<Coffee, 'roaster' | 'name'>): string {
  const fold = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
  return `${fold(coffee.roaster)}|${fold(coffee.name)}`;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const base = readJson(catalogPath);
if (!Array.isArray(base)) throw new Error(`${catalogPath} must hold an array`);
const catalog = new Map<string, Coffee>();
for (const entry of base) {
  const coffee = parseCatalogCoffee(entry);
  if (!coffee) throw new Error(`Current catalog has an invalid entry: ${JSON.stringify(entry).slice(0, 120)}`);
  catalog.set(coffee.id, coffee);
}
const byKey = new Map([...catalog.values()].map((coffee) => [sameCoffeeKey(coffee), coffee.id]));

const batchFiles = readdirSync(batchDir).filter((name) => name.endsWith('.json')).sort();
const report = { added: [] as string[], updated: [] as string[], unchanged: 0, invalid: [] as string[], duplicates: [] as string[], warnings: [] as string[] };

for (const file of batchFiles) {
  const entries = readJson(join(batchDir, file));
  if (!Array.isArray(entries)) {
    report.invalid.push(`${file}: file must hold an array`);
    continue;
  }
  entries.forEach((entry, index) => {
    const where = `${file}[${index}]`;
    const problems = catalogEntryProblems(entry);
    const coffee = problems.length === 0 ? parseCatalogCoffee(entry) : undefined;
    if (!coffee) {
      report.invalid.push(`${where}: ${problems.join('; ') || 'custom coffees (isCustom) cannot enter the catalog'}`);
      return;
    }
    const warn = (merged: Coffee) => {
      const dropped = Object.keys(entry as object).filter((key) => !(key in coffee));
      if (dropped.length) report.warnings.push(`${coffee.id}: dropped invalid optional ${dropped.join(', ')}`);
      const missing = RECOMMENDED.filter((key) => merged[key] === undefined);
      if (missing.length) report.warnings.push(`${coffee.id}: missing ${missing.join(', ')}`);
    };

    const existing = catalog.get(coffee.id);
    if (!existing) {
      const twin = byKey.get(sameCoffeeKey(coffee));
      if (twin) {
        report.duplicates.push(`${where}: ${coffee.id} looks like existing ${twin}; reuse that id to update it`);
        return;
      }
      catalog.set(coffee.id, coffee);
      byKey.set(sameCoffeeKey(coffee), coffee.id);
      report.added.push(coffee.id);
      warn(coffee);
      return;
    }
    // Merge, so a partial batch entry never wipes fields such as the image or tasting notes.
    const merged: Coffee = { ...existing, ...coffee };
    const changed = Object.keys(merged).filter(
      (key) => JSON.stringify(existing[key as keyof Coffee]) !== JSON.stringify(merged[key as keyof Coffee]),
    );
    if (changed.length === 0) {
      report.unchanged += 1;
      return;
    }
    catalog.set(coffee.id, merged);
    report.updated.push(`${coffee.id} (${changed.join(', ')})`);
    warn(merged);
  });
}

const list = (title: string, items: string[]) => {
  console.log(`${title}: ${items.length}`);
  for (const item of items) console.log(`  ${item}`);
};
console.log(`Catalog: ${catalog.size - report.added.length} coffees now, ${catalog.size} after merge, from ${batchFiles.length} batch file(s)`);
list('Added', report.added);
list('Updated', report.updated);
console.log(`Unchanged: ${report.unchanged}`);
list('Held back as likely duplicates', report.duplicates);
list('Invalid, skipped', report.invalid);
list('Warnings', report.warnings);

if (write) {
  writeFileSync(catalogPath, `${JSON.stringify([...catalog.values()], null, 2)}\n`);
  console.log(`Wrote ${catalogPath}`);
} else {
  console.log('Dry run. Nothing written; pass --write to update the catalog.');
}
if (report.invalid.length > 0) process.exitCode = 1;
