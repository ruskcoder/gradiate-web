import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Search, FileText, GraduationCap, Settings as Cog } from 'lucide-react'
import { sidebarData } from '@/components/layout/sidebar-data'
import { useCurrentUser } from '@/lib/store'
import { getCurrentClasses } from '@/lib/insights'
import { formatGrade } from '@/lib/grade-display'

export const OPEN_COMMAND_PALETTE = 'open-command-palette'

function flattenNav(items, parent = '') {
  return items.flatMap((item) => {
    if (item.items?.length) return flattenNav(item.items, item.title)
    return [{ id: item.url, label: item.title, hint: parent, url: item.url, icon: item.icon || FileText }]
  })
}

export function CommandPalette() {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef(null)

  // Reset the search whenever the palette opens.
  const changeOpen = (next) => {
    if (next) { setQuery(''); setActive(0) }
    setOpen(next)
  }

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => {
          if (!o) { setQuery(''); setActive(0) }
          return !o
        })
      }
    }
    const onOpen = () => { setQuery(''); setActive(0); setOpen(true) }
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_COMMAND_PALETTE, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_COMMAND_PALETTE, onOpen)
    }
  }, [])

  const items = useMemo(() => {
    const pages = [
      ...flattenNav(sidebarData.navMain),
      { id: '/settings', label: 'Settings', hint: '', url: '/settings', icon: Cog },
    ]
    const numberDisplay = user?.numberDisplay || 'decimal'
    const classes = open ? getCurrentClasses(user).classes.map((c) => ({
      id: `class:${c.key}`,
      label: c.name,
      hint: `${c.course} · ${formatGrade(c.average, numberDisplay)}`,
      url: '/grades',
      state: { selectCourse: c.key },
      icon: GraduationCap,
    })) : []
    const q = query.trim().toLowerCase()
    const all = [...pages, ...classes]
    return q ? all.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(q)) : all
  }, [query, user, open])

  const select = (item) => {
    if (!item) return
    setOpen(false)
    navigate(item.url, item.state ? { state: item.state } : undefined)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); select(items[active]) }
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={changeOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[15vh] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-xl border bg-background shadow-2xl overflow-hidden"
          onKeyDown={onKeyDown}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Search pages and classes</DialogPrimitive.Description>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0) }}
              placeholder="Search pages and classes…"
              className="h-12 flex-1 bg-transparent text-sm outline-none"
            />
            <kbd className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">Esc</kbd>
          </div>
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1">
            {items.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No results</p>}
            {items.map((item, idx) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  data-index={idx}
                  type="button"
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => select(item)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm ${idx === active ? 'bg-accent text-accent-foreground' : ''}`}
                >
                  <Icon className="size-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="text-xs text-muted-foreground truncate max-w-[45%]">{item.hint}</span>}
                </button>
              )
            })}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
