import {
  LayoutDashboard,
  User,
  CalendarCheck,
  CalendarDays,
  Wallet,
  Sparkles,
  Users,
  BarChart3,
  ShieldAlert,
  ClipboardList,
  Building2,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const employeeNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/leave", label: "Leave", icon: CalendarDays },
  { href: "/payroll", label: "Payroll", icon: Wallet },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/ai", label: "Dayflow AI", icon: Sparkles },
];

export const hrNav: NavItem[] = [
  { href: "/hr", label: "Command Center", icon: LayoutDashboard },
  { href: "/hr/employees", label: "Employees", icon: Users },
  { href: "/hr/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/hr/leave", label: "Leave Requests", icon: ClipboardList },
  { href: "/hr/anomalies", label: "Anomalies", icon: ShieldAlert },
  { href: "/hr/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/hr/departments", label: "Departments", icon: Building2 },
  { href: "/hr/ai", label: "Dayflow AI", icon: Sparkles },
];
