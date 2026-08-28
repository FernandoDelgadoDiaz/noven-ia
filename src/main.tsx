import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { NovenAccessProvider } from '@/context/NovenAccessContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NovenAccessProvider>
      <App />
    </NovenAccessProvider>
  </StrictMode>,
)
