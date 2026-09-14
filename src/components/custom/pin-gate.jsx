import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useCurrentUser, useStore } from '@/lib/store'
import { hashPin, PIN_PATTERN } from '@/lib/privacy-pin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const digits = (v) => v.replace(/\D/g, '').slice(0, 8)

// eslint-disable-next-line react-refresh/only-export-components
export function usePrivacyLock() {
  const user = useCurrentUser()
  const unlocked = useStore((s) => s.privacyUnlocked)
  const setPrivacyUnlocked = useStore((s) => s.setPrivacyUnlocked)
  const locked = !!user?.privacyPinHash && !unlocked
  const unlock = (pin) => {
    if (user?.privacyPinHash && hashPin(pin) === user.privacyPinHash) {
      setPrivacyUnlocked(true)
      return true
    }
    return false
  }
  return { locked, unlock }
}

export function PinPromptDialog({ open, onOpenChange }) {
  const { unlock } = usePrivacyLock()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    if (unlock(pin)) {
      setPin('')
      setError('')
      onOpenChange(false)
    } else {
      setPin('')
      setError('Incorrect PIN')
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2"><Lock className="size-5" /> Enter privacy PIN</AlertDialogTitle>
          <AlertDialogDescription>GPA, rank and transcripts are protected on this account.</AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          autoFocus
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="PIN"
          value={pin}
          onChange={(e) => { setPin(digits(e.target.value)); setError('') }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button onClick={submit} disabled={!pin}>Unlock</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Page-level gate: shows a lock screen and PIN prompt until unlocked. */
export function PinGate({ title, children }) {
  const { locked } = usePrivacyLock()
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)
  if (!locked) return children
  return (
    <div className="h-full min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center">
      <Lock className="size-10 text-muted-foreground" />
      <h2 className="text-xl font-semibold">{title} is locked</h2>
      <p className="text-sm text-muted-foreground">Enter your privacy PIN to view it.</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => navigate(-1)}>Go back</Button>
        <Button onClick={() => setOpen(true)}>Unlock</Button>
      </div>
      <PinPromptDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}

/** Settings section to set, change or remove the privacy PIN. */
export function PrivacyPinSettings() {
  const user = useCurrentUser()
  const changeUserData = useStore((s) => s.changeUserData)
  const setPrivacyUnlocked = useStore((s) => s.setPrivacyUnlocked)
  const hasPin = !!user?.privacyPinHash
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState(null)

  const reset = () => { setCurrent(''); setNext(''); setConfirm('') }
  const verify = () => !hasPin || hashPin(current) === user.privacyPinHash

  const save = () => {
    if (!verify()) return setMsg({ error: true, text: 'Current PIN is incorrect.' })
    if (!PIN_PATTERN.test(next)) return setMsg({ error: true, text: 'PIN must be 4–8 digits.' })
    if (next !== confirm) return setMsg({ error: true, text: "PINs don't match." })
    changeUserData('privacyPinHash', hashPin(next))
    setPrivacyUnlocked(false)
    reset()
    setMsg({ text: hasPin ? 'PIN changed.' : 'PIN set. GPA, rank and transcripts are now locked.' })
  }

  const remove = () => {
    if (!verify()) return setMsg({ error: true, text: 'Current PIN is incorrect.' })
    changeUserData('privacyPinHash', '')
    reset()
    setMsg({ text: 'PIN removed.' })
  }

  const field = (id, label, value, set) => (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => { set(digits(e.target.value)); setMsg(null) }}
        className="max-w-[180px]"
      />
    </div>
  )

  return (
    <div className="mt-4 flex flex-col gap-3">
      <p className="text-sm">
        Status: <span className="font-medium">{hasPin ? 'On' : 'Off'}</span>
      </p>
      <div className="flex flex-wrap gap-3">
        {hasPin && field('pin-current', 'Current PIN', current, setCurrent)}
        {field('pin-next', hasPin ? 'New PIN' : 'PIN (4–8 digits)', next, setNext)}
        {field('pin-confirm', 'Confirm PIN', confirm, setConfirm)}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={save}>{hasPin ? 'Change PIN' : 'Set PIN'}</Button>
        {hasPin && <Button variant="destructive" onClick={remove}>Remove PIN</Button>}
      </div>
      {msg && <p className={`text-sm ${msg.error ? 'text-destructive' : 'text-green-600'}`}>{msg.text}</p>}
    </div>
  )
}
