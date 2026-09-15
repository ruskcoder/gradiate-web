import React from "react"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle
} from "@/components/ui/item"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { categoryColor } from "./grades-stats"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useCurrentUser } from "@/lib/store"
import { formatGrade } from "@/lib/grade-display"
import { Trash2, Edit, Save, Star } from 'lucide-react'

// Scrim overlaid on a colored grade chip so the "hide colors" primary tint (and
// the card header) reads as a rich muted tone rather than a flat vivid block —
// mirrors the mobile app. 30% black in light mode, 60% in dark.
const GRADE_SCRIM = "bg-black/30 dark:bg-black/60"

export const gradeAndColor = (grade, badges = null, hideColors = false) => {
  let numericGrade = null
  if (grade === null || typeof grade === 'undefined' || grade === '') {
    grade = "···"
  } else {
    numericGrade = parseFloat(grade)
    grade = numericGrade.toPrecision(4)
  }

  if (grade === "···") return { grade, numericGrade, gradeColor: "bg-gray-400", textColor: "text-white", bgColor: "#9ca3af" };

  if (badges && badges.includes("exempt")) {
    return { grade: "X", numericGrade, gradeColor: "bg-sky-500", textColor: "text-white", bgColor: "#0ea5e9" }
  }

  if (badges && (badges.includes("dropped") || badges.includes("excluded"))) {
    return { grade, numericGrade, gradeColor: "bg-gray-400", textColor: "text-white", bgColor: "#9ca3af" }
  }

  if (badges && badges.includes("missing")) {
    return { grade, numericGrade, gradeColor: "bg-red-500", textColor: "text-white", bgColor: "#ef4444" }
  }

  if (hideColors) {
    return { grade, numericGrade, gradeColor: "bg-primary", textColor: "text-white", bgColor: "var(--primary)" }
  }

  if (grade >= 90) return { grade, numericGrade, gradeColor: "bg-green-500", textColor: "text-white", bgColor: "#22c55e" }
  if (grade >= 80) return { grade, numericGrade, gradeColor: "bg-blue-500", textColor: "text-white", bgColor: "#3b82f6" }
  if (grade >= 70) return { grade, numericGrade, gradeColor: "bg-yellow-500", textColor: "text-white", bgColor: "#eab308" }
  return { grade, numericGrade, gradeColor: "bg-red-500", textColor: "text-white", bgColor: "#ef4444" }
}

// Applies the user's Number Display preference to an already-color-resolved
// grade, leaving placeholder/exempt markers ("···", "X") untouched.
const displayGradeValue = (gradeValue, numericGrade, numberDisplay) =>
  numericGrade !== null && numericGrade !== undefined && gradeValue !== "···" && gradeValue !== "X"
    ? formatGrade(numericGrade, numberDisplay)
    : gradeValue

