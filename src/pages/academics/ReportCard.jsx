import React from 'react'
import { getReportCard } from '@/lib/grades-api'
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

export default function ReportCard() {
  const [loading, setLoading] = React.useState(true)
  const [reportCards, setReportCards] = React.useState([])
  const [error, setError] = React.useState(null)
  const [selectedRun, setSelectedRun] = React.useState(null)

  React.useEffect(() => {
    const fetchReportCard = async () => {
      try {
        setLoading(true)
        const data = await getReportCard()
        if (data.success && data.reportCards && Array.isArray(data.reportCards)) {
          setReportCards(data.reportCards)
          if (data.reportCards.length > 0) {
            setSelectedRun(data.reportCards[0].reportCardRun)
          }
        }
      } catch (err) {
        console.error('Failed to fetch report card:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchReportCard()
  }, [])

  const showTitle = true

  const selectedReportCard = React.useMemo(() => {
    if (!selectedRun) return null
    return reportCards.find((rc) => rc.reportCardRun === selectedRun)
  }, [reportCards, selectedRun])

  const _getAllColumns = React.useMemo(() => {
    if (!selectedReportCard || !selectedReportCard.report || selectedReportCard.report.length === 0) {
      return []
    }
    const columns = new Set()
    selectedReportCard.report.forEach((row) => {
      Object.keys(row).forEach((key) => {
        columns.add(key)
      })
    })
    return Array.from(columns)
  }, [selectedReportCard])

  const columnOrder = [
    'course',
    'description',
    'period',
    'teacher',
    'room',
    'att_credit',
    'ern_credit',
    // PowerSchool per-term runs post a single letter/number grade + percent.
    'grade',
    'percent',
    'first',
    'second',
    'third',
    'exam1',
    'sem1',
    'fourth',
    'fifth',
    'sixth',
    'exam2',
    'sem2',
    'eoy',
    'cnd1',
    'cnd2',
    'cnd3',
    'cnd4',
    'cnd5',
    'cnd6',
    'c1',
    'c2',
    'c3',
    'c4',
    'c5',
    'exda',
    'uexa',
    'exdt',
    'uext',
  ]

  const columnLabels = {
    'course': 'Course',
    'description': 'Description',
    'period': 'Period',
    'teacher': 'Teacher',
    'room': 'Room',
    'att_credit': 'Att Credit',
    'ern_credit': 'Ern Credit',
    'grade': 'Grade',
    'percent': '%',
    'first': '1st',
    'second': '2nd',
    'third': '3rd',
    'exam1': 'Exam 1',
    'sem1': 'Sem 1',
    'fourth': '4th',
    'fifth': '5th',
    'sixth': '6th',
    'exam2': 'Exam 2',
    'sem2': 'Sem 2',
    'eoy': 'EOY',
    'cnd1': 'Cond 1',
    'cnd2': 'Cond 2',
    'cnd3': 'Cond 3',
    'cnd4': 'Cond 4',
    'cnd5': 'Cond 5',
    'cnd6': 'Cond 6',
    'c1': 'C1',
    'c2': 'C2',
    'c3': 'C3',
    'c4': 'C4',
    'c5': 'C5',
    'exda': 'Exda',
    'uexa': 'Uexa',
    'exdt': 'Exdt',
    'uext': 'Uext',
  }

  const displayColumns = columnOrder.filter((col) =>
    selectedReportCard && selectedReportCard.report && selectedReportCard.report.length > 0
      ? selectedReportCard.report.some((row) => row[col] !== undefined && row[col] !== '')
      : false
  )

  const filteredRows = React.useMemo(() => {
    if (!selectedReportCard || !selectedReportCard.report || selectedReportCard.report.length === 0) return []
    return selectedReportCard.report.filter((row) => {
      return displayColumns.some((col) => row[col] !== undefined && row[col] !== null && String(row[col]).trim() !== '')
    })
  }, [selectedReportCard, displayColumns])

  // Get grade difference between columns for the same course
  const getGradeDifference = (row, currentColumn) => {
    if (!['second', 'third'].includes(currentColumn)) return null
    
    const currentValue = parseFloat(row[currentColumn])
    if (isNaN(currentValue)) return null
    
    const previousColumn = currentColumn === 'second' ? 'first' : 'second'
    const previousValue = parseFloat(row[previousColumn])
    if (isNaN(previousValue)) return null
    
    const difference = currentValue - previousValue
    return difference
  }

  return (
    <div className="space-y-8 flex flex-col">
      {showTitle && <h1 className="text-4xl font-bold">Report Card</h1>}

      <div className="bg-card rounded-xl p-6 border overflow-y-auto min-h-0 flex flex-col">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Spinner className="size-8" />
          </div>
        )}

        {error && (
          <div className="text-destructive text-center py-8">
            <p>Error loading report card: {error}</p>
          </div>
        )}

        {!loading && !error && reportCards.length === 0 && (
          <div className="text-muted-foreground text-center py-8">
            <p>No report card data available</p>
          </div>
        )}

        {!loading && !error && reportCards.length > 0 && (
          <div className="space-y-6 flex flex-col flex-1">
            {/* Period Selector */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Report Card Run:</label>
              <Select value={selectedRun} onValueChange={setSelectedRun}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportCards.map((rc) => (
                    <SelectItem key={rc.reportCardRun} value={rc.reportCardRun}>
                      Report Card Run {rc.reportCardRun}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Report Card Table */}
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
                          const isComparisonColumn = ['second', 'third'].includes(col)
                          const difference = isComparisonColumn ? getGradeDifference(row, col) : null

                          return (
                            <TableCell key={`${rowIdx}-${col}`} className="whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {cellValue}
                                {difference !== null && (
                                  <span className={`px-2 py-0 rounded text-xs font-semibold ${
                                    difference > 0
                                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200'
                                      : difference < 0
                                      ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
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
                <p>No data available for this report card</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
