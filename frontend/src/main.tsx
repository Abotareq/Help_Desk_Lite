import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthProvider'
import { AppRoutes } from './routes/AppRoutes'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A ticket queue changes because someone else acted, so refetching when
      // the tab regains focus is the behaviour people expect.
      refetchOnWindowFocus: true,
      staleTime: 10_000,
      // Retrying a 401 or a 403 just delays the redirect to sign-in.
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status
        if (status && status >= 400 && status < 500) return false
        return failureCount < 2
      },
    },
  },
})

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found in index.html')

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
