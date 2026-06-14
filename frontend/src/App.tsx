import { BrowserRouter, Routes, Route, Link, useLocation, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import InputPage from './pages/InputPage'
import ListPage from './pages/ListPage'
import DetailPage from './pages/DetailPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'

const queryClient = new QueryClient()

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation()
  const active = location.pathname === to
  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </Link>
  )
}

function Layout() {
  const { logout, isAuthenticated } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="text-xl font-bold text-blue-600">
              State Machine Simulator
            </Link>
            <div className="flex items-center gap-2">
              {isAuthenticated && (
                <>
                  <div className="hidden sm:flex gap-2">
                    <NavLink to="/input">新規作成</NavLink>
                    <NavLink to="/">一覧</NavLink>
                    <NavLink to="/dashboard">ダッシュボード</NavLink>
                  </div>
                  <button
                    onClick={logout}
                    className="ml-4 px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    ログアウト
                  </button>
                </>
              )}
            </div>
          </div>
          {/* Mobile navigation */}
          {isAuthenticated && (
            <div className="sm:hidden pb-3 flex flex-wrap gap-2">
              <NavLink to="/input">新規作成</NavLink>
              <NavLink to="/">一覧</NavLink>
              <NavLink to="/dashboard">ダッシュボード</NavLink>
            </div>
          )}
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
