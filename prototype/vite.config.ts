import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PROTO_HTTPS=1 serves over HTTPS with a self-signed cert from prototype/certs.local/ (git-ignored),
// because a phone only gives the live camera scan a camera on HTTPS. See README. Default: plain HTTP.
const https = process.env.PROTO_HTTPS
  ? { key: readFileSync(`${__dirname}/certs.local/key.pem`), cert: readFileSync(`${__dirname}/certs.local/cert.pem`) }
  : undefined

// Pico v2 prototype dev server (port 5180). The live beta is built by the root vite.config.ts via index.dev.html.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: { host: true, port: 5180, fs: { allow: ['..'] }, https },
})
