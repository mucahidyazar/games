import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AppCrashScreen, ErrorBoundary } from './components/errors/ErrorBoundary'
import { createQueryClient } from './features/account/queries'
import { GameControllerProvider } from '@/games/trap-the-orb/state/GameControllerProvider'
import { PlayerDataProvider } from '@/games/trap-the-orb/state/PlayerDataProvider'
import { logger } from './lib/logger'
import './index.css'
import { initializeTheme } from './app/theme'

initializeTheme()

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root is missing from index.html')

window.addEventListener('unhandledrejection', (event) => logger.error('Unhandled promise rejection', event.reason))

const queryClient = createQueryClient()

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary fallback={() => <AppCrashScreen />} onError={(error) => logger.error('The app crashed', error)}>
      <QueryClientProvider client={queryClient}>
        <PlayerDataProvider>
          <GameControllerProvider>
            <App />
          </GameControllerProvider>
        </PlayerDataProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
