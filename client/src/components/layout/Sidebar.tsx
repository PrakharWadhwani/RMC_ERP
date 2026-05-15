"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Wallet, 
  Settings,
  Zap,
  ShieldCheck
} from "lucide-react";
import styles from "./Sidebar.module.css";
import { cn } from "../../lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { useAuthStore } from "../../store/useAuthStore"; // Added import

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/" },
  { name: "Quick Sale", icon: ShoppingCart, path: "/sales" },
  { name: "Inventory", icon: Package, path: "/inventory" },
  { name: "Stakeholders", icon: Users, path: "/stakeholders" },
  { name: "Finances", icon: Wallet, path: "/finances" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { username } = useAuthStore(); // Extract username here

  return (
    <aside className={styles.sidebar}>
      {/* Branding Area */}
      <div className={styles.logo}>
        <Zap size={24} fill="currentColor" />
        <span>RAINBOW ERP</span>
      </div>

      {/* Navigation Links */}
      <nav className={styles.navGroup}>
        {/* Admin Link - Moved outside the map to fix the syntax errors */}
        {username === 'leo' && (
          <Link 
            href="/admin/approvals" 
            className={cn(styles.navItem, pathname === "/admin/approvals" && styles.active)}
          >
            <ShieldCheck size={20} />
            Staff Requests
          </Link>
        )}

        {menuItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className={cn(styles.navItem, isActive && styles.active)}
            >
              <item.icon size={20} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer Area with Theme Toggle and Settings */}
      <div className={styles.footer}>
        <ThemeToggle />
        <Link 
          href="/settings" 
          className={cn(styles.navItem, pathname === "/settings" && styles.active)}
        >
          <Settings size={20} />
          Settings
        </Link>
      </div>
    </aside>
  );
}