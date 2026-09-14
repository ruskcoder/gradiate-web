// Derived views over the persisted grades history — the dashboard, goals,
// missing-work tracker, GPA projection and change alerts all read from here so
// they work offline and never trigger extra network calls.

import { GPA_CONFIGS } from '@/lib/GPAConfigs'

export const courseKeyOf = (c) => `${c.course}|${c.name}`

export function parseNum(v) {
  if (v === null || v === undefined || v === '') return null
  const n = parseFloat(String(v).replace('%', ''))
  return Number.isFinite(n) ? n : null
}

/**
 * The current term's classes rebuilt from storage, each with its latest average
 * and the previous *different* average so the UI can show an up/down trend.
 */
export function getCurrentClasses(user) {
  const store = user?.gradesStore
  const term = store?.initialTerm
  const termHistory = term ? store.history?.[term] : null
  if (!termHistory) return { term: term || '', loadedAt: null, classes: [] }

  let loadedAt = 0
  const classes = []
  for (const key of Object.keys(termHistory)) {
    const entries = termHistory[key] || []
    const latest = entries[entries.length - 1]
    if (!latest) continue
    loadedAt = Math.max(loadedAt, latest.loadedAt || 0)
    const average = parseNum(latest.average)
    let prevAverage = null
    for (let i = entries.length - 2; i >= 0; i--) {
      const p = parseNum(entries[i].average)
      if (p !== null && p !== average) { prevAverage = p; break }
    }
    const [course, name] = key.split('|')
    classes.push({
      key,
      course,
      name,
      average,
      prevAverage,
      delta: average !== null && prevAverage !== null ? average - prevAverage : null,
      categories: latest.categories || {},
      scores: latest.scores || [],
    })
  }
  classes.sort((a, b) => a.name.localeCompare(b.name))
  return { term, loadedAt: loadedAt || null, classes }
}

const usableScore = (s) => {
  const v = parseFloat(s.score)
  const dropped = s.badges && s.badges.includes('dropped')
  return !isNaN(v) && s.score !== '···' && s.score !== '' && !s.excluded && !dropped
}

