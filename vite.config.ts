import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const configuredBase = process.env.VITE_BASE || '/'
const base = configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`

// PROTO_HTTPS=1 serves over HTTPS with a self-signed cert from prototype/certs.local/ (git-ignored), because a phone
// only gives the live camera scan a camera on HTTPS. Make the cert: see prototype/README.md. Default: plain HTTP.
const cert = (name: string) => readFileSync(new URL(`./prototype/certs.local/${name}`, import.meta.url))
const https = process.env.PROTO_HTTPS ? { key: cert('key.pem'), cert: cert('cert.pem') } : undefined

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    https,
  },
  build: {
    rollupOptions: {
      input: './index.dev.html',
    },
  },
})
