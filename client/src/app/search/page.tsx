"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, FileText, Activity, DownloadCloud, Eye } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import api from "../../lib/api";
import type { SearchResponse } from "../../lib/types";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

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
                        <TableRow key={txn.id}>
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
                  {results.purchase_bills.map((bill) => {
                    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
                    const fullFileUrl = bill.file_path ? `${baseUrl}${bill.file_path}` : null;

                    return (
                      <div key={bill.id} className="rounded-xl border p-5 flex flex-col gap-4 bg-zinc-950/20">
                        {/* Top Metadata Header Row */}
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b pb-3 border-zinc-800/50">
                          <div>
                            <h3 className="font-black text-lg tracking-tight uppercase text-white">Bill {bill.bill_no}</h3>
                            <div className="text-[11px] font-bold uppercase text-muted-foreground space-y-0.5 mt-1 opacity-75">
                              <p>Vendor: <span className="text-white">{bill.vendor_name}</span></p>
                              <p>Total Amount: <span className="text-white font-mono">₹{bill.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></p>
                              <p>Date Added: <span className="text-white font-mono">{bill.date ? new Date(bill.date).toLocaleDateString() : "Unknown"}</span></p>
                            </div>
                          </div>

                          {/* Interactive Document View / Download Actions */}
                          <div className="flex flex-wrap gap-2 items-center">
                            <Link href={`/vendors/${bill.vendor_id}`} className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:bg-zinc-800">
                              View Vendor
                            </Link>
                            {fullFileUrl ? (
                              <>
                                <a
                                  href={fullFileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center justify-center rounded-lg bg-primary/10 border border-primary/30 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/20"
                                >
                                  <Eye className="mr-1.5 h-3.5 w-3.5" /> View Copy
                                </a>
                                <a
                                  href={`${baseUrl}/purchases/${bill.id}/download`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center justify-center rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-zinc-700"
                                >
                                  <DownloadCloud className="mr-1.5 h-3.5 w-3.5" /> Download
                                </a>
                              </>
                            ) : (
                              <span className="inline-flex items-center rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-500 font-bold">
                                No file attached
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle Line Items Inventory Grid Segment */}
                        {bill.items && bill.items.length > 0 ? (
                          <div className="rounded-xl bg-zinc-900/40 p-4 border border-zinc-800/60 max-w-4xl">
                            <p className="text-[10px] uppercase font-black tracking-wider text-muted-foreground/60 mb-2.5">Purchased Items Breakdown</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {bill.items.map((item: any, idx: number) => {
                                const resolvedName = item.product_name || 
                                  `${item.brand ? item.brand + " " : ""}${item.model_name || "Product"} (${item.model_no || "N/A"})`;
                                return (
                                  <div key={`${bill.id}-item-${idx}`} className="flex items-center justify-between gap-4 rounded-lg bg-zinc-950/50 p-3 border border-zinc-800/40">
                                    <div className="space-y-0.5">
                                      <p className="font-bold text-xs text-zinc-200 tracking-tight">{resolvedName}</p>
                                      <p className="text-[10px] font-medium text-zinc-500 font-mono">
                                        Qty: {item.quantity} × ₹{item.unit_price.toLocaleString("en-IN")}
                                      </p>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-1">
                                      <span className="text-xs font-mono font-bold text-zinc-400">
                                        ₹{(item.total_price || (item.quantity * item.unit_price)).toLocaleString("en-IN")}
                                      </span>
                                      <Link
                                        href={`/inventory?search=${encodeURIComponent(item.model_no || item.product_name || "")}`}
                                        className="text-[9px] font-bold text-primary/80 hover:text-primary transition underline uppercase tracking-wide"
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
                          <p className="text-xs text-zinc-500 italic px-1">No separate itemized logs registered under this manual total record.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No matching purchase bills found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}