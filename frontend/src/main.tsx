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
          <Toaster 
            position="bottom-right" 
            toastOptions={{ 
              duration: 3500,
              style: { 
                borderRadius: '10px', 
                background: '#0f172a', 
                color: '#f8fafc', 
                fontSize: '13px', 
                fontWeight: 500,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)' 
              } 
            }} 
          />
        </NetworkProvider>
      </SubscriptionProvider>
    </AuthProvider>
  </StrictMode>,
)
