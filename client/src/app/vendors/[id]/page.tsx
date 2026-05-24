"use client";

import { use, useState } from "react";
import { ArrowLeft, Phone, User, Wallet, Loader2, RefreshCw, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Separator } from "../../../components/ui/separator";
import BillOverlay from "../../../components/BillOverlay";
import { useLaserFocus } from "../../../hooks/useLaserFocus";
import type { BillOverlayData, SearchPurchaseBill, SearchTransaction } from "../../../lib/types";

export default function StakeholderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data, loading, error, refetch } = useLaserFocus({
    type: "vendor",
    id,
  });
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null);
  const [selectedBillData, setSelectedBillData] = useState<BillOverlayData | null>(null);

  const openTransactionOverlay = (tx: SearchTransaction) => {
    setSelectedTransactionId(tx.id);
    setSelectedBillData({
      id: tx.id,
      type: tx.type,
      date: tx.created_at,
      stakeholder_name: profile.name,
      total_amount: tx.total_amount,
      paid_amount: tx.paid_amount,
      payment_mode: tx.payment_mode,
      description: `Vendor transaction for ${profile.name}`,
      items: (tx.items || []).map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name || `Product ${item.product_id}`,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price ?? item.quantity * item.unit_price,
      })),
    });
  };

  const openBillOverlay = (bill: SearchPurchaseBill) => {
    setSelectedTransactionId(bill.id);
    setSelectedBillData({
      id: bill.id,
      type: "PURCHASE",
      date: bill.date || new Date().toISOString(),
      stakeholder_name: bill.vendor_name || profile.name,
      total_amount: bill.total_amount,
      paid_amount: bill.total_amount,
      payment_mode: "N/A",
      description: `Stored bill ${bill.bill_no}`,
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

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        <Link href="/vendors">
          <Button variant="ghost" className="font-bold gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>
        </Link>
        <Card className="border-2 border-destructive/20">
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-lg font-bold text-destructive">{error || "Vendor not found"}</p>
            <Button onClick={refetch} variant="outline">Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { profile, digital_bills, transaction_history } = data;
  const transaction_count = transaction_history.length;
  const history = transaction_history;
  const balanceColor = profile.balance > 0 ? "text-success" : profile.balance < 0 ? "text-danger" : "text-muted-foreground";

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 text-left">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/vendors">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase">Laser Focus</h1>
            <p className="text-muted-foreground text-sm font-bold uppercase opacity-50">Vendor #{id}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refetch}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="md:col-span-1 border-2">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-primary/10">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-black">{profile.name}</p>
                <Badge variant={profile.type === "VENDOR" ? "default" : "secondary"} className="font-bold text-[10px] mt-1">
                  {profile.type}
                </Badge>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Phone</p>
                  <p className="font-mono font-bold">{profile.phone_no}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Balance</p>
                  <p className={`text-2xl font-black font-mono ${balanceColor}`}>
                    ₹{Math.abs(profile.balance).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {profile.balance > 0 ? "They owe you" : profile.balance < 0 ? "You owe them" : "Settled"}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Transactions</p>
              <p className="text-3xl font-black font-mono">{transaction_count}</p>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-lg font-black uppercase">Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground italic">
                  No transactions yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((tx) => {
                    const isSale = tx.type === "SALE";
                    const isPurchase = tx.type === "PURCHASE";
                    const date = new Date(tx.created_at);

                    return (
                      <div
                        key={tx.id}
                        className="flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-muted/30"
                        onClick={() => openTransactionOverlay(tx)}
                      >
                        <div className={`rounded-lg p-2 ${isSale ? "bg-success/10" : isPurchase ? "bg-warning/10" : "bg-muted"}`}>
                          {isSale ? (
                            <ArrowUpRight className="h-5 w-5 text-success" />
                          ) : (
                            <ArrowDownLeft className="h-5 w-5 text-warning" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black">{tx.type}</p>
                            <Badge variant="outline" className="text-[10px] font-mono">#{tx.id}</Badge>
                          </div>
                          <p className="text-[10px] font-mono text-muted-foreground">
                            {date.toLocaleDateString()} at {date.toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-lg font-black">₹{tx.total_amount.toLocaleString()}</p>
                          <div className="flex items-center justify-end gap-2">
                            <Badge variant={tx.payment_mode === "CASH" ? "default" : "secondary"} className="text-[9px] font-bold">
                              {tx.payment_mode}
                            </Badge>
                            {tx.paid_amount < tx.total_amount && (
                              <Badge variant="destructive" className="text-[9px] font-bold">
                                DUE: ₹{(tx.total_amount - tx.paid_amount).toLocaleString()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-lg font-black uppercase">Stored Purchase Bills</CardTitle>
            </CardHeader>
            <CardContent>
              {digital_bills.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground italic">
                  No digital bills uploaded for this vendor.
                </div>
              ) : (
                <div className="space-y-3">
                  {digital_bills.map((bill) => (
                    <div
                      key={bill.id}
                      className="flex cursor-pointer flex-col gap-4 rounded-xl border p-4 transition-colors hover:bg-muted/30 md:flex-row md:items-start md:justify-between"
                      onClick={() => openBillOverlay(bill)}
                    >
                      <div className="flex-1 space-y-2">
                        <p className="font-bold">Bill {bill.bill_no}</p>
                        <p className="text-[10px] text-muted-foreground">Amount: ₹{bill.total_amount.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">Date: {bill.date ? new Date(bill.date).toLocaleDateString() : "Unknown"}</p>
                        {bill.items?.length ? (
                          <div className="mt-3 rounded-xl border border-border bg-muted/50 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Purchased Items</p>
                            <div className="mt-2 space-y-2">
                              {bill.items.map((item) => (
                                <div key={`${bill.id}-${item.product_id}`} className="flex flex-col gap-2 rounded-lg border border-border p-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <p className="text-sm font-bold text-primary">{item.product_name}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                      Qty: {item.quantity} • Unit: ₹{item.unit_price.toLocaleString()}
                                    </p>
                                  </div>
                                  <Link
                                    href={`/inventory?search=${encodeURIComponent(item.product_name)}`}
                                    className="text-[10px] font-bold text-primary underline"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    View item history
                                  </Link>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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