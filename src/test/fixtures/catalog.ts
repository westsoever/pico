import type { Coffee } from '../../types/coffee';

/**
 * Stable catalog used by every test instead of src/data/coffees-dk.json, so
 * tests keep passing when the real Copenhagen catalog is refreshed.
 */
export const catalogFixture: Coffee[] = [
  {
    id: 'fixture-ethiopia',
    name: 'Halo Hartume',
    roaster: 'Fixture Roasters',
    roasterCity: 'Copenhagen',
    origin: 'Ethiopia',
    region: 'Yirgacheffe',
    producer: 'Halo Hartume Washing Station',
    process: 'washed',
    variety: 'Heirloom',
    altitude: '1900–2100 masl',
    roastLevel: 'light',
    roastStyle: 'filter',
    tastingNotes: ['jasmine', 'lemon zest'],
    flavorTags: ['floral', 'citrus', 'bright', 'fruity'],
    description: 'Washed Ethiopian with jasmine and lemon.',
    imageUrl: 'https://example.com/halo-hartume.jpg',
    sourceUrl: 'https://example.com/shop/halo-hartume',
    available: true,
  },
  {
    id: 'fixture-kenya',
    name: 'Gatomboya',
    roaster: 'Fixture Roasters',
    roasterCity: 'Copenhagen',
    origin: 'Kenya',
    process: 'washed',
    roastLevel: 'light',
    roastStyle: 'omni',
    flavorTags: ['citrus', 'berry', 'bright', 'fruity'],
    description: 'Blackcurrant and grapefruit acidity.',
  },
  {
    id: 'fixture-colombia',
    name: 'La Esperanza',
    roaster: 'Second Fixture Coffee',
    origin: 'Colombia',
    process: 'washed',
    roastLevel: 'medium',
    roastStyle: 'espresso',
    flavorTags: ['chocolate', 'caramel', 'nutty'],
    description: 'Sweet chocolate and caramel.',
    available: false,
  },
  {
    id: 'fixture-brazil',
    name: 'Fazenda Rainha',
    roaster: 'Second Fixture Coffee',
    origin: 'Brazil',
    process: 'natural',
    roastLevel: 'dark',
    flavorTags: ['chocolate', 'nutty', 'heavy-body'],
    description: 'Heavy, nutty espresso base.',
  },
];
