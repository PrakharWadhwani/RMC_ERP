"use client";

import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, TrendingDown, PlusCircle, Loader2, RefreshCw, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Skeleton } from "../../components/ui/skeleton";
import { Separator } from "../../components/ui/separator";
import api from "../../lib/api";
import type { DailySummary } from "../../lib/types";

export default function FinancesPage() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Expense Form
  const [expItem, setExpItem] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expMode, setExpMode] = useState<"CASH" | "ONLINE">("CASH");
  const [expDesc, setExpDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await api.get("/finances/daily-summary");
      setSummary(res.data);
    } catch (err) {
      console.error("Finance Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSummary(); }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expItem || !expAmount) return alert("Item and amount are required!");
    try {
      setSubmitting(true);
      // Backend expects query parameters
      const params = new URLSearchParams({
        item: expItem,
        amount: expAmount,
        mode: expMode,
      });
      if (expDesc) params.set("description", expDesc);
      await api.post(`/finances/expenses/?${params.toString()}`);
      setExpItem(""); setExpAmount(""); setExpDesc("");
      fetchSummary(); // Refresh to show updated totals
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to add expense");
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (v: number) => `₹${Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const MetricSkeleton = () => (
    <CardContent className="p-6 space-y-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-32" /></CardContent>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 text-left">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Finances</h1>
          <p className="text-muted-foreground text-sm font-bold uppercase opacity-50">Daily Profit & Expense Tracker</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSummary} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Date Banner */}
      {!loading && summary && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-bold">
            Summary for <span className="font-mono text-primary">{summary.date}</span>
            <span className="text-muted-foreground ml-2">• Checked by {summary.checked_by}</span>
          </p>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="metric-card border-2">
          {loading ? <MetricSkeleton /> : (
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Total Revenue</p>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-black font-mono tracking-tight">{fmt(summary?.revenue || 0)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">From today&apos;s sales</p>
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
              <p className="text-3xl font-black font-mono tracking-tight text-success">{fmt(summary?.gross_profit || 0)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Revenue − Cost of Goods</p>
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
              <p className="text-3xl font-black font-mono tracking-tight text-danger">{fmt(summary?.expenses || 0)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Today&apos;s operational costs</p>
            </CardContent>
          )}
        </Card>
        <Card className="metric-card border-2">
          {loading ? <MetricSkeleton /> : (
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Net Profit</p>
                {(summary?.net_profit || 0) >= 0 ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-danger" />}
              </div>
              <p className={`text-4xl font-black font-mono tracking-tight ${(summary?.net_profit || 0) >= 0 ? "text-success" : "text-danger"}`}>
                {fmt(summary?.net_profit || 0)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Gross Profit − Expenses</p>
            </CardContent>
          )}
        </Card>
      </div>

      <Separator />

      {/* Add Expense */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
            <PlusCircle className="h-5 w-5" /> Record Expense
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase">Item Name</Label>
              <Input value={expItem} onChange={(e) => setExpItem(e.target.value)} placeholder="e.g. Electricity Bill" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase">Amount (₹)</Label>
              <Input type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase">Payment Mode</Label>
              <div className="flex gap-2">
                <Button type="button" variant={expMode === "CASH" ? "default" : "outline"} size="sm" className="flex-1 font-bold" onClick={() => setExpMode("CASH")}>CASH</Button>
                <Button type="button" variant={expMode === "ONLINE" ? "default" : "outline"} size="sm" className="flex-1 font-bold" onClick={() => setExpMode("ONLINE")}>ONLINE</Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase">Description (Optional)</Label>
              <Input value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="Notes..." />
            </div>
            <Button type="submit" disabled={submitting || !expItem || !expAmount} className="font-bold h-10">
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Add Expense"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}