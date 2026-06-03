"use client";

import { useEffect, useState } from "react";
import {
  Wallet, Landmark, Check, X, Loader2, ShieldAlert,
  Coins, CreditCard, Users, Calendar, RefreshCw,
  Plus, Pencil, History, UserX, UserCheck, Briefcase, Phone, Save, ChevronDown, ChevronUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { useAuthStore } from "../../../store/useAuthStore";
import api from "../../../lib/api";

// ============================================================================
// Types
// ============================================================================

interface Employee {
  id: number;
  name: string;
  phone_no: string | null;
  role: string;
  base_salary: number;
  is_active: boolean;
  user_id: number | null;
  created_at: string;
  linked_username: string | null;
}

interface SalarySummary {
  employee_id: number;
  employee_name: string;
  role: string;
  base_salary: number;
  total_advances: number;
  net_payable: number;
}

interface AdvanceRequest {
  id: number;
  employee_id: number | null;
  employee_name: string;
  amount: number;
  month: number;
  year: number;
  approved_by_admin: boolean;
  timestamp: string;
}

interface SalaryLogEntry {
  id: number;
  employee_id: number;
  old_salary: number;
  new_salary: number;
  changed_by: string;
  timestamp: string;
}

// ============================================================================
// Component
// ============================================================================

export default function AdminSalaryPage() {
  const { isAdmin } = useAuthStore();

  // --- Data state ---
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaries, setSalaries] = useState<SalarySummary[]>([]);
  const [advances, setAdvances] = useState<AdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Tab state ---
  const [activeTab, setActiveTab] = useState<"employees" | "overview" | "requests">("employees");

  // --- Month/Year filter for overview ---
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  // --- Add Employee dialog ---
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEmp, setNewEmp] = useState({ name: "", phone_no: "", role: "Staff", base_salary: "" });
  const [addLoading, setAddLoading] = useState(false);

  // --- Edit Employee dialog ---
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone_no: "", role: "", base_salary: "" });
  const [editLoading, setEditLoading] = useState(false);

  // --- Salary History dialog ---
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyEmployee, setHistoryEmployee] = useState<Employee | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<SalaryLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // --- Advance Approval dialog ---
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<AdvanceRequest | null>(null);
  const [paymentMode, setPaymentMode] = useState<"CASH" | "ONLINE">("CASH");
  const [managing, setManaging] = useState(false);

  // --- Add Advance dialog ---
  const [addAdvDialogOpen, setAddAdvDialogOpen] = useState(false);
  const [advForm, setAdvForm] = useState({ employee_id: "", amount: "", month: String(new Date().getMonth() + 1), year: String(new Date().getFullYear()) });
  const [addAdvLoading, setAddAdvLoading] = useState(false);

  // ============================================================================
  // Data fetching
  // ============================================================================

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/salary/admin/employees?include_inactive=true");
      setEmployees(res.data || []);
    } catch (err) {
      console.error("Failed to load employees", err);
    }
  };

  const fetchSalaries = async () => {
    try {
      const res = await api.get(`/salary/admin/summary?month=${month}&year=${year}`);
      setSalaries(res.data || []);
    } catch (err) {
      console.error("Failed to load salary summary", err);
    }
  };

  const fetchAdvances = async () => {
    try {
      const res = await api.get("/salary/admin/requests");
      setAdvances(res.data || []);
    } catch (err) {
      console.error("Failed to load advances", err);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchEmployees(), fetchSalaries(), fetchAdvances()]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin]);

  // Refetch salaries when month/year changes
  useEffect(() => {
    if (isAdmin && !loading) fetchSalaries();
  }, [month, year]);

  // ============================================================================
  // Security guard
  // ============================================================================

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

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleAddEmployee = async () => {
    if (!newEmp.name.trim()) return;
    setAddLoading(true);
    try {
      await api.post("/salary/admin/employees", {
        name: newEmp.name.trim(),
        phone_no: newEmp.phone_no.trim() || null,
        role: newEmp.role || "Staff",
        base_salary: parseFloat(newEmp.base_salary) || 0,
      });
      setAddDialogOpen(false);
      setNewEmp({ name: "", phone_no: "", role: "Staff", base_salary: "" });
      fetchEmployees();
      fetchSalaries();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create employee.");
    } finally {
      setAddLoading(false);
    }
  };

  const openEditDialog = (emp: Employee) => {
    setEditEmp(emp);
    setEditForm({
      name: emp.name,
      phone_no: emp.phone_no || "",
      role: emp.role,
      base_salary: String(emp.base_salary),
    });
    setEditDialogOpen(true);
  };

  const handleEditEmployee = async () => {
    if (!editEmp) return;
    setEditLoading(true);
    try {
      await api.put(`/salary/admin/employees/${editEmp.id}`, {
        name: editForm.name.trim() || undefined,
        phone_no: editForm.phone_no.trim() || undefined,
        role: editForm.role || undefined,
        base_salary: editForm.base_salary ? parseFloat(editForm.base_salary) : undefined,
      });
      setEditDialogOpen(false);
      setEditEmp(null);
      fetchEmployees();
      fetchSalaries();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to update employee.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleActive = async (emp: Employee) => {
    const action = emp.is_active ? "deactivate" : "reactivate";
    if (!confirm(`Are you sure you want to ${action} ${emp.name}?`)) return;

    try {
      if (emp.is_active) {
        await api.delete(`/salary/admin/employees/${emp.id}`);
      } else {
        await api.put(`/salary/admin/employees/${emp.id}`, { is_active: true });
      }
      fetchEmployees();
      fetchSalaries();
    } catch (err: any) {
      alert(err.response?.data?.detail || `Failed to ${action} employee.`);
    }
  };

  const openSalaryHistory = async (emp: Employee) => {
    setHistoryEmployee(emp);
    setHistoryDialogOpen(true);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/salary/admin/salary-history/${emp.id}`);
      setSalaryHistory(res.data || []);
    } catch (err) {
      console.error("Failed to load salary history", err);
      setSalaryHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleManageAdvance = async (advanceId: number, action: "approve" | "reject") => {
    if (action === "approve") {
      const adv = advances.find(a => a.id === advanceId);
      if (adv) {
        setSelectedAdvance(adv);
        setApproveDialogOpen(true);
      }
      return;
    }
    if (!confirm("Are you sure you want to reject and delete this advance request?")) return;
    setLoading(true);
    try {
      await api.post(`/salary/admin/manage-advance/${advanceId}?action=reject`);
      fetchAll();
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
      fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to approve advance.");
    } finally {
      setManaging(false);
    }
  };

  const handleAddAdvance = async () => {
    if (!advForm.employee_id || !advForm.amount) return;
    setAddAdvLoading(true);
    try {
      await api.post("/salary/admin/advance", {
        employee_id: parseInt(advForm.employee_id),
        amount: parseFloat(advForm.amount),
        month: parseInt(advForm.month),
        year: parseInt(advForm.year),
      });
      setAddAdvDialogOpen(false);
      setAdvForm({ employee_id: "", amount: "", month: String(new Date().getMonth() + 1), year: String(new Date().getFullYear()) });
      fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create advance.");
    } finally {
      setAddAdvLoading(false);
    }
  };

  // ============================================================================
  // Formatting helpers
  // ============================================================================

  const fmt = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const totalBaseSalary = salaries.reduce((sum, s) => sum + s.base_salary, 0);
  const totalAdvancesApproved = salaries.reduce((sum, s) => sum + s.total_advances, 0);
  const totalNetPayable = salaries.reduce((sum, s) => sum + s.net_payable, 0);

  const months = [
    { value: 1, name: "January" }, { value: 2, name: "February" },
    { value: 3, name: "March" }, { value: 4, name: "April" },
    { value: 5, name: "May" }, { value: 6, name: "June" },
    { value: 7, name: "July" }, { value: 8, name: "August" },
    { value: 9, name: "September" }, { value: 10, name: "October" },
    { value: 11, name: "November" }, { value: 12, name: "December" },
  ];

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  const pendingRequests = advances.filter(a => !a.approved_by_admin);
  const activeEmployees = employees.filter(e => e.is_active);
  const roleOptions = ["Staff", "Manager", "Driver", "Accountant", "Supervisor", "Other"];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Employee Management</h1>
          <p className="text-muted-foreground text-sm font-bold uppercase opacity-50 mt-1">
            Owner Controls • Staff, Salaries & Advances
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {activeTab === "overview" && (
            <div className="flex items-center bg-black/40 border border-white/10 rounded-xl px-2 py-1 gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="bg-transparent border-0 text-white text-xs font-bold focus:outline-none cursor-pointer"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value} className="bg-neutral-900">{m.name}</option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="bg-transparent border-0 text-white text-xs font-bold focus:outline-none cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y} className="bg-neutral-900">{y}</option>
                ))}
              </select>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading && employees.length === 0 ? (
        <div className="text-center p-20">
          <Loader2 className="animate-spin text-white/20 mx-auto mb-4" size={40} />
          <p className="text-white/40 text-sm uppercase font-bold">Loading employee data...</p>
        </div>
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-2 border-primary/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Active Employees</p>
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-black font-mono tracking-tight text-white">{activeEmployees.length}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Total base: {fmt(totalBaseSalary)}</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-warning/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Advances This Month</p>
                  <Wallet className="h-4 w-4 text-warning" />
                </div>
                <p className="text-2xl font-black font-mono tracking-tight text-warning">{fmt(totalAdvancesApproved)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Approved advances paid out</p>
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

          {/* Tabs */}
          <div className="flex border-b border-white/10 gap-6">
            <button
              onClick={() => setActiveTab("employees")}
              className={`pb-4 text-sm font-black uppercase tracking-wider relative transition-all ${
                activeTab === "employees" ? "text-primary" : "text-white/40 hover:text-white"
              }`}
            >
              Employees
              <Badge className="bg-primary/20 text-primary border border-primary/30 font-bold text-[9px] px-1.5 ml-2">
                {activeEmployees.length}
              </Badge>
              {activeTab === "employees" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />}
            </button>
            <button
              onClick={() => setActiveTab("overview")}
              className={`pb-4 text-sm font-black uppercase tracking-wider relative transition-all ${
                activeTab === "overview" ? "text-primary" : "text-white/40 hover:text-white"
              }`}
            >
              Salary Overview
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

          {/* Tab Content */}
          <Card className="border-2 border-white/10">
            <CardContent className="p-6">
              {/* ========== EMPLOYEES TAB ========== */}
              {activeTab === "employees" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase text-muted-foreground">
                      {employees.length} employee{employees.length !== 1 ? "s" : ""} total • {activeEmployees.length} active
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setAddDialogOpen(true)}
                      className="bg-primary hover:bg-primary/80 text-white font-black uppercase text-[10px] h-9"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Employee
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10">
                          <TableHead className="text-xs font-black uppercase">Name</TableHead>
                          <TableHead className="text-xs font-black uppercase">Role</TableHead>
                          <TableHead className="text-xs font-black uppercase">Phone</TableHead>
                          <TableHead className="text-xs font-black uppercase text-right">Base Salary</TableHead>
                          <TableHead className="text-xs font-black uppercase text-center">Status</TableHead>
                          <TableHead className="text-xs font-black uppercase text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employees.map((emp) => (
                          <TableRow key={emp.id} className={`border-white/5 ${!emp.is_active ? "opacity-40" : ""}`}>
                            <TableCell>
                              <div>
                                <p className="font-bold text-white text-sm">{emp.name}</p>
                                {emp.linked_username && (
                                  <p className="text-[10px] text-primary/60 font-bold">@{emp.linked_username}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-white/5 text-white/70 border border-white/10 font-bold uppercase text-[9px]">
                                {emp.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground font-mono">
                              {emp.phone_no || "—"}
                            </TableCell>
                            <TableCell className="font-mono text-right text-sm font-bold text-white">
                              {fmt(emp.base_salary)}
                            </TableCell>
                            <TableCell className="text-center">
                              {emp.is_active ? (
                                <Badge className="bg-success/20 text-success border border-success/30 font-bold uppercase text-[9px]">
                                  Active
                                </Badge>
                              ) : (
                                <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 font-bold uppercase text-[9px]">
                                  Inactive
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditDialog(emp)}
                                  className="h-8 w-8 p-0 text-white/40 hover:text-white"
                                  title="Edit employee"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openSalaryHistory(emp)}
                                  className="h-8 w-8 p-0 text-white/40 hover:text-primary"
                                  title="Salary history"
                                >
                                  <History className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleToggleActive(emp)}
                                  className={`h-8 w-8 p-0 ${emp.is_active ? "text-white/40 hover:text-red-400" : "text-white/40 hover:text-green-400"}`}
                                  title={emp.is_active ? "Deactivate" : "Reactivate"}
                                >
                                  {emp.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {employees.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm uppercase font-bold">
                              No employees found. Click &quot;Add Employee&quot; to create one.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* ========== SALARY OVERVIEW TAB ========== */}
              {activeTab === "overview" && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-xs font-black uppercase">Employee</TableHead>
                        <TableHead className="text-xs font-black uppercase">Role</TableHead>
                        <TableHead className="text-xs font-black uppercase text-right">Base Salary</TableHead>
                        <TableHead className="text-xs font-black uppercase text-right text-warning">Approved Advances</TableHead>
                        <TableHead className="text-xs font-black uppercase text-right text-success">Net Pay Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salaries.map((s) => (
                        <TableRow key={s.employee_id} className="border-white/5">
                          <TableCell className="font-bold text-white text-sm">{s.employee_name}</TableCell>
                          <TableCell>
                            <Badge className="bg-white/5 text-white/70 border border-white/10 font-bold uppercase text-[9px]">
                              {s.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-right text-sm">{fmt(s.base_salary)}</TableCell>
                          <TableCell className="font-mono text-right text-warning text-sm">{fmt(s.total_advances)}</TableCell>
                          <TableCell className="font-mono text-right text-success text-sm font-bold">{fmt(s.net_payable)}</TableCell>
                        </TableRow>
                      ))}
                      {salaries.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-sm uppercase font-bold">
                            No active employees found for this period.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* ========== ADVANCE REQUESTS TAB ========== */}
              {activeTab === "requests" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase text-muted-foreground">
                      {pendingRequests.length} pending • {advances.length} total
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setAddAdvDialogOpen(true)}
                      className="bg-primary hover:bg-primary/80 text-white font-black uppercase text-[10px] h-9"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Record Advance
                    </Button>
                  </div>

                  {advances.length === 0 ? (
                    <div className="text-center p-12 text-muted-foreground text-sm uppercase font-bold tracking-wider">
                      No advance requests found.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/10">
                            <TableHead className="text-xs font-black uppercase">Employee</TableHead>
                            <TableHead className="text-xs font-black uppercase">Month/Year</TableHead>
                            <TableHead className="text-xs font-black uppercase">Amount</TableHead>
                            <TableHead className="text-xs font-black uppercase">Date</TableHead>
                            <TableHead className="text-xs font-black uppercase text-center">Status</TableHead>
                            <TableHead className="text-xs font-black uppercase text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {advances.map((adv) => (
                            <TableRow key={adv.id} className="border-white/5">
                              <TableCell className="font-bold text-white text-sm">{adv.employee_name}</TableCell>
                              <TableCell className="font-bold text-sm">
                                {months.find(m => m.value === adv.month)?.name} {adv.year}
                              </TableCell>
                              <TableCell className="font-mono font-bold text-sm">{fmt(adv.amount)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(adv.timestamp).toLocaleDateString("en-IN", {
                                  day: "numeric", month: "short", year: "numeric",
                                  hour: "2-digit", minute: "2-digit"
                                })}
                              </TableCell>
                              <TableCell className="text-center">
                                {adv.approved_by_admin ? (
                                  <Badge className="bg-success/20 text-success border border-success/30 font-bold uppercase text-[9px]">
                                    Approved
                                  </Badge>
                                ) : (
                                  <Badge className="bg-warning/20 text-warning border border-warning/30 font-bold uppercase text-[9px]">
                                    Pending
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

      {/* ================================================================== */}
      {/* DIALOG: Add Employee                                               */}
      {/* ================================================================== */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="border-2 border-white/10 bg-neutral-900 text-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase text-white">Add New Employee</DialogTitle>
            <CardDescription className="text-xs uppercase font-bold text-muted-foreground">
              Create a new employee record. This does not create a login account.
            </CardDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-white/60">Full Name *</Label>
              <Input
                placeholder="e.g. Ravi Kumar"
                value={newEmp.name}
                onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })}
                className="bg-black/50 border-white/10 focus:border-primary font-bold text-white text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-white/60">Phone Number</Label>
              <Input
                placeholder="e.g. 9876543210"
                value={newEmp.phone_no}
                onChange={(e) => setNewEmp({ ...newEmp, phone_no: e.target.value })}
                className="bg-black/50 border-white/10 focus:border-primary font-mono text-white text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-white/60">Role</Label>
              <select
                value={newEmp.role}
                onChange={(e) => setNewEmp({ ...newEmp, role: e.target.value })}
                className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r} className="bg-neutral-900">{r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-white/60">Base Salary (₹)</Label>
              <Input
                type="number"
                placeholder="e.g. 25000"
                value={newEmp.base_salary}
                onChange={(e) => setNewEmp({ ...newEmp, base_salary: e.target.value })}
                className="bg-black/50 border-white/10 focus:border-primary font-mono text-white text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              className="border-white/10 hover:bg-white/5 font-black uppercase text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddEmployee}
              disabled={addLoading || !newEmp.name.trim()}
              className="bg-primary hover:bg-primary/80 text-white font-black uppercase text-xs"
            >
              {addLoading ? "Creating..." : "Create Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* DIALOG: Edit Employee                                              */}
      {/* ================================================================== */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="border-2 border-white/10 bg-neutral-900 text-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase text-white">Edit Employee</DialogTitle>
            <CardDescription className="text-xs uppercase font-bold text-muted-foreground">
              Update employee details. Salary changes are logged automatically.
            </CardDescription>
          </DialogHeader>

          {editEmp && (
            <div className="py-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase text-white/60">Full Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="bg-black/50 border-white/10 focus:border-primary font-bold text-white text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase text-white/60">Phone Number</Label>
                <Input
                  value={editForm.phone_no}
                  onChange={(e) => setEditForm({ ...editForm, phone_no: e.target.value })}
                  className="bg-black/50 border-white/10 focus:border-primary font-mono text-white text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase text-white/60">Role</Label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r} className="bg-neutral-900">{r}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase text-white/60">Base Salary (₹)</Label>
                <Input
                  type="number"
                  value={editForm.base_salary}
                  onChange={(e) => setEditForm({ ...editForm, base_salary: e.target.value })}
                  className="bg-black/50 border-white/10 focus:border-primary font-mono text-white text-sm"
                />
                {editEmp.base_salary !== parseFloat(editForm.base_salary || "0") && (
                  <p className="text-[10px] text-warning font-bold">
                    ⚠ Salary will change from {fmt(editEmp.base_salary)} → {fmt(parseFloat(editForm.base_salary) || 0)}. This change will be logged.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => { setEditDialogOpen(false); setEditEmp(null); }}
              className="border-white/10 hover:bg-white/5 font-black uppercase text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditEmployee}
              disabled={editLoading}
              className="bg-primary hover:bg-primary/80 text-white font-black uppercase text-xs"
            >
              {editLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* DIALOG: Salary History                                             */}
      {/* ================================================================== */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="border-2 border-white/10 bg-neutral-900 text-white max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase text-white">
              Salary History — {historyEmployee?.name}
            </DialogTitle>
            <CardDescription className="text-xs uppercase font-bold text-muted-foreground">
              Audit trail of all salary changes
            </CardDescription>
          </DialogHeader>

          <div className="py-4">
            {historyLoading ? (
              <div className="text-center p-8">
                <Loader2 className="animate-spin text-white/20 mx-auto" size={24} />
              </div>
            ) : salaryHistory.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground text-sm uppercase font-bold">
                No salary changes recorded yet.
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {salaryHistory.map((log) => (
                  <div key={log.id} className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-red-400 line-through">{fmt(log.old_salary)}</span>
                        <span className="text-white/40">→</span>
                        <span className="font-mono text-sm text-success font-bold">{fmt(log.new_salary)}</span>
                      </div>
                      <span className={`text-[10px] font-bold ${log.new_salary > log.old_salary ? "text-success" : "text-red-400"}`}>
                        {log.new_salary > log.old_salary ? "+" : ""}{fmt(log.new_salary - log.old_salary)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>By: <strong className="text-white/60">{log.changed_by}</strong></span>
                      <span>
                        {new Date(log.timestamp).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setHistoryDialogOpen(false); setHistoryEmployee(null); setSalaryHistory([]); }}
              className="border-white/10 hover:bg-white/5 font-black uppercase text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* DIALOG: Approve Advance                                            */}
      {/* ================================================================== */}
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
                  <span className="text-white/60 font-bold uppercase text-xs">Employee:</span>
                  <span className="font-black text-white">{selectedAdvance.employee_name}</span>
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
              onClick={() => { setApproveDialogOpen(false); setSelectedAdvance(null); }}
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

      {/* ================================================================== */}
      {/* DIALOG: Record Advance for Employee                                */}
      {/* ================================================================== */}
      <Dialog open={addAdvDialogOpen} onOpenChange={setAddAdvDialogOpen}>
        <DialogContent className="border-2 border-white/10 bg-neutral-900 text-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase text-white">Record Salary Advance</DialogTitle>
            <CardDescription className="text-xs uppercase font-bold text-muted-foreground">
              Create an advance entry for an employee. It will need separate approval to finalize the payout.
            </CardDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-white/60">Employee *</Label>
              <select
                value={advForm.employee_id}
                onChange={(e) => setAdvForm({ ...advForm, employee_id: e.target.value })}
                className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                <option value="" className="bg-neutral-900">Select employee...</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id} className="bg-neutral-900">
                    {emp.name} ({emp.role}) — {fmt(emp.base_salary)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-white/60">Amount (₹) *</Label>
              <Input
                type="number"
                placeholder="e.g. 5000"
                value={advForm.amount}
                onChange={(e) => setAdvForm({ ...advForm, amount: e.target.value })}
                className="bg-black/50 border-white/10 focus:border-primary font-mono text-white text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase text-white/60">Month</Label>
                <select
                  value={advForm.month}
                  onChange={(e) => setAdvForm({ ...advForm, month: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value} className="bg-neutral-900">{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase text-white/60">Year</Label>
                <select
                  value={advForm.year}
                  onChange={(e) => setAdvForm({ ...advForm, year: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  {years.map((y) => (
                    <option key={y} value={y} className="bg-neutral-900">{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAddAdvDialogOpen(false)}
              className="border-white/10 hover:bg-white/5 font-black uppercase text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddAdvance}
              disabled={addAdvLoading || !advForm.employee_id || !advForm.amount}
              className="bg-primary hover:bg-primary/80 text-white font-black uppercase text-xs"
            >
              {addAdvLoading ? "Creating..." : "Record Advance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
