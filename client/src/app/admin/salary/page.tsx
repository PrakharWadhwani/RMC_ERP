"use client";

import { useEffect, useState } from "react";
import { 
  Wallet, Landmark, Check, X, Loader2, ShieldAlert, 
  Coins, CreditCard, Users, Calendar, AlertCircle, RefreshCw 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../../components/ui/dialog";
import { useAuthStore } from "../../../store/useAuthStore";
import api from "../../../lib/api";

interface UserSalarySummary {
  user_id: number;
  username: string;
  base_salary: number;
  total_advances: number;
  net_payable: number;
}

interface AdvanceRequest {
  id: number;
  user_id: number;
  username: string;
  amount: number;
  month: number;
  year: number;
  approved_by_admin: boolean;
  timestamp: string;
}

export default function AdminSalaryPage() {
  const { isAdmin } = useAuthStore();
  const [salaries, setSalaries] = useState<UserSalarySummary[]>([]);
  const [advances, setAdvances] = useState<AdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Month & Year Filter
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  // Approval Dialog State
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<AdvanceRequest | null>(null);
  const [paymentMode, setPaymentMode] = useState<"CASH" | "ONLINE">("CASH");
  const [managing, setManaging] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<"overview" | "requests">("overview");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [salRes, advRes] = await Promise.all([
        api.get(`/salary/admin/summary?month=${month}&year=${year}`),
        api.get("/salary/admin/requests")
      ]);
      setSalaries(salRes.data || []);
      setAdvances(advRes.data || []);
    } catch (err: any) {
      console.error("Failed to load admin salary data", err);
      setError("Failed to load staff salaries and requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin, month, year]);

  // Security Guard: Prevent non-admins from viewing the content
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center space-y-4">
          <ShieldAlert size={64} className="text-red-500 mx-auto" />
          <h1 className="text-2xl font-black text-white uppercase">Access Denied</h1>
        </div>
      </div>
    );
  }

  const handleManageAdvance = async (advanceId: number, action: "approve" | "reject") => {
    if (action === "approve") {
      const adv = advances.find(a => a.id === advanceId);
      if (adv) {
        setSelectedAdvance(adv);
        setApproveDialogOpen(true);
      }
      return;
    }

    // Direct reject action
    if (!confirm("Are you sure you want to reject and delete this advance request?")) return;
    
    setLoading(true);
    try {
      await api.post(`/salary/admin/manage-advance/${advanceId}?action=reject`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Action failed");
      setLoading(false);
    }
  };

  const submitApproval = async () => {
    if (!selectedAdvance) return;
    setManaging(true);
    try {
      await api.post(
        `/salary/admin/manage-advance/${selectedAdvance.id}?action=approve&payment_mode=${paymentMode}`
      );
      setApproveDialogOpen(false);
      setSelectedAdvance(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to approve advance.");
    } finally {
      setManaging(false);
    }
  };

  const fmt = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const totalBaseSalary = salaries.reduce((sum, s) => sum + s.base_salary, 0);
  const totalAdvancesApproved = salaries.reduce((sum, s) => sum + s.total_advances, 0);
  const totalNetPayable = salaries.reduce((sum, s) => sum + s.net_payable, 0);

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
  const years = [currentYear - 1, currentYear, currentYear + 1];

  const pendingRequests = advances.filter(a => !a.approved_by_admin);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Salary Dashboard</h1>
          <p className="text-muted-foreground text-sm font-bold uppercase opacity-50 mt-1">
            Owner Controls • Worker Salaries & Advances
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center bg-black/40 border border-white/10 rounded-xl px-2 py-1 gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="bg-transparent border-0 text-white text-xs font-bold focus:outline-none cursor-pointer"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value} className="bg-neutral-955">
                  {m.name}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="bg-transparent border-0 text-white text-xs font-bold focus:outline-none cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y} className="bg-neutral-955">
                  {y}
                </option>
              ))}
            </select>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading && salaries.length === 0 ? (
        <div className="text-center p-20">Loading salaries...</div>
      ) : (
        <>
          {/* Metrics section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-2 border-primary/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Total Base Salaries</p>
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-black font-mono tracking-tight text-white">{fmt(totalBaseSalary)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Sum of approved staff base salaries</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-warning/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Advances Approved</p>
                  <Wallet className="h-4 w-4 text-warning" />
                </div>
                <p className="text-2xl font-black font-mono tracking-tight text-warning">{fmt(totalAdvancesApproved)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Advances paid out this month</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-success/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Net Monthly Payable</p>
                  <Landmark className="h-4 w-4 text-success" />
                </div>
                <p className="text-2xl font-black font-mono tracking-tight text-success">{fmt(totalNetPayable)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Remaining pay due at month end</p>
              </CardContent>
            </Card>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-white/10 gap-6">
            <button
              onClick={() => setActiveTab("overview")}
              className={`pb-4 text-sm font-black uppercase tracking-wider relative transition-all ${
                activeTab === "overview" ? "text-primary" : "text-white/40 hover:text-white"
              }`}
            >
              Staff Salary List
              {activeTab === "overview" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />}
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`pb-4 text-sm font-black uppercase tracking-wider relative transition-all flex items-center gap-2 ${
                activeTab === "requests" ? "text-primary" : "text-white/40 hover:text-white"
              }`}
            >
              Advance Requests
              {pendingRequests.length > 0 && (
                <Badge className="bg-warning text-black font-black text-[9px] px-1.5 py-0.2 ml-1">
                  {pendingRequests.length}
                </Badge>
              )}
              {activeTab === "requests" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />}
            </button>
          </div>

          {/* Tab contents */}
          <Card className="border-2 border-white/10">
            <CardContent className="p-6">
              {activeTab === "overview" ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-xs font-black uppercase">Staff Username</TableHead>
                        <TableHead className="text-xs font-black uppercase text-right">Base Salary</TableHead>
                        <TableHead className="text-xs font-black uppercase text-right text-warning">Approved Advances</TableHead>
                        <TableHead className="text-xs font-black uppercase text-right text-success">Net Pay Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salaries.map((s) => (
                        <TableRow key={s.user_id} className="border-white/5">
                          <TableCell className="font-bold text-white text-sm">{s.username}</TableCell>
                          <TableCell className="font-mono text-right text-sm">{fmt(s.base_salary)}</TableCell>
                          <TableCell className="font-mono text-right text-warning text-sm">{fmt(s.total_advances)}</TableCell>
                          <TableCell className="font-mono text-right text-success text-sm font-bold">{fmt(s.net_payable)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                /* Requests tab */
                <div>
                  {advances.length === 0 ? (
                    <div className="text-center p-12 text-muted-foreground text-sm uppercase font-bold tracking-wider">
                      No advance requests found.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/10">
                            <TableHead className="text-xs font-black uppercase">Staff Username</TableHead>
                            <TableHead className="text-xs font-black uppercase">Month/Year</TableHead>
                            <TableHead className="text-xs font-black uppercase">Requested Amount</TableHead>
                            <TableHead className="text-xs font-black uppercase">Date Submitted</TableHead>
                            <TableHead className="text-xs font-black uppercase text-center">Status</TableHead>
                            <TableHead className="text-xs font-black uppercase text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {advances.map((adv) => (
                            <TableRow key={adv.id} className="border-white/5">
                              <TableCell className="font-bold text-white text-sm">{adv.username}</TableCell>
                              <TableCell className="font-bold text-sm">
                                {months.find(m => m.value === adv.month)?.name} {adv.year}
                              </TableCell>
                              <TableCell className="font-mono font-bold text-sm">{fmt(adv.amount)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(adv.timestamp).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </TableCell>
                              <TableCell className="text-center">
                                {adv.approved_by_admin ? (
                                  <Badge className="bg-success/20 text-success border border-success/30 font-bold uppercase text-[9px]">
                                    Approved
                                  </Badge>
                                ) : (
                                  <Badge className="bg-warning/20 text-warning border border-warning/30 font-bold uppercase text-[9px]">
                                    Pending Review
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {!adv.approved_by_admin && (
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleManageAdvance(adv.id, "reject")}
                                      className="h-8 font-black uppercase text-[10px]"
                                    >
                                      <X className="h-3.5 w-3.5 mr-1" /> Reject
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => handleManageAdvance(adv.id, "approve")}
                                      className="h-8 bg-green-500 hover:bg-green-400 text-black font-black uppercase text-[10px]"
                                    >
                                      <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Select payment mode dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="border-2 border-white/10 bg-neutral-900 text-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase text-white">Approve Salary Advance</DialogTitle>
            <CardDescription className="text-xs uppercase font-bold text-muted-foreground">
              Select how to pay out this advance. This will deduct the amount from system balance and log an expense.
            </CardDescription>
          </DialogHeader>

          {selectedAdvance && (
            <div className="py-6 space-y-6">
              <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60 font-bold uppercase text-xs">Worker:</span>
                  <span className="font-black text-white">{selectedAdvance.username}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60 font-bold uppercase text-xs">Amount:</span>
                  <span className="font-mono font-black text-primary">{fmt(selectedAdvance.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60 font-bold uppercase text-xs">For Month:</span>
                  <span className="font-black text-white">
                    {months.find(m => m.value === selectedAdvance.month)?.name} {selectedAdvance.year}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black uppercase text-white/60">Choose Payment Method</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setPaymentMode("CASH")}
                    className={`flex items-center justify-center p-4 rounded-xl border-2 transition-all gap-2 flex-col font-black uppercase text-xs ${
                      paymentMode === "CASH" 
                        ? "border-primary bg-primary/5 text-primary" 
                        : "border-white/10 bg-black/20 text-white/60 hover:text-white"
                    }`}
                  >
                    <Coins className="h-6 w-6" />
                    Cash Account
                  </button>
                  <button
                    onClick={() => setPaymentMode("ONLINE")}
                    className={`flex items-center justify-center p-4 rounded-xl border-2 transition-all gap-2 flex-col font-black uppercase text-xs ${
                      paymentMode === "ONLINE" 
                        ? "border-primary bg-primary/5 text-primary" 
                        : "border-white/10 bg-black/20 text-white/60 hover:text-white"
                    }`}
                  >
                    <CreditCard className="h-6 w-6" />
                    Bank Account
                  </button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setApproveDialogOpen(false);
                setSelectedAdvance(null);
              }}
              className="border-white/10 hover:bg-white/5 font-black uppercase text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={submitApproval}
              disabled={managing}
              className="bg-green-500 hover:bg-green-400 text-black font-black uppercase text-xs"
            >
              {managing ? "Processing..." : "Confirm & Pay Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
