"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, Users, Wallet, RefreshCw } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import api from "../lib/api";
import type { DashboardSummary, DailySummary } from "../lib/types";

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [finance, setFinance] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, finRes] = await Promise.all([
        api.get("/dashboard/summary"),
        api.get("/finances/daily-summary"),
      ]);
      setDashboard(dashRes.data);
      setFinance(finRes.data);
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

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Command Center</h1>
          <p className="text-muted-foreground text-sm font-bold uppercase opacity-50 mt-1">
            {loading ? "Loading..." : `Viewed by ${dashboard?.viewed_by || "—"} • Today`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Financial Summary</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="metric-card border-2">
          {loading ? <MetricSkeleton /> : (
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Total Revenue</p>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-black font-mono tracking-tight">{fmt(finance?.revenue || 0)}</p>
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">{finance?.date || "—"}</p>
            </CardContent>
          )}
        </Card>
        <Card className="metric-card border-2">
          {loading ? <MetricSkeleton /> : (
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Gross Profit</p>
                <TrendingUp className="h-4 w-4 text-success" />
              </div>
              <p className="text-3xl font-black font-mono tracking-tight text-success">{fmt(finance?.gross_profit || 0)}</p>
            </CardContent>
          )}
        </Card>
        <Card className="metric-card border-2">
          {loading ? <MetricSkeleton /> : (
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Total Expenses</p>
                <TrendingDown className="h-4 w-4 text-danger" />
              </div>
              <p className="text-3xl font-black font-mono tracking-tight text-danger">{fmt(finance?.expenses || 0)}</p>
            </CardContent>
          )}
        </Card>
        <Card className="metric-card border-2">
          {loading ? <MetricSkeleton /> : (
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Net Profit</p>
                {(finance?.net_profit || 0) >= 0 ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-danger" />}
              </div>
              <p className={`text-3xl font-black font-mono tracking-tight ${(finance?.net_profit || 0) >= 0 ? "text-success" : "text-danger"}`}>
                {fmt(finance?.net_profit || 0)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Gross Profit − Expenses</p>
            </CardContent>
          )}
        </Card>
      </div>

      <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Business Overview</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="metric-card border-2">
          {loading ? <MetricSkeleton /> : (
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Customers Owe You</p>
                <Users className="h-4 w-4 text-success" />
              </div>
              <p className="text-3xl font-black font-mono tracking-tight text-success">{fmt(dashboard?.customers_owe_you || 0)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Receivables</p>
            </CardContent>
          )}
        </Card>
        <Card className="metric-card border-2">
          {loading ? <MetricSkeleton /> : (
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">You Owe Vendors</p>
                <Wallet className="h-4 w-4 text-warning" />
              </div>
              <p className="text-3xl font-black font-mono tracking-tight text-warning">{fmt(dashboard?.you_owe_vendors || 0)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Payables</p>
            </CardContent>
          )}
        </Card>
        <Card className="metric-card border-2">
          {loading ? <MetricSkeleton /> : (
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Low Stock Items</p>
                <AlertTriangle className="h-4 w-4 text-danger" />
              </div>
              <div className="flex items-baseline gap-3">
                <p className="text-3xl font-black font-mono tracking-tight">{dashboard?.low_stock_count || 0}</p>
                {(dashboard?.low_stock_count || 0) > 0 && <Badge variant="destructive" className="font-bold text-[10px]">ATTENTION</Badge>}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Below 5 units</p>
            </CardContent>
          )}
        </Card>
      </div>

      {!loading && dashboard?.reminders && (
        <Card className="border-2 border-primary/10">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl shrink-0" style={{ background: "var(--primary-green)" }}>
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-black uppercase text-muted-foreground">System Reminder</p>
              <p className="text-lg font-bold">{dashboard.reminders}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