/** Category-weighted average — same math as the What-If calculator. */
export function recalculateAverage(categories, scores) {
  let weightedSum = 0
  let totalWeight = 0
  for (const [name, cat] of Object.entries(categories || {})) {
    let pts = 0
    let max = 0
    for (const s of scores || []) {
      if (s.category !== name || !usableScore(s)) continue
      const w = parseFloat(s.weight) || 1
      pts += (parseFloat(s.score) || 0) * w
      max += (parseFloat(s.totalPoints) || 0) * w
    }
    if (max > 0) {
      const w = parseFloat(cat.categoryWeight) || 1
      weightedSum += (pts / max) * 100 * w
      totalWeight += w
    }
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null
}

/**
 * Percentage needed on one new assignment (100 pts × weight) in `category` for
 * the class to reach `target`. Mirrors WhatIf's Target tab.
 */
export function neededOnNext(categories, target, category, weight = 1) {
  const cats = categories || {}
  if (!cats[category]) return null
  let totalWeight = 0
  let other = 0
  for (const [name, c] of Object.entries(cats)) {
    const w = parseFloat(c.categoryWeight) || 1
    totalWeight += w
    if (name !== category) other += (parseFloat(c.percent) || 0) * w
  }
  const cat = cats[category]
  const catWeight = parseFloat(cat.categoryWeight) || 1
  const requiredCatPercent = (target * totalWeight - other) / catWeight
  const maxPts = parseFloat(cat.maximumPoints) || 0
  const stuPts = parseFloat(cat.studentsPoints) || 0
  const score = ((requiredCatPercent / 100) * (maxPts + 100 * weight) - stuPts) / weight
  return Number.isFinite(score) ? score : null
}

/** For a goal, the need on the next assignment in each category (heaviest first). */
export function goalPlan(cls, target) {
  const cats = cls?.categories || {}
  return Object.entries(cats)
    .map(([name, c]) => ({
      category: name,
      weight: parseFloat(c.categoryWeight) || 0,
      needed: neededOnNext(cats, target, name),
    }))
    .filter((p) => p.needed !== null)
    .sort((a, b) => b.weight - a.weight)
}

/** Every missing / zero assignment across classes, with the gain if turned in at 100%. */
export function getMissingAssignments(classes) {
  const out = []
  for (const cls of classes || []) {
    const scores = cls.scores || []
    const base = parseNum(cls.average) ?? recalculateAverage(cls.categories, scores)
    scores.forEach((s, idx) => {
      const badges = s.badges || []
      const isMissing = badges.includes('missing')
      const isZero = parseNum(s.score) === 0 && parseNum(s.totalPoints) > 0
      if (!isMissing && !isZero) return
      if (badges.includes('exempt') || badges.includes('dropped') || s.excluded) return
      let gain = null
      if (base !== null && cls.categories && Object.keys(cls.categories).length) {
        const total = parseNum(s.totalPoints) || 100
        const patched = scores.map((x, i) => (i === idx ? { ...x, score: total, totalPoints: total } : x))
        const after = recalculateAverage(cls.categories, patched)
        const before = recalculateAverage(cls.categories, scores.map((x, i) => (
          i === idx ? { ...x, score: 0, totalPoints: total } : x
        )))
        if (after !== null && before !== null) gain = after - before
      }
      out.push({
        id: `${cls.key || courseKeyOf(cls)}|${s.name}|${s.dateDue || ''}`,
        classKey: cls.key || courseKeyOf(cls),
        className: cls.name,
        name: s.name,
        category: s.category,
        dateDue: s.dateDue,
        reason: isMissing ? 'Missing' : 'Zero',
        gain,
      })
    })
  }
  return out.sort((a, b) => (b.gain ?? -1) - (a.gain ?? -1))
}

/** Pick the district's GPA scale the same way the GPA/Rank calculator does. */
export function defaultGpaType(user) {
  return user?.district?.toLowerCase().includes('cypress') ? 'cyFairWeighted' : 'katyWeighted'
}

function letterFor(grade, labels) {
  const n = Math.round(grade)
  for (const [letter, range] of Object.entries(labels)) {
    const [min, max] = range.split('-').map(Number)
    if (n >= min && n <= max) return letter
  }
  return null
}

function guessType(name, types) {
  const n = name.toLowerCase()
  const has = (t) => types.includes(t)
  if (has('AP') && /\bap\b/.test(n)) return 'AP'
  if (has('KAP') && /(kap|honors|\bpap\b|\bgt\b)/.test(n)) return 'KAP'
  if (has('K') && /(\bk\b|kap|honors|\bpap\b)/.test(n)) return 'K'
  if (has('DC') && /(dual|college)/.test(n)) return 'DC'
  if (has('ACA')) return 'ACA'
  if (has('On Level')) return 'On Level'
  return types[0]
}

/**
 * GPA if every current class ended at its current average. Uses the course types
 * the user set in the GPA/Rank calculator when available.
 */
export function projectGpa(user, classes, gpaType = defaultGpaType(user)) {
  const config = GPA_CONFIGS[gpaType]
  if (!config) return null
  const types = Object.keys(config.classes).filter((t) => t !== '*')
  let sum = 0
  let count = 0
  for (const cls of classes || []) {
    if (cls.average === null || cls.average === undefined) continue
    const letter = letterFor(cls.average, config.labels)
    if (!letter) continue
    const type = user?.courseTypesByCourseName?.[cls.name] || guessType(cls.name, types)
    const scale = config.classes[type] || config.classes['*']
    const pts = scale?.[letter]
    if (pts === undefined) continue
    sum += pts
    count++
  }
  return count ? { gpa: sum / count, count } : null
}

/** Merge a projected term GPA into a transcript GPA weighted by course count. */
export function combineWithTranscript(transcriptGpa, transcriptCourses, projected) {
  if (transcriptGpa === null || !transcriptCourses || !projected) return null
  return (transcriptGpa * transcriptCourses + projected.gpa * projected.count) /
    (transcriptCourses + projected.count)
}

/** Compare a stored term history with a freshly-loaded class list. */
export function diffGrades(termHistory, classes, term) {
  if (!termHistory || !classes) return []
  const changes = []
  for (const c of classes) {
    const entries = termHistory[courseKeyOf(c)]
    const prev = entries?.[entries.length - 1]
    if (!prev) continue
    const from = parseNum(prev.average)
    const to = parseNum(c.average ?? c.averages?.[term])
    const prevNames = new Set((prev.scores || []).map((s) => `${s.name}|${s.dateDue}`))
    const newAssignments = Array.isArray(c.scores) && prev.scores?.length
      ? c.scores.filter((s) => !prevNames.has(`${s.name}|${s.dateDue}`)).map((s) => s.name)
      : []
    const avgChanged = from !== null && to !== null && Math.abs(from - to) >= 0.005
    if (avgChanged || newAssignments.length) {
      changes.push({ key: courseKeyOf(c), name: c.name, from: avgChanged ? from : null, to: avgChanged ? to : null, newAssignments })
    }
  }
  return changes
}

/**
 * Fold freshly-detected changes into the ones still badged on screen: keep the
 * original "from" so the badge shows the total move, and accumulate new
 * assignments.
 */
export function mergeGradeChanges(existing, incoming) {
  const byKey = new Map((existing || []).map((c) => [c.key, c]))
  for (const c of incoming) {
    const prev = byKey.get(c.key)
    if (!prev) { byKey.set(c.key, c); continue }
    byKey.set(c.key, {
      ...c,
      from: prev.from ?? c.from,
      to: c.to ?? prev.to,
      newAssignments: [...new Set([...prev.newAssignments, ...c.newAssignments])],
    })
  }
  return [...byKey.values()]
}

/** Badge data for one class: average delta (or null) and new-assignment count. */
export function changeBadge(change) {
  if (!change) return null
  const delta = change.from !== null && change.to !== null ? change.to - change.from : null
  const newCount = change.newAssignments?.length || 0
  if ((delta === null || Math.abs(delta) < 0.005) && !newCount) return null
  return { delta: delta !== null && Math.abs(delta) >= 0.005 ? delta : null, newCount }
}

// ---- Bell schedule -------------------------------------------------------

/** Minutes since midnight from "7:25 AM" or "13:05". */
export function parseClock(str) {
  if (!str) return null
  const m = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s*$/i.exec(str)
  if (!m) return null
  let h = parseInt(m[1])
  const min = parseInt(m[2])
  const ampm = m[3]?.toUpperCase()
  if (ampm === 'PM' && h !== 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return h * 60 + min
}

/** Current and next period for a bell schedule at `now`. */
export function periodStatus(schedule, now = new Date()) {
  if (!schedule?.periods?.length) return null
  const t = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  const periods = schedule.periods
    .map((p) => ({ ...p, start: parseClock(p.startTime), end: parseClock(p.endTime) }))
    .filter((p) => p.start !== null && p.end !== null)
    .sort((a, b) => a.start - b.start)
  const current = periods.find((p) => t >= p.start && t < p.end) || null
  const next = periods.find((p) => p.start > t) || null
  return {
    current,
    next,
    minutesLeft: current ? Math.ceil(current.end - t) : null,
    minutesUntilNext: next ? Math.ceil(next.start - t) : null,
    progress: current ? (t - current.start) / (current.end - current.start) : null,
  }
}
