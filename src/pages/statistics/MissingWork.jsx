import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentUser, useStore } from '@/lib/store'
import { getCurrentClasses, getMissingAssignments } from '@/lib/insights'
import { syncMissingTodos } from '@/lib/grade-alerts'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ListPlus, Check } from 'lucide-react'

export default function MissingWork() {
  const user = useCurrentUser()
  const changeUserData = useStore((s) => s.changeUserData)
  const addTodo = useStore((s) => s.addTodo)
  const showTitle = user ? user.showPageTitles !== false : true

  const { classes, loadedAt } = useMemo(() => getCurrentClasses(user), [user])
  const missing = useMemo(() => getMissingAssignments(classes), [classes])
  const todoSources = new Set((user?.todos || []).map((t) => t.source).filter(Boolean))
  const totalGain = missing.reduce((s, m) => s + (m.gain || 0), 0)
  const classesWithoutDetail = classes.filter((c) => !c.scores.length).length

  return (
    <div className="space-y-6">
      {showTitle && <h1 className="text-4xl font-bold">Missing Work</h1>}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Assignments</p>
            <p className="text-3xl font-bold">{missing.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total points to gain</p>
            <p className="text-3xl font-bold text-green-600">+{totalGain.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="auto-todo"
            checked={!!user?.autoTodoFromMissing}
            onCheckedChange={(v) => {
              changeUserData('autoTodoFromMissing', !!v)
              if (v) syncMissingTodos()
            }}
          />
          <Label htmlFor="auto-todo">Automatically add missing work to my todo list</Label>
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Assignment</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">If turned in</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {missing.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  Nothing missing in your stored grades.
                </TableCell>
              </TableRow>
            ) : missing.map((m) => {
              const source = `missing:${m.id}`
              const added = todoSources.has(source)
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.className}</TableCell>
                  <TableCell>{m.category}</TableCell>
                  <TableCell>{m.dateDue}</TableCell>
                  <TableCell>
                    <Badge className={m.reason === 'Missing' ? 'bg-red-500' : 'bg-gray-500'}>{m.reason}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-green-600 font-semibold">
                    {m.gain !== null ? `+${m.gain.toFixed(2)}` : '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      disabled={added}
                      title={added ? 'Already in todos' : 'Add to todos'}
                      onClick={() => addTodo({ title: `${m.className}: ${m.name}`, dueDate: null, completed: false, source })}
                    >
                      {added ? <Check size={16} /> : <ListPlus size={16} />}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Based on grades stored {loadedAt ? `on ${new Date(loadedAt).toLocaleString()}` : 'on this device'}.
        {classesWithoutDetail > 0 && ` ${classesWithoutDetail} class(es) have no assignment detail stored yet — open them on the `}
        {classesWithoutDetail > 0 && <Link className="underline" to="/grades">Grades</Link>}
        {classesWithoutDetail > 0 && ' page to include them.'}
      </p>
    </div>
  )
}
