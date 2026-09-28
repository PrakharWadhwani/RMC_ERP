"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, UserPlus, Loader2, Eye, AlertTriangle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../../components/ui/dialog";
import { Switch } from "../../components/ui/switch";
import api from "../../lib/api";
import type { Stakeholder } from "../../lib/types";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Stakeholder[]>([]);
  const [debtors, setDebtors] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);

  // Search
  const [searchPhone, setSearchPhone] = useState("");
  const [searchResult, setSearchResult] = useState<Stakeholder | null>(null);
  const [searching, setSearching] = useState(false);

  // Create Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [isWholesale, setIsWholesale] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [allRes, debtRes] = await Promise.all([
        api.get("/customers/"),
        api.get("/customers/debtors")
      ]);
      setCustomers(allRes.data);
      setDebtors(debtRes.data);
    } catch (err) {
      console.error("Backend Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSearch = async () => {
    if (!searchPhone) return;
    try {
      setSearching(true);
      const res = await api.get(`/customers/search?q=${encodeURIComponent(searchPhone)}`);
      const found = res.data[0] as Stakeholder | undefined;
      if (found) {
        setSearchResult(found);
      } else {
        setSearchResult(null);
        alert("No record found for this name fragment.");
      }
    } catch (err) {
      console.error(err);
      setSearchResult(null);
      alert("Failed to search customers.");
    } finally {
      setSearching(false);
    }
  };

  const handleCreate = async () => {
    if (!newName) return;
    try {
      setCreating(true);
      // Wait, axios passes json, let's use json
      await api.post("/customers/", {
        name: newName,
        phone_no: newPhone || null,
        type: "CUSTOMER", // Forced by backend anyway
        is_wholesale: isWholesale
      });
      setNewName(""); setNewPhone(""); setIsWholesale(false);
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create customer");
    } finally {
      setCreating(false);
    }
  };

  const EntityTable = ({ data, emptyMsg }: { data: Stakeholder[]; emptyMsg: string }) => (
    <div className="rounded-xl border-2 bg-card overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="font-bold uppercase text-xs">Name</TableHead>
            <TableHead className="font-bold uppercase text-xs">Phone</TableHead>
            <TableHead className="font-bold uppercase text-xs text-center">Type</TableHead>
            <TableHead className="font-bold uppercase text-xs text-right">Balance</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">{emptyMsg}</TableCell>
            </TableRow>
          ) : (
            data.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-bold">{c.name}</TableCell>
                <TableCell className="font-mono text-sm">{c.phone_no || "N/A"}</TableCell>
                <TableCell className="text-center">
                  {c.is_wholesale ? (
                    <Badge variant="secondary" className="font-bold text-[10px] bg-blue-500/20 text-blue-500">WHOLESALE</Badge>
                  ) : (
                    <Badge variant="outline" className="font-bold text-[10px]">RETAIL</Badge>
                  )}
                </TableCell>
                <TableCell className={`text-right font-mono font-bold ${c.balance > 0 ? "text-success" : c.balance < 0 ? "text-danger" : ""}`}>
                  ₹{Math.abs(c.balance).toLocaleString()}
                  {c.balance > 0 && <span className="text-[10px] ml-1">owes you</span>}
                  {c.balance < 0 && <span className="text-[10px] ml-1">you owe</span>}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/customers/${c.id}`}>
                    <Button variant="ghost" size="sm" className="font-bold text-xs gap-1">
                      <Eye className="h-3 w-3" /> DETAIL
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 text-left">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Customers</h1>
          <p className="text-muted-foreground text-sm font-bold uppercase opacity-50">Retail & Wholesale</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold gap-2"><UserPlus className="h-4 w-4" /> Register Customer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-black">Register New Customer</DialogTitle>
              <DialogDescription>Add a new customer to your system</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase">Full Name</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Rajesh Kumar" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase">Phone Number (Optional)</Label>
                <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="9876543210" />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="wholesale" checked={isWholesale} onCheckedChange={setIsWholesale} />
                <Label htmlFor="wholesale" className="font-bold">Wholesale Customer</Label>
              </div>
              <Button onClick={handleCreate} disabled={creating || !newName} className="w-full font-bold">
                {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Register"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <Input className="max-w-xs" placeholder="Search by customer name..." value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} />
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
      {searchResult && (
        <Card className="border-2 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-black text-lg">{searchResult.name}</p>
              <p className="text-xs font-mono text-muted-foreground">{searchResult.phone_no} • {searchResult.type}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Balance</p>
                <p className={`font-mono font-bold ${searchResult.balance > 0 ? "text-success" : searchResult.balance < 0 ? "text-danger" : ""}`}>
                  ₹{Math.abs(searchResult.balance).toLocaleString()}
                </p>
              </div>
              <Link href={`/customers/${searchResult.id}`}>
                <Button size="sm" className="font-bold">View History</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList className="font-bold">
          <TabsTrigger value="all" className="font-bold gap-1">All Customers</TabsTrigger>
          <TabsTrigger value="debtors" className="font-bold gap-1"><AlertTriangle className="h-3 w-3" /> Debtors</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <EntityTable data={customers} emptyMsg="No customers found." />
          )}
        </TabsContent>
        <TabsContent value="debtors" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <EntityTable data={debtors} emptyMsg="No debtors. All accounts are clear!" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}