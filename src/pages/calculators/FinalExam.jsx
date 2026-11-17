import React from 'react'
import { useCurrentUser, useStore } from '@/lib/store'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import FinalExamModern from './FinalExamModern'
import FinalExamClassic from './FinalExamClassic'

/**
 * Final Exam Calculator. Users can fall back to the original UI from the
 * checkbox beside the title; the choice is saved on their account.
 */
export default function FinalExamCalculator() {
  const user = useCurrentUser()
  const changeUserData = useStore((s) => s.changeUserData)
  const classic = user?.finalExamClassicUi ?? false

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4 pr-2">
        <h1 className="text-4xl font-bold">Final Exam Calculator</h1>
        <div className="flex items-center gap-2">
          <Checkbox
            id="final-exam-classic"
            checked={classic}
            onCheckedChange={(v) => changeUserData('finalExamClassicUi', v === true)}
          />
          <Label htmlFor="final-exam-classic" className="cursor-pointer text-muted-foreground">
            Use old UI
          </Label>
        </div>
      </div>

      {classic ? <FinalExamClassic /> : <FinalExamModern />}
    </div>
  )
}
