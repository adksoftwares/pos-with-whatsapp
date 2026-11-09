import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './state/AuthContext.tsx'
import { NetworkProvider } from './state/NetworkContext.tsx'
import { SubscriptionProvider } from './state/SubscriptionContext.tsx'
import { initPWA } from './pwa.ts'
import { Toaster } from 'react-hot-toast'

initPWA();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <SubscriptionProvider>
        <NetworkProvider>
          <App />
          <Toaster position="top-right" />
        </NetworkProvider>
      </SubscriptionProvider>
    </AuthProvider>
  </StrictMode>,
)
