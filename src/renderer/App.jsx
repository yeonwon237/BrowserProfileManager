import { lazy, Suspense, useState } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { WorkspaceProvider } from './context/WorkspaceContext'
import { LanguageProvider } from './context/LanguageContext'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import OrphanBrowserModal from './components/OrphanBrowserModal'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Profiles = lazy(() => import('./pages/Profiles'))
const Automation = lazy(() => import('./pages/Automation'))
const Proxies = lazy(() => import('./pages/Proxies'))
const Logs = lazy(() => import('./pages/Logs'))
const DataTools = lazy(() => import('./pages/DataTools'))
const Settings = lazy(() => import('./pages/Settings'))
const Extensions = lazy(() => import('./pages/Extensions'))
const Synchronizer = lazy(() => import('./pages/Synchronizer'))
const TeamSync = lazy(() => import('./pages/TeamSync'))

function PageLoader() {
  return <div className="h-full flex items-center justify-center text-xs text-slate-400"><span className="w-4 h-4 mr-2 border-2 border-slate-300 border-t-brand-500 rounded-full animate-spin" />Loading module…</div>
}

function App() {
  const [search, setSearch] = useState('')

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <WorkspaceProvider>
          <Router>
            <Layout onSearch={setSearch} search={search}>
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard search={search} />} />
                <Route path="/profiles" element={<Profiles search={search} />} />
                <Route path="/automation" element={<Automation search={search} />} />
                <Route path="/proxies" element={<Proxies search={search} />} />
                <Route path="/data-tools" element={<DataTools search={search} />} />
                <Route path="/extensions" element={<Extensions />} />
                <Route path="/synchronizer" element={<Synchronizer />} />
                <Route path="/team-sync" element={<TeamSync />} />
                <Route path="/logs" element={<Logs search={search} />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
              </Suspense>
            </Layout>
          </Router>
          <OrphanBrowserModal />
          </WorkspaceProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
