import React from 'react'
import { getProgressReport } from '@/lib/grades-api'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function ProgressReport() {
  const [loading, setLoading] = React.useState(true)
  const [progressReports, setProgressReports] = React.useState([])
  const [error, setError] = React.useState(null)
  const [selectedDate, setSelectedDate] = React.useState(null)

  React.useEffect(() => {
    const fetchProgressReport = async () => {
      try {
        setLoading(true)
        const data = await getProgressReport()
        if (data.success && data.progressReports && Array.isArray(data.progressReports)) {
          const sortedReports = [...data.progressReports].sort((a, b) => {
            return new Date(a.date) - new Date(b.date)
          })
          setProgressReports(sortedReports)
          if (sortedReports.length > 0) {
            setSelectedDate(sortedReports[sortedReports.length - 1].date)
          }
        }
      } catch (err) {
        console.error('Failed to fetch progress report:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchProgressReport()
  }, [])

  const showTitle = true

  const selectedProgressReport = React.useMemo(() => {
    if (!selectedDate) return null
    return progressReports.find((pr) => pr.date === selectedDate)
  }, [progressReports, selectedDate])

  const columnOrder = [
    'course',
    'description',
    'period',
    'teacher',
    'room',
    'grade',
    'com1',
    'com2',
    'com3',
    'com4',
    'com5',
  ]

  const columnLabels = {
    'course': 'Course',
    'description': 'Description',
    'period': 'Period',
    'teacher': 'Teacher',
    'room': 'Room',
    'grade': 'Grade',
    'com1': 'Comment 1',
    'com2': 'Comment 2',
    'com3': 'Comment 3',
    'com4': 'Comment 4',
    'com5': 'Comment 5',
  }

  const displayColumns = columnOrder.filter((col) =>
    selectedProgressReport && selectedProgressReport.report && selectedProgressReport.report.length > 0
      ? selectedProgressReport.report.some((row) => row[col] !== undefined && row[col] !== '')
      : false
  )

  const filteredRows = React.useMemo(() => {
    if (!selectedProgressReport || !selectedProgressReport.report || selectedProgressReport.report.length === 0) return []
    return selectedProgressReport.report.filter((row) => {
      return displayColumns.some((col) => row[col] !== undefined && row[col] !== null && String(row[col]).trim() !== '')
    })
  }, [selectedProgressReport, displayColumns])

  const currentReportIndex = React.useMemo(() => {
    if (!selectedDate) return -1
    return progressReports.findIndex((pr) => pr.date === selectedDate)
  }, [progressReports, selectedDate])

  const previousReport = React.useMemo(() => {
    if (currentReportIndex <= 0) return null
    return progressReports[currentReportIndex - 1]
  }, [progressReports, currentReportIndex])

  const previousGradesMap = React.useMemo(() => {
    if (!previousReport || !previousReport.report) return {}
    const map = {}
    previousReport.report.forEach((row) => {
      if (row.course && row.grade !== undefined && row.grade !== '') {
        map[row.course] = parseFloat(row.grade)
      }
    })
    return map
  }, [previousReport])

  const getGradeDifference = (course, currentGrade) => {
    if (!previousGradesMap[course] || !currentGrade || currentReportIndex <= 0) return null
    const current = parseFloat(currentGrade)
    if (isNaN(current)) return null
    const previous = previousGradesMap[course]
    const difference = current - previous
    return difference
  }

  return (
    <div className="space-y-8 flex flex-col">
      {showTitle && <h1 className="text-4xl font-bold">Progress Report</h1>}

      <div className="bg-card rounded-xl p-6 border overflow-y-auto min-h-0 flex flex-col">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Spinner className="size-8" />
          </div>
        )}

        {error && (
          <div className="text-destructive text-center py-8">
            <p>Error loading progress report: {error}</p>
          </div>
        )}

        {!loading && !error && progressReports.length === 0 && (
          <div className="text-muted-foreground text-center py-8">
            <p>No progress report data available</p>
          </div>
        )}

        {!loading && !error && progressReports.length > 0 && (
          <div className="space-y-6 flex flex-col flex-1">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Report Date:</label>
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {progressReports.map((pr) => (
                    <SelectItem key={pr.date} value={pr.date}>
                      {pr.date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filteredRows && filteredRows.length > 0 ? (
              <div className="overflow-x-auto flex-1 border rounded-lg">
                <Table className="text-xs">
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow>
                      {displayColumns.map((col) => (
                        <TableHead key={col} className="whitespace-nowrap bg-muted">
                          {columnLabels[col] || col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row, rowIdx) => (
                      <TableRow key={rowIdx}>
                        {displayColumns.map((col) => {
                          const cellValue = row[col] || ''
                          const isGradeColumn = col === 'grade'
                          const difference = isGradeColumn ? getGradeDifference(row.course, cellValue) : null
                          
                          return (
                            <TableCell key={`${rowIdx}-${col}`} className="whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {cellValue}
                                {difference !== null && (
                                  <span className={`px-2 py-0 rounded text-xs font-semibold ${
                                    difference > 0
                                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200'
                                      : difference < 0 ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200' 
                                      : 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200'
                                  }`}>
                                    {difference > 0 ? '+' : ''}{difference.toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-muted-foreground text-center py-8">
                <p>No data available for this progress report</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
