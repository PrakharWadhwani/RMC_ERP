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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import api from "../../lib/api";
import type { Entity } from "../../lib/types";

export default function StakeholdersPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [debtors, setDebtors] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  // Search
  const [searchPhone, setSearchPhone] = useState("");
  const [searchResult, setSearchResult] = useState<Entity | null>(null);
  const [searching, setSearching] = useState(false);

  // Create Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newType, setNewType] = useState<"CUSTOMER" | "VENDOR">("CUSTOMER");
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const debtRes = await api.get("/stakeholders/debtors/");
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
      const res = await api.get(`/stakeholders/search/${searchPhone}`);
      setSearchResult(res.data);
    } catch {
      setSearchResult(null);
      alert("No record found for this phone number.");
    } finally {
      setSearching(false);
    }
  };

  const handleCreate = async () => {
    if (!newName || !newPhone) return;
    try {
      setCreating(true);
      const params = new URLSearchParams({
        name: newName,
        phone_no: newPhone,
        entity_type: newType,
      });
      await api.post(`/stakeholders/entities/?${params.toString()}`);
      setNewName(""); setNewPhone("");
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create entity");
    } finally {
      setCreating(false);
    }
  };

  const EntityTable = ({ data, emptyMsg }: { data: Entity[]; emptyMsg: string }) => (
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
            data.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-bold">{e.name}</TableCell>
                <TableCell className="font-mono text-sm">{e.phone_no}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={e.entity_type === "CUSTOMER" ? "default" : "secondary"} className="font-bold text-[10px]">
                    {e.entity_type}
                  </Badge>
                </TableCell>
                <TableCell className={`text-right font-mono font-bold ${e.balance > 0 ? "text-success" : e.balance < 0 ? "text-danger" : ""}`}>
                  ₹{Math.abs(e.balance).toLocaleString()}
                  {e.balance > 0 && <span className="text-[10px] ml-1">owes you</span>}
                  {e.balance < 0 && <span className="text-[10px] ml-1">you owe</span>}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/stakeholders/${e.id}`}>
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
          <h1 className="text-4xl font-black tracking-tight uppercase">Stakeholders</h1>
          <p className="text-muted-foreground text-sm font-bold uppercase opacity-50">Customers & Vendors</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold gap-2"><UserPlus className="h-4 w-4" /> Register Entity</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-black">Register Customer / Vendor</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase">Full Name</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Rajesh Kumar" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase">Phone Number</Label>
                <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="9876543210" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase">Type</Label>
                <div className="flex gap-2">
                  <Button variant={newType === "CUSTOMER" ? "default" : "outline"} className="flex-1 font-bold" onClick={() => setNewType("CUSTOMER")}>Customer</Button>
                  <Button variant={newType === "VENDOR" ? "default" : "outline"} className="flex-1 font-bold" onClick={() => setNewType("VENDOR")}>Vendor</Button>
                </div>
              </div>
              <Button onClick={handleCreate} disabled={creating || !newName || !newPhone} className="w-full font-bold">
                {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Register"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <Input className="max-w-xs" placeholder="Search by phone number..." value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} />
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
      {searchResult && (
        <Card className="border-2 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-black text-lg">{searchResult.name}</p>
              <p className="text-xs font-mono text-muted-foreground">{searchResult.phone_no} • {searchResult.entity_type}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Balance</p>
                <p className={`font-mono font-bold ${searchResult.balance > 0 ? "text-success" : searchResult.balance < 0 ? "text-danger" : ""}`}>
                  ₹{Math.abs(searchResult.balance).toLocaleString()}
                </p>
              </div>
              <Link href={`/stakeholders/${searchResult.id}`}>
                <Button size="sm" className="font-bold">View History</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="debtors">
        <TabsList className="font-bold">
          <TabsTrigger value="debtors" className="font-bold gap-1"><AlertTriangle className="h-3 w-3" /> Debtors</TabsTrigger>
        </TabsList>
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