"use client";

import { use } from "react";
import { ArrowLeft, Phone, User, Wallet, Loader2, RefreshCw, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Separator } from "../../../components/ui/separator";
import { useLaserFocus } from "../../../hooks/useLaserFocus";

export default function StakeholderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data, loading, error, refetch } = useLaserFocus({
    type: "customer",
    id,
  });

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
        <Link href="/customers">
          <Button variant="ghost" className="font-bold gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>
        </Link>
        <Card className="border-2 border-destructive/20">
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-lg font-bold text-destructive">{error || "Entity not found"}</p>
            <Button onClick={refetch} variant="outline">Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { profile, transaction_count, history } = data;
  const balanceColor = profile.balance > 0 ? "text-success" : profile.balance < 0 ? "text-danger" : "text-muted-foreground";

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 text-left">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/customers">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase">Laser Focus</h1>
            <p className="text-muted-foreground text-sm font-bold uppercase opacity-50">Customer #{id}</p>
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
                <Badge variant={profile.type === "CUSTOMER" ? "default" : "secondary"} className="font-bold text-[10px] mt-1">
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

        {/* Transaction Timeline */}
        <Card className="md:col-span-2 border-2">
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
                    <div key={tx.id} className="flex items-center gap-4 p-4 rounded-xl border hover:bg-muted/30 transition-colors">
                      <div className={`p-2 rounded-lg ${isSale ? "bg-success/10" : isPurchase ? "bg-warning/10" : "bg-muted"}`}>
                        {isSale ? (
                          <ArrowUpRight className="h-5 w-5 text-success" />
                        ) : (
                          <ArrowDownLeft className="h-5 w-5 text-warning" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-sm">{tx.type}</p>
                          <Badge variant="outline" className="text-[10px] font-mono">#{tx.id}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {date.toLocaleDateString()} at {date.toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black font-mono text-lg">₹{tx.total_amount.toLocaleString()}</p>
                        <div className="flex items-center gap-2 justify-end">
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
      </div>
    </div>
  );
}