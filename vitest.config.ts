import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['app/api/**/*.test.ts', 'lib/**/*.test.ts', 'components/**/*.test.{ts,tsx}'],
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