export function GradesList({ variant, children }) {
  const width = variant === "card" ? '175px' : '250px';

  const injectVariant = (el) => {
    if (!React.isValidElement(el)) return el;
    const t = el.type;
    if (typeof t === 'string') {
      const children = el.props.children;
      if (!children) return el;
      const newChildren = React.Children.map(children, injectVariant);
      if (newChildren === children) return el;
      return React.cloneElement(el, undefined, newChildren);
    }
    return React.cloneElement(el, { variant });
  }

  return (
    <div
      className='gap-2'
      style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${width}, 1fr))`, justifyItems: 'stretch' }}
    >
      {children && React.Children.map(children, child => injectVariant(child))}
    </div>
  )
}

// Inline pill after the course ID showing how far the average moved since the
// class was last opened. Fixed 18px height so it never grows the text line.
function DeltaBadge({ delta }) {
  if (delta === null || delta === undefined) return null
  const up = delta > 0
  return (
    <span
      title="Change since you last opened this class"
      className={`ml-1.5 inline-flex h-[18px] shrink-0 items-center rounded-full px-1.5 align-middle text-[12px] font-semibold leading-none tabular-nums text-white ${up ? 'bg-green-600' : 'bg-red-600'}`}
    >
      {up ? '+' : ''}{delta.toFixed(2)}%
    </span>
  )
}

// Star centered on an assignment's top-left corner when it's new since last load.
function NewAssignmentBadge() {
  return (
    <span
      title="New assignment"
      className="pointer-events-none z-10 absolute -top-2.5 -left-2.5 flex size-5 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow"
    >
      <Star className="size-3 fill-current" />
    </span>
  )
}

export function GradesItem({ courseName, id, grade, variant, change }) {
  const currentUser = useCurrentUser()
  const hideColors = currentUser?.hideColors ?? false
  const numberDisplay = currentUser?.numberDisplay ?? 'decimal'
  const { grade: gradeValue, numericGrade, gradeColor, textColor, bgColor } = gradeAndColor(grade, null, hideColors)
  const displayGrade = displayGradeValue(gradeValue, numericGrade, numberDisplay)
  return variant === "card" ? (
    <div className="relative">
    <Card className="grade-card w-full pt-0 overflow-hidden pb-2 gap-3 max-w-[350px] min-w-[175px] cursor-pointer hover:bg-accent transition-colors">
      <CardHeader
        className="relative flex flex-col justify-center items-center m-0 p-4 py-5 overflow-hidden gap-2"
        style={{ backgroundColor: bgColor }}
      >
        <div
          aria-hidden
          className="z-1 absolute inset-0 pointer-events-none bg-black/30 dark:bg-black/60"
        />
        <span className={`text-[2.5rem]/10 relative z-2 ${textColor}`}>
          {displayGrade}
        </span>
        <div className={`z-2 flex w-full text-sm justify-center items-center gap-2`}>
          <span className={textColor}>0%</span>
          <Progress value={numericGrade ?? 0} className="border-1 border-white h-2" dark={true} />
          <span className={textColor}>100%</span>
        </div>
      </CardHeader>
      <CardContent className="px-3">
        <CardTitle className="truncate mb-[2px]">{courseName}</CardTitle>
        <CardDescription className="flex items-center min-w-0 h-5">
          <span className="truncate">{id}</span>
          <DeltaBadge delta={change?.delta} />
        </CardDescription>
      </CardContent>
    </Card>
    </div>
  ) : (
    <div className="relative">
    <Item variant="outline" className="p-2 min-w-[250px] cursor-pointer hover:bg-accent transition-colors">
      <div className="flex w-full items-center justify-between">
        <ItemContent className="gap-0 ml-1 mr-3 min-w-0">
          <ItemTitle className="text-base font-semibold truncate block">{courseName}</ItemTitle>
          <ItemDescription className="flex items-center min-w-0 h-5">
            <span className="truncate">{id}</span>
            <DeltaBadge delta={change?.delta} />
          </ItemDescription>
        </ItemContent>
        <ItemActions className="flex-shrink-0">
          <span className={`relative overflow-hidden block font-semibold tracking-wide text-[1.5rem] ${textColor} text-center rounded-sm px-2 py-[2px] mr-[4px] ${gradeColor} min-w-[86px]`}>
            {hideColors && <span aria-hidden className={`absolute inset-0 pointer-events-none ${GRADE_SCRIM}`} />}
            <span className="relative z-1">{displayGrade}</span>
          </span>
        </ItemActions>
      </div>
    </Item>
    </div>
  )
}

export function ClassGradesList({ children }) {
  const width = '275px';
  return (
    <div
      className='gap-2'
      style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${width}, 1fr))`, justifyItems: 'stretch' }}
    >
      {children && React.Children.map(children, child => child)}
    </div>
  )
}

