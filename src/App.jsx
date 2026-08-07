import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import './assets/css/main.css';
import { ThemeProvider } from '@/components/theme-provider';
import MainLayout from '@/components/layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Grades from './pages/grades/Grades';
import Settings from './pages/Settings';
import Attendance from './pages/academics/Attendance';
import Schedules from './pages/academics/Schedules';
import Transcripts from './pages/academics/Transcripts';
import ReportCard from './pages/academics/ReportCard';
import ProgressReport from './pages/academics/ProgressReport';
import Teachers from './pages/academics/Teachers';
import ScheduleEditor from './pages/academics/ScheduleEditor';
import FinalExamCalculator from './pages/calculators/FinalExam';
import GPARankCalculator from './pages/calculators/GPA-Rank';
import { useStore } from '@/lib/store';
import { useCurrentUser } from '@/lib/store';
import { toast } from "sonner"
import { Toaster } from '@/components/ui/sonner';
import { API_URL } from '@/lib/constants';
import { Megaphone } from 'lucide-react';
import { applyColorTheme } from '@/lib/apply-color-theme';

// eslint-disable-next-line react-refresh/only-export-components
export async function fetchReferralData(user, changeUserData, {
  setReferralCode,
  setReferralStatus,
  setLoading,
} = {}) {
  if (!user) return
  if (setLoading) setLoading(true)
  try {
    const response = await fetch(`${API_URL}referral?username=${encodeURIComponent(user.username)}`)
    const data = await response.json()

    const referralCode = data.referralCode || 'N/A'
    const numReferrals = data.numReferrals ?? 0
    if (setReferralCode) setReferralCode(referralCode)
    if (setReferralStatus) setReferralStatus(numReferrals)

    const isPremium = numReferrals >= 0
    changeUserData('premium', isPremium)

    if (data?.blocked) {
      document.body.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100vh;
          background-color: #f8d7da;
          color: #721c24;
          font-family: Arial, sans-serif;
          font-size: 24px;
          text-align: center;
        ">
          <div>
        <strong>You have been blocked. <br/> Please contact info@gradiate.com for assistance.</strong>
          
          </div>
          <button style="
            margin-top: 20px;
            padding: 10px 20px;
            font-size: 18px;
            background-color: #721c24;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
          " onclick="localStorage.clear(); location.reload();">Logout</button>
        </div>
      `;
      document.body.style.margin = "0";
      document.body.style.padding = "0";
    }
  } catch (error) {
    console.error('Failed to fetch referral data:', error)
  } finally {
    if (setLoading) setLoading(false)
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export async function showWebNotificationsForUser(currentUser, loggingIn = false) {
  if (!currentUser) return

  try {
    const resp = await fetch(`${API_URL}web-notifications?username=${encodeURIComponent(currentUser.username)}`)
    if (!resp.ok) return
    const body = await resp.json()
    const items = Array.isArray(body?.data) ? body.data : []
    const lastLoginDate = currentUser?.lastLogin ? new Date(currentUser.lastLogin) : null

    for (const it of items) {
      const created = it?.created_at ? new Date(it.created_at) : null
      if (!created) continue
      if ((lastLoginDate == null || created > lastLoginDate) && (loggingIn === !!it.show_on_login)) {
        try {
          toast(it.title || "New Notification", {
            duration: 7000,
            position: 'top-right',
            description: it.notification || 'Unable to load notification content.',
            icon: <div className="w-8 h-8 bg-primary flex items-center justify-center rounded-lg">
              <Megaphone className='w-5 h-5 text-primary-foreground' />
            </div>,
            closeButton: true,
          })
        } catch (_e) {
          // ignore toast errors
        }
      }
    }

    try {
      useStore.getState().changeUserData('lastLogin', new Date().toISOString())
    } catch (e) {
      console.error(e);
    }
  } catch (e) {
    console.error(e);
  }
}

function ProtectedRoute({ children }) {
  const currentUserIndex = useStore((state) => state.currentUserIndex);
  const users = useStore((state) => state.users);
  const notLogged = currentUserIndex === -1 || users.length === 0;

  if (notLogged) {
    return <Navigate to="/login" replace />;
  }

  return <MainLayout>{children}</MainLayout>;
}

export default function App() {
  const currentUserIndex = useStore((state) => state.currentUserIndex);
  const users = useStore((state) => state.users);
  const currentUser = useCurrentUser();
  const notLogged = currentUserIndex === -1 || users.length === 0;
  const [isDarkMode, setIsDarkMode] = React.useState(false)

  useEffect(() => {
    if (!currentUser) return;

    try {
      fetchReferralData(currentUser, useStore.getState().changeUserData).catch(() => {});
      showWebNotificationsForUser(currentUser);
    } catch (_e) {
      // 
    }
  }, []);

  useEffect(() => {
    if (!currentUser?.colorTheme) return;

    applyColorTheme(currentUser.colorTheme).catch(() => {});

  }, [currentUser?.colorTheme, isDarkMode]);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark')
    setIsDarkMode(isDark)

    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark')
      setIsDarkMode(isDark)
    })
    
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    
    return () => observer.disconnect()
  }, [])

  return (
    <ThemeProvider defaultTheme="light" storageKey="gradiate-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={notLogged ? <Navigate to="/login" replace /> : <Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/grades" element={<ProtectedRoute><Grades /></ProtectedRoute>} />
          <Route path="/grades/whatif" element={<ProtectedRoute><Grades /></ProtectedRoute>} />
          <Route path="/statistics/history" element={<ProtectedRoute><Grades /></ProtectedRoute>} />
          <Route path="/statistics/timeline" element={<ProtectedRoute><Grades /></ProtectedRoute>} />
          <Route path="/statistics/timetravel" element={<ProtectedRoute><Grades /></ProtectedRoute>} />
          <Route path="/statistics/impacts" element={<ProtectedRoute><Grades /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/academics/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
          <Route path="/academics/schedules" element={<ProtectedRoute><Schedules /></ProtectedRoute>} />
          <Route path="/academics/transcripts" element={<ProtectedRoute><Transcripts /></ProtectedRoute>} />
          <Route path="/academics/report-card" element={<ProtectedRoute><ReportCard /></ProtectedRoute>} />
          <Route path="/academics/progress-report" element={<ProtectedRoute><ProgressReport /></ProtectedRoute>} />
          <Route path="/academics/teachers" element={<ProtectedRoute><Teachers /></ProtectedRoute>} />
          <Route path="/academics/schedule-editor" element={<ProtectedRoute><ScheduleEditor /></ProtectedRoute>} />
          <Route path="/calculators/final-exam" element={<ProtectedRoute><FinalExamCalculator /></ProtectedRoute>} />
          <Route path="/calculators/gpa-rank" element={<ProtectedRoute><GPARankCalculator /></ProtectedRoute>} />
          <Route path="*" element={<div className="p-6">Not Found</div>} />
        </Routes>
      </BrowserRouter>
      <Toaster theme={currentUser?.theme || "light"} />
    </ThemeProvider>
  );
}
