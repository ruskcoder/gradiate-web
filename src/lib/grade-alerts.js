import { useStore } from '@/lib/store'
import { diffGrades, getCurrentClasses, getMissingAssignments, mergeGradeChanges } from '@/lib/insights'

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

/**
 * Publish changes as badges on the grades list (see GradesItem). A system
 * notification is still sent when the user opted in and the tab is hidden.
 */
export function notifyGradeChanges(changes) {
  const state = useStore.getState()
  const user = state.currentUser()
  if (!changes.length || user?.changeAlerts === false) return

  state.setGradeChanges(mergeGradeChanges(state.gradeChanges, changes))

  const settings = user?.alertSettings
  if (settings?.browserNotifications && typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' && document.visibilityState === 'hidden') {
    const title = changes.length === 1 ? 'Grade updated' : `${changes.length} grades updated`
    try {
      new Notification(title, {
        body: changes.slice(0, 4).map(describe).join('\n'),
        icon: '/logo-rounded.png',
        tag: 'grade-changes',
      })
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
 * before, run the merge, then badge the changes and sync todos.
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
