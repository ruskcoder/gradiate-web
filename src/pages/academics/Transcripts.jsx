import React from 'react'
import { Download } from 'lucide-react'
import { useCurrentUser } from '@/lib/store'
import { getTranscript } from '@/lib/grades-api'
import { exportUnofficialTranscript } from '@/lib/transcript-export'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function Transcripts() {
  const [loading, setLoading] = React.useState(true)
  const [transcriptData, setTranscriptData] = React.useState({})
  const [error, setError] = React.useState(null)
  const [exporting, setExporting] = React.useState(false)

  React.useEffect(() => {
    const fetchTranscript = async () => {
      try {
        setLoading(true)
        const data = await getTranscript()
        if (data.success && data.transcriptData) {
          setTranscriptData(data.transcriptData)
        }
      } catch (err) {
        console.error('Failed to fetch transcript:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchTranscript()
  }, [])

  const user = useCurrentUser()
  const showTitle = user ? user.showPageTitles !== false : true

  const groupedByYear = React.useMemo(() => {
    const groups = {}
    Object.entries(transcriptData).forEach(([key, entry]) => {
      if (typeof entry !== 'object' || !entry.year || !entry.semester || !entry.data) {
        return
      }
      const year = entry.year
      if (!groups[year]) {
        groups[year] = []
      }
      groups[year].push({ key, ...entry })
    })
    return groups
  }, [transcriptData])

  const summaryStats = React.useMemo(() => {
    return {
      rank: transcriptData.rank || 'N/A',
      quartile: transcriptData.quartile || 'N/A',
      weightedGPA: transcriptData['Weighted GPA*'] || 'N/A',
      unweightedGPA: transcriptData['Unweighted GPA*'] || 'N/A'
    }
  }, [transcriptData])

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportUnofficialTranscript(transcriptData, user)
    } catch (err) {
      console.error('Failed to export transcript:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-8 flex flex-col">
      {showTitle && <h1 className="text-4xl font-bold">Transcripts</h1>}
      
      <div className="bg-card rounded-xl p-6 border overflow-y-auto h-full flex flex-col">
        {loading && (
          <div className='flex items-center justify-center h-full'>
            <Spinner className='size-8' />
          </div>
        )}
        
        {error && (
          <div className='text-destructive text-center py-8'>
            <p>Error loading transcript: {error}</p>
          </div>
        )}
        
        {!loading && !error && Object.keys(transcriptData).length === 0 && (
          <div className='text-muted-foreground text-center py-8'>
            <p>No transcript data available</p>
          </div>
        )}
        
        {!loading && !error && Object.keys(groupedByYear).length > 0 && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-100 dark:bg-blue-900 rounded-lg p-4 border border-blue-300 dark:border-blue-700">
                <p className="text-xs text-blue-700 dark:text-blue-200 font-medium mb-1">Rank</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{summaryStats.rank}</p>
              </div>
              <div className="bg-purple-100 dark:bg-purple-900 rounded-lg p-4 border border-purple-300 dark:border-purple-700">
                <p className="text-xs text-purple-700 dark:text-purple-200 font-medium mb-1">Quartile</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{summaryStats.quartile}</p>
              </div>
              <div className="bg-green-100 dark:bg-green-900 rounded-lg p-4 border border-green-300 dark:border-green-700">
                <p className="text-xs text-green-700 dark:text-green-200 font-medium mb-1">Weighted GPA</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">{summaryStats.weightedGPA}</p>
              </div>
              <div className="bg-orange-100 dark:bg-orange-900 rounded-lg p-4 border border-orange-300 dark:border-orange-700">
                <p className="text-xs text-orange-700 dark:text-orange-200 font-medium mb-1">Unweighted GPA</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{summaryStats.unweightedGPA}</p>
              </div>
            </div>

            {Object.entries(groupedByYear).map(([year, entries]) => (
              <div key={year} className="space-y-2">
                <h2 className="text-2xl font-semibold">{year}</h2>
                <div className="flex flex-wrap gap-6">
                  {entries.map((entry) => (
                    <div key={entry.key} className="rounded-lg border p-4" style={{ minWidth: '250px', maxWidth: '500px' }}>
                      <div className="space-y-2 mb-1">
                        <p className="text-sm font-medium">Semester {entry.semester}<span className='text-muted-foreground font-normal'> • Grade {entry.grade} • {entry.school}</span></p>
                        <p className="text-sm font-medium">Credits: {entry.credits}</p>
                      </div>
                      
                      <div className="overflow-x-auto">
                        {entry.data && Array.isArray(entry.data) && entry.data.length > 0 ? (
                          <Table className="text-xs">
                            <TableHeader>
                              <TableRow>
                                {entry.data[0].map((header, idx) => (
                                  <TableHead key={idx} className="whitespace-nowrap">{header}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {entry.data.slice(1).map((row, rowIdx) => (
                                <TableRow key={rowIdx}>
                                  {row.map((cell, cellIdx) => (
                                    <TableCell key={cellIdx} className="whitespace-nowrap">
                                      {cell}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-sm text-muted-foreground">No course data available</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex justify-start pt-2">
              <Button variant="outline" onClick={handleExport} disabled={exporting}>
                {exporting ? <Spinner className="size-4" /> : <Download />}
                Export Unofficial Transcript
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
