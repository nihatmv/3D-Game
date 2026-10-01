import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { PortfolioPage } from './page/PortfolioPage'
import { showPortfolioPage } from './routes'
import './index.css'

// The 3D island (three.js, R3F, drei) is a separate chunk: the plain page never loads it.
const App = lazy(() => import('./App'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showPortfolioPage() ? (
      <PortfolioPage />
    ) : (
      <Suspense fallback={null}>
        <App />
      </Suspense>
    )}
  </StrictMode>,
)
