import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '../src/v2/app/App'
import '../src/v2/app/app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
