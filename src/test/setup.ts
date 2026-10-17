import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';

vi.mock('../data/coffees-dk.json', async () => ({
  default: (await import('./fixtures/catalog')).catalogFixture,
}));

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '';
});
