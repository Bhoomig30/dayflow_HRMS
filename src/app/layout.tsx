import type { Metadata } from "next";
import "./globals.css";

// A system font stack is used instead of next/font/google so the app has no
// build- or runtime-time dependency on reaching Google Fonts — it renders
// identically in network-restricted environments (CI, offline dev, locked-down
// deployment targets) without any visual regression.

export const metadata: Metadata = {
  title: "Dayflow — Every workday, perfectly aligned.",
  description: "Dayflow is a role-aware HR management system: attendance, leave, payroll, analytics and Dayflow AI in one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
