import React, { useEffect } from 'react'
import { useCurrentUser } from '@/lib/store'
import { getClasses } from '@/lib/grades-api'
import { getLatestGradesLoad, hasStorageData, getInitialTerm, getTermList } from '@/lib/grades-store'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Toggle } from '@/components/ui/toggle'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { X } from 'lucide-react'

export default function FinalExamCalculator() {

  const [loadingInitial, setLoadingInitial] = React.useState(true)
  const [termList, setTermList] = React.useState([])
  const [currentTerm, setCurrentTerm] = React.useState('')
  const [classes, setClasses] = React.useState([])
  const [selectedClass, setSelectedClass] = React.useState('')
  const [selectedTerms, setSelectedTerms] = React.useState(new Set())
  const [loadingTerms, setLoadingTerms] = React.useState({})
  const [initialClassesData, setInitialClassesData] = React.useState({})
  const [cachedTermData, setCachedTermData] = React.useState({})

  const [finalExamWeight, setFinalExamWeight] = React.useState('15')
  const [termAverages, setTermAverages] = React.useState({})
  const [calculatorTermAverages, setCalculatorTermAverages] = React.useState({})
  const [finalExamGrade, setFinalExamGrade] = React.useState('')
  const [desiredAverage, setDesiredAverage] = React.useState('')
  const [calculatedField, setCalculatedField] = React.useState(null)
  const [calculateError, setCalculateError] = React.useState('')
  const [isExempting, setIsExempting] = React.useState(false)

  const loadedFromStorageRef = React.useRef(false)

  const user = useCurrentUser()
  const showTitle = user ? user.showPageTitles !== false : true

  useEffect(() => {
    if (selectedClass && initialClassesData[currentTerm]) {
      const selectedClassData = initialClassesData[currentTerm].find(cls => cls.course === selectedClass)
      if (selectedClassData && selectedClassData.average !== undefined && selectedClassData.average !== '') {
        const classAverage = parseFloat(selectedClassData.average)
        setTermAverages((prev) => ({ ...prev, [currentTerm]: classAverage.toFixed(2) }))
        setCalculatorTermAverages((prev) => ({ ...prev, [currentTerm]: classAverage.toFixed(2) }))
      } else {
        setTermAverages((prev) => ({ ...prev, [currentTerm]: '' }))
        setCalculatorTermAverages((prev) => ({ ...prev, [currentTerm]: '' }))
      }
      setCalculatedField(null)
    }
  }, [selectedClass, currentTerm, initialClassesData])

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        setLoadingInitial(true)
        const generator = getClasses()
        for await (const chunk of generator) {
          if (chunk.percent !== undefined && chunk.message !== undefined) {

          } else if (chunk.success === true) {
            if (loadedFromStorageRef.current) {
              return
            }

            setTermList(chunk.termList)
            setCurrentTerm(chunk.term)
            setClasses(chunk.classes)

            setInitialClassesData((prev) => ({ ...prev, [chunk.term]: chunk.classes }))

            setCachedTermData((prev) => ({
              ...prev,
              [chunk.term]: chunk.classes,
            }))

            let firstClass = chunk.classes[0]?.course
            if (chunk.classes.length > 0 && !selectedClass) {
              setSelectedClass(firstClass)
            }

            setSelectedTerms(new Set([chunk.term]))

            if (chunk.classes.length > 0) {
              const firstClassData = chunk.classes[0]
              if (firstClassData && firstClassData.average !== undefined && firstClassData.average !== '') {
                const classAverage = parseFloat(firstClassData.average)
                setTermAverages({ [chunk.term]: classAverage.toFixed(2) })
                setCalculatorTermAverages({ [chunk.term]: classAverage.toFixed(2) })
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch initial data:', err)
      } finally {
        setLoadingInitial(false)
      }
    }

    fetchInitial()
  }, [selectedClass])

  const handleFetchData = async () => {
    if (!selectedClass) {
      setCalculateError('Please select a class first')
      return
    }

    const termsToFetch = Array.from(selectedTerms).filter((t) => t !== currentTerm)

    if (termsToFetch.length === 0) {
      setCalculateError('No additional terms to fetch')
      return
    }

    setCalculateError('')

    for (const term of termsToFetch) {
      try {
        setLoadingTerms((prev) => ({ ...prev, [term]: true }))

        const generator = getClasses(term)
        for await (const chunk of generator) {
          if (chunk.percent !== undefined && chunk.message !== undefined) {

          } else if (chunk.success === true) {

            setInitialClassesData((prev) => ({ ...prev, [term]: chunk.classes }))

            const selectedClassData = chunk.classes.find(cls => cls.course === selectedClass)

            setCachedTermData((prev) => ({
              ...prev,
              [term]: chunk.classes,
            }))

            if (selectedClassData && selectedClassData.average !== undefined && selectedClassData.average !== '') {
              const classAverage = parseFloat(selectedClassData.average)
              setTermAverages((prev) => ({ ...prev, [term]: classAverage.toFixed(2) }))
              setCalculatorTermAverages((prev) => ({ ...prev, [term]: classAverage.toFixed(2) }))
            } else {

              setTermAverages((prev) => ({ ...prev, [term]: '' }))
              setCalculatorTermAverages((prev) => ({ ...prev, [term]: '' }))
              setCalculateError(`No grade data for selected class in Term ${term}`)
            }

            setLoadingTerms((prev) => ({ ...prev, [term]: false }))
          }
        }
      } catch (err) {
        console.error(`Failed to fetch term ${term}:`, err)
        setCalculateError(`Failed to load data for Term ${term}`)
        setLoadingTerms((prev) => ({ ...prev, [term]: false }))
      }
    }
  }

  const handleUseStored = () => {
    if (!selectedClass) {
      setCalculateError('Please select a class first')
      return
    }

    setCalculateError('')

    for (const term of selectedTerms) {
      const latestLoad = getLatestGradesLoad(term)

      if (latestLoad) {
        const selectedClassData = latestLoad.classes.find(cls => cls.course === selectedClass)

        if (selectedClassData && selectedClassData.average !== undefined && selectedClassData.average !== '') {
          const classAverage = parseFloat(selectedClassData.average)
          setTermAverages((prev) => ({ ...prev, [term]: classAverage.toFixed(2) }))
          setCalculatorTermAverages((prev) => ({ ...prev, [term]: classAverage.toFixed(2) }))
        } else {
          setTermAverages((prev) => ({ ...prev, [term]: '' }))
          setCalculatorTermAverages((prev) => ({ ...prev, [term]: '' }))
          setCalculateError(`No grade data for selected class in Term ${term}`)
        }
      }
    }
  }

  const handleUseStoredInitial = () => {
    const storedInitialTerm = getInitialTerm()
    const storedTermList = getTermList()
    const latestLoad = getLatestGradesLoad(storedInitialTerm)

    if (latestLoad && storedTermList.length > 0) {
      loadedFromStorageRef.current = true
      setTermList(storedTermList)
      setCurrentTerm(storedInitialTerm)
      setClasses(latestLoad.classes)
      setSelectedTerms(new Set([storedInitialTerm]))

      if (latestLoad.classes.length > 0) {
        const firstClass = latestLoad.classes[0]?.course
        setSelectedClass(firstClass)

        const firstClassData = latestLoad.classes[0]
        if (firstClassData && firstClassData.average !== undefined && firstClassData.average !== '') {
          const classAverage = parseFloat(firstClassData.average)
          setTermAverages({ [storedInitialTerm]: classAverage.toFixed(2) })
          setCalculatorTermAverages({ [storedInitialTerm]: classAverage.toFixed(2) })
        }
      }

      setLoadingInitial(false)
    }
  }

  const handleCalculate = () => {
    setCalculateError('')

    const termAvgValues = Object.keys(calculatorTermAverages)
      .sort((a, b) => termList.indexOf(a) - termList.indexOf(b))
      .map((key) => {
        const parsed = parseFloat(calculatorTermAverages[key])
        return isNaN(parsed) ? null : parsed
      })

    const desired = desiredAverage ? parseFloat(desiredAverage) : null

    if (isExempting) {

      let emptyCount = 0
      let blankFieldNames = []

      if (termAvgValues.some(v => v === null)) {
        emptyCount++
        blankFieldNames.push('term average(s)')
      }
      if (desired === null) {
        emptyCount++
        blankFieldNames.push('desired average')
      }

      if (emptyCount === 0) {
        setCalculateError('Please leave one field blank to calculate it')
        return
      }

      if (emptyCount !== 1) {
        setCalculateError(`Exactly one field must be blank (currently ${emptyCount} are blank: ${blankFieldNames.join(', ')})`)
        return
      }

      if (desired === null) {

        const validTermAvgs = termAvgValues.filter((v) => v !== null)
        const sumTerms = validTermAvgs.reduce((a, b) => a + b, 0)
        const avgTerms = sumTerms / validTermAvgs.length
        setDesiredAverage(avgTerms.toFixed(2))
        setCalculatedField('desired')
      } else {

        const blankIndex = termAvgValues.findIndex((v) => v === null)
        const validTermAvgs = termAvgValues.filter((v) => v !== null)
        const sumValidTerms = validTermAvgs.reduce((a, b) => a + b, 0)

        const calculated = desired * termAvgValues.length - sumValidTerms

        const termKey = Object.keys(calculatorTermAverages).sort((a, b) => termList.indexOf(a) - termList.indexOf(b))[blankIndex]
        setCalculatorTermAverages((prev) => ({
          ...prev,
          [termKey]: calculated.toFixed(2),
        }))
        setCalculatedField(`term-${termKey}`)
      }
    } else {

      const weight = parseFloat(finalExamWeight)
      if (isNaN(weight) || weight < 0 || weight >= 100) {
        setCalculateError('Final exam weight must be between 0 and 100')
        return
      }

      const finalExam = finalExamGrade ? parseFloat(finalExamGrade) : null

      let emptyCount = 0
      let blankFieldNames = []

      if (termAvgValues.some(v => v === null)) {
        emptyCount++
        blankFieldNames.push('term average(s)')
      }
      if (finalExam === null) {
        emptyCount++
        blankFieldNames.push('final exam grade')
      }
      if (desired === null) {
        emptyCount++
        blankFieldNames.push('desired average')
      }

      if (emptyCount === 0) {
        setCalculateError('Please leave one field blank to calculate it')
        return
      }

      if (emptyCount !== 1) {
        setCalculateError(`Exactly one field must be blank (currently ${emptyCount} are blank: ${blankFieldNames.join(', ')})`)
        return
      }

      const totalWeight = 100 - weight

      if (desired === null) {

        const validTermAvgs = termAvgValues.filter((v) => v !== null)
        const sumTerms = validTermAvgs.reduce((a, b) => a + b, 0)
        const avgTerms = sumTerms / validTermAvgs.length
        const calculated =
          (avgTerms * totalWeight + finalExam * weight) / 100
        setDesiredAverage(calculated.toFixed(2))
        setCalculatedField('desired')
      } else if (finalExam === null) {

        const validTermAvgs = termAvgValues.filter((v) => v !== null)
        const sumTerms = validTermAvgs.reduce((a, b) => a + b, 0)
        const avgTerms = sumTerms / validTermAvgs.length
        const calculated =
          (desired * 100 - avgTerms * totalWeight) / weight
        setFinalExamGrade(calculated.toFixed(2))
        setCalculatedField('finalExam')
      } else {

        const blankIndex = termAvgValues.findIndex((v) => v === null)
        const validTermAvgs = termAvgValues.filter((v) => v !== null)
        const sumValidTerms = validTermAvgs.reduce((a, b) => a + b, 0)

        const calculated =
          (desired * 100 - finalExam * weight) * termAvgValues.length / totalWeight - sumValidTerms

        const termKey = Object.keys(calculatorTermAverages).sort((a, b) => termList.indexOf(a) - termList.indexOf(b))[blankIndex]
        setCalculatorTermAverages((prev) => ({
          ...prev,
          [termKey]: calculated.toFixed(2),
        }))
        setCalculatedField(`term-${termKey}`)
      }
    }
  }

  const sortedTermKeys = React.useMemo(() => {
    return Array.from(selectedTerms).sort((a, b) => termList.indexOf(a) - termList.indexOf(b))
  }, [selectedTerms, termList])

  const allTermsHaveStorage = React.useMemo(() => {
    return Array.from(selectedTerms).every(term => hasStorageData(term))
  }, [selectedTerms])

  const hasInitialStorageData = React.useMemo(() => {
    const initialTerm = getInitialTerm()
    return initialTerm !== '' && hasStorageData(initialTerm)
  }, [])

  const exemptingAverage = React.useMemo(() => {
    const validAverages = Object.values(termAverages)
      .map(val => parseFloat(val))
      .filter(val => !isNaN(val))

    if (validAverages.length === 0) return null
    const avg = validAverages.reduce((a, b) => a + b, 0) / validAverages.length
    return avg.toFixed(2)
  }, [termAverages])

  return (
    <div className="space-y-8 flex flex-col">
      {showTitle && <h1 className="text-4xl font-bold">Final Exam Calculator</h1>}

      <ResizablePanelGroup direction="horizontal" className="space-x-2">
        { }
        <ResizablePanel className="relative bg-card rounded-xl border flex flex-col min-w-[400px]">
          {loadingInitial && (
            <div className="absolute inset-0 bg-card/85 flex flex-col items-center justify-center z-50 rounded-xl gap-3">
              <Spinner className="size-8" />
              {hasInitialStorageData && (
                <Button
                  onClick={handleUseStoredInitial}
                  variant="outline"
                  size="sm"
                >
                  Use Stored
                </Button>
              )}
            </div>
          )}

          <div className='flex items-center justify-between py-2 px-4 border-b'>
            <div className='text-center text-sm font-medium text-muted-foreground flex-1 py-1'>
              Data
            </div>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label>Select Class</Label>
              <Select value={selectedClass} onValueChange={(classValue) => {
                setSelectedClass(classValue)

                selectedTerms.forEach((term) => {
                  if (cachedTermData[term]) {
                    const selectedClassData = cachedTermData[term].find(cls => cls.course === classValue)
                    if (selectedClassData && selectedClassData.average !== undefined && selectedClassData.average !== '') {
                      const classAverage = parseFloat(selectedClassData.average)
                      setTermAverages((prev) => ({ ...prev, [term]: classAverage.toFixed(2) }))
                      setCalculatorTermAverages((prev) => ({ ...prev, [term]: classAverage.toFixed(2) }))
                    }
                  }
                })
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.course} value={cls.course}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 mb-4">
              <Label>Terms</Label>
              <div className="flex flex-wrap gap-2">
                {termList.map((term) => (
                  <Toggle
                    key={term}
                    pressed={selectedTerms.has(term)}
                    onPressedChange={(pressed) => {
                      setSelectedTerms((prev) => {
                        const next = new Set(prev)
                        if (pressed) {
                          next.add(term)
                        } else {
                          next.delete(term)
                        }
                        return next
                      })
                    }}
                    className="flex-1"
                  >
                    Term {term}
                  </Toggle>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleFetchData} className="flex-1">
                Fetch Data
              </Button>
              <Button
                onClick={handleUseStored}
                variant="outline"
                className="flex-1"
                disabled={!allTermsHaveStorage}
              >
                Use Stored
              </Button>
            </div>

            <div className="space-y-2 mt-2 pt-4 border-t">
              <Label className="text-sm font-medium">Grade</Label>
              <div className="flex flex-col gap-2">
                {Array.from(selectedTerms).map((term) => (
                  <div key={term} className="flex items-center gap-2">
                    <span className="text-sm whitespace-nowrap">Term {term}:</span>
                    {loadingTerms[term] ? (
                      <Spinner className="size-4" />
                    ) : (
                      <span className="text-sm font-medium">
                        {termAverages[term] || '--'}
                      </span>
                    )}
                  </div>
                ))}
                {Array.from(selectedTerms).length === 0 && (
                  <span className="text-sm text-muted-foreground">Select terms to load</span>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t space-y-1">
              <Label className="text-sm font-medium">Average if exempting:</Label>
              <p className="text-sm font-bold">
                {exemptingAverage || '--'}
              </p>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle className="bg-border hover:bg-accent/50" />

        { }
        <ResizablePanel className="relative bg-card rounded-xl border flex flex-col min-w-[400px]">
          {loadingInitial && (
            <div className="absolute inset-0 bg-card/85 flex items-center justify-center z-50 rounded-xl">
              <Spinner className="size-8" />
            </div>
          )}

          <div className='flex items-center justify-between py-2 px-4 border-b'>
            <div className='text-center text-sm font-medium text-muted-foreground flex-1 py-1'>
              Calculate
            </div>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            <div className="space-y-3">
              <Label className="text-base font-semibold">Term Averages</Label>
              <div className="grid grid-cols-4 gap-3">
                {sortedTermKeys.map((term) => (
                  <div key={term} className="space-y-1">
                    <Label htmlFor={`term-${term}`} className="text-sm">
                      Term {term}
                    </Label>
                    <Input
                      id={`term-${term}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={calculatorTermAverages[term] || ''}
                      onChange={(e) =>
                        setCalculatorTermAverages((prev) => ({
                          ...prev,
                          [term]: e.target.value,
                        }))
                      }
                      placeholder={termAverages[term] ? `${termAverages[term]}` : '--'}
                      autoFocus={calculatedField === `term-${term}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="exempting"
                    checked={isExempting}
                    onCheckedChange={setIsExempting}
                  />
                  <Label htmlFor="exempting" className="font-medium cursor-pointer">
                    Exempting
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="finalExamGrade">Final Exam Grade</Label>
                <div className="relative">
                  <Input
                    id="finalExamGrade"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={finalExamGrade}
                    onChange={(e) => setFinalExamGrade(e.target.value)}
                    placeholder="Final exam grade"
                    autoFocus={calculatedField === 'finalExam'}
                    disabled={isExempting}
                  />
                  <Button
                    variant='ghost'
                    size='icon'
                    className='text-muted-foreground focus-visible:ring-ring/50 absolute inset-y-0 right-0 rounded-l-none hover:bg-transparent'
                    onClick={() => setFinalExamGrade('')}
                  >
                    <X />
                  </Button>
                </div>
              </div>
              <div className="space-y-2" style={{ width: '30%' }}>
                <Label htmlFor="finalExamWeight">Weight (%)</Label>
                <Input
                  id="finalExamWeight"
                  type="number"
                  min="0"
                  max="100"
                  value={finalExamWeight}
                  onChange={(e) => setFinalExamWeight(e.target.value)}
                  placeholder="20"
                  disabled={isExempting}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="desiredAverage">Semester Average</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="desiredAverage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={desiredAverage}
                    onChange={(e) => setDesiredAverage(e.target.value)}
                    placeholder="Semester average"
                    autoFocus={calculatedField === 'desired'}
                  />
                  <Button
                    variant='ghost'
                    size='icon'
                    className='text-muted-foreground focus-visible:ring-ring/50 absolute inset-y-0 right-0 rounded-l-none hover:bg-transparent'
                    onClick={() => setDesiredAverage('')}
                  >
                    <X />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setDesiredAverage('89.5')}
                >
                  A
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDesiredAverage('79.5')}
                >
                  B
                </Button>
              </div>
            </div>

            <Separator />

            {calculateError && (
              <div className="text-red-500 text-sm font-medium">
                {calculateError}
              </div>
            )}

            <Button onClick={handleCalculate} className="w-full mt-0" size="lg">
              Calculate
            </Button>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}