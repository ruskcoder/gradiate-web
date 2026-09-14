import { useMemo, useState } from 'react'
import { useCurrentUser, useStore } from '@/lib/store'
import TodoList from '@/components/custom/todo-list'
import { ShortcutSection } from '@/components/custom/shortcut-section'
import { GpaWidget, ClassesWidget, BellWidget, MissingWidget } from '@/components/custom/dashboard-widgets'
import { ShareCardDialog } from '@/components/custom/share-card-dialog'
import { getCurrentClasses } from '@/lib/insights'
import { getClasses } from '@/lib/grades-api'
import { CLASSES_ENDPOINT } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { RefreshCw, Share2 } from 'lucide-react'

export default function Dashboard() {
  const user = useCurrentUser()
  const showTitle = user ? user.showPageTitles !== false : true
  const [refreshing, setRefreshing] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const formattedDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })

  const { classes, loadedAt } = useMemo(() => getCurrentClasses(user), [user])

  const refresh = async () => {
    setRefreshing(true)
    try {
      useStore.getState().invalidateCache(CLASSES_ENDPOINT)
      const stream = getClasses()
      while (!(await stream.next()).done) { /* drain */ }
    } catch (e) {
      console.error(e)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {showTitle ? (
          <div>
            <h1 className="text-4xl font-bold">Dashboard</h1>
            <p className="mt-1">{formattedDate}</p>
          </div>
        ) : <div />}
        <div className="flex items-center gap-2">
          {loadedAt && (
            <span className="text-xs text-muted-foreground">
              Updated {new Date(loadedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)} disabled={!classes.length}>
            <Share2 /> Share
          </Button>
          <Button size="sm" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Refreshing' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)] flex-grow">
        <div className="flex flex-col gap-4 min-w-0">
          <ShortcutSection />
          <div className="grid gap-4 lg:grid-cols-2">
            <GpaWidget classes={classes} />
            <BellWidget />
          </div>
          <ClassesWidget classes={classes} />
        </div>
        <div className="flex flex-col gap-4 min-w-0">
          <MissingWidget classes={classes} />
          <div className="bg-card rounded-lg shadow p-4 border space-y-3 flex-grow">
            <TodoList />
          </div>
          <p className="text-xs text-muted-foreground">
            Feature requests: <a className="underline" href="https://forms.gle/GmXtne4w9yGxVcDH8">forms.gle/GmXtne4w9yGxVcDH8</a>
          </p>
        </div>
      </div>

      <ShareCardDialog open={shareOpen} onOpenChange={setShareOpen} classes={classes} />
    </div>
  )
}
