import React, { useMemo } from 'react'
import { ClassGradesList, ClassGradesItem, GradesItem, GradesList } from '@/components/custom/grades-item'
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { useCurrentUser } from '@/lib/store'

export const ImpactsPage = ({ selectedGrade, term }) => {
  const currentUser = useCurrentUser();

  const historyData = useMemo(() => {
    if (!selectedGrade || !currentUser || !term) return null;

    const gradesStore = currentUser.gradesStore || {};
    const termHistory = gradesStore.history?.[term] || {};

    const courseKey = `${selectedGrade.course}|${selectedGrade.name}`;
    const courseHistory = termHistory[courseKey] || [];

    if (courseHistory.length === 0) return null;

    return courseHistory.map((entry) => {
      const loadDate = new Date(entry.loadedAt).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).replace(/,/, '');

      return {
        time: loadDate,
        timestamp: entry.loadedAt,
        Average: parseFloat(entry.average) || 0,
      };
    });
  }, [selectedGrade, currentUser, term]);

  const recalculateGrades = (categories, scores) => {
    const updatedCategories = { ...categories }

    Object.keys(updatedCategories).forEach((categoryName) => {
      const categoryScores = scores.filter(s => {
        if (s.category !== categoryName) return false
        const scoreVal = parseFloat(s.score)
        // Exempt work is left out of the average just like dropped work.
        const isExemptOrDropped = s.badges && (s.badges.includes('dropped') || s.badges.includes('exempt'))
        return !isNaN(scoreVal) && s.score !== '···' && s.score !== '' && !s.excluded && !isExemptOrDropped
      })

      let totalWeightedStudentPoints = 0
      let totalWeightedMaxPoints = 0

      if (categoryScores.length > 0) {
        categoryScores.forEach(s => {
          const weight = parseFloat(s.weight) || 1
          const studentPoints = parseFloat(s.score) || 0
          const maxPoints = parseFloat(s.totalPoints) || 0

          totalWeightedStudentPoints += studentPoints * weight
          totalWeightedMaxPoints += maxPoints * weight
        })
      }

      const percentValue = totalWeightedMaxPoints > 0 ? (totalWeightedStudentPoints / totalWeightedMaxPoints) * 100 : 0

      updatedCategories[categoryName] = {
        ...updatedCategories[categoryName],
        percent: percentValue.toFixed(3),
        studentsPoints: totalWeightedStudentPoints.toFixed(4),
        maximumPoints: totalWeightedMaxPoints.toFixed(2),
      }
    })

    let weightedSum = 0
    let totalWeight = 0

    Object.values(updatedCategories).forEach((cat) => {
      const hasAssignments = parseFloat(cat.maximumPoints) > 0
      if (hasAssignments) {
        const weight = parseFloat(cat.categoryWeight) || 1
        const percent = parseFloat(cat.percent) || 0
        weightedSum += percent * weight
        totalWeight += weight
      }
    })

    const average = totalWeight > 0 ? weightedSum / totalWeight : 0

    return { categories: updatedCategories, average }
  }

  const gradeImpacts = useMemo(() => {
    if (!selectedGrade) return []

    const originalCategories = selectedGrade.categories || {}
    const originalScores = selectedGrade.scores || []
    // The baseline has to come from the SAME math as the "with this assignment
    // removed" recompute below. Using the portal-reported average instead
    // offset every single impact by a constant (portal average − locally
    // computed average), which is often a few tenths.
    const { average: baselineAverage } = recalculateGrades(originalCategories, originalScores)

    return originalScores.map((score, idx) => {
      const isExemptOrDropped = score.badges && (score.badges.includes('dropped') || score.badges.includes('exempt'))
      const isExcluded = score.excluded

      if (isExemptOrDropped || isExcluded) {
        return {
          ...score,
          impactBadge: 0,
        }
      }

      const scoresWithoutThis = originalScores.filter((_, i) => i !== idx)

      const { average: newAverage } = recalculateGrades(originalCategories, scoresWithoutThis)

      const impact = baselineAverage - newAverage

      return {
        ...score,
        impactBadge: impact,
      }
    })
  }, [selectedGrade])

  if (!gradeImpacts || gradeImpacts.length === 0) {
    return (
      <div className="text-muted-foreground text-center h-full flex items-center justify-center">
        No assignments available for this course.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <GradesList variant="list">
        <GradesItem
          courseName={selectedGrade.name}
          id={selectedGrade.course}
          grade={selectedGrade.average}
          variant="list"
        />
      </GradesList>

      {historyData && historyData.length > 0 && (
        <Card className="mb-0 h-fit">
          <CardHeader>
            <CardTitle>Grade History</CardTitle>
          </CardHeader>
          <CardContent className="w-full h-[250px]">
            <ChartContainer
              config={{
                Average: {
                  label: 'Average',
                  color: '#3b82f6',
                },
              }}
              className="w-full h-full"
            >
              <BarChart
                width={400}
                height={250}
                data={historyData}
                margin={{ left: 12, right: 12, top: 0, bottom: 0 }}
                maxBarSize={50}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 12 }}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
                />
                <Bar
                  dataKey="Average"
                  fill="#3b82f6"
                  isAnimationActive={false}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-md font-bold mb-2 mt-4">Impacts by Assignment</h2>
        <ClassGradesList>
          {gradeImpacts.map((score, index) => (
            <ClassGradesItem
              key={index}
              scoreData={score}
              impactBadge={score.impactBadge}
            />
          ))}
        </ClassGradesList>
      </div>
    </div>
  )
}

