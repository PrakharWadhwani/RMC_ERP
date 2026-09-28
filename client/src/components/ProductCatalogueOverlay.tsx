"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon, X, ArrowUpRight } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Separator } from "./ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import api, { resolveAssetUrl } from "../lib/api";
import type { Category, ProductDetailResponse } from "../lib/types";
import BillOverlay from "./BillOverlay";

interface ProductCatalogueOverlayProps {
  productId: number | null;
  onClose: () => void;
}

const stockClassName = (stock: number) => {
  if (stock > 10) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
  if (stock >= 5) return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  return "border-rose-500/40 bg-rose-500/10 text-rose-300";
};

function flattenCategories(categories: Category[], depth = 0): Array<Category & { depth: number }> {
  return categories.flatMap((category) => [
    { ...category, depth },
    ...flattenCategories(category.subcategories || [], depth + 1),
  ]);
}

// Extracts a transaction/bill numeric ID from a stock log reason string.
// Examples:
//   "SALE: Bill #12 to ABC"   → 12
//   "PURCHASE: Bill INV001"   → null (no leading #, not a numeric-only id)
//   "SALE #5 to Retail"       → 5
function extractTransactionId(reason: string): number | null {
  const match = reason.match(/#(\d+)/);
  if (match) return parseInt(match[1], 10);
  return null;
}

function isTransactionReason(reason: string): boolean {
  return (
    reason.includes("SALE") ||
    reason.includes("PURCHASE") ||
    reason.includes("Bill") ||
    reason.includes("Transaction") ||
    reason.includes("Sale") ||
    reason.includes("Purchase")
  );
}

export default function ProductCatalogueOverlay({ productId, onClose }: ProductCatalogueOverlayProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productData, setProductData] = useState<ProductDetailResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  // BillOverlay state — opened when user clicks a transaction row in movement log
  const [activeBillId, setActiveBillId] = useState<number | null>(null);

  useEffect(() => {
    if (!productId) return;

    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [detailsRes, categoryRes] = await Promise.all([
          api.get(`/inventory/products/${productId}/details`),
          api.get("/inventory/categories/tree"),
        ]);

        if (!isMounted) return;

        setProductData(detailsRes.data as ProductDetailResponse);
        setCategories(categoryRes.data as Category[]);
      } catch (err) {
        if (isMounted) setError("Unable to load product details right now.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  // Reset bill overlay when product changes
  useEffect(() => {
    setActiveBillId(null);
  }, [productId]);

  const categoryName = useMemo(() => {
    if (!productData) return "Unknown Category";
    const flatCategories = flattenCategories(categories);
    const match = flatCategories.find((c) => c.id === productData.details.category_id);
    return match?.name || "Unknown Category";
  }, [categories, productData]);

  const imageUrl = resolveAssetUrl(productData?.details.image_url ?? null);

  if (!productId) return null;

  return (
    <>
      {/* This overlay sits at z-[70] so it renders above BillOverlay (z-[60]) 
          when opened standalone, but BillOverlay can also open on top at z-[80]
          when triggered from within this overlay */}
      <div className="fixed inset-0 z-[70] bg-black/80 px-4 py-6 sm:px-8">
        <div
          className="mx-auto flex h-full max-w-5xl items-center justify-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <Card className="w-full max-h-[92vh] border-2 border-white/10 bg-zinc-950 text-white shadow-2xl flex flex-col overflow-hidden">
            <CardContent className="p-0 flex flex-col h-full max-h-[92vh]">

              {/* Header */}
              <div className="flex items-start justify-between border-b border-white/10 px-5 py-4 sm:px-6 shrink-0">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.35em] text-muted-foreground">
                    Product Catalogue
                  </p>
                  <h2 className="mt-2 text-2xl font-black uppercase tracking-tight sm:text-3xl">
                    {productData?.details.brand || "Product"}{" "}
                    {productData?.details.model_name || "Details"}
                  </h2>
                  <p className="mt-1 text-sm font-mono text-muted-foreground">
                    {productData?.details.model_no || "—"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-10 w-10 text-muted-foreground hover:text-white"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Scrollable body */}
              <div
                className="p-5 sm:p-6"
                style={{
                  overflowY: "auto",
                  maxHeight: "calc(92vh - 120px)",
                  scrollbarWidth: "thin",
                  scrollbarColor: "rgba(255,255,255,0.2) transparent",
                }}
              >
                {loading ? (
                  <div className="flex h-64 items-center justify-center text-sm font-bold uppercase text-muted-foreground">
                    Loading product details...
                  </div>
                ) : error ? (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm font-bold text-rose-200">
                    {error}
                  </div>
                ) : productData ? (
                  <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">

                    {/* Left — image + price cards */}
                    <div className="space-y-4">
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={productData.details.model_name}
                            className="h-72 w-full object-cover sm:h-80"
                          />
                        ) : (
                          <div className="flex h-72 w-full flex-col items-center justify-center gap-3 bg-zinc-900/80 text-muted-foreground sm:h-80">
                            <ImageIcon className="h-10 w-10" />
                            <p className="text-sm font-bold uppercase">No image uploaded</p>
                          </div>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Card className="border-2 border-white/10 bg-zinc-900/70">
                          <CardContent className="p-4">
                            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                              Cost Rate
                            </p>
                            <p className="mt-2 font-mono text-2xl font-black text-white">
                              ₹{Number(productData.details.cost_price).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border-2 border-white/10 bg-zinc-900/70">
                          <CardContent className="p-4">
                            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                              Min Selling Price
                            </p>
                            <p className="mt-2 font-mono text-2xl font-black text-emerald-400">
                              ₹{Number(productData.details.min_selling_price || 0).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* Right — status + movement log */}
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                              Current Status
                            </p>
                            <p className="mt-1 font-mono text-3xl font-black">
                              {productData.details.current_stock}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`px-3 py-1 font-mono text-xs font-bold uppercase ${stockClassName(
                              productData.details.current_stock
                            )}`}
                          >
                            {productData.details.current_stock > 0 ? "In Stock" : "Out of stock"}
                          </Badge>
                        </div>
                        <Separator className="bg-white/10" />
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-black uppercase text-muted-foreground">
                              Category Group
                            </p>
                            <p className="mt-1 text-sm font-bold uppercase text-white">{categoryName}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-muted-foreground">
                              System Record ID
                            </p>
                            <p className="mt-1 font-mono text-sm font-bold text-white">
                              #{productData.details.id}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Movement log */}
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-1">
                          Movement Log History
                        </p>
                        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 overflow-hidden">
                          <Table>
                            <TableHeader className="bg-zinc-900/80">
                              <TableRow className="border-b border-white/10 hover:bg-transparent">
                                <TableHead className="font-black uppercase text-[10px] text-white">Date</TableHead>
                                <TableHead className="font-black uppercase text-[10px] text-white">
                                  Activity / Reference
                                </TableHead>
                                <TableHead className="text-right font-black uppercase text-[10px] text-white">
                                  Qty Delta
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {productData.movement_history.length === 0 ? (
                                <TableRow>
                                  <TableCell
                                    colSpan={3}
                                    className="h-24 text-center text-xs font-bold uppercase text-muted-foreground"
                                  >
                                    No movement history yet.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                productData.movement_history.map((row) => {
                                  const transactionId = isTransactionReason(row.reason)
                                    ? extractTransactionId(row.reason)
                                    : null;

                                  return (
                                    <TableRow
                                      key={row.id}
                                      className="border-b border-white/10 hover:bg-white/5"
                                    >
                                      <TableCell className="font-mono text-sm text-zinc-300">
                                        {new Date(row.timestamp).toLocaleDateString("en-IN")}
                                      </TableCell>
                                      <TableCell className="text-sm font-bold text-white">
                                        {transactionId !== null ? (
                                          // Opens BillOverlay on top — no navigation, no page change
                                          <button
                                            type="button"
                                            onClick={() => setActiveBillId(transactionId)}
                                            className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                                          >
                                            {row.reason}
                                            <ArrowUpRight className="h-3 w-3 inline shrink-0" />
                                          </button>
                                        ) : (
                                          <span>{row.reason}</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right font-mono font-black">
                                        <span
                                          className={
                                            row.change_amount >= 0 ? "text-emerald-400" : "text-rose-300"
                                          }
                                        >
                                          {row.change_amount >= 0 ? "+" : ""}
                                          {row.change_amount}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* BillOverlay opens on top of this overlay at z-[80] */}
      {activeBillId !== null ? (
        <div className="fixed inset-0 z-[80]">
          <BillOverlay
            transactionId={activeBillId}
            onClose={() => setActiveBillId(null)}
          />
        </div>
      ) : null}
    </>
  );
}