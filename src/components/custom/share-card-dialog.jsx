import { useEffect, useRef, useState } from 'react'
import { useCurrentUser } from '@/lib/store'
import { formatGrade } from '@/lib/grade-display'
import { projectGpa, defaultGpaType } from '@/lib/insights'
import { APP_NAME } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from 'sonner'
import { usePrivacyLock } from '@/components/custom/pin-gate'

const W = 1080
const H = 1350

const colorFor = (avg) => {
  if (avg === null) return '#9ca3af'
  if (avg >= 90) return '#22c55e'
  if (avg >= 80) return '#3b82f6'
  if (avg >= 70) return '#eab308'
  return '#ef4444'
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function draw(canvas, { classes, hideNumbers, showGpa, gpa, name }) {
  const ctx = canvas.getContext('2d')
  const font = 'Lexend, system-ui, sans-serif'
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#0f172a')
  bg.addColorStop(1, '#1e3a8a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#ffffff'
  ctx.font = `700 64px ${font}`
  ctx.fillText(name ? `${name.split(' ')[0]}'s grades` : 'My grades', 80, 150)
  ctx.fillStyle = '#94a3b8'
  ctx.font = `400 34px ${font}`
  ctx.fillText(new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }), 80, 205)

  let y = 270
  if (showGpa && gpa) {
    roundRect(ctx, 80, y, W - 160, 150, 28)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fill()
    ctx.fillStyle = '#94a3b8'
    ctx.font = `400 32px ${font}`
    ctx.fillText('Projected GPA', 120, y + 62)
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 64px ${font}`
    ctx.fillText(gpa.gpa.toFixed(3), 120, y + 125)
    y += 190
  }

  const shown = classes.slice(0, 9)
  const rowH = Math.min(92, (H - y - 140) / Math.max(shown.length, 1))
  for (const cls of shown) {
    roundRect(ctx, 80, y, W - 160, rowH - 16, 22)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fill()
    ctx.fillStyle = '#e2e8f0'
    ctx.font = `500 34px ${font}`
    let label = cls.name
    while (ctx.measureText(label).width > W - 460 && label.length > 4) label = label.slice(0, -2)
    if (label !== cls.name) label += '…'
    ctx.fillText(label, 115, y + rowH / 2 + 4)

    const text = formatGrade(cls.average, hideNumbers ? 'letter+' : 'decimal')
    roundRect(ctx, W - 300, y + 12, 185, rowH - 40, 16)
    ctx.fillStyle = colorFor(cls.average)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 38px ${font}`
    ctx.textAlign = 'center'
    ctx.fillText(text, W - 207, y + rowH / 2 + 6)
    ctx.textAlign = 'left'
    y += rowH
  }

  ctx.fillStyle = '#64748b'
  ctx.font = `500 30px ${font}`
  ctx.fillText(`Made with ${APP_NAME}`, 80, H - 70)
}

export function ShareCardDialog({ open, onOpenChange, classes }) {
  const user = useCurrentUser()
  const canvasRef = useRef(null)
  const [hideNumbers, setHideNumbers] = useState(true)
  const [showGpa, setShowGpa] = useState(false)
  const { locked } = usePrivacyLock()

  useEffect(() => {
    if (!open) return
    // Wait a frame so the canvas is mounted inside the sheet.
    const id = requestAnimationFrame(() => {
      if (!canvasRef.current) return
      draw(canvasRef.current, {
        classes,
        hideNumbers,
        showGpa: showGpa && !locked,
        gpa: projectGpa(user, classes, defaultGpaType(user)),
        name: user?.name,
      })
    })
    return () => cancelAnimationFrame(id)
  }, [open, classes, hideNumbers, showGpa, locked, user])

  const toBlob = () => new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/png'))

  const download = async () => {
    const blob = await toBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'grades.png'
    a.click()
    URL.revokeObjectURL(url)
  }

  const copy = async () => {
    try {
      const blob = await toBlob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast('Image copied to clipboard')
    } catch {
      toast('Copy is not supported in this browser — use Download instead')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Share card</SheetTitle>
          <SheetDescription>Generate an image of your current grades.</SheetDescription>
        </SheetHeader>
        <div className="px-4 flex flex-col gap-4">
          <canvas ref={canvasRef} width={W} height={H} className="w-full rounded-lg border" />
          <div className="flex items-center gap-2">
            <Checkbox id="share-hide" checked={hideNumbers} onCheckedChange={(v) => setHideNumbers(!!v)} />
            <Label htmlFor="share-hide">Show letter grades instead of numbers</Label>
          </div>
          {!locked && (
            <div className="flex items-center gap-2">
              <Checkbox id="share-gpa" checked={showGpa} onCheckedChange={(v) => setShowGpa(!!v)} />
              <Label htmlFor="share-gpa">Include projected GPA</Label>
            </div>
          )}
          <div className="flex gap-2 pb-4">
            <Button className="flex-1" onClick={download}>Download</Button>
            <Button className="flex-1" variant="outline" onClick={copy}>Copy</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
