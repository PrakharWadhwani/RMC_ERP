"use client";

import { useEffect, useState } from "react";
import { Wallet, Landmark, History, CheckCircle, Clock, Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import api from "../../lib/api";
import { useAuthStore } from "../../store/useAuthStore";

interface AdvanceRecord {
  id: number;
  amount: number;
  month: number;
  year: number;
  approved_by_admin: boolean;
  timestamp: string;
}

export default function WorkerSalaryPage() {
  const { username } = useAuthStore();
  const [employeeName, setEmployeeName] = useState<string>("");
  const [role, setRole] = useState<string>("Staff");
  const [baseSalary, setBaseSalary] = useState<number>(0);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSalaryData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/salary/my-salary");
      setEmployeeName(res.data.employee_name || username || "");
      setRole(res.data.role || "Staff");
      setBaseSalary(res.data.base_salary);
      setAdvances(res.data.advances || []);
    } catch (err: any) {
      console.error("Failed to load salary details", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalaryData();
  }, []);

  const months = [
    { value: 1, name: "January" }, { value: 2, name: "February" },
    { value: 3, name: "March" }, { value: 4, name: "April" },
    { value: 5, name: "May" }, { value: 6, name: "June" },
    { value: 7, name: "July" }, { value: 8, name: "August" },
    { value: 9, name: "September" }, { value: 10, name: "October" },
    { value: 11, name: "November" }, { value: 12, name: "December" },
  ];

  const fmt = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const totalApprovedAdvances = advances
    .filter(adv => adv.approved_by_admin)
    .reduce((sum, adv) => sum + adv.amount, 0);

  const remainingPay = Math.max(0, baseSalary - totalApprovedAdvances);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-8">
      <div>
        <h1 className="text-4xl font-black tracking-tight uppercase">My Salary</h1>
        <p className="text-muted-foreground text-sm font-bold uppercase opacity-50 mt-1">
          {employeeName} • {role} • Read-Only View
        </p>
      </div>

      {loading ? (
        <div className="text-center p-20 text-muted-foreground">Loading salary data...</div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
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

          {/* Info Notice */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-3">
            <Coins className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black uppercase text-primary">Salary advances are managed by your admin</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Contact your administrator to request salary advances or report any discrepancies.
              </p>
            </div>
          </div>

          {/* Advance History */}
          <Card className="border-2 border-white/10">
            <CardHeader>
              <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                <History className="h-5 w-5 text-primary" /> Advance History
              </CardTitle>
              <CardDescription className="text-xs uppercase font-bold text-muted-foreground opacity-50">
                All salary advance records
              </CardDescription>
            </CardHeader>
            <CardContent>
              {advances.length === 0 ? (
                <div className="text-center p-12 text-muted-foreground text-sm">
                  No salary advance records found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-xs font-black uppercase">Month/Year</TableHead>
                        <TableHead className="text-xs font-black uppercase">Amount</TableHead>
                        <TableHead className="text-xs font-black uppercase">Date</TableHead>
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
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            {adv.approved_by_admin ? (
                              <Badge className="bg-success/20 text-success border border-success/30 font-bold uppercase text-[9px] px-2 py-0.5">
                                Approved
                              </Badge>
                            ) : (
                              <Badge className="bg-warning/20 text-warning border border-warning/30 font-bold uppercase text-[9px] px-2 py-0.5">
                                Pending
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
      )}
    </div>
  );
}
