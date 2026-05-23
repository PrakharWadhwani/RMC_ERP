"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Package, Receipt, RefreshCw, ShoppingCart, Truck, Users, Wallet } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import api from "../lib/api";
import type { DashboardSummary } from "../lib/types";

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const dashRes = await api.get("/dashboard/summary");
      setDashboard(dashRes.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const fmt = (v: number) => `₹${Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <h1 className="text-4xl font-black tracking-tight uppercase">Dashboard</h1>
        <Card className="border-2 border-destructive/20">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
            <p className="text-lg font-bold text-destructive">{error}</p>
            <Button onClick={fetchAll} variant="outline"><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const MetricSkeleton = () => (
    <CardContent className="p-6 space-y-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-32" /></CardContent>
  );

  const notifications = dashboard?.notification_items?.length
    ? dashboard.notification_items
    : [dashboard?.reminders || "All systems are healthy. No urgent notifications right now."];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-muted-foreground">Command Center</p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-tight md:text-4xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Loading today's operational view..." : `Viewed by ${dashboard?.viewed_by || "—"}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Full-width quick actions row */}
      <div className="w-full">
        <h2 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground mb-2">Quick actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 w-full">
          <Link href="/sales" className="block">
            <Button
              variant="outline"
              className="h-36 w-full flex-col gap-4 rounded-2xl border-2 text-lg bg-gradient-to-br from-background to-primary/5 transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lg rmc-quick-action"
            >
              <ShoppingCart className="h-8 w-8 text-primary" />
              <span className="font-bold uppercase">Quick Sale</span>
            </Button>
          </Link>
          <Link href="/purchases" className="block">
            <Button
              variant="outline"
              className="h-36 w-full flex-col gap-4 rounded-2xl border-2 text-lg bg-gradient-to-br from-background to-secondary/5 transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lg rmc-quick-action"
            >
              <Receipt className="h-8 w-8 text-primary" />
              <span className="font-bold uppercase">Purchases</span>
            </Button>
          </Link>
          <Link href="/inventory" className="block">
            <Button
              variant="outline"
              className="h-36 w-full flex-col gap-4 rounded-2xl border-2 text-lg bg-gradient-to-br from-background to-amber-500/5 transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lg rmc-quick-action"
            >
              <Package className="h-8 w-8 text-primary" />
              <span className="font-bold uppercase">Inventory</span>
            </Button>
          </Link>
          <Link href="/customers" className="block">
            <Button
              variant="outline"
              className="h-36 w-full flex-col gap-4 rounded-2xl border-2 text-lg bg-gradient-to-br from-background to-emerald-500/5 transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lg rmc-quick-action"
            >
              <Users className="h-8 w-8 text-primary" />
              <span className="font-bold uppercase">Customers</span>
            </Button>
          </Link>
          <Link href="/vendors" className="block">
            <Button
              variant="outline"
              className="h-36 w-full flex-col gap-4 rounded-2xl border-2 text-lg bg-gradient-to-br from-background to-cyan-500/5 transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lg rmc-quick-action"
            >
              <Truck className="h-8 w-8 text-primary" />
              <span className="font-bold uppercase">Vendors</span>
            </Button>
          </Link>
          <Link href="/finances" className="block">
            <Button
              variant="outline"
              className="h-36 w-full flex-col gap-4 rounded-2xl border-2 text-lg bg-gradient-to-br from-background to-fuchsia-500/5 transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lg rmc-quick-action"
            >
              <Wallet className="h-8 w-8 text-primary" />
              <span className="font-bold uppercase">Finances</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* System notification below quick actions */}
      <div className="w-full">
        <Card className="border-2 border-primary/10 bg-primary/5 w-full mt-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary p-3 text-white">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">System notification</p>
                <p className="text-sm text-muted-foreground">Live business alerts and follow-up cues</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {notifications.map((item) => (
                <div key={item} className="rounded-xl border bg-background/80 px-3 py-2">
                  <p className="text-sm font-semibold">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border bg-background/80 px-3 py-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Low-stock threshold</span>
              <Badge variant="outline" className="font-bold">
                {dashboard?.low_stock_limit ?? 5}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground">Business overview</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Card className="border-2">
            {loading ? (
              <MetricSkeleton />
            ) : (
              <CardContent className="p-6">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Customers owe you</p>
                  <Users className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="font-mono text-3xl font-black tracking-tight text-emerald-600">{fmt(dashboard?.customers_owe_you || 0)}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Outstanding receivables</p>
              </CardContent>
            )}
          </Card>

          <Card className="border-2">
            {loading ? (
              <MetricSkeleton />
            ) : (
              <CardContent className="p-6">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">You owe vendors</p>
                  <Wallet className="h-4 w-4 text-amber-600" />
                </div>
                <p className="font-mono text-3xl font-black tracking-tight text-amber-600">{fmt(dashboard?.you_owe_vendors || 0)}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Outstanding payables</p>
              </CardContent>
            )}
          </Card>

          <Card className="border-2">
            {loading ? (
              <MetricSkeleton />
            ) : (
              <CardContent className="p-6">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Low stock items</p>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div className="flex items-baseline gap-3">
                  <p className="font-mono text-3xl font-black tracking-tight">{dashboard?.low_stock_count || 0}</p>
                  {(dashboard?.low_stock_count || 0) > 0 && (
                    <Badge variant="destructive" className="text-[10px] font-bold">
                      Attention
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">Items at or below your threshold</p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}