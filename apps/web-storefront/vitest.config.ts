import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Real test infrastructure (new) -- this app had ZERO test files and no
// test script at all before this, unlike every other app in this
// monorepo. Same jsdom + React Testing Library toolchain already used
// in apps/admin-dashboard and apps/supplier-portal, adapted for this
// app's Next.js `@/*` path alias (see tsconfig.json) since Vitest
// doesn't read Next's own module resolution config.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './test-setup.ts',
  },
});
