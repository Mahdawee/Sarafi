import type { Metadata } from "next";
import "@fontsource-variable/vazirmatn";
import "@fontsource-variable/inter";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "Sarafi | سیستم صرافی",
  description: "Money exchange (Sarafi) management system — سیستم مدیریت صرافی",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen bg-slate-100 text-slate-800 antialiased">
        <AppProviders>
          <Shell>{children}</Shell>
        </AppProviders>
      </body>
    </html>
  );
}
