import React, { useEffect, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getTranscript } from '@/lib/grades-api'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Trash2, Plus, RotateCcw, Paperclip } from 'lucide-react'
import { GPA_CONFIGS, letterForGrade } from '@/lib/GPAConfigs'
import { useStore, useCurrentUser } from '@/lib/store'

export default function GPARankCalculator() {
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [courses, setCourses] = useState([])
  const [gpaType, setGpaType] = useState('katyWeighted')
  const [userRankGPA, setUserRankGPA] = useState('')
  const [transcriptGPA, setTranscriptGPA] = useState(null)
  const [unweightedTranscriptGPA, setUnweightedTranscriptGPA] = useState(null)
  // `gpa` / `rank` hold the RAW TEXT typed into the field, not a parsed number.
  // Parsing on every keystroke made a decimal GPA impossible to enter: a
  // `type="number"` input reports "" for the half-typed "3.", which wrote null
  // back and wiped the field. Parsing happens once, in `predictRank`.
  const [rankDataPoints, setRankDataPoints] = useState([
    { id: 1, gpa: '', rank: '' },
    { id: 2, gpa: '', rank: '' }
  ])
  const [nextCourseId, setNextCourseId] = useState(1)
  const [nextRankId, setNextRankId] = useState(3)
  const [defaultGPAType, setDefaultGPAType] = useState('katyWeighted')
  const [currentRank, setCurrentRank] = useState(null)
  const [classSize, setClassSize] = useState(null)

  const user = useCurrentUser()
  const showTitle = user ? user.showPageTitles !== false : true

  useEffect(() => {
    const loadTranscript = async () => {
      try {

        const currentUser = useStore.getState().currentUser()

        // Determine GPA type based on user's district
        let gpaTypeToUse = 'katyWeighted'
        if (currentUser?.district && currentUser.district.toLowerCase().includes('cypress')) {
          gpaTypeToUse = 'cyFairWeighted'
        }

        const data = await getTranscript()
        if (data.success && data.transcriptData) {

          let weightedGpa = null
          let unweightedGpa = null
          if (data.transcriptData['Weighted GPA*']) {
            weightedGpa = parseFloat(data.transcriptData['Weighted GPA*'])
          }
          if (data.transcriptData['Unweighted GPA*']) {
            unweightedGpa = parseFloat(data.transcriptData['Unweighted GPA*'])
          }
          setTranscriptGPA(weightedGpa)
          setUnweightedTranscriptGPA(unweightedGpa)

          if (data.transcriptData['rank']) {
            const rankStr = data.transcriptData['rank']
            const rankParts = rankStr.split('/')
            if (rankParts.length === 2) {
              const rank = parseInt(rankParts[0].trim())
              const size = parseInt(rankParts[1].trim())
              if (!isNaN(rank) && !isNaN(size)) {
                setCurrentRank(rank)
                setClassSize(size)
              }
            }
          }

          const parsedCourses = parseTranscriptCourses(data.transcriptData)

          if (currentUser?.deletedTranscriptCourses) {
            const updatedCourses = parsedCourses.map(course => ({
              ...course,
              isDeleted: currentUser.deletedTranscriptCourses.includes(`${course.courseCode}-${course.courseName}-${course.schoolYear}`)
            }))
            setCourses(updatedCourses)
          } else {
            setCourses(parsedCourses)
          }

          if (currentUser?.courseTypesByCourseName) {
            setCourses(prevCourses =>
              prevCourses.map(course => {
                const storedType = currentUser.courseTypesByCourseName[course.courseName]
                return storedType ? { ...course, type: storedType } : course
              })
            )
          }

          if (currentUser?.customCourses && currentUser.customCourses.length > 0) {
            const customCourses = currentUser.customCourses.map((course, index) => ({
              id: nextCourseId + index,
              uniqueId: `c-${nextCourseId + index}`,
              source: 'custom',
              courseCode: '',
              courseName: course.courseName,
              grade: course.grade,
              credit: 1,
              type: course.type,
              isDeleted: false
            }))
            setCourses(prevCourses => [...customCourses, ...prevCourses])
            setNextCourseId(nextCourseId + currentUser.customCourses.length)
          }

          if (currentUser?.rankDataPoints && currentUser.rankDataPoints.length > 0) {
            setRankDataPoints(currentUser.rankDataPoints.map((point, index) => ({
              id: nextRankId + index,
              gpa: Number.isFinite(point?.gpa) ? String(point.gpa) : '',
              rank: Number.isFinite(point?.rank) ? String(point.rank) : ''
            })))
            setNextRankId(nextRankId + currentUser.rankDataPoints.length)
          }

          setDefaultGPAType(gpaTypeToUse)
          setGpaType(gpaTypeToUse)
        }
      } catch (error) {
        console.error('Failed to load transcript:', error)
      } finally {
        setLoadingInitial(false)
      }
    }

    loadTranscript()
  }, [])

  const parseTranscriptCourses = (transcriptData) => {
    const parsedCourses = []
    let id = 1
    let transcriptGPA = null

    for (const [semesterKey, semester] of Object.entries(transcriptData)) {
      if (semesterKey === 'Weighted GPA*') {
        transcriptGPA = parseFloat(semester)
        continue
      }
      if (semesterKey === 'rank' || semesterKey === 'quartile' || semesterKey === 'Unweighted GPA*') {
        continue
      }

      const semesterData = semester.data || []
      for (let i = 1; i < semesterData.length; i++) {
        const row = semesterData[i]
        const courseCode = row[0] || ''
        const courseName = row[1] || ''
        const gradeStr = row[2] || ''
        const credit = row[3] || '0'

        parsedCourses.push({
          id,
          uniqueId: `t-${id}`,
          source: 'transcript',
          courseCode,
          courseName,
          // Keep the raw value when the transcript reports a letter or credit
          // grade ("A", "P"): parseInt turned those into 0, which
          // `calculateGPA` then filtered out, so the course vanished from the
          // GPA. `gradeToLetter` already understands letter grades.
          grade: (() => {
            const text = String(gradeStr ?? '').trim()
            const n = parseFloat(text)
            return Number.isFinite(n) ? n : text
          })(),
          credit: parseFloat(credit),
          type: determineDefaultCourseType(courseCode, courseName),
          isDeleted: false,
          semester: semester.semester,
          year: semester.year,
          schoolYear: semesterKey,
          term: `${semester.year}-S${semester.semester}`

        })
        id++
      }
    }

    setNextCourseId(id)

    if (transcriptGPA !== null) {
      sessionStorage.setItem('transcriptGPA', transcriptGPA.toString())
    }
    return parsedCourses
  }

  const determineDefaultCourseType = (courseCode, courseName) => {
    const code = courseCode.toLowerCase()
    const name = courseName.toLowerCase()

    if (code.startsWith('a') || name.includes('ap')) return 'AP'
    if (name.includes('honors') || name.includes('kap')) return 'KAP'
    if (name.includes('dual') || name.includes('college')) return 'DC'
    return ''
  }

  const getCourseTypes = () => {
    const config = GPA_CONFIGS[gpaType]
    if (!config) return []
    return Object.keys(config.classes).filter(type => type !== '*')
  }

  const gradeToLetter = (grade) => {
    const labels = GPA_CONFIGS[gpaType]?.labels || {}

    if (typeof grade === 'string' && Object.keys(labels).includes(grade.toUpperCase())) {
      return grade.toUpperCase()
    }

    // parseFloat, not parseInt: an 89.6 has to land in the same band the portal
    // puts it in, and parseInt truncated it to 89.
    const num = parseFloat(grade)
    if (isNaN(num)) return ''

    return letterForGrade(num, labels) ?? ''
  }

  const calculateCourseGPA = (grade, courseType) => {
    const letter = gradeToLetter(grade)
    if (!letter) return null

    const config = GPA_CONFIGS[gpaType]
    if (!config) return null

    const typeConfig = config.classes[courseType] || config.classes['*']
    const gpaValue = typeConfig?.[letter]

    return gpaValue !== undefined ? gpaValue : null
  }

  // Next free `c-<n>` id, derived from the courses that actually exist. The old
  // version read the `nextCourseId` STATE, which was still at its pre-transcript
  // value while the restored custom courses were being built — so the new id
  // collided with an existing one, the `courseExists` guard returned the list
  // unchanged, and "Add Course" silently did nothing.
  const nextCustomUniqueId = (list) => {
    let max = 0
    for (const c of list) {
      const m = /^c-(\d+)$/.exec(c.uniqueId || '')
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
    return max + 1
  }

  // NOTE: the handlers below compute the next course list from `courses` and then
  // call `setCourses` with that value, rather than writing to the store from
  // inside a `setCourses(prev => ...)` updater. Updaters must be pure — React may
  // run them twice (StrictMode, or a re-render during concurrent work), which
  // double-wrote the persisted account data.
  const persistCustomCourses = (list) => {
    useStore.getState().changeUserData(
      'customCourses',
      list
        .filter(c => c.source === 'custom' && !c.isDeleted)
        .map(c => ({ courseName: c.courseName, grade: c.grade, type: c.type }))
    )
  }

  const addCustomCourse = () => {
    const id = nextCustomUniqueId(courses)
    const newCourse = {
      id,
      uniqueId: `c-${id}`,
      source: 'custom',
      courseCode: '',
      courseName: '',
      grade: '',
      credit: 1,
      type: '',
      isDeleted: false
    }
    const updated = [newCourse, ...courses]
    setCourses(updated)
    persistCustomCourses(updated)
    setNextCourseId(id + 1)
  }

  const updateCourse = (courseId, field, value) => {
    if (field === 'type') {
      const courseToUpdate = courses.find(c => c.uniqueId === courseId)
      const courseName = courseToUpdate?.courseName
      if (courseToUpdate && courseName) {
        const updated = courses.map(course =>
          course.courseName === courseName || course.uniqueId === courseId
            ? { ...course, [field]: String(value) }
            : course
        )
        const courseTypesByCourseName = useStore.getState().currentUser()?.courseTypesByCourseName || {}
        setCourses(updated)
        useStore.getState().changeUserData('courseTypesByCourseName', {
          ...courseTypesByCourseName,
          [courseName]: String(value)
        })
        persistCustomCourses(updated)
        return
      }
    }

    const updated = courses.map(course =>
      course.uniqueId === courseId ? { ...course, [field]: String(value) } : course
    )
    setCourses(updated)
    persistCustomCourses(updated)
  }

  const toggleDeleteCourse = (courseId) => {
    const updated = courses.map(course => {
      if (course.uniqueId !== courseId) return course
      // A custom course is removed outright; a transcript course is only
      // struck through so it can be restored.
      if (course.source === 'custom') return null
      return { ...course, isDeleted: !course.isDeleted }
    }).filter(c => c !== null)

    const deletedTranscriptCourses = updated
      .filter(c => c.isDeleted && c.source === 'transcript')
      .map(c => `${c.courseCode}-${c.courseName}-${c.schoolYear}`)

    setCourses(updated)
    useStore.getState().changeUserData('deletedTranscriptCourses', deletedTranscriptCourses)
    persistCustomCourses(updated)
  }

  const calculateGPA = (coursesToCalc = courses, excludeDeleted = true) => {
    const validCourses = coursesToCalc.filter(c => {
      if (excludeDeleted && c.isDeleted) return false
      // `!c.grade` also threw away a literal 0, which is a real failing grade,
      // not a missing one. Only blanks are missing.
      if (c.grade === '' || c.grade === null || c.grade === undefined) return false
      return true
    })

    if (validCourses.length === 0) return 0

    let totalGPA = 0
    let totalWeight = 0
    for (const course of validCourses) {
      const courseGPA = calculateCourseGPA(course.grade, course.type)
      if (courseGPA !== null) {
        totalGPA += courseGPA
        totalWeight += 1
      }
    }

    return totalWeight > 0 ? totalGPA / totalWeight : 0
  }

  const getCurrentGPA = () => {

    if (gpaType === 'unweighted' && unweightedTranscriptGPA !== null) {
      return unweightedTranscriptGPA
    }
    if ((gpaType === 'katyWeighted' || gpaType === 'cyFairWeighted') && transcriptGPA !== null) {
      return transcriptGPA
    }

    const activeCourses = courses.filter(c => !c.isDeleted)
    return calculateGPA(activeCourses, true)
  }

  const getPredictedGPA = () => {
    return calculateGPA(courses, true)
  }

  /** No rank is better than 1st, or worse than last in the class. */
  const clampRank = (rank) => {
    if (!Number.isFinite(rank)) return null
    const floored = Math.max(1, rank)
    return classSize && classSize > 0 ? Math.min(floored, classSize) : floored
  }

  const predictRank = (targetGPA) => {
    const validPoints = rankDataPoints
      .map(p => ({ gpa: parseFloat(p.gpa), rank: parseInt(p.rank, 10) }))
      .filter(p => Number.isFinite(p.gpa) && Number.isFinite(p.rank))

    if (validPoints.length === 0) return null
    if (validPoints.length === 1) return clampRank(validPoints[0].rank)

    const n = validPoints.length
    const sumX = validPoints.reduce((sum, p) => sum + p.gpa, 0)
    const sumY = validPoints.reduce((sum, p) => sum + p.rank, 0)
    const sumXY = validPoints.reduce((sum, p) => sum + p.gpa * p.rank, 0)
    const sumX2 = validPoints.reduce((sum, p) => sum + p.gpa * p.gpa, 0)

    const denominator = n * sumX2 - sumX * sumX
    if (denominator === 0) {

      return clampRank(Math.round(sumY / n))
    }

    const slope = (n * sumXY - sumX * sumY) / denominator
    const intercept = (sumY - slope * sumX) / n

    const predictedRank = Math.round(slope * targetGPA + intercept)

    return clampRank(predictedRank)
  }

  // The persisted shape stays numeric (`{ gpa: number | null, rank: number | null }`)
  // so the mobile app and older sessions keep reading it; the raw text lives only
  // in component state. It also no longer persists the internal `id`.
  const persistRankDataPoints = (points) => {
    useStore.getState().changeUserData(
      'rankDataPoints',
      points.map(p => {
        const gpa = parseFloat(p.gpa)
        const rank = parseInt(p.rank, 10)
        return {
          gpa: Number.isFinite(gpa) ? gpa : null,
          rank: Number.isFinite(rank) ? rank : null
        }
      })
    )
  }

  const updateRankDataPoint = (pointId, field, value) => {
    const updated = rankDataPoints.map(p => (p.id === pointId ? { ...p, [field]: value } : p))
    setRankDataPoints(updated)
    persistRankDataPoints(updated)
  }

  const addRankDataPoint = () => {
    const newPoints = [...rankDataPoints, { id: nextRankId, gpa: '', rank: '' }]
    setRankDataPoints(newPoints)
    persistRankDataPoints(newPoints)
    setNextRankId(nextRankId + 1)
  }

  const deleteRankDataPoint = (pointId) => {
    const updated = rankDataPoints.filter(p => p.id !== pointId)
    setRankDataPoints(updated)
    persistRankDataPoints(updated)
  }

  const usePredictedGPA = () => {
    setUserRankGPA(getPredictedGPA().toFixed(4))
  }

  const allCoursesHaveTypes = () => {
    const nonDeletedCourses = displayCourses.filter(c => !c.isDeleted)
    if (gpaType === 'unweighted') {
      return nonDeletedCourses.length > 0
    }

    return nonDeletedCourses.length > 0 && nonDeletedCourses.every(c => c.type && c.type !== '')
  }

  const currentGPA = getCurrentGPA()
  const predictedGPA = getPredictedGPA()
  const gpaDiff = predictedGPA - currentGPA
  const displayCourses = courses
    .filter(c => c.source === 'custom' || c.source === 'transcript')
    .sort((a, b) => {

      if (a.source === 'custom' && b.source !== 'custom') return -1
      if (a.source !== 'custom' && b.source === 'custom') return 1

      const yearA = parseInt(a.year) || 0
      const yearB = parseInt(b.year) || 0
      if (yearA !== yearB) {
        return yearB - yearA
      }

      return a.courseName.localeCompare(b.courseName)
    })
  // `userGPANum ? ...` treated a GPA of 0 as "not entered".
  const parsedUserGPA = parseFloat(userRankGPA)
  const userGPANum = Number.isFinite(parsedUserGPA) ? parsedUserGPA : null
  const predictedRank = userGPANum !== null ? predictRank(userGPANum) : null
  const weightedButtonText = defaultGPAType === 'cyFairWeighted' ? 'Weighted - Cy-Fair ISD' : 'Weighted - Katy ISD'
  const isWeightedSelected = gpaType === 'katyWeighted' || gpaType === 'cyFairWeighted'

  return (
    <div className="space-y-8 flex flex-col">
      {showTitle && <h1 className="text-4xl font-bold">GPA & Rank Calculator</h1>}

      <ResizablePanelGroup direction="horizontal" className="space-x-2">

        <ResizablePanel className="relative bg-card rounded-xl border flex flex-col min-w-[400px]">
          {loadingInitial && (
            <div className="absolute inset-0 bg-card/85 flex items-center justify-center z-50 rounded-xl">
              <Spinner className="size-8" />
            </div>
          )}
          <div className='flex items-center justify-between py-2 px-4 border-b'>
            <div className='text-center text-sm font-medium text-muted-foreground flex-1 py-1'>
              GPA
            </div>
          </div>

          <div className="p-4 space-y-4 flex-1 overflow-y-auto">

            <div className="flex gap-2">
              <Button
                variant={isWeightedSelected ? 'default' : 'outline'}
                onClick={() => setGpaType(defaultGPAType)}
                className="flex-1 border"
              >
                {weightedButtonText}
              </Button>
              <Button
                variant={gpaType === 'unweighted' ? 'default' : 'outline'}
                onClick={() => setGpaType('unweighted')}
                className="flex-1 border"
              >
                Unweighted
              </Button>
              <Button
                variant="outline"
                disabled
                className="flex-1 border"
              >
                Custom
              </Button>
            </div>

            <div className="flex flex-col gap-2 w-full">

              {displayCourses.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No transcript courses found — add your own below.
                </p>
              )}

              {displayCourses.length > 0 && (
                <div className="border rounded-lg overflow-y-auto" style={{ maxHeight: '250px' }}>
                  <Table className="w-full">
                    <TableHeader className="sticky top-0">
                      <TableRow>
                        <TableHead className="">Type</TableHead>
                        <TableHead className="w-full">Course Name</TableHead>
                        <TableHead className="min-w-[70px]">Grade</TableHead>
                        <TableHead className="min-w-[60px]">GPA</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayCourses.map((course) => {
                        const courseGPA = calculateCourseGPA(course.grade, course.type)

                        return (
                          <TableRow key={course.uniqueId} className={course.isDeleted ? 'opacity-60' : ''}>
                            <TableCell className="">
                              <Select
                                value={course.type ? String(course.type) : undefined}
                                onValueChange={(value) => updateCourse(course.uniqueId, 'type', value)}
                                disabled={gpaType === 'unweighted' || course.isDeleted}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {getCourseTypes().map(type => (
                                    <SelectItem key={type} value={String(type)}>{type}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className={`font-medium ${course.isDeleted ? 'line-through' : ''}`}>
                              {course.source === 'custom' ? (
                                <Input
                                  type="text"
                                  placeholder="Course Name"
                                  value={course.courseName}
                                  onChange={(e) => updateCourse(course.uniqueId, 'courseName', e.target.value)}
                                  className="h-8"
                                />
                              ) : (
                                course.courseName
                              )}
                            </TableCell>
                            <TableCell className={`max-w-[120px] ${course.isDeleted ? 'line-through' : ''}`}>
                              {course.source === 'transcript' ? (
                                <span className="text-sm font-medium">{course.grade}</span>
                              ) : (
                                <Input
                                  type="text"
                                  placeholder="95"
                                  value={course.grade}
                                  onChange={(e) => updateCourse(course.uniqueId, 'grade', e.target.value)}
                                  className="h-8"
                                />
                              )}
                            </TableCell>
                            <TableCell className={`max-w-[120px] ${course.isDeleted ? 'line-through' : ''}`}>
                              {courseGPA?.toFixed(2) || '-'}
                            </TableCell>
                            <TableCell className="w-12">
                              {course.isDeleted && course.source === 'transcript' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleDeleteCourse(course.uniqueId)}
                                  className='h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100'
                                  title="Restore course"
                                >
                                  <RotateCcw size={16} />
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleDeleteCourse(course.uniqueId)}
                                  className='h-8 w-8 p-0 text-foreground hover:text-red-600 hover:bg-red-100'
                                  title={course.source === 'custom' ? 'Delete course' : 'Remove course'}
                                >
                                  <Trash2 size={16} />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              <Button
                variant="outline"
                onClick={addCustomCourse}
                className="w-full"
              >
                <Plus size={16} className="mr-1" />
                Add Course
              </Button>


                <div className="grid grid-cols-2 gap-4 w-full mt-2">
                  <div className="bg-blue-100 dark:bg-blue-900 rounded-lg p-4 border border-blue-300 dark:border-blue-700">
                    <p className="text-xs text-blue-700 dark:text-blue-200 font-medium mb-2">Current GPA</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{currentGPA.toFixed(4)}</p>
                  </div>

                  {allCoursesHaveTypes() ? (
                    <div className="bg-purple-100 dark:bg-purple-900 rounded-lg p-4 border border-purple-300 dark:border-purple-700 flex flex-col">
                      <p className="text-xs text-purple-700 dark:text-purple-200 font-medium mb-2">Predicted GPA</p>
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{predictedGPA.toFixed(4)}</p>
                        {(() => {
                          let badgeColor = 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                          if (gpaDiff > 0.01) {
                            badgeColor = 'bg-green-200 text-green-700 dark:bg-green-900 dark:text-green-200'
                          } else if (gpaDiff < -0.01) {
                            badgeColor = 'bg-red-200 text-red-700 dark:bg-red-900 dark:text-red-200'
                          }
                          return (
                            <span className={`text-sm font-semibold px-2.5 py-1 rounded ${badgeColor}`}>
                              {gpaDiff > 0 ? '+' : ''}{gpaDiff.toFixed(4)}
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 border border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center">
                      <p className="text-xs text-gray-700 dark:text-gray-200 font-medium text-center">Select a type for all courses to see predicted GPA</p>
                    </div>
                  )}
                </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle className="bg-border hover:bg-accent/50" />

        <ResizablePanel className="relative bg-card rounded-xl border flex flex-col min-w-[400px]">
          {loadingInitial && (
            <div className="absolute inset-0 bg-card/85 flex items-center justify-center z-50 rounded-xl">
              <Spinner className="size-8" />
            </div>
          )}
          <div className='flex items-center justify-between py-2 px-4 border-b'>
            <div className='text-center text-sm font-medium text-muted-foreground flex-1 py-1'>
              Rank
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto space-y-4">
            <div className="space-y-2">
              <p className='text-muted-foreground text-sm'>Disclaimer: This calculator does not account for repeated ranks and is JUST a linear regression. You will need 10+ data points for accurate results. </p>
              <label className="text-sm font-medium">Enter some known GPA's and Ranks</label>
              <div className="border rounded-lg overflow-x-auto max-h-48 overflow-y-auto mt-1">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/2">GPA</TableHead>
                      <TableHead className="w-1/2">Rank</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankDataPoints.map((point) => (
                      <TableRow key={point.id}>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="3.8"
                            value={point.gpa}
                            onChange={(e) => updateRankDataPoint(point.id, 'gpa', e.target.value)}
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-4">
                            <Input
                              type="text"
                              inputMode="numeric"
                              placeholder="15"
                              value={point.rank}
                              onChange={(e) => updateRankDataPoint(point.id, 'rank', e.target.value)}
                              className="h-8 text-xs"
                            />
                            {rankDataPoints.length > 1 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteRankDataPoint(point.id)}
                                className='h-8 w-8 p-0 text-foreground hover:text-red-600 hover:bg-red-100'
                                title="Delete data point"
                              >
                                <Trash2 size={14} />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button
                variant="outline"
                onClick={addRankDataPoint}
                className="w-full text-xs h-8"
              >
                <Plus size={14} className="mr-1" />
                Add Data Point
              </Button>
            </div>


            <div className="space-y-2 border-t pt-2">
              <label className="text-sm font-medium">Your GPA</label>
              <div className="flex gap-1 mt-1">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Enter your GPA"
                  value={userRankGPA}
                  onChange={(e) => setUserRankGPA(e.target.value)}
                  className="h-9 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={usePredictedGPA}
                  title="Use Predicted GPA"
                  className="px-2 h-9"
                >
                  <Paperclip size={16} />
                </Button>
              </div>
            </div>


            <div className="grid grid-cols-2 gap-2 border-t pt-4">
              <div className="bg-amber-100 dark:bg-amber-900 rounded-lg p-3 border border-amber-300 dark:border-amber-700">
                <p className="text-xs text-amber-700 dark:text-amber-200 font-medium mb-1">Current Rank</p>
                <p className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-1">
                  {currentRank && classSize ? `${currentRank} / ${classSize}` : '-- / --'}
                </p>
              </div>

              <div className="bg-orange-100 dark:bg-orange-900 rounded-lg p-3 border border-orange-300 dark:border-orange-700 flex flex-col">
                <p className="text-xs text-orange-700 dark:text-orange-200 font-medium mb-1">Predicted Rank</p>
                <div className="flex items-center gap-1">
                  <p className="text-xl font-bold text-orange-900 dark:text-orange-100">
                    {predictedRank !== null && classSize ? `${predictedRank} / ${classSize}` : '--'}
                  </p>
                  {predictedRank !== null && currentRank !== null && (
                    (() => {
                      const rankDiff = predictedRank - currentRank
                      let badgeColor = 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                      if (rankDiff > 0) {
                        badgeColor = 'bg-red-200 text-red-700 dark:bg-red-900 dark:text-red-200'
                      } else if (rankDiff < 0) {
                        badgeColor = 'bg-green-200 text-green-700 dark:bg-green-900 dark:text-green-200'
                      }
                      return (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${badgeColor} ml-1`}>
                          {rankDiff > 0 ? '+' : ''}{rankDiff}
                        </span>
                      )
                    })()
                  )}
                </div>
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
