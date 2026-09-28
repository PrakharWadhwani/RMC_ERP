import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../components/layout/ThemeProvider";
import AppShell from "../components/layout/AppShell";

const geist = Geist({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RMC ERP",
  description: "Advanced Inventory & Sales Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning is required for next-themes to work without errors
    <html lang="en" suppressHydrationWarning> 
      <body className={geist.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}