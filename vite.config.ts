import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const configuredBase = process.env.VITE_BASE || '/'
const base = configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
  },
})
