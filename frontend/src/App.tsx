import { BrowserRouter, Routes, Route, Link, useLocation, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import InputPage from './pages/InputPage'
import ListPage from './pages/ListPage'
import DetailPage from './pages/DetailPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './components/ProtectedRoute'
import LanguageToggle from './components/LanguageToggle'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import { I18nProvider } from './i18n/I18nProvider'
import { useI18n } from './i18n/useI18n'

const queryClient = new QueryClient()

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation()
  const active = location.pathname === to
  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-foreground-muted hover:bg-surface-muted'
      }`}
    >
      {children}
    </Link>
  )
}

function Layout() {
  const { logout, isAuthenticated } = useAuth()
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-surface-muted flex flex-col">
      <nav className="bg-surface/90 backdrop-blur shadow-sm border-b border-border sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 text-xl font-bold text-foreground tracking-tight whitespace-nowrap shrink-0">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-sm font-extrabold">FR</span>
              FlowReview
            </Link>
            <div className="flex items-center gap-2">
              {isAuthenticated && (
                <>
                  <div className="hidden sm:flex gap-2">
                    <NavLink to="/">{t('nav.list')}</NavLink>
                    <NavLink to="/input">{t('nav.create')}</NavLink>
                    <NavLink to="/dashboard">{t('nav.dashboard')}</NavLink>
                  </div>
                  <button
                    onClick={logout}
                    aria-label={t('nav.logout')}
                    title={t('nav.logout')}
                    className="ml-4 inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-muted transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </button>
                </>
              )}
              <LanguageToggle />
            </div>
          </div>
          {/* Mobile navigation */}
          {isAuthenticated && (
            <div className="sm:hidden pb-3 flex flex-nowrap gap-2 overflow-x-auto">
              <NavLink to="/">{t('nav.list')}</NavLink>
              <NavLink to="/input">{t('nav.create')}</NavLink>
              <NavLink to="/dashboard">{t('nav.dashboard')}</NavLink>
            </div>
          )}
        </div>
      </nav>
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border py-4 text-center text-xs text-foreground-subtle">
        FlowReview — {t('app.footerTagline')}
      </footer>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<ListPage />} />
          <Route path="/input" element={<InputPage />} />
          <Route path="/models/:id" element={<DetailPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </I18nProvider>
  )
}
