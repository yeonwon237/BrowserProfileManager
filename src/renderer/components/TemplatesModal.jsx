import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, CopyIcon, TrashIcon, AlertIcon, LayersIcon } from './icons'
import TemplateFormModal from './TemplateFormModal'
import BulkCreateProfilesModal from './BulkCreateProfilesModal'
import { useWorkspace } from '../context/WorkspaceContext'

export default function TemplatesModal({ isOpen, onClose, onProfileCreated, proxies = [] }) {
  const { currentWorkspaceId } = useWorkspace()
  const [templates, setTemplates] = useState([])
  const [, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [showFormModal, setShowFormModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)

  const reloadTemplates = useCallback(async () => {
    try {
      if (window.electronAPI && window.electronAPI.getTemplates) {
        const opts = currentWorkspaceId && currentWorkspaceId !== 'all' ? { workspace_id: currentWorkspaceId } : {}
        const list = await window.electronAPI.getTemplates(opts)
        setTemplates(list || [])
      }
    } catch (err) {
      setError(err.message || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [currentWorkspaceId])

  useEffect(() => {
    if (isOpen) {
      reloadTemplates()
    }
  }, [isOpen, reloadTemplates])

  if (!isOpen) return null

  const handleDuplicate = async (t) => {
    try {
      if (window.electronAPI && window.electronAPI.duplicateTemplate) {
        await window.electronAPI.duplicateTemplate(t.id)
        reloadTemplates()
      }
    } catch (err) {
      setError(err.message || 'Failed to duplicate template')
    }
  }

  const handleDelete = async (id) => {
    try {
      if (window.electronAPI && window.electronAPI.deleteTemplate) {
        await window.electronAPI.deleteTemplate(id)
        reloadTemplates()
      }
    } catch (err) {
      setError(err.message || 'Failed to delete template')
    }
  }

  const handleCreateProfile = async (t) => {
    try {
      if (window.electronAPI && window.electronAPI.createProfileFromTemplate) {
        await window.electronAPI.createProfileFromTemplate(t.id, {
          workspace_id: currentWorkspaceId === 'all' ? 'default' : currentWorkspaceId,
        })
        if (onProfileCreated) onProfileCreated(1)
        onClose()
      }
    } catch (err) {
      setError(err.message || 'Failed to create profile from template')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-app-surface rounded-2xl border border-slate-200 dark:border-app-border shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-app-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <LayersIcon size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-app-text">
                Profile Templates
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-app-muted-2">
                Standardize browser settings, proxies, tags & notes for fast multi-profile generation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-app-muted dark:hover:text-app-text"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertIcon size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-app-muted">
              {templates.length} template(s) available
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBulkModal(true)}
                disabled={templates.length === 0}
                className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <PlusIcon size={13} />
                <span>Bulk Create Profiles</span>
              </button>
              <button
                onClick={() => {
                  setEditingTemplate(null)
                  setShowFormModal(true)
                }}
                className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <PlusIcon size={13} />
                <span>New Template</span>
              </button>
            </div>
          </div>

          {templates.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-app-muted text-xs space-y-2 border border-dashed border-slate-200 dark:border-app-border rounded-xl">
              <LayersIcon size={24} className="mx-auto opacity-40" />
              <p>No profile templates found in this workspace</p>
              <button
                onClick={() => setShowFormModal(true)}
                className="text-brand-600 dark:text-brand-400 font-semibold hover:underline mt-1"
              >
                Create your first template →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-app-border/60">
              {templates.map((t) => (
                <div key={t.id} className="py-3.5 flex items-center justify-between gap-4 group">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-800 dark:text-app-text truncate">
                        {t.name}
                      </p>
                      <span className="text-[10px] font-mono px-2 py-0.2 rounded-md bg-slate-100 dark:bg-app-surface-2 text-slate-600 dark:text-app-muted font-bold uppercase">
                        {t.browser_type}
                      </span>
                      {t.group_name && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium">
                          {t.group_name}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-app-muted-2 mt-0.5 truncate">
                      {t.description || 'No description'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleCreateProfile(t)}
                      className="btn btn-primary text-xs py-1 px-2.5"
                    >
                      + 1 Profile
                    </button>

                    <button
                      onClick={() => handleDuplicate(t)}
                      title="Duplicate template"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-app-muted dark:hover:text-app-text hover:bg-slate-100 dark:hover:bg-app-surface-2"
                    >
                      <CopyIcon size={13} />
                    </button>

                    <button
                      onClick={() => {
                        setEditingTemplate(t)
                        setShowFormModal(true)
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-app-text px-2 py-1"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleDelete(t.id)}
                      title="Delete template"
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    >
                      <TrashIcon size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showFormModal && (
        <TemplateFormModal
          isOpen={showFormModal}
          onClose={() => {
            setShowFormModal(false)
            setEditingTemplate(null)
          }}
          template={editingTemplate}
          proxies={proxies}
          onSave={async (data) => {
            if (editingTemplate) {
              await window.electronAPI.updateTemplate(editingTemplate.id, data)
            } else {
              await window.electronAPI.createTemplate({
                ...data,
                workspace_id: currentWorkspaceId === 'all' ? 'default' : currentWorkspaceId,
              })
            }
            reloadTemplates()
          }}
        />
      )}

      {showBulkModal && (
        <BulkCreateProfilesModal
          isOpen={showBulkModal}
          onClose={() => setShowBulkModal(false)}
          templates={templates}
          onCreated={(count) => {
            if (onProfileCreated) onProfileCreated(count)
            onClose()
          }}
        />
      )}
    </div>
  )
}
