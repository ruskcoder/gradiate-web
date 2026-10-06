import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useCurrentUser, useStore } from '@/lib/store'
import { categoryColor } from '@/components/custom/grades-stats'
import { gradeAndColor, displayGradeValue } from '@/components/custom/grades-item'
import { Spinner } from '@/components/ui/spinner'

const dueTime = (s) => {
  const t = Date.parse(s?.dateDue)
  return Number.isFinite(t) ? t : -Infinity
}

/**
 * Every assignment that showed up in this session's grade loads, newest first.
 * Reads both the still-badged changes and the ones whose class was already
 * opened, so a card doesn't vanish just because you looked at the class.
 */
function useNewGrades(classes) {
  const gradeChanges = useStore((s) => s.gradeChanges)
  const viewedGradeChanges = useStore((s) => s.viewedGradeChanges)

  return useMemo(() => {
    const namesByKey = new Map()
    for (const c of [...Object.values(viewedGradeChanges), ...gradeChanges]) {
      if (!c.newAssignments?.length) continue
      const names = namesByKey.get(c.key) || new Set()
      c.newAssignments.forEach((n) => names.add(n))
      namesByKey.set(c.key, names)
    }
    const out = []
    for (const cls of classes) {
      const names = namesByKey.get(cls.key)
      if (!names) continue
      cls.scores.forEach((s, i) => {
        if (names.has(s.name)) out.push({ id: `${cls.key}|${i}`, cls, score: s })
      })
    }
    return out.sort((a, b) => dueTime(b.score) - dueTime(a.score))
  }, [classes, gradeChanges, viewedGradeChanges])
}

function NewGradeCard({ cls, score }) {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const raw = score.percentage !== undefined && score.percentage !== null ? score.percentage : score.score
  const { grade, numericGrade, bgColor } = gradeAndColor(raw, score.badges, user?.hideColors ?? false)
  const shown = displayGradeValue(grade, numericGrade, user?.numberDisplay ?? 'decimal')
  // Letter display modes and the exempt "X" stay bare.
  const isPercent = /^-?\d+(\.\d+)?$/.test(shown)

  return (
    <button
      type="button"
      onClick={() => navigate('/grades', { state: { selectCourse: cls.key } })}
      title={`${score.name}${score.dateDue ? ` · ${score.dateDue}` : ''}`}
      className="shrink-0 w-56 text-left rounded-2xl border bg-card p-4 flex flex-col gap-2 hover:bg-accent transition-colors cursor-pointer"
    >
      <p className="font-semibold truncate">{cls.name}</p>
      <div className="flex items-center gap-2 min-w-0">
        <span className="size-6 rounded-md shrink-0" style={{ backgroundColor: categoryColor(score.category || '') }} />
        <span className="text-sm truncate">{score.category || 'Uncategorized'}</span>
      </div>
      <p className="text-4xl font-bold tabular-nums leading-tight" style={{ color: bgColor }}>
        {shown}{isPercent ? '%' : ''}
      </p>
      <p className="text-xs text-muted-foreground truncate">{score.name}</p>
    </button>
  )
}

/** Side-scrolling row of the grades that came in since this session started. */
export function NewGradesStrip({ classes, loading }) {
  const items = useNewGrades(classes)

  return (
    <div className="bg-card rounded-lg border p-4 flex flex-col gap-3 min-w-0">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Sparkles className="size-5 text-muted-foreground" />
        New Grades
        {items.length > 0 && <span className="text-sm font-normal text-muted-foreground">({items.length})</span>}
        {loading && <Spinner className="size-4 text-muted-foreground" />}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {loading ? 'Checking for new grades…' : 'No new grades since your last check.'}
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {items.map((it) => <NewGradeCard key={it.id} cls={it.cls} score={it.score} />)}
        </div>
      )}
    </div>
  )
}
