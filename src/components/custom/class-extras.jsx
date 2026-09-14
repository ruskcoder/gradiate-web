import { useEffect, useMemo, useState } from 'react'
import { useCurrentUser, useStore } from '@/lib/store'
import { goalPlan, parseNum } from '@/lib/insights'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Target, NotebookPen } from 'lucide-react'

/** Goal target + per-class notes shown under a selected class on the Grades page. */
export function ClassExtras({ grade }) {
  const user = useCurrentUser()
  const changeUserData = useStore((s) => s.changeUserData)
  const key = `${grade.course}|${grade.name}`
  const goal = user?.goals?.[key]
  const [goalInput, setGoalInput] = useState(goal ?? '')
  const [note, setNote] = useState(user?.classNotes?.[key] ?? '')

  useEffect(() => {
    setGoalInput(user?.goals?.[key] ?? '')
    setNote(user?.classNotes?.[key] ?? '')
    // Only reset when switching classes, not on every store write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const saveGoal = (v) => {
    const goals = { ...(user.goals || {}) }
    const n = parseFloat(v)
    if (Number.isFinite(n)) goals[key] = n
    else delete goals[key]
    changeUserData('goals', goals)
    setGoalInput(Number.isFinite(n) ? n : '')
  }

  const saveNote = () => {
    const notes = { ...(user.classNotes || {}) }
    if (note.trim()) notes[key] = note
    else delete notes[key]
    changeUserData('classNotes', notes)
  }

  const average = parseNum(grade.average)
  const plan = useMemo(
    () => (goal !== undefined ? goalPlan(grade, goal).slice(0, 3) : []),
    [grade, goal]
  )

  return (
    <div className="grid gap-4 mb-4 md:grid-cols-2">
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base flex items-center gap-2"><Target className="size-4" /> Goal</CardTitle>
        </CardHeader>
        <CardContent className="px-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              type="number"
              className="h-8"
              placeholder="Target average"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveGoal(goalInput)}
            />
            <Button size="sm" variant="outline" onClick={() => saveGoal('89.5')}>A</Button>
            <Button size="sm" variant="outline" onClick={() => saveGoal('79.5')}>B</Button>
            <Button size="sm" onClick={() => saveGoal(goalInput)}>Set</Button>
          </div>
          {goal === undefined ? (
            <p className="text-xs text-muted-foreground">Set a target to see what you need on upcoming work.</p>
          ) : average !== null && average >= goal ? (
            <p className="text-sm text-green-600">On track — {average.toFixed(2)} ≥ {goal}.</p>
          ) : plan.length ? (
            <div className="text-sm space-y-1">
              {average !== null && <p className="text-red-600">{(goal - average).toFixed(2)} below goal.</p>}
              {plan.map((p) => (
                <p key={p.category}>
                  Next <span className="font-medium">{p.category}</span>:{' '}
                  <span className={`font-semibold tabular-nums ${p.needed > 100 ? 'text-red-600' : ''}`}>
                    {p.needed > 100 ? `${p.needed.toFixed(1)}% (not reachable with one)` : `${Math.max(0, p.needed).toFixed(1)}%`}
                  </span>
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No category data for this class yet.</p>
          )}
          {goal !== undefined && (
            <Button size="sm" variant="ghost" className="self-start px-0 h-6" onClick={() => saveGoal('')}>Clear goal</Button>
          )}
        </CardContent>
      </Card>
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base flex items-center gap-2"><NotebookPen className="size-4" /> Notes</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
            placeholder="Test dates, teacher preferences, reminders…"
            className="w-full min-h-[92px] rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 resize-y"
          />
          <p className="text-xs text-muted-foreground mt-1">Saved on this device when you click away.</p>
        </CardContent>
      </Card>
    </div>
  )
}
