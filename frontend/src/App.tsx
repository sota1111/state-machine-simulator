import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import InputPage from './pages/InputPage'
import ListPage from './pages/ListPage'
import DetailPage from './pages/DetailPage'
import DashboardPage from './pages/DashboardPage'

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

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="text-xl font-bold text-blue-600">
              State Machine Simulator
            </Link>
            <div className="flex gap-2">
              <NavLink to="/input">新規作成</NavLink>
              <NavLink to="/">一覧</NavLink>
              <NavLink to="/dashboard">ダッシュボード</NavLink>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ListPage />} />
        <Route path="/input" element={<InputPage />} />
        <Route path="/models/:id" element={<DetailPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
