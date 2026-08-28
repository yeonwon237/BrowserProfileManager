import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces] = useState([])
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(() => {
    return localStorage.getItem('ynlogin_current_workspace') || 'default'
  })
  const [loading, setLoading] = useState(true)

  const reloadWorkspaces = useCallback(async () => {
    try {
      if (window.electronAPI && window.electronAPI.getWorkspaces) {
        const list = await window.electronAPI.getWorkspaces({ includeArchived: true })
        if (Array.isArray(list)) {
          setWorkspaces(list)
          // If current selected workspace no longer exists, reset to default
          if (currentWorkspaceId !== 'all' && !list.some((w) => w.id === currentWorkspaceId)) {
            setCurrentWorkspaceId('default')
            localStorage.setItem('ynlogin_current_workspace', 'default')
          }
        }
      }
    } catch (err) {
      console.warn('Could not load workspaces:', err)
    } finally {
      setLoading(false)
    }
  }, [currentWorkspaceId])

  useEffect(() => {
    reloadWorkspaces()
  }, [reloadWorkspaces])

  const selectWorkspace = (id) => {
    setCurrentWorkspaceId(id)
    localStorage.setItem('ynlogin_current_workspace', id)
  }

  const currentWorkspace =
    currentWorkspaceId === 'all'
      ? { id: 'all', name: 'All Workspaces', is_default: false }
      : workspaces.find((w) => w.id === currentWorkspaceId) || {
          id: 'default',
          name: 'Default Workspace',
          is_default: true,
        }

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        currentWorkspaceId,
        selectWorkspace,
        reloadWorkspaces,
        loading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}
