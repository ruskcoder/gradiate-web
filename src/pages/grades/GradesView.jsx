import React, { useMemo, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { RingGradeStat, CategoryGradeStat, CategoryGradeList } from '@/components/custom/grades-stats'
import { ClassGradesItem, ClassGradesList } from '@/components/custom/grades-item'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { useCurrentUser } from '@/lib/store'
export function GradesView({ selectedGrade, timeTravel = false, term }) {
  const currentUser = useCurrentUser()
  const location = useLocation()
  const [historyIndex, setHistoryIndex] = useState(0)

  const history = useMemo(() => {
    if (!currentUser || !term || !selectedGrade) return []
    const termHistory = currentUser.gradesStore?.history?.[term]
    if (!termHistory) return []

    const courseKey = `${selectedGrade.course}|${selectedGrade.name}`
    return termHistory[courseKey] || []
  }, [currentUser, term, selectedGrade])

  useEffect(() => {
    setHistoryIndex(0)
  }, [selectedGrade])

  useEffect(() => {
    if (timeTravel && location.state?.historyIndex !== undefined) {
      setHistoryIndex(location.state.historyIndex)
    }
  }, [timeTravel, location.state])

  const displayedGrade = useMemo(() => {
    if (!timeTravel || !selectedGrade || history.length === 0) {
      if (!selectedGrade) return selectedGrade
      // selectedGrade is already enriched with scores/categories by GradesLayout;
      // just resolve the shown average from the averages dict (Skyward) when
      // there's no single `average` field.
      const average = selectedGrade.average ?? selectedGrade.averages?.[term]
      return { ...selectedGrade, average }
    }

    const historyItem = history[historyIndex]
    if (!historyItem) return selectedGrade

    return {
      ...selectedGrade,
      average: historyItem.average,
      categories: historyItem.categories,
      scores: historyItem.scores,
    }
  }, [timeTravel, selectedGrade, history, historyIndex, term])

  const displayedTimestamp = useMemo(() => {
    if (!timeTravel || history.length === 0) {
      return null
    }

    const historyItem = history[historyIndex]
    if (!historyItem) return null

    const date = new Date(historyItem.loadedAt)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }, [timeTravel, history, historyIndex])

  // A semester (Skyward SM1/SM2) is a set of terms, each graded on its own
  // categories/assignments and then weighted-averaged into the semester grade.
  // Render that hierarchy — one card per term — instead of a flat "2ND - Major
  // Grade" soup. `groups` survives on the enriched grade (the flattener spreads it).
  const groups = displayedGrade?.groups && typeof displayedGrade.groups === 'object'
    ? displayedGrade.groups
    : null
  // Order the terms chronologically (1ST, 2ND, ... then exams), not by the map's
  // insertion order which comes back reversed.
  const termRank = (t) => {
    const m = /^(\d+)/.exec(t)
    if (m) return parseInt(m[1])
    if (/^EX/i.test(t)) return 90 + (parseInt((/\d+/.exec(t) || [])[0]) || 0)
    return 50
  }
  const groupNames = groups ? Object.keys(groups).sort((a, b) => termRank(a) - termRank(b)) : []
  const showGrouped = groupNames.length > 1 && !timeTravel

  // TimeTravel: compare the viewed snapshot with the latest one.
  const travelComparison = useMemo(() => {
    if (!timeTravel || history.length < 2) return null
    const then = history[historyIndex]
    const latest = history[history.length - 1]
    if (!then || !latest) return null
    const a = parseFloat(then.average)
    const b = parseFloat(latest.average)
    const thenNames = new Set((then.scores || []).map((s) => `${s.name}|${s.dateDue}`))
    const added = (latest.scores || []).filter((s) => !thenNames.has(`${s.name}|${s.dateDue}`)).length
    return {
      delta: Number.isFinite(a) && Number.isFinite(b) ? b - a : null,
      latest: Number.isFinite(b) ? b : null,
      added,
      isLatest: historyIndex === history.length - 1,
    }
  }, [timeTravel, history, historyIndex])

  if (!selectedGrade) {
    return (
      <p className="text-muted-foreground text-center h-full flex items-center justify-center max-h-[46px]">
        Select a grade to continue.
      </p>
    )
  }

  return (
    <>
      {timeTravel && (
        <Card className="gap-2 mb-4">
          <CardHeader>
            <CardTitle className='text-center'>
              {history.length === 1 && (
                <div className="flex flex-col gap-2">
                  <span className="text-muted-foreground">No History Available, Viewing: {displayedTimestamp || 'No data'}</span>
                </div>
              )}
              {history.length > 1 && (
                displayedTimestamp || 'Drag the slider to view a date'
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Slider
              value={[historyIndex]}
              onValueChange={(value) => setHistoryIndex(value[0])}
              max={Math.max(0, history.length - 1)}
              step={1}
              className={"w-full"}
              disabled={history.length === 0}
            />
            {history.length > 1 && (
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>{history.length} snapshots</span>
                {travelComparison && !travelComparison.isLatest && (
                  <span>
                    Since then:{' '}
                    {travelComparison.delta !== null && (
                      <span className={travelComparison.delta >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {travelComparison.delta >= 0 ? '+' : ''}{travelComparison.delta.toFixed(2)}
                      </span>
                    )}
                    {travelComparison.latest !== null && ` → ${travelComparison.latest.toFixed(2)} now`}
                    {travelComparison.added > 0 && ` · ${travelComparison.added} new assignment${travelComparison.added === 1 ? '' : 's'}`}
                  </span>
                )}
                {travelComparison?.isLatest && <span>Latest snapshot</span>}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <div className="flex gap-4 overflow-x-auto mb-4">
        <RingGradeStat grade={Number.isFinite(parseFloat(displayedGrade.average)) ? parseFloat(displayedGrade.average).toPrecision(4) : displayedGrade.average} />
        {!showGrouped && (
          <CategoryGradeList>
            {Object.entries(displayedGrade.categories || {}).map(([categoryName, categoryData]) => (
              <CategoryGradeStat
                key={categoryName}
                categoryData={{ category: categoryName, ...categoryData }}
              />
            ))}
          </CategoryGradeList>
        )}
      </div>

      {showGrouped ? (
        <div className="flex flex-col gap-4">
          {groupNames.map((groupName) => {
            const group = groups[groupName] || {}
            const weight = parseFloat(group.weight)
            const grade = group.grade
            return (
              <Card key={groupName} className="gap-3">
                <CardHeader className="pb-0">
                  <CardTitle className="flex items-center justify-between text-base font-semibold">
                    <span className="flex items-baseline gap-2">
                      {groupName}
                      {Number.isFinite(weight) && weight > 0 && (
                        <span className="text-xs font-normal text-muted-foreground">
                          {weight}% of semester
                        </span>
                      )}
                    </span>
                    {grade !== undefined && grade !== '' && (
                      <span className="tabular-nums">{grade}</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex gap-4 overflow-x-auto">
                    <CategoryGradeList>
                      {Object.entries(group.categories || {}).map(([categoryName, categoryData]) => (
                        <CategoryGradeStat
                          key={categoryName}
                          categoryData={{ category: categoryName, ...categoryData }}
                        />
                      ))}
                    </CategoryGradeList>
                  </div>
                  {(group.scores || []).length > 0 ? (
                    <ClassGradesList>
                      {group.scores.map((score, index) => (
                        <ClassGradesItem key={index} scoreData={score} />
                      ))}
                    </ClassGradesList>
                  ) : (
                    <p className="text-sm text-muted-foreground">No assignments recorded for this term.</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <ClassGradesList>
          {(displayedGrade.scores || []).map((score, index) => (
            <ClassGradesItem key={index} scoreData={score} />
          ))}
        </ClassGradesList>
      )}
    </>
  )
}

