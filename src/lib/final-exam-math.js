/**
 * Pure helpers behind the Final Exam calculator: grouping terms into semesters,
 * pulling one class's per-term averages out of a classes payload, and solving
 * the semester formula for whichever field is unknown.
 *
 *   semester = mean(terms) * (100 - weight)/100 + final * weight/100
 *   (exempt: semester = mean(terms))
 *
 * Mirrored in gradexis-mobile/lib/final-exam-math.ts — keep the two in sync.
 */

/** Rounded letter cutoffs: an 89.5 rounds up to an A. */
export const LETTER_TARGETS = [
  { letter: 'A', target: 89.5, color: 90 },
  { letter: 'B', target: 79.5, color: 80 },
  { letter: 'C', target: 69.5, color: 70 },
]

/** "1" → "Term 1"; portal labels like "Q1" stay as they are. */
export function termLabel(term) {
  return /^\d+$/.test(String(term)) ? `Term ${term}` : String(term)
}

/**
 * The semesters to offer, each a `{ id, label, terms }`. With a term tree the
 * roots that have (non-group) children are the semesters. A flat term list
 * (HAC: 1–4 or 1–6) is split down the middle; an odd count stays one group.
 */
export function buildSemesters(forest, termList) {
  const fromTree = (forest || [])
    .map((root) => {
      const kids = (root.children || []).filter((c) => !c.group).map((c) => c.label)
      return kids.length ? { id: root.label, label: root.label, terms: kids } : null
    })
    .filter(Boolean)
  if (fromTree.length) return fromTree

  const list = termList || []
  if (list.length >= 2 && list.length % 2 === 0) {
    const half = list.length / 2
    return [
      { id: 'S1', label: 'Semester 1', terms: list.slice(0, half) },
      { id: 'S2', label: 'Semester 2', terms: list.slice(half) },
    ]
  }
  return list.length ? [{ id: 'ALL', label: 'All terms', terms: list }] : []
}

/**
 * The semester containing the current term, else the first one. `path` is the
 * root→term label path (a lone `[term]` for flat portals), so a deep leaf like
 * a progress report still lands in its semester.
 */
export function semesterFor(semesters, path) {
  return (
    semesters.find((s) => path.includes(s.id) || path.some((p) => s.terms.includes(p))) ??
    semesters[0] ??
    null
  )
}

/**
 * Merge a classes payload into `byTerm` ({ [term]: { [course]: average } }).
 * All-in-one portals carry an `averages` dict with every term at once; per-term
 * portals only answer for the term that was loaded.
 */
export function mergeClassAverages(byTerm, term, classes) {
  const next = { ...byTerm }
  const put = (t, course, avg) => {
    next[t] = { ...(next[t] || {}), [course]: avg }
  }
  for (const c of classes || []) {
    if (c.averages && typeof c.averages === 'object') {
      for (const label of Object.keys(c.averages)) put(label, c.course, c.averages[label])
    } else {
      put(term, c.course, c.average)
    }
  }
  return next
}

/** True when a payload already holds every term (no per-term fetches needed). */
export function isAllInOne(classes) {
  return !!classes?.some((c) => c.averages && typeof c.averages === 'object')
}

export function parseGrade(v) {
  if (v === null || v === undefined || v === '') return null
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Solve for `unknown` ('final' | 'target' | index of a term). `terms` holds a
 * number or null per term; the unknown term's own slot is ignored. Returns null
 * when something it needs is missing.
 */
export function solve({ terms, final, target, weight, exempt, unknown }) {
  const n = terms.length
  if (n === 0) return null
  const w = exempt ? 0 : weight
  if (!exempt && (!Number.isFinite(w) || w < 0 || w >= 100)) return null

  if (typeof unknown === 'number') {
    if (target === null) return null
    if (!exempt && final === null) return null
    const others = terms.filter((_, i) => i !== unknown)
    if (others.some((v) => v === null)) return null
    const neededMean = exempt ? target : (target * 100 - final * w) / (100 - w)
    return neededMean * n - others.reduce((a, b) => a + b, 0)
  }

  if (terms.some((v) => v === null)) return null
  const mean = terms.reduce((a, b) => a + b, 0) / n

  if (unknown === 'target') {
    if (exempt) return mean
    if (final === null) return null
    return (mean * (100 - w) + final * w) / 100
  }

  // unknown === 'final'
  if (exempt || target === null || w === 0) return null
  return (target * 100 - mean * (100 - w)) / w
}

/** Format a solved number for a pill. */
export function fmt(n) {
  return n === null || n === undefined || !Number.isFinite(n) ? '' : n.toFixed(2)
}
