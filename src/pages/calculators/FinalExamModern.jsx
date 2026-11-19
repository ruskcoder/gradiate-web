import React from 'react'
import { ArrowRight, Calculator, Plus, RefreshCw, X } from 'lucide-react'
import { CLASSES_ENDPOINT } from '@/lib/constants'
import { getClasses } from '@/lib/grades-api'
import { getLatestGradesLoad, getInitialTerm, getTermList, getTermTree } from '@/lib/grades-store'
import { flatForest, pathToLabel } from '@/lib/term-tree'
import { useCurrentUser, useStore } from '@/lib/store'
import { gradeAndColor } from '@/components/custom/grades-item'
import { GradePillInput } from '@/components/custom/grade-pill-input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Label } from '@/components/ui/label'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { cn } from '@/lib/utils'
import {
  LETTER_TARGETS,
  buildSemesters,
  fmt,
  isAllInOne,
  mergeClassAverages,
  parseGrade,
  semesterFor,
  solve,
  termLabel,
} from '@/lib/final-exam-math'

// Shown before any grade data exists, so the calculator still works by hand.
const MANUAL_SEMESTER = { id: 'MANUAL', label: 'Semester', terms: ['1', '2'] }

const RED = '#ef4444'
const GREEN = '#22c55e'
const BLUE = '#3b82f6'
const YELLOW = '#eab308'

/** Every label in a term forest, roots included. */
function allLabels(forest) {
  const out = []
  const walk = (nodes) => nodes.forEach((n) => { out.push(n.label); walk(n.children || []) })
  walk(forest || [])
  return out
}

/** Saved grades, so the calculator fills in instantly before the live load. */
function readStored() {
  const initial = getInitialTerm()
  const storedList = getTermList()
  if (!initial || !storedList.length) return null
  const tree = getTermTree()
  const forest = tree?.length ? tree : flatForest(storedList)
  const path = pathToLabel(forest, initial)
  let byTerm = {}
  new Set([...storedList, ...allLabels(tree)]).forEach((label) => {
    const load = getLatestGradesLoad(label)
    if (load) byTerm = mergeClassAverages(byTerm, label, load.classes)
  })
  return {
    forest,
    termList: storedList,
    path: path.length ? path : [initial],
    byTerm,
    classes: getLatestGradesLoad(initial)?.classes || [],
  }
}

