import { describe, expect, it } from 'vitest';
import { flavorTagsFromNotes } from './catalog-schema';

describe('flavorTagsFromNotes', () => {
  it('maps roaster notes onto Pico flavor tags, plurals and phrases included', () => {
    expect(flavorTagsFromNotes(['blackberries', 'mandarin orange', 'acacia honey'])).toEqual([
      'fruity', 'caramel', 'berry', 'citrus',
    ]);
    expect(flavorTagsFromNotes(['pecan nuts', 'milk chocolate', 'black tea'])).toEqual([
      'chocolate', 'nutty', 'bright',
    ]);
  });

  it('matches whole words only', () => {
    expect(flavorTagsFromNotes(['nutmeg'])).toEqual(['spice']);
    expect(flavorTagsFromNotes(['unknown savoury'])).toEqual([]);
  });
});
