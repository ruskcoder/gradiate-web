import React from 'react'
import { cn } from '@/lib/utils'

// Only what a grade can look like while it's being typed: an optional minus,
// digits, and one decimal point.
const PARTIAL_GRADE = /^-?\d{0,3}(\.\d{0,2})?$/

const SIZES = {
  md: 'w-[96px] text-[1.4rem] py-[3px]',
  lg: 'w-[180px] text-[2.5rem] py-1',
}

/**
 * A grade chip you can type into. It looks like the colored average pills used
 * across the app and recolors live as the value changes. `computed` pills (the
 * calculator's answer) get a dashed outline so they read as "worked out for
 * you" rather than something the user typed.
 */
export function GradePillInput({
  value,
  onChange,
  color,
  computed = false,
  loading = false,
  size = 'md',
  placeholder = '···',
  className,
  onFocus,
  ...props
}) {
  const pending = loading && !value
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        const next = e.target.value.trim()
        if (next === '' || PARTIAL_GRADE.test(next)) onChange?.(next)
      }}
      onFocus={(e) => {
        e.target.select()
        onFocus?.(e)
      }}
      style={{ backgroundColor: pending ? undefined : color }}
      className={cn(
        'block rounded-sm text-center font-semibold tracking-wide text-white tabular-nums',
        'border-2 outline-none transition-[background-color,border-color] duration-300',
        'placeholder:text-white/75 hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/50',
        computed ? 'border-dashed border-white/70' : 'border-transparent',
        pending && 'animate-pulse bg-gray-400',
        SIZES[size],
        className
      )}
      {...props}
    />
  )
}
