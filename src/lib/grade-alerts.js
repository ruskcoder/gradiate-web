import { toast } from 'sonner'
import { useStore } from '@/lib/store'
import { diffGrades, getCurrentClasses, getMissingAssignments } from '@/lib/insights'

const fmt = (n) => (n === null ? '···' : n.toFixed(2))

function describe(change) {
  const parts = []
  if (change.from !== null && change.to !== null && change.from !== change.to) {
    parts.push(`${fmt(change.from)} → ${fmt(change.to)}`)
  }
  if (change.newAssignments.length) {
    parts.push(`${change.newAssignments.length} new: ${change.newAssignments.slice(0, 2).join(', ')}${change.newAssignments.length > 2 ? '…' : ''}`)
  }
  return `${change.name} · ${parts.join(' · ')}`
}

export function notifyGradeChanges(changes) {
  const user = useStore.getState().currentUser()
  const settings = user?.alertSettings
  if (!changes.length || user?.changeAlerts === false) return

  const title = changes.length === 1 ? 'Grade updated' : `${changes.length} grades updated`
  const lines = changes.slice(0, 4).map(describe)

  toast(title, {
    description: lines.join('\n'),
    duration: 9000,
    position: 'top-right',
    closeButton: true,
  })

  if (settings?.browserNotifications && typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' && document.visibilityState === 'hidden') {
    try {
      new Notification(title, { body: lines.join('\n'), icon: '/logo-rounded.png', tag: 'grade-changes' })
    } catch {
      // Some browsers only allow notifications from a service worker.
    }
  }
}

/** Create todos for missing assignments that don't already have one. */
export function syncMissingTodos() {
  const state = useStore.getState()
  const user = state.currentUser()
  if (!user?.autoTodoFromMissing) return
  const existing = new Set((user.todos || []).map((t) => t.source).filter(Boolean))
  const { classes } = getCurrentClasses(user)
  for (const m of getMissingAssignments(classes)) {
    const source = `missing:${m.id}`
    if (existing.has(source)) continue
    state.addTodo({ title: `${m.className}: ${m.name}`, dueDate: null, completed: false, source })
  }
}

/**
 * Wrap a store merge of freshly-loaded classes: diff against what was stored
 * before, run the merge, then alert and sync todos.
 */
export function withGradeChangeDetection(term, classes, merge) {
  let changes = []
  try {
    const before = useStore.getState().getGradesStore().history?.[term]
    changes = diffGrades(before, classes, term)
  } catch (e) {
    console.error(e)
  }
  merge()
  try {
    notifyGradeChanges(changes)
    syncMissingTodos()
  } catch (e) {
    console.error(e)
  }
}
