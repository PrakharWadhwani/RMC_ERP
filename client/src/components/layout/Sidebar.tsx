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
  ShieldCheck,
  Truck,
  Receipt,
  Search
} from "lucide-react";
import styles from "./Sidebar.module.css";
import { cn } from "../../lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { useAuthStore } from "../../store/useAuthStore";

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/" },
  { name: "Search", icon: Search, path: "/search" },
  { name: "Quick Sale", icon: ShoppingCart, path: "/sales" },
  { name: "Purchases", icon: Receipt, path: "/purchases" },
  { name: "Inventory", icon: Package, path: "/inventory" },
  { name: "Customers", icon: Users, path: "/customers" },
  { name: "Vendors", icon: Truck, path: "/vendors" },
  { name: "Finances", icon: Wallet, path: "/finances" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { username, isAdmin } = useAuthStore();

  return (
    <aside className={styles.sidebar}>
      {/* Branding Area */}
      <div className={styles.logo}>
        <Zap size={24} fill="currentColor" />
        <span>RMC ERP</span>
      </div>

      {/* Navigation Links */}
      <nav className={styles.navGroup}>
        {isAdmin && (
          <>
            <Link 
              href="/admin/approvals" 
              className={cn(styles.navItem, pathname === "/admin/approvals" && styles.active)}
            >
              <ShieldCheck size={20} />
              Staff Requests
            </Link>
            <Link 
              href="/admin/salary" 
              className={cn(styles.navItem, pathname === "/admin/salary" && styles.active)}
            >
              <Users size={20} />
              Employees
            </Link>
          </>
        )}

        {username && !isAdmin && (
          <Link 
            href="/salary" 
            className={cn(styles.navItem, pathname === "/salary" && styles.active)}
          >
            <Wallet size={20} />
            My Salary
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