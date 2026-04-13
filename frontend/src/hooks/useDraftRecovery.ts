import { useEffect, useRef, useCallback } from 'react'

interface DraftData {
  data: Record<string, unknown>
  savedAt: string
}

const DRAFT_SAVE_INTERVAL = 2000

export function useDraftRecovery<T extends Record<string, unknown>>(
  type: string,
  slug: string | undefined,
  formData: T,
  isDirty: boolean,
  onRestore: (data: T) => void
) {
  const key = `kiro-draft-${type}-${slug ?? 'new'}`
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSavedRef = useRef<string>('')

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return
      const draft: DraftData = JSON.parse(raw)
      const savedAt = new Date(draft.savedAt)
      const timeStr = savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const confirmed = window.confirm(
        `You have unsaved changes from ${timeStr}. Restore them?`
      )
      if (confirmed) {
        onRestore(draft.data as T)
      } else {
        localStorage.removeItem(key)
      }
    } catch {
      // ignore malformed draft
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft every 2 seconds when dirty
  useEffect(() => {
    if (saveTimerRef.current) clearInterval(saveTimerRef.current)

    if (!isDirty) return

    saveTimerRef.current = setInterval(() => {
      const serialized = JSON.stringify(formData)
      if (serialized === lastSavedRef.current) return
      lastSavedRef.current = serialized
      const draft: DraftData = {
        data: formData,
        savedAt: new Date().toISOString(),
      }
      try {
        localStorage.setItem(key, JSON.stringify(draft))
      } catch {
        // ignore storage errors
      }
    }, DRAFT_SAVE_INTERVAL)

    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current)
    }
  }, [isDirty, formData, key])

  const clearDraft = useCallback(() => {
    localStorage.removeItem(key)
    lastSavedRef.current = ''
  }, [key])

  return { clearDraft }
}
