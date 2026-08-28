import Sidebar from './Sidebar'
import TopBar from './TopBar'

function Layout({ children, onSearch, search }) {
  return (
    <div className="relative flex h-full w-full bg-[#f3f6fb] dark:bg-app-bg text-slate-900 dark:text-app-text select-none overflow-hidden transition-colors duration-250">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 dark:bg-[radial-gradient(circle_at_75%_-10%,rgba(79,124,255,0.12),transparent_34%),radial-gradient(circle_at_15%_110%,rgba(34,211,238,0.06),transparent_30%)] bg-[radial-gradient(circle_at_75%_-10%,rgba(79,124,255,0.08),transparent_32%)]" />
      <Sidebar />
      <div className="relative z-[1] flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <TopBar onSearch={onSearch} search={search} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout
