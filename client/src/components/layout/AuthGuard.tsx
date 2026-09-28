"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "../../store/useAuthStore";
import { Loader2 } from "lucide-react";

const PUBLIC_ROUTES = ["/login", "/register"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, hydrate } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    hydrate();
    setChecked(true);
  }, [hydrate]);

  useEffect(() => {
    if (!checked) return;

    const isPublic = PUBLIC_ROUTES.includes(pathname);

    // 1. Basic Auth Check
    if (!isAuthenticated && !isPublic) {
      router.replace("/login");
      return;
    }

    if (isAuthenticated && isPublic) {
      router.replace("/");
      return;
    }

    // 2. Admin Security Check
    // If the path is an admin page and the user is not an admin, kick them to dashboard
    if (pathname.startsWith("/admin") && !isAdmin) {
      router.replace("/");
    }
    
  }, [checked, isAuthenticated, isAdmin, pathname, router]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPublic = PUBLIC_ROUTES.includes(pathname);
  if (!isAuthenticated && !isPublic) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}