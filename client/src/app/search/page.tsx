"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, FileText, Activity } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import BillOverlay from "../../components/BillOverlay";
import api from "../../lib/api";
import type { BillOverlayData, SearchPurchaseBill, SearchResponse, SearchTransaction } from "../../lib/types";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null);
  const [selectedBillData, setSelectedBillData] = useState<BillOverlayData | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) {
      setError("Enter a search term to continue.");
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const response = await api.get<SearchResponse>("/search/global", {
        params: { query: query.trim() },
      });
      setResults(response.data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Search request failed.";
      setError(message);
      setResults(null);
    } finally {
      loading;
      setLoading(false);
    }
  };

  const openLink = (path: string) => {
    window.location.href = path;
  };

  const openTransactionOverlay = (txn: SearchTransaction) => {
    setSelectedTransactionId(txn.id);
    setSelectedBillData({
      id: txn.id,
      type: txn.type,
      date: txn.created_at,
      stakeholder_name: txn.stakeholder_name || "Walk-in Customer",
      total_amount: txn.total_amount,
      paid_amount: txn.paid_amount,
      payment_mode: txn.payment_mode,
      description: `Global search transaction ${txn.type}`,
      items: [],
    });
  };

  const openBillOverlay = (bill: SearchPurchaseBill) => {
    setSelectedTransactionId(bill.id);
    setSelectedBillData({
      id: bill.id,
      type: "PURCHASE",
      date: bill.date || new Date().toISOString(),
      stakeholder_name: bill.vendor_name || "Unknown Vendor",
      total_amount: bill.total_amount,
      paid_amount: bill.total_amount,
      payment_mode: "N/A",
      description: `Purchase bill ${bill.bill_no}`,
      file_path: bill.file_path,
      items: bill.items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        model_no: item.model_no,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price ?? item.quantity * item.unit_price,
      })),
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 text-left">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Global Search</h1>
          <p className="text-muted-foreground text-sm font-bold uppercase opacity-50">Search customers, vendors, transactions and purchase bills</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, bill number, transaction type, vendor or phone"
            className="h-12 w-full md:w-[420px]"
            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={loading} className="h-12 font-bold">
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive border-2">
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {searched && !loading && (
        <div className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                <Users className="h-4 w-4" /> Stakeholders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {results?.stakeholders.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.stakeholders.map((item) => (
                    <div key={item.id} className="rounded-xl border p-4 hover:border-primary transition-colors">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-bold text-sm">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground">{item.type}</p>
                        </div>
                        <Badge variant={item.type === "VENDOR" ? "secondary" : "default"} className="text-[10px] font-bold">
                          {item.type}
                        </Badge>
                      </div>
                      <p className="text-[10px] mt-2 text-muted-foreground">{item.phone_no || "No phone"}</p>
                      <p className="text-[10px] font-bold mt-2">Balance: ₹{item.balance.toLocaleString()}</p>
                      <div className="mt-4">
                        <Button variant="outline" size="sm" onClick={() => openLink(item.type === "VENDOR" ? `/vendors/${item.id}` : `/customers/${item.id}`)}>
                          View Profile
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No matching customers or vendors found.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                <Activity className="h-4 w-4" /> Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {results?.transactions.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] uppercase">Date</TableHead>
                        <TableHead className="text-[10px] uppercase">Type</TableHead>
                        <TableHead className="text-[10px] uppercase">Counterparty</TableHead>
                        <TableHead className="text-[10px] uppercase">Amount</TableHead>
                        <TableHead className="text-[10px] uppercase">Mode</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.transactions.map((txn) => (
                        <TableRow key={txn.id} className="cursor-pointer hover:bg-muted/20" onClick={() => openTransactionOverlay(txn)}>
                          <TableCell className="text-xs font-mono">{new Date(txn.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-xs">{txn.type}</TableCell>
                          <TableCell className="text-xs">{txn.stakeholder_name || "Walk-in"}</TableCell>
                          <TableCell className="text-xs">₹{txn.total_amount.toLocaleString()}</TableCell>
                          <TableCell className="text-xs">{txn.payment_mode}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No matching transactions found.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                <FileText className="h-4 w-4" /> Purchase Bills
              </CardTitle>
            </CardHeader>
            <CardContent>
              {results?.purchase_bills.length ? (
                <div className="space-y-4">
                  {results.purchase_bills.map((bill) => (
                    <div
                      key={bill.id}
                      className="flex cursor-pointer flex-col gap-4 rounded-xl border bg-zinc-950/20 p-5"
                      onClick={() => openBillOverlay(bill)}
                    >
                      {/* Top Metadata Header Row */}
                      <div className="flex flex-col gap-4 border-b border-zinc-800/50 pb-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="font-black text-lg tracking-tight uppercase text-white">Bill {bill.bill_no}</h3>
                          <div className="mt-1 space-y-0.5 text-[11px] font-bold uppercase text-muted-foreground opacity-75">
                            <p>Vendor: <span className="text-white">{bill.vendor_name}</span></p>
                            <p>Total Amount: <span className="text-white font-mono">₹{bill.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></p>
                            <p>Date Added: <span className="text-white font-mono">{bill.date ? new Date(bill.date).toLocaleDateString() : "Unknown"}</span></p>
                          </div>
                        </div>

                        <Link
                          href={`/vendors/${bill.vendor_id}`}
                          className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:bg-zinc-800"
                          onClick={(event) => event.stopPropagation()}
                        >
                          View Vendor
                        </Link>
                      </div>

                      {/* Middle Line Items Inventory Grid Segment */}
                      {bill.items && bill.items.length > 0 ? (
                        <div className="max-w-4xl rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
                          <p className="mb-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">Purchased Items Breakdown</p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {bill.items.map((item: any, idx: number) => {
                              const resolvedName = item.product_name ||
                                `${item.brand ? item.brand + " " : ""}${item.model_name || "Product"} (${item.model_no || "N/A"})`;

                              return (
                                <div key={`${bill.id}-item-${idx}`} className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800/40 bg-zinc-950/50 p-3">
                                  <div className="space-y-0.5">
                                    <p className="text-xs font-bold tracking-tight text-zinc-200">{resolvedName}</p>
                                    <p className="font-mono text-[10px] font-medium text-zinc-500">
                                      Qty: {item.quantity} × ₹{item.unit_price.toLocaleString("en-IN")}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1 text-right">
                                    <span className="font-mono text-xs font-bold text-zinc-400">
                                      ₹{(item.total_price || (item.quantity * item.unit_price)).toLocaleString("en-IN")}
                                    </span>
                                    <Link
                                      href={`/inventory?search=${encodeURIComponent(item.model_no || item.product_name || "")}`}
                                      className="text-[9px] font-bold uppercase tracking-wide text-primary/80 underline transition hover:text-primary"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      Track Item
                                    </Link>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="px-1 text-xs italic text-zinc-500">No separate itemized logs registered under this manual total record.</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No matching purchase bills found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <BillOverlay
        transactionId={selectedTransactionId}
        onClose={() => {
          setSelectedTransactionId(null);
          setSelectedBillData(null);
        }}
        initialData={selectedBillData}
      />
    </div>
  );
}