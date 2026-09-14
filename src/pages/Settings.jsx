import React from 'react'
import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { exportBackup, importBackup } from '@/lib/backup'
import { PrivacyPinSettings } from '@/components/custom/pin-gate'
import { useCurrentUser, useStore } from '@/lib/store'
import { getColorThemes } from '@/lib/color-themes'
import { applyColorTheme } from '@/lib/apply-color-theme'
import { clearGradesStore } from '@/lib/grades-store'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useTheme } from '@/components/theme-provider'
import { GradesItem } from '@/components/custom/grades-item'

const ColorIcons = ({ colors, darkColors, isDark }) => {
  const displayColors = isDark && darkColors ? darkColors : colors
  return (
    <div className='flex gap-1'>
      {displayColors.map((color, index) => (
        <div
          key={index}
          className={`border h-4 w-4 rounded-md m-0 p-0`}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  )
}

export default function Settings() {
  const user = useCurrentUser()
  const changeUserData = useStore((s) => s.changeUserData)
  const { setTheme } = useTheme()
  const [colorThemes, setColorThemes] = useState([])
  const [themesLoading, setThemesLoading] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showClearHistoryDialog, setShowClearHistoryDialog] = useState(false)
  const [showWipeDialog, setShowWipeDialog] = useState(false)
  const importInputRef = useRef(null)

  useEffect(() => {
    const loadThemes = async () => {
      try {
        const themes = await getColorThemes()
        setColorThemes(themes)
      } catch (error) {
        console.error('Failed to load color themes:', error)
      } finally {
        setThemesLoading(false)
      }
    }
    
    loadThemes()

    // Detect dark mode
    const isDark = document.documentElement.classList.contains('dark')
    setIsDarkMode(isDark)

    // Listen for dark mode changes
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark')
      setIsDarkMode(isDark)
    })
    
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    
    return () => observer.disconnect()
  }, [])

  if (!user) {
    return (
      <div className="p-4">
        <h1 className="text-4xl font-bold">Settings</h1>
        <p className="mt-2 text-muted-foreground">No user selected.</p>
      </div>
    )
  }

  const alertSettings = {
    browserNotifications: false,
    autoRefreshMinutes: 0,
    ...(user.alertSettings || {}),
  }
  const setAlertSetting = (key, value) =>
    changeUserData('alertSettings', { ...alertSettings, [key]: value })

  return (
    <div className="p-6">
      <h1 className="text-4xl font-bold">Settings</h1>
      <p className="mt-2 text-muted-foreground">Application settings and preferences.</p>

      <div className="mt-6 space-y-8">
        <section>
          <h2 className="text-lg font-semibold">Appearance</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Theme and visual preferences.</p>
          
          <Label>Color Theme</Label>
          <p className='text-xs text-muted-foreground mt-1'>Disclaimer: Some color themes may not be optimized for looks.</p>
          <div className="mt-2 mb-4">
            <Select
              value={user.colorTheme}
              onValueChange={(val) => {
                changeUserData('colorTheme', val)
                applyColorTheme(val).catch(() => {})
              }}
              className="w-full"
            >
              <SelectTrigger>
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Color Theme</SelectLabel>
                  {themesLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading themes...
                    </SelectItem>
                  ) : (
                    colorThemes.map((theme) => (
                      <SelectItem key={theme.filename} value={theme.filename}>
                        <div className="flex items-center gap-2">
                          {theme.colors && theme.colors.length > 0 && (
                            <ColorIcons colors={theme.colors} darkColors={theme.darkColors} isDark={isDarkMode} />
                          )}
                          <span>{theme.name}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Checkbox
              id="match-theme-logo"
              checked={!!user.matchThemeWithLogo}
              onCheckedChange={(checked) => changeUserData('matchThemeWithLogo', !!checked)}
              disabled={user.colorTheme == 'default'}
            />
            <Label htmlFor="match-theme-logo" className="cursor-pointer">Match logo with theme</Label>
          </div>
          <div className="mt-8 flex gap-14">
            <div className="">
              <Label>Theme</Label>
              <div className="mt-2">
                <Select
                  value={user.theme}
                  onValueChange={(val) => {
                    changeUserData('theme', val)
                    if (val === 'light' || val === 'dark') setTheme(val)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Theme</SelectLabel>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="">
              <div className="flex flex-col">
                <Label>Grades view</Label>
                <div className="mt-2 flex items-start gap-4">
                  <div className="w-full">
                    <Select
                      value={user.gradesView}
                      onValueChange={(val) => changeUserData('gradesView', val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select view" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Grades</SelectLabel>
                          <SelectItem value="list">List</SelectItem>
                          <SelectItem value="card">Cards</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="absolute translate-x-50 -translate-y-[75%] h-24 w-36 flex items-center justify-center">
                <GradesItem
                  courseName="Preview Course"
                  id="MATH101"
                  grade={92}
                  variant={user.gradesView}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 max-w-xs">
            <Label>Number display</Label>
            <p className='text-xs text-muted-foreground mt-1'>How numeric grades are shown across the app.</p>
            <div className="mt-2">
              <Select
                value={user.numberDisplay || 'decimal'}
                onValueChange={(val) => changeUserData('numberDisplay', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select display" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Number Display</SelectLabel>
                    <SelectItem value="decimal">Decimal (96.6)</SelectItem>
                    <SelectItem value="rounded">Rounded (97)</SelectItem>
                    <SelectItem value="letter">Letter (A)</SelectItem>
                    <SelectItem value="letter+">Letter+ (A+)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <Checkbox
              id="hide-colors"
              checked={!!user.hideColors}
              onCheckedChange={(checked) => changeUserData('hideColors', !!checked)}
            />
            <Label htmlFor="hide-colors" className="cursor-pointer">Hide grade colors</Label>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">General</h2>
          <p className="text-sm text-muted-foreground mt-1">General app options.</p>

          <div className="mt-4 flex flex-col gap-4">
            <div className="max-w-xs">
              <Label>Default page</Label>
              <div className="text-sm text-muted-foreground">Page that opens when you start the app.</div>
              <div className="mt-2">
                <Select
                  value={user.defaultPage || 'dashboard'}
                  onValueChange={(val) => changeUserData('defaultPage', val)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dashboard">Dashboard</SelectItem>
                    <SelectItem value="grades">Grades</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={!!user.showPageTitles}
                onCheckedChange={(checked) => changeUserData('showPageTitles', !!checked)}
              />
              <div>
                <Label>Show page titles</Label>
                <div className="text-sm text-muted-foreground">Show or hide page titles across the app.</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={user.animationsEnabled !== false}
                onCheckedChange={(checked) => changeUserData('animationsEnabled', !!checked)}
              />
              <div>
                <Label>Enable animations</Label>
                <div className="text-sm text-muted-foreground">Play transitions when switching grade terms and revealing grades.</div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Alerts & Refresh</h2>
          <p className="text-sm text-muted-foreground mt-1">Get told when your grades change.</p>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={user.changeAlerts !== false}
                onCheckedChange={(checked) => changeUserData('changeAlerts', !!checked)}
              />
              <div>
                <Label>Grade change alerts</Label>
                <div className="text-sm text-muted-foreground">Badge classes with how much their average moved, and star classes with new assignments.</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={alertSettings.browserNotifications}
                disabled={typeof Notification === 'undefined'}
                onCheckedChange={async (checked) => {
                  if (checked && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
                    const result = await Notification.requestPermission()
                    if (result !== 'granted') return
                  }
                  setAlertSetting('browserNotifications', !!checked)
                }}
              />
              <div>
                <Label>Browser notifications</Label>
                <div className="text-sm text-muted-foreground">Also send a system notification when the tab is in the background.</div>
              </div>
            </div>
            <div className="max-w-xs">
              <Label>Auto refresh</Label>
              <div className="text-sm text-muted-foreground">Re-check grades while the app is open.</div>
              <div className="mt-2">
                <Select
                  value={String(alertSettings.autoRefreshMinutes)}
                  onValueChange={(val) => setAlertSetting('autoRefreshMinutes', parseInt(val))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Off</SelectItem>
                    <SelectItem value="15">Every 15 minutes</SelectItem>
                    <SelectItem value="30">Every 30 minutes</SelectItem>
                    <SelectItem value="60">Every hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={!!user.autoTodoFromMissing}
                onCheckedChange={(checked) => changeUserData('autoTodoFromMissing', !!checked)}
              />
              <div>
                <Label>Add missing work to todos</Label>
                <div className="text-sm text-muted-foreground">Create a todo for each missing assignment found after a refresh.</div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Privacy PIN</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Require a PIN before GPA, rank or transcripts can be viewed anywhere in the app. Stays unlocked until you reload or switch accounts.
          </p>
          <PrivacyPinSettings />
        </section>

        <section>
          <h2 className="text-lg font-semibold">Backup & Restore</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Save settings, todos, shortcuts, goals, notes, bell schedules and grade history to a file. Passwords are never included.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => exportBackup(user)}>Export backup</Button>
            <Button variant="outline" onClick={() => importInputRef.current?.click()}>Import backup</Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                try {
                  toast(await importBackup(file))
                } catch (err) {
                  toast(err.message || 'Could not import backup')
                }
              }}
            />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Data Management</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage your stored data.</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button 
              variant="destructive" 
              onClick={() => setShowClearHistoryDialog(true)}
            >
              Clear Grades History
            </Button>
            <AlertDialog open={showClearHistoryDialog} onOpenChange={setShowClearHistoryDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Grades History?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all stored grades history. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => {
                      clearGradesStore();
                      setShowClearHistoryDialog(false);
                    }}
                  >
                    Clear
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button variant="destructive" onClick={() => setShowWipeDialog(true)}>
              Remove all data from this device
            </Button>
            <AlertDialog open={showWipeDialog} onOpenChange={setShowWipeDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove all data from this device?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Signs out every account and deletes saved passwords, grade history, todos and settings stored in this browser. Export a backup first if you want to keep them.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      localStorage.clear()
                      sessionStorage.clear()
                      window.location.href = '/login'
                    }}
                  >
                    Remove everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </section>
      </div>
    </div>
  )
}
