import { useMemo, useState } from 'react'
import { useCurrentUser, useStore } from '@/lib/store'
import { goalPlan, parseNum } from '@/lib/insights'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Target, NotebookPen } from 'lucide-react'

const keyOf = (grade) => `${grade.course}|${grade.name}`

function HeaderButton({ icon: Icon, title, active }) {
  return (
    <Button size="sm" variant="outline" className="h-7 w-7 p-0 relative" title={title}>
      <Icon size={16} />
      {active && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary" />}
    </Button>
  )
}

function GoalBody({ grade }) {
  const user = useCurrentUser()
  const changeUserData = useStore((s) => s.changeUserData)
  const key = keyOf(grade)
  const goal = user?.goals?.[key]
  const [input, setInput] = useState(goal ?? '')

  const save = (v) => {
    const goals = { ...(user.goals || {}) }
    const n = parseFloat(v)
    if (Number.isFinite(n)) goals[key] = n
    else delete goals[key]
    changeUserData('goals', goals)
    setInput(Number.isFinite(n) ? n : '')
  }

  const average = parseNum(grade.average)
  const plan = useMemo(
    () => (goal !== undefined ? goalPlan(grade, goal).slice(0, 3) : []),
    [grade, goal]
  )

  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium flex items-center gap-2"><Target size={16} /> Goal</p>
      <div className="flex gap-2">
        <Input
          type="number"
          className="h-8"
          placeholder="Target average"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save(input)}
        />
        <Button size="sm" onClick={() => save(input)}>Set</Button>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => save('89.5')}>A</Button>
        <Button size="sm" variant="outline" onClick={() => save('79.5')}>B</Button>
        {goal !== undefined && <Button size="sm" variant="ghost" onClick={() => save('')}>Clear</Button>}
      </div>
      {goal === undefined ? (
        <p className="text-xs text-muted-foreground">Set a target to see what you need on upcoming work.</p>
      ) : average !== null && average >= goal ? (
        <p className="text-sm text-green-600">On track: {average.toFixed(2)} ≥ {goal}.</p>
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
    </div>
  )
}

function NotesBody({ grade }) {
  const user = useCurrentUser()
  const changeUserData = useStore((s) => s.changeUserData)
  const key = keyOf(grade)
  const [note, setNote] = useState(user?.classNotes?.[key] ?? '')

  // Closing the popover blurs the textarea first, so saving on blur is enough.
  const save = () => {
    const notes = { ...(user.classNotes || {}) }
    if (note.trim()) notes[key] = note
    else delete notes[key]
    changeUserData('classNotes', notes)
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium flex items-center gap-2"><NotebookPen size={16} /> Notes</p>
      <textarea
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={save}
        placeholder="Test dates, teacher preferences, reminders…"
        className="w-full min-h-[120px] rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 resize-y"
      />
      <p className="text-xs text-muted-foreground">Saved on this device.</p>
    </div>
  )
}

/** Goal + Notes popover buttons for the selected class's title bar. */
export function ClassHeaderActions({ grade }) {
  const user = useCurrentUser()
  const key = keyOf(grade)
  return (
    <div className="flex gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <span><HeaderButton icon={Target} title="Goal" active={user?.goals?.[key] !== undefined} /></span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <GoalBody key={key} grade={grade} />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <span><HeaderButton icon={NotebookPen} title="Notes" active={!!user?.classNotes?.[key]} /></span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <NotesBody key={key} grade={grade} />
        </PopoverContent>
      </Popover>
    </div>
  )
}
