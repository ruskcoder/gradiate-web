import { useStore } from '@/lib/store'
import { APP_NAME } from '@/lib/constants'

const FORMAT = 'gradiate-backup'
const VERSION = 1

// Everything a backup may carry. Credentials and session data (password,
// clMFA, clsession) and account identity (username, link, platform, …) are never
// exported and never overwritten on import.
const PORTABLE_KEYS = [
  'colorTheme', 'theme', 'gradesView', 'showPageTitles', 'matchThemeWithLogo',
  'hideColors', 'numberDisplay', 'animationsEnabled', 'bellSchedules',
  'courseTypesByCourseName', 'deletedTranscriptCourses', 'customCourses',
  'rankDataPoints', 'todos', 'shortcuts', 'goals', 'classNotes', 'alertSettings',
  'autoTodoFromMissing', 'activeBellSchedule', 'changeAlerts', 'defaultPage',
  'gradesStore',
]

export function exportBackup(user) {
  const data = {}
  for (const k of PORTABLE_KEYS) if (user[k] !== undefined) data[k] = user[k]
  const payload = {
    format: FORMAT,
    version: VERSION,
    app: APP_NAME,
    exportedAt: new Date().toISOString(),
    account: { username: user.username, platform: user.platform, district: user.district },
    data,
  }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${APP_NAME.toLowerCase()}-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Union two per-course snapshot histories, deduped by timestamp. */
function mergeHistory(current = {}, incoming = {}) {
  const out = { ...current }
  for (const term of Object.keys(incoming)) {
    out[term] = { ...(out[term] || {}) }
    for (const course of Object.keys(incoming[term] || {})) {
      const byTime = new Map()
      for (const e of [...(out[term][course] || []), ...(incoming[term][course] || [])]) {
        byTime.set(e.loadedAt, e)
      }
      out[term][course] = [...byTime.values()].sort((a, b) => a.loadedAt - b.loadedAt)
    }
  }
  return out
}

/** Restore a backup file into the current account. Returns a summary string. */
export async function importBackup(file) {
  const payload = JSON.parse(await file.text())
  if (payload?.format !== FORMAT || typeof payload.data !== 'object') {
    throw new Error('This is not a valid backup file.')
  }
  const { changeUserData, currentUser } = useStore.getState()
  const user = currentUser()
  if (!user) throw new Error('No account selected.')

  let restored = 0
  for (const k of PORTABLE_KEYS) {
    const value = payload.data[k]
    if (value === undefined) continue
    if (k === 'gradesStore') {
      const cur = user.gradesStore
      changeUserData('gradesStore', {
        ...cur,
        ...value,
        initialTerm: cur.initialTerm || value.initialTerm,
        termList: cur.termList?.length ? cur.termList : value.termList,
        history: mergeHistory(cur.history, value.history),
      })
    } else {
      changeUserData(k, value)
    }
    restored++
  }
  const other = payload.account?.username && payload.account.username !== user.username
  return `Restored ${restored} sections${other ? ` (from account ${payload.account.username})` : ''}.`
}
