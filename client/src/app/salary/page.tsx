"use client";

import { useEffect, useState } from "react";
import { Wallet, Landmark, History, Plus, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import api from "../../lib/api";
import { useAuthStore } from "../../store/useAuthStore";

interface AdvanceRequest {
  id: number;
  amount: number;
  month: number;
  year: number;
  approved_by_admin: boolean;
  timestamp: string;
}

export default function WorkerSalaryPage() {
  const { username } = useAuthStore();
  const [baseSalary, setBaseSalary] = useState<number>(0);
  const [advances, setAdvances] = useState<AdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchSalaryData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/salary/my-salary");
      setBaseSalary(res.data.base_salary);
      setAdvances(res.data.advances || []);
    } catch (err: any) {
      console.error("Failed to load salary details", err);
      setError("Failed to load salary data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalaryData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }

    if (parsedAmount > baseSalary) {
      setError(`Requested amount (₹${parsedAmount}) cannot exceed your base salary (₹${baseSalary}).`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/salary/advance", {
        amount: parsedAmount,
        month,
        year
      });
      setSuccess("Salary advance request submitted successfully!");
      setAmount("");
      fetchSalaryData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  const months = [
    { value: 1, name: "January" },
    { value: 2, name: "February" },
    { value: 3, name: "March" },
    { value: 4, name: "April" },
    { value: 5, name: "May" },
    { value: 6, name: "June" },
    { value: 7, name: "July" },
    { value: 8, name: "August" },
    { value: 9, name: "September" },
    { value: 10, name: "October" },
    { value: 11, name: "November" },
    { value: 12, name: "December" },
  ];

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];

  const fmt = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const totalApprovedAdvances = advances
    .filter(adv => adv.approved_by_admin)
    .reduce((sum, adv) => sum + adv.amount, 0);

  const remainingPay = Math.max(0, baseSalary - totalApprovedAdvances);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8">
      <div>
        <h1 className="text-4xl font-black tracking-tight uppercase">My Salary & Advances</h1>
        <p className="text-muted-foreground text-sm font-bold uppercase opacity-50 mt-1">
          Portal for {username} • Salary Tracking
        </p>
      </div>

      {loading ? (
        <div className="text-center p-20">Loading salary data...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Summary Cards */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-2 border-primary/10">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Base Salary</p>
                    <Landmark className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-2xl font-black font-mono tracking-tight text-white">{fmt(baseSalary)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Monthly base salary</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-warning/10">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Approved Advances</p>
                    <Wallet className="h-4 w-4 text-warning" />
                  </div>
                  <p className="text-2xl font-black font-mono tracking-tight text-warning">{fmt(totalApprovedAdvances)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Deducted from current month</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-success/10">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Remaining Pay</p>
                    <CheckCircle className="h-4 w-4 text-success" />
                  </div>
                  <p className="text-2xl font-black font-mono tracking-tight text-success">{fmt(remainingPay)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Payable at month end</p>
                </CardContent>
              </Card>
            </div>

            {/* Advance History */}
            <Card className="border-2 border-white/10">
              <CardHeader>
                <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" /> Advance History
                </CardTitle>
                <CardDescription className="text-xs uppercase font-bold text-muted-foreground opacity-50">
                  Track status of salary advance requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                {advances.length === 0 ? (
                  <div className="text-center p-12 text-muted-foreground text-sm">
                    No past salary advance requests found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10">
                          <TableHead className="text-xs font-black uppercase">Month/Year</TableHead>
                          <TableHead className="text-xs font-black uppercase">Requested Amount</TableHead>
                          <TableHead className="text-xs font-black uppercase">Submitted Date</TableHead>
                          <TableHead className="text-xs font-black uppercase text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {advances.map((adv) => (
                          <TableRow key={adv.id} className="border-white/5">
                            <TableCell className="font-bold text-sm">
                              {months.find(m => m.value === adv.month)?.name} {adv.year}
                            </TableCell>
                            <TableCell className="font-mono font-bold text-sm">
                              {fmt(adv.amount)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(adv.timestamp).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </TableCell>
                            <TableCell className="text-right">
                              {adv.approved_by_admin ? (
                                <Badge className="bg-success/20 text-success border border-success/30 font-bold uppercase text-[9px] px-2 py-0.5">
                                  Approved
                                </Badge>
                              ) : (
                                <Badge className="bg-warning/20 text-warning border border-warning/30 font-bold uppercase text-[9px] px-2 py-0.5">
                                  Pending Review
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Request Form */}
          <div>
            <Card className="border-2 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" /> Request Advance
                </CardTitle>
                <CardDescription className="text-xs uppercase font-bold text-muted-foreground opacity-50">
                  Request an advance on your current month salary
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-danger/10 border border-danger/30 text-danger rounded-xl text-xs font-bold flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {success && (
                    <div className="p-3 bg-success/10 border border-success/30 text-success rounded-xl text-xs font-bold flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{success}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="amount" className="text-xs font-black uppercase text-white/60">Amount (₹)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="e.g. 5000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      className="bg-black/50 border-white/10 focus:border-primary font-mono text-white text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="month" className="text-xs font-black uppercase text-white/60">Month</Label>
                      <select
                        id="month"
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value))}
                        className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      >
                        {months.map((m) => (
                          <option key={m.value} value={m.value} className="bg-neutral-900">
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="year" className="text-xs font-black uppercase text-white/60">Year</Label>
                      <select
                        id="year"
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      >
                        {years.map((y) => (
                          <option key={y} value={y} className="bg-neutral-900">
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-primary hover:bg-primary/80 text-white font-black uppercase py-6 rounded-xl transition-all"
                  >
                    {submitting ? "Submitting..." : "Submit Advance Request"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
