"use client";

import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, TrendingDown, PlusCircle, Loader2, RefreshCw, CalendarDays, Wallet, Building2, Package, Users, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Skeleton } from "../../components/ui/skeleton";
import { Separator } from "../../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import api from "../../lib/api";
import type { DailySummary, ProfitReportResponse, SystemBalance } from "../../lib/types";

export default function FinancesPage() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [balances, setBalances] = useState<SystemBalance | null>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [monthlyReport, setMonthlyReport] = useState<ProfitReportResponse | null>(null);
  const [yearlyReport, setYearlyReport] = useState<ProfitReportResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit Balances
  const [editingBalances, setEditingBalances] = useState(false);
  const [editCash, setEditCash] = useState("");
  const [editBank, setEditBank] = useState("");

  // Expense Form
  const [expItem, setExpItem] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expMode, setExpMode] = useState<"CASH" | "ONLINE">("CASH");
  const [expDesc, setExpDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const [sumRes, balRes, ledgRes, monthlyRes, yearlyRes] = await Promise.all([
        api.get("/finances/daily-summary"),
        api.get("/finances/balances"),
        api.get("/finances/ledger"),
        api.get("/finances/profit-report?period=monthly"),
        api.get("/finances/profit-report?period=yearly")
      ]);
      setSummary(sumRes.data);
      setBalances(balRes.data);
      setLedger(ledgRes.data);
      setMonthlyReport(monthlyRes.data);
      setYearlyReport(yearlyRes.data);
      setEditCash(balRes.data.cash_balance.toString());
      setEditBank(balRes.data.bank_balance.toString());
    } catch (err) {
      console.error("Finance Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSummary(); }, []);

  const handleUpdateBalances = async () => {
    try {
      setSubmitting(true);
      const res = await api.put("/finances/balances", {
        cash_balance: parseFloat(editCash),
        bank_balance: parseFloat(editBank)
      });
      setBalances(res.data);
      setEditingBalances(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to update balances (Requires Admin).");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expItem || !expAmount) return alert("Item and amount are required!");
    try {
      setSubmitting(true);
      const params = new URLSearchParams({
        item: expItem,
        amount: expAmount,
        mode: expMode,
      });
      if (expDesc) params.set("description", expDesc);
      await api.post(`/finances/expenses/?${params.toString()}`);
      setExpItem(""); setExpAmount(""); setExpDesc("");
      fetchSummary();
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
          <h1 className="text-4xl font-black tracking-tight uppercase">Finances & Ledgers</h1>
          <p className="text-muted-foreground text-sm font-bold uppercase opacity-50">Master Dashboard</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSummary} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CASH & BANK BALANCES */}
        <div className="md:col-span-1 space-y-4">
          <Card className="border-2 bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex justify-between items-center text-sm font-black uppercase text-muted-foreground">
                <span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> SYSTEM BALANCES</span>
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setEditingBalances(!editingBalances)}>
                  {editingBalances ? "Cancel" : "Edit"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? <MetricSkeleton /> : (
                <>
                  <div className="p-4 bg-muted/30 rounded-xl border">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">CASH IN HAND</p>
                    {editingBalances ? (
                      <Input type="number" value={editCash} onChange={e => setEditCash(e.target.value)} className="h-10 font-bold" />
                    ) : (
                      <p className="text-3xl font-black font-mono tracking-tight">{fmt(balances?.cash_balance || 0)}</p>
                    )}
                  </div>
                  <div className="p-4 bg-muted/30 rounded-xl border">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">BANK BALANCE (ONLINE)</p>
                    {editingBalances ? (
                      <Input type="number" value={editBank} onChange={e => setEditBank(e.target.value)} className="h-10 font-bold" />
                    ) : (
                      <p className="text-3xl font-black font-mono tracking-tight">{fmt(balances?.bank_balance || 0)}</p>
                    )}
                  </div>
                  {editingBalances && (
                    <Button onClick={handleUpdateBalances} disabled={submitting} className="w-full font-bold">
                      {submitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Save Changes"}
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* PROFIT REPORTS & LEDGER */}
        <div className="md:col-span-2">
          <Card className="border-2 h-full">
            <CardContent className="pt-6">
              <Tabs defaultValue="daily" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-6">
                  <TabsTrigger value="daily" className="font-bold uppercase text-xs">Today</TabsTrigger>
                  <TabsTrigger value="monthly" className="font-bold uppercase text-xs">This Month</TabsTrigger>
                  <TabsTrigger value="yearly" className="font-bold uppercase text-xs">This Year</TabsTrigger>
                  <TabsTrigger value="ledger" className="font-bold uppercase text-xs bg-primary/10">Ledger</TabsTrigger>
                </TabsList>
                
                <TabsContent value="daily" className="space-y-4">
                  {!loading && summary && (
                    <div className="flex items-center gap-2 mb-4 text-xs font-bold text-muted-foreground">
                      <CalendarDays className="h-4 w-4" /> {summary.date} • Checked by: {summary.checked_by}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border-2 rounded-xl">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Revenue</p>
                      <p className="text-2xl font-black font-mono mt-1">{fmt(summary?.revenue || 0)}</p>
                    </div>
                    <div className="p-4 border-2 rounded-xl">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Expenses</p>
                      <p className="text-2xl font-black font-mono mt-1 text-danger">{fmt(summary?.expenses || 0)}</p>
                    </div>
                    <div className="p-4 border-2 rounded-xl">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Gross Profit</p>
                      <p className="text-2xl font-black font-mono mt-1 text-success">{fmt(summary?.gross_profit || 0)}</p>
                    </div>
                    <div className="p-4 border-2 rounded-xl bg-success/10 border-success/30">
                      <p className="text-[10px] font-black uppercase text-success">Net Profit</p>
                      <p className="text-3xl font-black font-mono mt-1 text-success">{fmt(summary?.net_profit || 0)}</p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="monthly" className="space-y-4">
                  {monthlyReport ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 border-2 rounded-xl">
                          <p className="text-[10px] font-black uppercase text-muted-foreground">Revenue</p>
                          <p className="text-2xl font-black font-mono mt-1">{fmt(monthlyReport.data.reduce((sum, row) => sum + row.revenue, 0))}</p>
                        </div>
                        <div className="p-4 border-2 rounded-xl">
                          <p className="text-[10px] font-black uppercase text-muted-foreground">Expenses</p>
                          <p className="text-2xl font-black font-mono mt-1 text-danger">{fmt(monthlyReport.data.reduce((sum, row) => sum + row.expenses, 0))}</p>
                        </div>
                        <div className="p-4 border-2 rounded-xl bg-success/10 border-success/30">
                          <p className="text-[10px] font-black uppercase text-success">Net Profit</p>
                          <p className="text-2xl font-black font-mono mt-1 text-success">{fmt(monthlyReport.data.reduce((sum, row) => sum + row.net_profit, 0))}</p>
                        </div>
                      </div>
                      <div className="rounded-xl border overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead className="text-[10px] font-black uppercase">Month</TableHead>
                              <TableHead className="text-[10px] font-black uppercase">Revenue</TableHead>
                              <TableHead className="text-[10px] font-black uppercase">Gross Profit</TableHead>
                              <TableHead className="text-[10px] font-black uppercase">Expenses</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase">Net Profit</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {monthlyReport.data.map((row) => (
                              <TableRow key={row.label}>
                                <TableCell className="font-bold">{row.label}</TableCell>
                                <TableCell className="font-mono">{fmt(row.revenue)}</TableCell>
                                <TableCell className="font-mono text-success">{fmt(row.gross_profit)}</TableCell>
                                <TableCell className="font-mono text-danger">{fmt(row.expenses)}</TableCell>
                                <TableCell className="text-right font-mono font-bold">{fmt(row.net_profit)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground font-bold">Monthly report is not available right now.</div>
                  )}
                </TabsContent>
                <TabsContent value="yearly" className="space-y-4">
                  {yearlyReport ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 border-2 rounded-xl">
                          <p className="text-[10px] font-black uppercase text-muted-foreground">Revenue</p>
                          <p className="text-2xl font-black font-mono mt-1">{fmt(yearlyReport.data.reduce((sum, row) => sum + row.revenue, 0))}</p>
                        </div>
                        <div className="p-4 border-2 rounded-xl">
                          <p className="text-[10px] font-black uppercase text-muted-foreground">Expenses</p>
                          <p className="text-2xl font-black font-mono mt-1 text-danger">{fmt(yearlyReport.data.reduce((sum, row) => sum + row.expenses, 0))}</p>
                        </div>
                        <div className="p-4 border-2 rounded-xl bg-success/10 border-success/30">
                          <p className="text-[10px] font-black uppercase text-success">Net Profit</p>
                          <p className="text-2xl font-black font-mono mt-1 text-success">{fmt(yearlyReport.data.reduce((sum, row) => sum + row.net_profit, 0))}</p>
                        </div>
                      </div>
                      <div className="rounded-xl border overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead className="text-[10px] font-black uppercase">Year</TableHead>
                              <TableHead className="text-[10px] font-black uppercase">Revenue</TableHead>
                              <TableHead className="text-[10px] font-black uppercase">Gross Profit</TableHead>
                              <TableHead className="text-[10px] font-black uppercase">Expenses</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase">Net Profit</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {yearlyReport.data.map((row) => (
                              <TableRow key={row.label}>
                                <TableCell className="font-bold">{row.label}</TableCell>
                                <TableCell className="font-mono">{fmt(row.revenue)}</TableCell>
                                <TableCell className="font-mono text-success">{fmt(row.gross_profit)}</TableCell>
                                <TableCell className="font-mono text-danger">{fmt(row.expenses)}</TableCell>
                                <TableCell className="text-right font-mono font-bold">{fmt(row.net_profit)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground font-bold">Yearly report is not available right now.</div>
                  )}
                </TabsContent>
                <TabsContent value="ledger" className="space-y-4">
                  <div className="rounded-xl border overflow-hidden max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0">
                        <TableRow>
                          <TableHead className="text-[10px] font-black uppercase">Date</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Type</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Description</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Mode</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledger.map(entry => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-xs font-mono">{new Date(entry.date).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Badge variant={entry.type === "SALE" ? "default" : entry.type === "PURCHASE" ? "secondary" : "destructive"} className="text-[9px]">
                                {entry.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{entry.description}</TableCell>
                            <TableCell className="text-xs font-bold">{entry.mode}</TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              {entry.type === "EXPENSE" || entry.type === "PURCHASE" ? <span className="text-danger">-{fmt(entry.amount)}</span> : <span className="text-success">+{fmt(entry.amount)}</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                        {ledger.length === 0 && (
                          <TableRow><TableCell colSpan={5} className="text-center text-xs p-4 text-muted-foreground">No recent transactions.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Add Expense Form */}
      <Card className="border-2 max-w-3xl">
        <CardHeader>
          <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
            <PlusCircle className="h-5 w-5" /> Record Operation Expense
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