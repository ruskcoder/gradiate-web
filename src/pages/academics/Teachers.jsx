import React from 'react'
import { getTeachers } from '@/lib/grades-api'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Copy, Check } from 'lucide-react'
import ListItem, { ListItemsList } from '@/components/custom/list-item'

export default function Teachers() {
  const [loading, setLoading] = React.useState(true)
  const [teachers, setTeachers] = React.useState([])
  const [error, setError] = React.useState(null)
  const [copiedEmail, setCopiedEmail] = React.useState(null)

  React.useEffect(() => {
    const fetchTeachers = async () => {
      try {
        setLoading(true)
        const data = await getTeachers()
        if (data.success && data.teachers && Array.isArray(data.teachers)) {
          // Email is optional — some portals (Skyward) don't expose it. Keep any
          // entry with a teacher name; dedupe by email when present, else by the
          // teacher/class pair so those portals still list every teacher.
          const seen = new Set()
          const uniqueTeachers = data.teachers.filter((t) => {
            if (!t.teacher) return false
            const dedupeKey = t.email || `${t.teacher}|${t.class || ''}`
            if (seen.has(dedupeKey)) return false
            seen.add(dedupeKey)
            return true
          })
          setTeachers(uniqueTeachers)
        }
      } catch (err) {
        console.error('Failed to fetch teachers:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchTeachers()
  }, [])

  const showTitle = true

  const getInitials = (name) => {
    if (!name) return ''
    const parts = name.split(',').map((p) => p.trim())
    if (parts.length === 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    const words = name.split(' ')
    return (words[0][0] + (words[1]?.[0] || '')).toUpperCase()
  }

  const handleCopyEmail = (email, idx) => {
    navigator.clipboard.writeText(email)
    setCopiedEmail(idx)
    setTimeout(() => setCopiedEmail(null), 2000)
  }

  return (
    <div className="space-y-8 flex flex-col">
      {showTitle && <h1 className="text-4xl font-bold">Teachers</h1>}

      <div className="bg-card rounded-xl p-6 border overflow-y-auto min-h-0 flex flex-col">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Spinner className="size-8" />
          </div>
        )}

        {error && (
          <div className="text-destructive text-center py-8">
            <p>Error loading teachers: {error}</p>
          </div>
        )}

        {!loading && !error && teachers.length === 0 && (
          <div className="text-muted-foreground text-center py-8">
            <p>No teacher data available</p>
          </div>
        )}

        {!loading && !error && teachers.length > 0 && (
          <ListItemsList minWidth="350px">
            {teachers.map((teacher, idx) => (
              <TooltipProvider key={idx}>
                <ListItem
                  squareColor="var(--primary)"
                  squareText={getInitials(teacher.teacher)}
                  Title={teacher.teacher}
                  Desc={teacher.email || teacher.class || ''}
                  minWidth="350px"
                  rightContent={
                    teacher.email ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopyEmail(teacher.email, idx)
                          }}
                          className="h-11 w-7 p-0"
                        >
                          {copiedEmail === idx ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {copiedEmail === idx ? 'Copied!' : 'Copy'}
                      </TooltipContent>
                    </Tooltip>
                    ) : null
                  }
                />
              </TooltipProvider>
            ))}
          </ListItemsList>
        )}
      </div>
    </div>
  )
}
