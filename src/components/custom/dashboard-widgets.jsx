import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Bell, Target, AlertTriangle, GraduationCap } from 'lucide-react'
import { useCurrentUser, useStore } from '@/lib/store'
import { formatGrade } from '@/lib/grade-display'
import { getTranscript } from '@/lib/grades-api'
import {
  getMissingAssignments,
  periodStatus,
  projectGpa,
  combineWithTranscript,
  defaultGpaType,
} from '@/lib/insights'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function Widget({ title, icon: Icon, action, children, className = '' }) {
  return (
    <div className={`bg-card rounded-lg shadow border p-5 flex flex-col gap-3 min-w-0 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          {Icon && <Icon className="size-5 text-muted-foreground" />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function Empty({ children }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

export function GpaWidget({ classes }) {
  const user = useCurrentUser()
  const [transcript, setTranscript] = useState(null)
  const [loading, setLoading] = useState(false)
  const gpaType = defaultGpaType(user)
  const weighted = useMemo(() => projectGpa(user, classes, gpaType), [user, classes, gpaType])
  const unweighted = useMemo(() => projectGpa(user, classes, 'unweighted'), [user, classes])

  const loadTranscript = async () => {
    setLoading(true)
    try {
      const data = await getTranscript()
      const t = data?.transcriptData || {}
      let courses = 0
      for (const [k, sem] of Object.entries(t)) {
        if (['rank', 'quartile', 'Weighted GPA*', 'Unweighted GPA*'].includes(k)) continue
        courses += Math.max(0, (sem?.data?.length || 1) - 1)
      }
      setTranscript({
        weighted: parseFloat(t['Weighted GPA*']) || null,
        unweighted: parseFloat(t['Unweighted GPA*']) || null,
        courses,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const cumulative = transcript
    ? combineWithTranscript(transcript.weighted, transcript.courses, weighted)
    : null

  return (
    <Widget title="GPA Projection" icon={GraduationCap}>
      {!weighted ? (
        <Empty>Load your grades once to see a projection.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">This term (weighted)</p>
              <p className="text-3xl font-bold tabular-nums">{weighted.gpa.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">This term (unweighted)</p>
              <p className="text-3xl font-bold tabular-nums">{unweighted ? unweighted.gpa.toFixed(3) : '—'}</p>
            </div>
          </div>
          {cumulative !== null ? (
            <p className="text-sm">
              Cumulative if grades hold: <span className="font-semibold tabular-nums">{cumulative.toFixed(4)}</span>
              <span className="text-muted-foreground"> (transcript {transcript.weighted?.toFixed(4)})</span>
            </p>
          ) : (
            <Button variant="outline" size="sm" onClick={loadTranscript} disabled={loading}>
              {loading ? 'Loading transcript…' : 'Include transcript for cumulative GPA'}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Based on {weighted.count} classes. Course types come from the GPA/Rank calculator.
          </p>
        </>
      )}
    </Widget>
  )
}

function GoalEditor({ cls, goal }) {
  const changeUserData = useStore((s) => s.changeUserData)
  const user = useCurrentUser()
  const [value, setValue] = useState(goal ?? '')
  const save = (v) => {
    const goals = { ...(user.goals || {}) }
    const n = parseFloat(v)
    if (Number.isFinite(n)) goals[cls.key] = n
    else delete goals[cls.key]
    changeUserData('goals', goals)
  }
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Goal for {cls.name}</p>
      <div className="flex gap-2">
        <Input type="number" placeholder="e.g. 90" value={value} onChange={(e) => setValue(e.target.value)} className="h-8" />
        <Button size="sm" onClick={() => save(value)}>Save</Button>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => { setValue('89.5'); save('89.5') }}>A</Button>
        <Button size="sm" variant="outline" onClick={() => { setValue('79.5'); save('79.5') }}>B</Button>
        <Button size="sm" variant="ghost" onClick={() => { setValue(''); save('') }}>Clear</Button>
      </div>
    </div>
  )
}

export function ClassesWidget({ classes }) {
  const user = useCurrentUser()
  const goals = user?.goals || {}
  const numberDisplay = user?.numberDisplay || 'decimal'

  return (
    <Widget
      title="Classes"
      icon={Target}
      action={<Link to="/grades" className="text-sm text-muted-foreground hover:underline">Open grades</Link>}
    >
      {classes.length === 0 ? (
        <Empty>No stored grades yet — open Grades or press Refresh.</Empty>
      ) : (
        <div className="flex flex-col divide-y">
          {classes.map((cls) => {
            const goal = goals[cls.key]
            const belowGoal = goal !== undefined && cls.average !== null && cls.average < goal
            const atRisk = cls.average !== null && cls.average < 70
            return (
              <div key={cls.key} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate flex items-center gap-1">
                    {(atRisk || belowGoal) && <AlertTriangle className="size-4 text-red-500 shrink-0" />}
                    {cls.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{cls.course}</p>
                </div>
                {cls.delta !== null && (
                  <span className={`flex items-center text-xs tabular-nums ${cls.delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {cls.delta > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                    {Math.abs(cls.delta).toFixed(2)}
                  </span>
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={`text-xs rounded px-2 py-1 border tabular-nums ${belowGoal ? 'border-red-400 text-red-600' : 'text-muted-foreground'}`}
                      title="Set goal"
                    >
                      {goal !== undefined ? `Goal ${goal}` : 'Set goal'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64">
                    <GoalEditor cls={cls} goal={goal} />
                  </PopoverContent>
                </Popover>
                <span className="font-semibold tabular-nums w-14 text-right">{formatGrade(cls.average, numberDisplay)}</span>
              </div>
            )
          })}
        </div>
      )}
    </Widget>
  )
}

