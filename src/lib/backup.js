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

/** True for a plain object — `typeof null` is also 'object', and an array isn't one. */
function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Union two per-course snapshot histories, deduped by timestamp.
 *
 * A backup file is untrusted input — it can be hand-edited or truncated — so
 * every level is shape-checked before it is walked. Anything malformed is
 * skipped rather than merged in as junk (or thrown on).
 */
function mergeHistory(current = {}, incoming = {}) {
  const out = isPlainObject(current) ? { ...current } : {}
  if (!isPlainObject(incoming)) return out
  for (const term of Object.keys(incoming)) {
    const incomingTerm = incoming[term]
    if (!isPlainObject(incomingTerm)) continue
    out[term] = isPlainObject(out[term]) ? { ...out[term] } : {}
    for (const course of Object.keys(incomingTerm)) {
      const mine = Array.isArray(out[term][course]) ? out[term][course] : []
      const theirs = Array.isArray(incomingTerm[course]) ? incomingTerm[course] : []
      const byTime = new Map()
      for (const e of [...mine, ...theirs]) {
        if (!isPlainObject(e) || typeof e.loadedAt !== 'number') continue
        byTime.set(e.loadedAt, e)
      }
      out[term][course] = [...byTime.values()].sort((a, b) => a.loadedAt - b.loadedAt)
    }
  }
  return out
}

/** Restore a backup file into the current account. Returns a summary string. */
export async function importBackup(file) {
  let payload
  try {
    payload = JSON.parse(await file.text())
  } catch {
    throw new Error('This is not a valid backup file.')
  }
  // `typeof null === 'object'`, so a `"data": null` payload used to pass this
  // check and then throw on the first property read.
  if (payload?.format !== FORMAT || !isPlainObject(payload.data)) {
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
      // A hand-edited backup can carry anything here; only merge a real object.
      if (!isPlainObject(value)) continue
      const cur = user.gradesStore
      changeUserData('gradesStore', {
        ...cur,
        ...value,
        initialTerm: cur.initialTerm || value.initialTerm || '',
        termList: cur.termList?.length
          ? cur.termList
          : Array.isArray(value.termList)
            ? value.termList
            : [],
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
