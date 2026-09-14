import {
  PieChart,
  GraduationCap,
  BookOpen,
  Calculator,
  FileText,
  CalendarCheck,
  Clock,
  FileCheck,
  ClipboardList,
  Users,
  ChartLine
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface NavItem {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  items?: NavItem[]
}

interface SidebarData {
  navMain: NavItem[]
}

export const sidebarData: SidebarData = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: PieChart,
      isActive: false,
    },
    {
      title: "Grades",
      url: "/grades",
      icon: GraduationCap,
      isActive: false,
    },
    {
      title: "Calculators",
      url: "#",
      icon: Calculator,
      items: [
        { title: "What If", url: "/grades/whatif" },
        { title: "Final Exam", url: "/calculators/final-exam" },
        { title: "GPA/Rank", url: "/calculators/gpa-rank" },
      ],
    },
    {
      title: "Statistics & Analysis",
      url: "#",
      icon: ChartLine,
      items: [
        { title: "Impacts", url: "/statistics/impacts" },
        { title: "History", url: "/statistics/history" },
        { title: "Timeline", url: "/statistics/timeline" },
        { title: "TimeTravel", url: "/statistics/timetravel" },
        { title: "Missing Work", url: "/statistics/missing" },
      ],
    },
    {
      title: "Academics",
      url: "#",
      icon: FileText,
      items: [
        { title: "Attendance", url: "/academics/attendance", icon: CalendarCheck },
        { title: "Schedules", url: "/academics/schedules", icon: Clock },
        { title: "Transcripts", url: "/academics/transcripts", icon: BookOpen },
        { title: "Report Card", url: "/academics/report-card", icon: FileCheck },
        { title: "Progress Report", url: "/academics/progress-report", icon: ClipboardList },
        { title: "Teachers", url: "/academics/teachers", icon: Users },
      ],
    },
  ],
}