export default function FinalExamModern() {
  const user = useCurrentUser()
  const changeUserData = useStore((s) => s.changeUserData)
  const hideColors = user?.hideColors ?? false

  // ── Grade data ────────────────────────────────────────────────────────────
  const [stored] = React.useState(readStored)
  const [forest, setForest] = React.useState(stored?.forest ?? [])
  const [termList, setTermList] = React.useState(stored?.termList ?? [])
  const [currentPath, setCurrentPath] = React.useState(stored?.path ?? [])
  const [classes, setClasses] = React.useState(stored?.classes ?? [])
  const [byTerm, setByTerm] = React.useState(stored?.byTerm ?? {}) // { term: { course: average } }
  const [liveTerms, setLiveTerms] = React.useState(() => new Set())
  const [loadingTerms, setLoadingTerms] = React.useState({})
  const [initialLoading, setInitialLoading] = React.useState(true)
  const [allInOne, setAllInOne] = React.useState(false)
  const attemptedRef = React.useRef(new Set())
  const mountedRef = React.useRef(true)
  React.useEffect(() => () => { mountedRef.current = false }, [])

  // ── Calculator inputs ─────────────────────────────────────────────────────
  const [pickedCourse, setCourse] = React.useState('')
  const [semesterId, setSemesterId] = React.useState(null)
  // Edits and left-out terms are kept per class + semester, so switching class
  // shows that class's real grades and switching back restores your edits.
  const [excludedBy, setExcludedBy] = React.useState({}) // { ctx: [term] }
  const [overridesBy, setOverridesBy] = React.useState({}) // { ctx: { term: typed value } }
  const [finalInput, setFinalInput] = React.useState('')
  const [targetInput, setTargetInput] = React.useState('')
  const [lastTouched, setLastTouched] = React.useState('final') // 'final' | 'target'
  const [exempt, setExempt] = React.useState(false)
  const [focused, setFocused] = React.useState(null)
  const [weightInput, setWeightInput] = React.useState(String(user?.finalExamWeight ?? 15))

  const applyMeta = React.useCallback((tree, list, term) => {
    const f = tree?.length ? tree : flatForest(list)
    setForest(f)
    setTermList(list || [])
    const path = pathToLabel(f, term)
    setCurrentPath(path.length ? path : [term])
  }, [])

  // The live load refreshes whatever the saved grades filled in.
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        for await (const chunk of getClasses()) {
          if (cancelled) return
          if (chunk.success !== true) continue
          applyMeta(chunk.termTree, chunk.termList, chunk.term)
          setClasses(chunk.classes || [])
          setByTerm((prev) => mergeClassAverages(prev, chunk.term, chunk.classes))
          const whole = !!chunk.hasSubterms || isAllInOne(chunk.classes)
          setAllInOne(whole)
          setLiveTerms((prev) => {
            const next = new Set(prev)
            next.add(chunk.term)
            if (whole) Object.keys(chunk.classes?.[0]?.averages || {}).forEach((t) => next.add(t))
            return next
          })
        }
      } catch (err) {
        console.error('Final exam calculator: initial load failed', err)
      } finally {
        if (!cancelled) setInitialLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [applyMeta])

  // The picked class, or the first one until the user picks (or if it vanished).
  const course = classes.some((c) => c.course === pickedCourse) ? pickedCourse : (classes[0]?.course ?? '')

  const semesters = React.useMemo(() => buildSemesters(forest, termList), [forest, termList])
  const semester = React.useMemo(() => {
    if (!semesters.length) return MANUAL_SEMESTER
    return semesters.find((s) => s.id === semesterId) ?? semesterFor(semesters, currentPath)
  }, [semesters, semesterId, currentPath])

  // Load one term's grades. All-in-one portals return every term from a single
  // request, so for them this reloads everything. `fresh` skips the cache.
  const fetchTerm = React.useCallback(async (term, fresh = false) => {
    if (fresh) useStore.getState().invalidateCache(CLASSES_ENDPOINT)
    setLoadingTerms((p) => ({ ...p, [term]: true }))
    try {
      for await (const chunk of getClasses(allInOne ? undefined : term)) {
        if (!mountedRef.current) return
        if (chunk.success !== true) continue
        setByTerm((prev) => mergeClassAverages(prev, allInOne ? chunk.term : term, chunk.classes))
        setLiveTerms((prev) => new Set(prev).add(term))
      }
    } catch (err) {
      console.error(`Final exam calculator: failed to load term ${term}`, err)
    } finally {
      if (mountedRef.current) setLoadingTerms((p) => ({ ...p, [term]: false }))
    }
  }, [allInOne])

  // Quietly fetch the semester's other terms in the background. All-in-one
  // portals already sent every term, so there's nothing to fetch for them.
  React.useEffect(() => {
    if (initialLoading || allInOne || semester.id === MANUAL_SEMESTER.id) return
    const todo = semester.terms.filter((t) => !liveTerms.has(t) && !attemptedRef.current.has(t))
    if (!todo.length) return
    todo.forEach((t) => attemptedRef.current.add(t))
    // Not cancelled when deps change: each finished term updates `liveTerms`,
    // which re-runs this effect, and that must not abandon the rest of the queue.
    ;(async () => {
      for (const term of todo) await fetchTerm(term)
    })()
  }, [initialLoading, allInOne, semester, liveTerms, fetchTerm])

  const ctxKey = `${course}|${semester.id}`
  const overrides = overridesBy[ctxKey] ?? {}
  const excluded = new Set(excludedBy[ctxKey] ?? [])
  const setOverrides = (fn) => setOverridesBy((all) => ({ ...all, [ctxKey]: fn(all[ctxKey] ?? {}) }))

  // ── Derived values ────────────────────────────────────────────────────────
  const weight = parseFloat(weightInput)
  const fetchedRaw = (t) => {
    const n = parseGrade(byTerm[t]?.[course])
    return n === null ? '' : n.toFixed(2)
  }
  const rawTerm = (t) => (overrides[t] !== undefined ? overrides[t] : fetchedRaw(t))
  const isLoading = (t) => !!loadingTerms[t] || (initialLoading && !fetchedRaw(t) && overrides[t] === undefined)

  const activeTerms = semester.terms.filter((t) => !excluded.has(t))
  const termNums = activeTerms.map((t) => parseGrade(rawTerm(t)))
  const emptyIdx = activeTerms.map((t, i) => (termNums[i] === null ? i : -1)).filter((i) => i >= 0)
  const waitingOn = activeTerms.filter((t, i) => termNums[i] === null && isLoading(t))

  let auto
  if (emptyIdx.length) auto = emptyIdx[0]
  else if (exempt) auto = 'target'
  else auto = lastTouched === 'target' ? 'final' : 'target'

  const finalNum = parseGrade(finalInput)
  const targetNum = parseGrade(targetInput)
  const solveFor = (unknown, target = targetNum) =>
    emptyIdx.length > 1 || waitingOn.length
      ? null
      : solve({
          terms: termNums,
          final: unknown === 'final' ? null : finalNum,
          target: unknown === 'target' ? null : target,
          weight,
          exempt,
          unknown,
        })
  const result = solveFor(auto)

  const weightValid = Number.isFinite(weight) && weight >= 0 && weight < 100

  // A final exam grade you NEED reads the other way round: needing a 95 is
  // bad news (red), needing a 60 is easy (green).
  const neededColor = (value) => {
    const n = parseGrade(value)
    if (n === null || hideColors) return gradeAndColor(value, null, hideColors).bgColor
    if (n >= 90) return RED
    if (n >= 80) return YELLOW
    if (n >= 70) return BLUE
    return GREEN
  }

  // Terms allow a little extra credit: anything above 102 is out of reach (red).
  const termColor = (value, isAuto) => {
    const n = parseGrade(value)
    if (n !== null && n > 102 && !hideColors) return RED
    if (n !== null && n <= 102) return pillColor(String(Math.min(n, 100)), isAuto)
    return pillColor(value, isAuto)
  }

  // The semester average is colored by its rounded value: an 89.5 rounds up to
  // an A, so it shows green.
  const roundedColor = (value) => {
    const n = parseGrade(value)
    return pillColor(n === null ? value : String(Math.round(n)), false)
  }

  const pillColor = (value, isAuto) => {
    const n = parseGrade(value)
    if (isAuto && n !== null && !hideColors) {
      if (n > 100) return RED
      if (n < 0) return GREEN
    }
    return gradeAndColor(value, null, hideColors).bgColor
  }

  // ── Field handlers ────────────────────────────────────────────────────────
  const focusAuto = (field) => {
    setFocused(field)
    // Typing over a calculated value starts from blank, with the answer left
    // behind as the placeholder.
    if (field === 'final' && auto === 'final') setFinalInput('')
    if (field === 'target' && auto === 'target') setTargetInput('')
  }

  const setWeight = (v) => {
    if (v !== '' && !/^\d{0,2}(\.\d{0,2})?$/.test(v)) return
    setWeightInput(v)
    const n = parseFloat(v)
    if (Number.isFinite(n) && n >= 0 && n < 100) changeUserData('finalExamWeight', n)
  }

  // "Calculate This": make `field` ('final' | 'target' | a term) the one being
  // solved. Every value on screen is locked in first (including the current
  // answer), so exactly one field ends up blank.
  const calculateThis = (field) => {
    const autoTermKey = typeof auto === 'number' ? activeTerms[auto] : null
    const answer = fmt(result)
    const shownFinal = auto === 'final' ? answer : finalInput
    const shownTarget = auto === 'target' ? answer : targetInput
    setOverrides((p) => {
      const next = { ...p }
      if (autoTermKey && autoTermKey !== field) {
        if (answer) next[autoTermKey] = answer
        else delete next[autoTermKey]
      }
      if (field !== 'final' && field !== 'target') next[field] = ''
      return next
    })
    setFinalInput(field === 'final' ? '' : shownFinal)
    setTargetInput(field === 'target' ? '' : shownTarget)
    if (field === 'final') setLastTouched('target')
    if (field === 'target') setLastTouched('final')
  }

  const iconButton = (label, onClick, icon, disabled = false) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className="flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )

  // Refetch: drop any edit so the fresh grade shows, then reload the term.
  const refetchTerm = (t) => {
    setOverrides((p) => {
      const rest = { ...p }
      delete rest[t]
      return rest
    })
    fetchTerm(t, true)
  }

  // Turning a field's calculator off hands the job back to the semester
  // average (or, if that was the one, to the final).
  const stopCalculating = (field) => {
    if (field !== 'target') calculateThis('target')
    else if (!exempt) calculateThis('final')
  }

  const calcButton = (field, active) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          variant="outline"
          size="sm"
          aria-label="Calculate This"
          pressed={active}
          onPressedChange={(on) => (on ? calculateThis(field) : stopCalculating(field))}
          className={cn(
            'absolute inset-y-0 left-full my-auto ml-1.5 size-7 min-w-7 p-0',
            active ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <Calculator className="size-3.5" />
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>Calculate This</TooltipContent>
    </Tooltip>
  )

  const pickTarget = (target) => {
    setTargetInput(String(target))
    setLastTouched('target')
  }

  const toggleTerm = (t) =>
    setExcludedBy((all) => {
      const next = new Set(all[ctxKey] ?? [])
      if (next.has(t)) next.delete(t)
      else if (semester.terms.length - next.size > 1) next.add(t)
      return { ...all, [ctxKey]: [...next] }
    })

  // ── Rendering helpers ─────────────────────────────────────────────────────
  const displayFinal = auto === 'final' && focused !== 'final' ? fmt(result) : finalInput
  const displayTarget = auto === 'target' && focused !== 'target' ? fmt(result) : targetInput


  const classesLoading = initialLoading && !classes.length

  // Mean of the terms shown, for the "→ average" pill after them.
  const shownTermNums = activeTerms.map((t, i) => (i === auto ? parseGrade(fmt(result)) : termNums[i]))
  const termsMean = shownTermNums.every((v) => v !== null) && shownTermNums.length
    ? shownTermNums.reduce((a, b) => a + b, 0) / shownTermNums.length
    : null

  const panelHeader = (title) => (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <div className="flex-1 py-1 text-center text-sm font-medium text-muted-foreground">{title}</div>
    </div>
  )

  return (
    <TooltipProvider>
    <ResizablePanelGroup direction="horizontal" className="space-x-2">
      {/* Left: the class and its term grades */}
      <ResizablePanel className="flex min-w-[360px] flex-col rounded-xl border bg-card">
        {panelHeader('Grades')}

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          {/* Class picker: each chip carries its current average */}
          {(classesLoading || classes.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {classesLoading
                ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-36 rounded-lg" />)
                : classes.map((c) => {
                    const avg = byTerm[currentPath.at(-1)]?.[c.course] ?? c.average
                    const { grade, bgColor } = gradeAndColor(avg, null, hideColors)
                    const selected = c.course === course
                    return (
                      <button
                        key={c.course}
                        type="button"
                        onClick={() => setCourse(c.course)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border py-1.5 pl-3 pr-1.5 text-sm font-medium transition-colors hover:bg-accent',
                          selected ? 'border-primary' : 'border-border'
                        )}
                      >
                        <span className="max-w-[180px] truncate">{c.name || c.course}</span>
                        <span
                          className="rounded-sm px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white"
                          style={{ backgroundColor: bgColor }}
                        >
                          {grade}
                        </span>
                      </button>
                    )
                  })}
            </div>
          )}

          {semesters.length > 1 && (
            <Tabs value={semester.id} onValueChange={setSemesterId} className="w-full">
              <TabsList className="w-full">
                {semesters.map((s) => (
                  <TabsTrigger key={s.id} value={s.id}>
                    {s.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {/* Term pills, then their average */}
          <div className="flex flex-wrap items-end justify-center gap-x-12 gap-y-4">
            {semester.terms.map((t) => {
              const off = excluded.has(t)
              const idx = activeTerms.indexOf(t)
              const isAuto = !off && idx === auto
              const value = isAuto && focused !== t ? fmt(result) : rawTerm(t)
              return (
                <div key={t} className="flex flex-col items-center gap-1.5">
                  <div className="flex h-5 items-center gap-1.5 text-xs font-medium">
                    {iconButton(
                      off ? 'Include this term' : 'Leave this term out',
                      () => toggleTerm(t),
                      off ? <Plus className="size-3.5" /> : <X className="size-3.5" />,
                      !off && activeTerms.length <= 1
                    )}
                    <span
                      className={cn(
                        isAuto ? 'text-primary' : 'text-muted-foreground',
                        off && 'line-through opacity-40'
                      )}
                    >
                      {termLabel(t)}
                    </span>
                    {semester.id !== MANUAL_SEMESTER.id &&
                      iconButton(
                        'Refetch this term',
                        () => refetchTerm(t),
                        <RefreshCw className={cn('size-3', loadingTerms[t] && 'animate-spin')} />,
                        off || !!loadingTerms[t]
                      )}
                  </div>
                  <div className={cn('relative', off && 'opacity-40')}>
                    <GradePillInput
                      aria-label={termLabel(t)}
                      value={value}
                      disabled={off}
                      loading={isLoading(t)}
                      computed={isAuto}
                      placeholder={isAuto && focused === t ? fmt(result) || '···' : '···'}
                      color={termColor(value || (isAuto ? fmt(result) : ''), isAuto)}
                      onFocus={() => setFocused(t)}
                      onBlur={() => setFocused(null)}
                      onChange={(v) => setOverrides((p) => ({ ...p, [t]: v }))}
                    />
                    {!off && calcButton(t, isAuto)}
                  </div>
                </div>
              )
            })}

            <div
              className={cn(
                'flex h-11 items-center',
                !excluded.has(semester.terms[semester.terms.length - 1]) && 'ml-[34px]'
              )}
            >
              <ArrowRight className="size-5 text-muted-foreground" />
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <div className="flex h-5 items-center text-xs font-medium text-muted-foreground">Average</div>
              <span
                className="flex h-11 w-[96px] items-center justify-center rounded-sm border-2 border-transparent text-[1.4rem] font-semibold tracking-wide text-white tabular-nums transition-[background-color] duration-300"
                style={{ backgroundColor: gradeAndColor(fmt(termsMean), null, hideColors).bgColor }}
              >
                {fmt(termsMean) || '···'}
              </span>
            </div>
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle className="bg-border hover:bg-accent/50" />

      {/* Right: exempt, the final, the semester average */}
      <ResizablePanel className="flex min-w-[360px] flex-col rounded-xl border bg-card">
        {panelHeader('Calculate')}

        <div className="flex flex-1 flex-col items-center gap-8 overflow-y-auto p-6">
          <div className="flex items-center gap-2 self-start">
            <Switch id="exempting" checked={exempt} onCheckedChange={setExempt} />
            <Label htmlFor="exempting" className="cursor-pointer font-medium">
              Exempting
            </Label>
          </div>

          {!exempt && (
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex h-5 items-center gap-1 text-xs font-medium text-muted-foreground">
                <span className={cn(auto === 'final' && 'text-primary')}>Final</span>
                <input
                  aria-label="Final exam weight"
                  inputMode="decimal"
                  value={weightInput}
                  onChange={(e) => setWeight(e.target.value.trim())}
                  className={cn(
                    'w-8 rounded border bg-transparent text-center tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    !weightValid && 'border-destructive text-destructive'
                  )}
                />
                <span>% weight</span>
              </div>
              <div className="relative">
                <GradePillInput
                  aria-label="Final exam grade"
                  value={displayFinal}
                  computed={auto === 'final'}
                  placeholder={auto === 'final' && focused === 'final' ? fmt(result) || '···' : '···'}
                  color={
                    auto === 'final'
                      ? neededColor(displayFinal || fmt(result))
                      : pillColor(displayFinal, false)
                  }
                  onFocus={() => focusAuto('final')}
                  onBlur={() => setFocused(null)}
                  onChange={(v) => {
                    setFinalInput(v)
                    setLastTouched('final')
                  }}
                />
                {calcButton('final', auto === 'final')}
              </div>
            </div>
          )}

          {/* Semester average, with A/B/C goal shortcuts */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-7 items-center gap-2">
              <span className={cn('text-sm font-medium', auto === 'target' ? 'text-primary' : 'text-muted-foreground')}>
                Semester Average
              </span>
              {LETTER_TARGETS.map((l) => {
                // The semester average is the answer right now, so a goal
                // can't be typed into it.
                const locked = auto === 'target'
                const color = gradeAndColor(l.color, null, hideColors).bgColor
                const button = (
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => pickTarget(l.target)}
                    title={locked ? undefined : `Goal: ${l.target}`}
                    className={cn(
                      'flex size-7 items-center justify-center rounded-sm border-2 text-sm font-bold text-white transition-colors',
                      locked ? 'pointer-events-none bg-gray-400 opacity-50' : 'hover:brightness-95'
                    )}
                    style={{
                      backgroundColor: locked ? undefined : color,
                      borderColor:
                        !locked && targetNum === l.target
                          ? `color-mix(in srgb, ${color} 55%, black)`
                          : 'transparent',
                    }}
                  >
                    {l.letter}
                  </button>
                )
                if (!locked) return <React.Fragment key={l.letter}>{button}</React.Fragment>
                // A disabled button fires no hover events, so the tooltip hangs off a wrapper.
                return (
                  <Tooltip key={l.letter}>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="cursor-not-allowed rounded-sm">{button}</span>
                    </TooltipTrigger>
                    <TooltipContent>Cannot set a value that is being calculated</TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
            <div className="relative">
              <GradePillInput
                size="lg"
                aria-label="Semester average"
                value={displayTarget}
                computed={auto === 'target'}
                placeholder={auto === 'target' && focused === 'target' ? fmt(result) || '···' : '···'}
                color={roundedColor(displayTarget || (auto === 'target' ? fmt(result) : ''))}
                onFocus={() => focusAuto('target')}
                onBlur={() => setFocused(null)}
                onChange={(v) => {
                  setTargetInput(v)
                  setLastTouched('target')
                }}
              />
              {calcButton('target', auto === 'target')}
            </div>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
    </TooltipProvider>
  )
}