export function ClassGradesItem({ scoreData, onRemove, onToggleExcluded, onEditPercentage, impactBadge, isNew = false }) {
  const currentUser = useCurrentUser()
  const hideColors = currentUser?.hideColors ?? false
  const numberDisplay = currentUser?.numberDisplay ?? 'decimal'
  const [isOpen, setIsOpen] = React.useState(false)
  const [isEditing, setIsEditing] = React.useState(false)
  const initialEditingValue = (() => {
    const p = scoreData.percentage
    if (p === null || typeof p === 'undefined' || p === '') return ''
    const s = String(p).trim()
    return s.endsWith('%') ? s.slice(0, -1) : s
  })()
  const [editingPercentage, setEditingPercentage] = React.useState(initialEditingValue)
  React.useEffect(() => {
    if (!isEditing) {
      const p = scoreData.percentage
      const s = (p === null || typeof p === 'undefined' || p === '') ? '' : String(p).trim()
      setEditingPercentage(s.endsWith('%') ? s.slice(0, -1) : s)
    }
  }, [scoreData.percentage, isEditing])
  const assignmentName = scoreData.name
  const date = scoreData.dateDue
  const displayGrade = (scoreData.percentage !== undefined && scoreData.percentage !== null) ? scoreData.percentage : scoreData.score
  const { grade, numericGrade, gradeColor, textColor } = gradeAndColor(displayGrade, scoreData.badges, hideColors)
  const formattedGrade = displayGradeValue(grade, numericGrade, numberDisplay)
  const category = scoreData.category
  const badgeColors = {
    "missing": "bg-red-500",
    "exempt": "bg-sky-500",
    "dropped": "bg-gray-400",
  };
  const badgeLabels = {
    "missing": "M",
    "exempt": "X",
    "dropped": "D",
  };

  const handleDelete = () => {
    setIsOpen(false)
    if (onRemove) {
      onRemove()
    }
  }

  const handleSavePercentage = () => {
    if (onEditPercentage) {
      const raw = String(editingPercentage).trim()
      if (raw === '') {
        onEditPercentage('')
      } else {
        const parsed = parseFloat(raw.replace('%', ''))
        onEditPercentage(!isNaN(parsed) ? parsed : 0)
      }
    }
    setIsEditing(false)
  }

  const handleEditClick = () => {
    setIsEditing(true)
    const p = scoreData.percentage
    const s = (p === null || typeof p === 'undefined') ? '' : String(p).trim()
    setEditingPercentage(s.endsWith('%') ? s.slice(0, -1) : s)
  }

  return (
    <div className="relative">
    {isNew && <NewAssignmentBadge />}
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Item variant="outline" className="p-2 min-w-[275px] cursor-pointer hover:bg-accent transition-colors">
          <div className="flex w-full items-center justify-between">
            <div className="h-[44px] w-5 rounded-sm mr-1" style={{ backgroundColor: categoryColor(category) }} />
            <ItemContent className="gap-0 ml-1 mr-3 min-w-0">
              <ItemTitle className="text-base font-semibold truncate block">{assignmentName}</ItemTitle>
              <ItemDescription className="truncate block">
                {scoreData.badges && scoreData.badges.map((badge) => (
                  <Badge key={badge} className={`px-1 py-0 mr-1 ${badgeColors[badge] || ''}`}>
                    {badgeLabels[badge] || badge}
                  </Badge>
                ))}
                {date}
              </ItemDescription>
            </ItemContent>
            <ItemActions className="flex-shrink-0 flex items-center gap-2">
              {impactBadge !== undefined && (
                <Badge className={`px-2 py-1 font-semibold text-md ${
                  impactBadge > 0
                    ? 'bg-green-600'
                    : impactBadge < 0
                    ? 'bg-red-600'
                    : 'bg-gray-600'
                }`}>
                  {impactBadge > 0 ? '+' : ''}{impactBadge.toFixed(2)}
                </Badge>
              )}
              <span className={`relative overflow-hidden block font-semibold tracking-wide text-[1.35rem] ${textColor} text-center rounded-sm px-2 py-[2px] mr-[4px] min-w-[76px] ${gradeColor} ${scoreData.badges.includes('dropped') || scoreData.excluded ? 'line-through' : ''}`}>
                {hideColors && <span aria-hidden className={`absolute inset-0 pointer-events-none ${GRADE_SCRIM}`} />}
                <span className="relative z-1">{formattedGrade}</span>
              </span>
            </ItemActions>
          </div>
        </Item>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <h4 className="font-medium leading-none">{assignmentName}</h4>
              <p className="text-sm text-muted-foreground">
                Assignment details
              </p>
            </div>
            {scoreData.percentage !== undefined && onEditPercentage && (
              <Button
                variant="outline"
                size="sm"
                onClick={isEditing ? handleSavePercentage : handleEditClick}
                className="ml-2 p-2"
              >
                {isEditing ? <Save className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
              </Button>
            )}
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-2 items-center gap-4">
              <span className="text-sm font-medium">Category:</span>
              <span className="text-sm">{category}</span>
            </div>
            <div className="grid grid-cols-2 items-center gap-4">
              <span className="text-sm font-medium">Due Date:</span>
              <span className="text-sm">{date}</span>
            </div>
            {scoreData.dateAssigned && (
              <div className="grid grid-cols-2 items-center gap-4">
                <span className="text-sm font-medium">Assigned:</span>
                <span className="text-sm">{scoreData.dateAssigned}</span>
              </div>
            )}
            <div className="grid grid-cols-2 items-center gap-4">
              <span className="text-sm font-medium">Score:</span>
              <span className="text-sm">{scoreData.score !== '' && scoreData.score !== null && typeof scoreData.score !== 'undefined' ? parseFloat(scoreData.score).toFixed(2) : '···'}</span>
            </div>
            {scoreData.totalPoints !== undefined && (
              <div className="grid grid-cols-2 items-center gap-4">
                <span className="text-sm font-medium">Max Points:</span>
                <span className="text-sm">{scoreData.totalPoints}</span>
              </div>
            )}
            {scoreData.percentage !== undefined && (
              <div className="grid grid-cols-2 items-center gap-4">
                <span className="text-sm font-medium">Percentage:</span>
                {isEditing ? (
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*\\.?[0-9]*"
                    value={editingPercentage}
                    onChange={(e) => setEditingPercentage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSavePercentage() } }}
                    className="h-8"
                    placeholder={scoreData.percentage != "" ? parseFloat(scoreData.percentage).toFixed(2) + "%" : ""}
                  />
                ) : (
                  <span className="text-sm">{scoreData.percentage !== '' && scoreData.percentage !== null && typeof scoreData.percentage !== 'undefined' ? parseFloat(scoreData.percentage).toFixed(2) + "%" : '···'}</span>
                )}
              </div>
            )}
            {scoreData.weight !== undefined && (
              <div className="grid grid-cols-2 items-center gap-4">
                <span className="text-sm font-medium">Weight:</span>
                <span className="text-sm">{scoreData.weight}</span>
              </div>
            )}
            {scoreData.badges && scoreData.badges.length > 0 && (
              <div className="grid grid-cols-2 items-start gap-4">
                <span className="text-sm font-medium">Badges:</span>
                <span className="text-sm">
                  {scoreData.badges && scoreData.badges.map((badge) => (
                    <Badge key={badge} className={`px-1 py-0 mr-1 ${badgeColors[badge] || ''}`}>
                      {badge.toUpperCase()}
                    </Badge>
                  ))}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {onToggleExcluded && (
              <label className="hover:bg-accent/50 flex items-center gap-3 rounded-lg border p-2 has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/10 flex-1">
                <Checkbox
                  checked={scoreData.excluded || false}
                  onCheckedChange={onToggleExcluded}
                  className="data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-white"
                />
                <p className="text-sm leading-none font-medium">
                  Disable
                </p>
              </label>
            )}
            {onRemove && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="flex-1"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
    </div>
  )
}