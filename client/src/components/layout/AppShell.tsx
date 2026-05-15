"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import AuthGuard from "./AuthGuard";

const NO_SHELL_ROUTES = ["/login", "/register"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showShell = !NO_SHELL_ROUTES.includes(pathname);

  return (
    <AuthGuard>
      {showShell ? (
        <div className="erp-container">
          <Sidebar />
          <main className="main-content">{children}</main>
        </div>
      ) : (
        <>{children}</>
      )}
    </AuthGuard>
  );
}