export function BellWidget() {
  const user = useCurrentUser()
  const changeUserData = useStore((s) => s.changeUserData)
  const [now, setNow] = useState(() => new Date())
  const schedules = user?.bellSchedules || []
  const active = schedules.find((s) => s.name === user?.activeBellSchedule) || schedules[0]

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const status = active ? periodStatus(active, now) : null

  return (
    <Widget title="Bell Schedule" icon={Bell}>
      {schedules.length === 0 ? (
        <Empty>No bell schedules. Add one on the <Link className="underline" to="/academics/schedules">Schedules</Link> page.</Empty>
      ) : (
        <>
          <Select value={active?.name} onValueChange={(v) => changeUserData('activeBellSchedule', v)}>
            <SelectTrigger className="h-8 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {schedules.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {status?.current ? (
            <div className="space-y-2">
              <p className="text-2xl font-bold">{status.current.name}</p>
              <Progress value={Math.round((status.progress || 0) * 100)} />
              <p className="text-sm text-muted-foreground">
                {status.minutesLeft} min left
                {status.next && ` · next: ${status.next.name} at ${status.next.startTime}`}
              </p>
            </div>
          ) : status?.next ? (
            <p className="text-sm">
              <span className="font-semibold">{status.next.name}</span> starts in {status.minutesUntilNext} min ({status.next.startTime})
            </p>
          ) : (
            <Empty>No more periods today.</Empty>
          )}
        </>
      )}
    </Widget>
  )
}

export function MissingWidget({ classes }) {
  const missing = useMemo(() => getMissingAssignments(classes), [classes])
  return (
    <Widget
      title="Missing Work"
      icon={AlertTriangle}
      action={<Link to="/statistics/missing" className="text-sm text-muted-foreground hover:underline">View all</Link>}
    >
      {missing.length === 0 ? (
        <Empty>Nothing missing in stored grades. 🎉</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {missing.slice(0, 5).map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{m.name}</p>
                <p className="text-xs text-muted-foreground truncate">{m.className} · {m.reason}</p>
              </div>
              {m.gain !== null && (
                <span className="text-xs font-semibold text-green-600 tabular-nums shrink-0">+{m.gain.toFixed(2)}</span>
              )}
            </div>
          ))}
          {missing.length > 5 && <p className="text-xs text-muted-foreground">+{missing.length - 5} more</p>}
        </div>
      )}
    </Widget>
  )
}
