import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import { configurationError } from './lib/supabase'
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {configurationError ? (
        <main className="max-w-md mx-auto p-8">
          <h1 className="text-2xl font-bold">Plann’d is being configured</h1>
          <p className="mt-4">Please check back soon.</p>
        </main>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </StrictMode>,
)
