import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    restoreMocks: true,
    // The v1 interaction tests take 1–3 s alone but pass 5 s on a loaded machine (several sessions/CI); not a hang.
    testTimeout: 15000,
  },
});
