import React, { useEffect, useState } from 'react'
import { ClassGradesItem, ClassGradesList } from '@/components/custom/grades-item'
import {
  Item,
  ItemContent,
  ItemTitle,
} from "@/components/ui/item"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel, FieldContent } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { RingGradeStat, CategoryGradeStat, CategoryGradeList } from '@/components/custom/grades-stats'
import { Plus } from 'lucide-react'

// Category-weighted recompute, shared by every What-If edit. Module scope, not
// a component const: the effects above used to call it before its `const` was
// initialised, which only worked by accident of effect ordering.
function recalculateGrades(categories, scores) {
  const updatedCategories = { ...categories }
  
  Object.keys(updatedCategories).forEach((categoryName) => {
    const categoryScores = scores.filter(s => {
      if (s.category !== categoryName) return false
      const scoreVal = parseFloat(s.score)
      // Exempt work counts no more than dropped work does — the portal leaves
      // both out of the average, so the what-if must too.
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

  // Calculate final grade: sum(categoryPercent * categoryWeight) for categories with assignments
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

export const WhatIf = ({ selectedGrade }) => {
  const [current, setCurrent] = useState(selectedGrade || {})
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newWeight, setNewWeight] = useState('')
  const [originalAverage, setOriginalAverage] = useState(null)
  
  const [manualName, setManualName] = useState('')
  const [manualPercentage, setManualPercentage] = useState('')
  const [manualCategory, setManualCategory] = useState('')
  const [manualWeight, setManualWeight] = useState('1')

  const [targetCategory, setTargetCategory] = useState('')
  const [targetWeight, setTargetWeight] = useState('1')
  const [targetAverage, setTargetAverage] = useState('')
  const [targetRequired, setTargetRequired] = useState(null)

  useEffect(() => {
    const gradeData = selectedGrade || {}
    if (gradeData.categories && gradeData.scores) {
      const { categories: updatedCategories, average } = recalculateGrades(gradeData.categories, gradeData.scores || [])
      setCurrent({ ...gradeData, categories: updatedCategories, average })
      const providedAvg = typeof gradeData.average !== 'undefined' && !isNaN(parseFloat(gradeData.average)) ? parseFloat(gradeData.average) : average
      setOriginalAverage(Number(providedAvg))
    } else {
      setCurrent(gradeData)
      const providedAvg = typeof gradeData.average !== 'undefined' && !isNaN(parseFloat(gradeData.average)) ? parseFloat(gradeData.average) : 0
      setOriginalAverage(Number(providedAvg))
    }
  }, [selectedGrade])

  useEffect(() => {
    // Calculate required score for target average
    if (!targetCategory || !targetAverage) {
      setTargetRequired(null)
      return
    }

    const targetAvgVal = parseFloat(targetAverage)
    
    if (isNaN(targetAvgVal) || targetAvgVal < 0 || targetAvgVal > 100) {
      setTargetRequired(null)
      return
    }

    const currentCategoryData = current.categories?.[targetCategory]
    if (!currentCategoryData) {
      setTargetRequired(null)
      return
    }

    // Get current state of all categories
    const categoryStates = {}

    Object.entries(current.categories || {}).forEach(([catName, catData]) => {
      const weight = parseFloat(catData.categoryWeight) || 1
      const percent = parseFloat(catData.percent) || 0
      const maxPoints = parseFloat(catData.maximumPoints) || 0
      const studentPoints = parseFloat(catData.studentsPoints) || 0

      categoryStates[catName] = { weight, percent, maxPoints, studentPoints }
    })

    // Calculate what the target category's percentage needs to be
    // to achieve the target average
    // Formula: targetAvg = sum(catPercent * catWeight) / totalWeight
    // We need to solve for: catPercent where catName = targetCategory
    
    // Only the categories that actually feed the average may count toward the
    // denominator. `recalculateGrades` skips categories with no assignments, so
    // including an empty one here (a "Final Exam" bucket, a just-added category)
    // solved for a different average than the app then displays — the suggested
    // score never actually reached the target. The target category always
    // counts: the new assignment is what gives it points.
    let totalWeight = 0
    let otherContribution = 0
    Object.entries(categoryStates).forEach(([catName, catState]) => {
      if (catName !== targetCategory && !(catState.maxPoints > 0)) return
      totalWeight += catState.weight
      if (catName !== targetCategory) otherContribution += catState.percent * catState.weight
    })

    // Rearrange: targetAvg * totalWeight = otherContribution + targetCatPercent * targetCatWeight
    // targetCatPercent = (targetAvg * totalWeight - otherContribution) / targetCatWeight
    const targetCatWeight = categoryStates[targetCategory].weight
    if (!(totalWeight > 0) || !(targetCatWeight > 0)) {
      setTargetRequired(null)
      return
    }
    const requiredTargetCatPercent = (targetAvgVal * totalWeight - otherContribution) / targetCatWeight

    // Now calculate what score is needed in the new assignment to achieve this percent
    // The new assignment has weight targetWeight, contributing: studentScore * targetWeight / (maxScore * targetWeight)
    // With weighted calculation: (currentWeightedPoints + newScore * targetWeight) / (currentWeightedMaxPoints + 100 * targetWeight)
    const currentMaxPoints = categoryStates[targetCategory].maxPoints
    const currentStudentPoints = categoryStates[targetCategory].studentPoints
    
    // The new assignment has weight targetWeight
    // newCategoryPercent = (currentStudentPoints + newScore * targetWeight) / (currentMaxPoints + 100 * targetWeight)
    // Solving for newScore:
    // requiredPercent * (currentMaxPoints + 100 * targetWeight) = currentStudentPoints + newScore * targetWeight
    // newScore = (requiredPercent * (currentMaxPoints + 100 * targetWeight) - currentStudentPoints) / targetWeight
    const targetWtVal = parseFloat(targetWeight) || 1
    const newAssignmentTotalPoints = 100
    const newAssignmentScore = ((requiredTargetCatPercent / 100) * (currentMaxPoints + newAssignmentTotalPoints * targetWtVal) - currentStudentPoints) / targetWtVal
    const newAssignmentPercentage = (newAssignmentScore / newAssignmentTotalPoints) * 100

    setTargetRequired(newAssignmentPercentage)
  }, [targetCategory, targetAverage, targetWeight, current.categories])

  const handleSaveCategory = (closePopover) => {
    const weightVal = parseFloat(newWeight)
    if (isNaN(weightVal)) {
      return
    }

    const percent = 0.0
    const studentsPoints = 0.0
    const maximumPoints = 0.0
    const categoryWeight = weightVal
    const categoryPoints = +(categoryWeight * (percent / 100))

    const categoryKey = newName && newName.trim().length ? newName.trim() : `Untitled Category`

    const newCategoryData = {
      percent: percent.toFixed(3),
      studentsPoints: studentsPoints.toFixed(4),
      maximumPoints: maximumPoints.toFixed(2),
      categoryWeight: categoryWeight.toFixed(2),
      categoryPoints: categoryPoints.toFixed(6),
    }

    const updatedCategories = Object.assign({}, current.categories || {})
    updatedCategories[categoryKey] = newCategoryData

    setCurrent({ ...current, categories: updatedCategories })

    setNewName('')
    setNewWeight('')
    setIsAdding(false)

    if (typeof closePopover === 'function') closePopover()
  }


  const handleRemoveGrade = (index) => {
    const updatedScores = (current.scores || []).filter((_, i) => i !== index)
    const { categories: updatedCategories, average } = recalculateGrades(current.categories || {}, updatedScores)

    setCurrent({
      ...current,
      scores: updatedScores,
      categories: updatedCategories,
      average: average,
    })
  }

  const handleToggleExcluded = (index) => {
    const updatedScores = [...(current.scores || [])]
    if (!updatedScores[index]) return
    updatedScores[index] = {
      ...updatedScores[index],
      excluded: !updatedScores[index].excluded,
    }
    const { categories: updatedCategories, average } = recalculateGrades(current.categories || {}, updatedScores)

    setCurrent({
      ...current,
      scores: updatedScores,
      categories: updatedCategories,
      average: average,
    })
  }

  const handleEditPercentage = (index, newPercentage) => {
    const updatedScores = [...(current.scores || [])]
    if (!updatedScores[index]) return
    if (newPercentage === '' || newPercentage === null) {
      updatedScores[index] = {
        ...updatedScores[index],
        percentage: '',
        score: '',
      }
    } else {
      const num = parseFloat(newPercentage)
      const totalPoints = parseFloat(updatedScores[index].totalPoints) || 100
      const newScore = !isNaN(num) ? (num / 100) * totalPoints : 0

      updatedScores[index] = {
        ...updatedScores[index],
        percentage: num,
        score: newScore,
      }
    }
    const { categories: updatedCategories, average } = recalculateGrades(current.categories || {}, updatedScores)

    setCurrent({
      ...current,
      scores: updatedScores,
      categories: updatedCategories,
      average: average,
    })
  }

  const handleAddManualGrade = () => {
    const percentage = parseFloat(manualPercentage)
    const weight = parseFloat(manualWeight) || 1
    
    if (isNaN(percentage) || !manualCategory) {
      return 
    }

    const assignmentName = manualName.trim() || `Untitled ${manualCategory}`
    const totalPointsValue = 100
    const scoreValue = (percentage / 100) * totalPointsValue

    const newScore = {
      name: assignmentName,
      score: scoreValue,
      percentage: percentage,
      category: manualCategory,
      totalPoints: totalPointsValue,
      weight: weight,
      dateDue: new Date().toLocaleDateString(),
      badges: [],
    }

    const updatedScores = [newScore, ...(current.scores || [])]
    const { categories: updatedCategories, average } = recalculateGrades(current.categories || {}, updatedScores)

    setCurrent({
      ...current,
      scores: updatedScores,
      categories: updatedCategories,
      average: average,
    })

    setManualName('')
    setManualPercentage('')
    setManualCategory('')
    setManualWeight('1')
  }

  const handleAddTargetGrade = () => {
    if (!targetCategory || targetRequired === null) {
      return
    }

    const assignmentName = `Upcoming ${targetCategory}`
    const targetWtVal = parseFloat(targetWeight) || 1
    const totalPointsValue = 100
    const scoreValue = (targetRequired / 100) * totalPointsValue

    const newScore = {
      name: assignmentName,
      score: scoreValue,
      percentage: targetRequired,
      category: targetCategory,
      totalPoints: totalPointsValue,
      weight: targetWtVal,
      dateDue: new Date().toLocaleDateString(),
      badges: [],
    }

    const updatedScores = [newScore, ...(current.scores || [])]
    const { categories: updatedCategories, average } = recalculateGrades(current.categories || {}, updatedScores)

    setCurrent({
      ...current,
      scores: updatedScores,
      categories: updatedCategories,
      average: average,
    })

    setTargetCategory('')
    setTargetWeight('1')
    setTargetAverage('')
    setTargetRequired(null)
  }

  // A semester rolls up several independently-graded terms (each weighted into
  // the final grade), so a single flat what-if would compute the wrong number.
  // What-if works per term — steer the user to a term / progress-period tab.
  const groupCount = selectedGrade?.groups && typeof selectedGrade.groups === 'object'
    ? Object.keys(selectedGrade.groups).length
    : 0
  if (groupCount > 1) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
        <p className="font-medium">What-If isn’t available for a full semester</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          A semester grade is an average of its terms, each graded separately.
          Pick a term or progress period (e.g. {Object.keys(selectedGrade.groups)[0]}) to run What-If on it.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className="flex gap-4 overflow-x-auto">
        <RingGradeStat
          grade={parseFloat(current.average || 0).toPrecision(4)}
          whatif={true}
          whatifGrade={originalAverage !== null ? originalAverage : undefined}
        />
        <CategoryGradeList>
          <Popover open={isAdding} onOpenChange={setIsAdding}>
            <PopoverTrigger asChild>
              <Item className="border-dashed border-4 py-3 gap-2 max-w-[300px] min-w-[150px] cursor-pointer hover:bg-accent transition-colors h-full" variant="outline">
                <ItemContent className="gap-0 text-muted-foreground">
                  <ItemTitle className="text-3xl justify-center">Add <Plus className="w-8 h-8" /></ItemTitle>
                </ItemContent>
              </Item>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="grid gap-4">
                <div>
                  <h4 className="font-medium leading-none">Add Category</h4>
                  <p className="text-sm text-muted-foreground">Provide a name and a weight.</p>
                </div>

                <Field>
                  <FieldLabel>
                    <Label>Category Name</Label>
                  </FieldLabel>
                  <FieldContent>
                    <Input placeholder="Optional name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel>
                    <Label>Category Weight</Label>
                  </FieldLabel>
                  <FieldContent>
                    <Input placeholder="e.g. 30" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} />
                  </FieldContent>
                </Field>

                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setIsAdding(false); setNewName(''); setNewWeight('') }}>Cancel</Button>
                  <Button size="sm" onClick={() => handleSaveCategory()}>Save</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {Object.entries(current.categories || {}).map(([categoryName, categoryData]) => (
            <CategoryGradeStat
              key={categoryName}
              categoryData={{ category: categoryName, ...categoryData }}
            />
          ))}
        </CategoryGradeList>
      </div>
      <div className='rounded-lg border w-full p-2'>
        <Tabs className="w-full" defaultValue="predict">
          <TabsList className="w-full" variant="accent">
            <TabsTrigger value="predict">Predict</TabsTrigger>
            <TabsTrigger value="target">Target</TabsTrigger>
          </TabsList>
          <TabsContent value="predict">
            <div className="flex flex-wrap gap-2 items-end w-full">
              <div className="flex flex-col flex-1 min-w-[100px]">
                <Label className="text-sm font-medium mb-2">Name</Label>
                <Input
                  placeholder="Assignment name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                />
              </div>
              <div className="flex flex-col min-w-[50px] w-[80px] shrink-0">
                <Label className="text-sm font-medium mb-2">Percent</Label>
                <Input
                  placeholder="95%"
                  value={manualPercentage}
                  onChange={(e) => setManualPercentage(e.target.value)}
                />
              </div>
              <div className="flex flex-col min-w-[170px] w-[170px] shrink-0">
                <Label className="text-sm font-medium mb-2">Category</Label>
                <Select value={manualCategory} onValueChange={setManualCategory} className="w-full">
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="w-full">
                    <SelectGroup>
                      {Object.keys(current.categories || {}).map((categoryName) => (
                        <SelectItem key={categoryName} value={categoryName}>{categoryName}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col min-w-[50px] w-[80px] shrink-0">
                <Label className="text-sm font-medium mb-2">Weight</Label>
                <Input
                  placeholder="1"
                  value={manualWeight}
                  onChange={(e) => setManualWeight(e.target.value)}
                />
              </div>
              <Button onClick={handleAddManualGrade} className="h-9 basis-full md:basis-auto">Add <Plus className="w-4 h-4" /></Button>
            </div>
          </TabsContent>
          <TabsContent value="target">
            <div className="flex gap-2">
              <div className="flex flex-col gap-2 flex-1">
                <div className="">
                  <Label className="text-sm font-medium mb-2">Upcoming Assignment</Label>
                  <div className="flex gap-2">
                    <Select value={targetCategory} onValueChange={setTargetCategory} className="flex-1">
                      <SelectTrigger className="">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="">
                        <SelectGroup>
                          {Object.keys(current.categories || {}).map((categoryName) => (
                            <SelectItem key={categoryName} value={categoryName}>{categoryName}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Weight"
                      type="number"
                      value={targetWeight}
                      onChange={(e) => setTargetWeight(e.target.value)}
                    />
                  </div>
                </div>
                <div className="">
                  <Label className="text-sm font-medium mb-2">Target Average</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Target %"
                      type="number"
                      value={targetAverage}
                      onChange={(e) => setTargetAverage(e.target.value)}
                    />
                    <Button variant="outline" size="sm" onClick={() => setTargetAverage('89.5')}>
                      A
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setTargetAverage('79.5')}>
                      B
                    </Button>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-muted p-4 text-primary min-w-fit flex flex-col justify-between">
                <div>
                  <h4 className="font-medium">You need a</h4>
                  <div className="text-3xl font-bold mb-2">
                    {targetRequired !== null ? targetRequired.toFixed(1) + '%' : '----'}
                  </div>
                </div>
                <Button onClick={handleAddTargetGrade} disabled={targetRequired === null}>
                  Add <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <ClassGradesList>
        {(current.scores || []).map((score, index) => (
          <ClassGradesItem 
            key={index} 
            scoreData={score}
            onRemove={() => handleRemoveGrade(index)}
            onToggleExcluded={() => handleToggleExcluded(index)}
            onEditPercentage={(newPercentage) => handleEditPercentage(index, newPercentage)}
          />
        ))}
      </ClassGradesList>
    </div>
  )
}