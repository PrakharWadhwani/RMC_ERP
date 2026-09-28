"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DownloadCloud, X, ImageIcon, Loader2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Separator } from "./ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import api, { resolveAssetUrl } from "../lib/api";
import type { BillOverlayData, BillOverlayItem } from "../lib/types";
import ProductCatalogueOverlay from "./ProductCatalogueOverlay";

interface BillOverlayProps {
  transactionId: number | null;
  onClose: () => void;
  initialData?: BillOverlayData | null;
}

const formatCurrency = (value: number) => `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const getDirectionLabel = (type: BillOverlayData["type"]) =>
  type === "SALE" ? "↑ INFLOW" : "↓ OUTFLOW";

const getDirectionClassName = (type: BillOverlayData["type"]) =>
  type === "SALE" ? "text-emerald-400" : "text-rose-300";

const normalizeStakeholderName = (input?: string | null) => {
  if (!input) {
    return "Unknown Stakeholder";
  }
  const cleaned = input.replace(/^(SALE|PURCHASE|EXPENSE)\s+(from|to)\s+/i, "").trim();
  return cleaned || "Unknown Stakeholder";
};

export default function BillOverlay({ transactionId, onClose, initialData }: BillOverlayProps) {
  const [data, setData] = useState<BillOverlayData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [activeProductId, setActiveProductId] = useState<number | null>(null);
  const [productImages, setProductImages] = useState<Record<number, string | null>>({});
  const [downloadState, setDownloadState] = useState<"idle" | "downloading">("idle");
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);

  // Track which product IDs we have already fetched images for,
  // so we never re-fetch and never trigger an infinite loop.
  const fetchedImageIds = useRef<Set<number>>(new Set());

  // ─── Load transaction data ───────────────────────────────────────────────
  useEffect(() => {
    if (!transactionId) {
      setData(null);
      setLoading(false);
      setError(null);
      setDownloadState("idle");
      setDownloadMessage(null);
      return;
    }

    let active = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        setDownloadState("idle");
        setDownloadMessage(null);

        if (initialData) {
          if (initialData.type === "PURCHASE" && initialData.items.length === 0) {
            const purchaseResponse = await api.get("/purchases/");
            const matchingBill = purchaseResponse.data.find(
              (bill: any) => `${bill.id}` === `${transactionId}`
            );

            if (matchingBill && active) {
              setData({
                ...initialData,
                file_path: matchingBill.file_path ?? initialData.file_path,
                items: (matchingBill.items || []).map((item: any) => ({
                  product_id: item.product_id,
                  product_name: item.model_name || item.product_name || `Product ${item.product_id}`,
                  model_no: item.model_no || null,
                  quantity: item.quantity,
                  unit_price: Number(item.unit_price),
                  total_price: Number(item.quantity) * Number(item.unit_price),
                })),
              });
              setLoading(false);
              return;
            }
          }

          if (active) {
            setData(initialData);
            setLoading(false);
          }
          return;
        }

        const ledgerResponse = await api.get("/finances/ledger");
        const matchingLedgerEntry = ledgerResponse.data.find((entry: any) => {
          if (!entry) return false;
          const normalizedId = `${entry.id}`.replace(/\D/g, "");
          return normalizedId === `${transactionId}`;
        });

        if (matchingLedgerEntry && active) {
          setData({
            id: transactionId,
            type: matchingLedgerEntry.type,
            date: matchingLedgerEntry.date,
            stakeholder_name: normalizeStakeholderName(matchingLedgerEntry.description),
            total_amount: Number(matchingLedgerEntry.amount),
            paid_amount: Number(matchingLedgerEntry.paid ?? matchingLedgerEntry.amount),
            payment_mode: matchingLedgerEntry.mode || "N/A",
            description: matchingLedgerEntry.description,
            items: [],
          });
          setLoading(false);
          return;
        }

        const purchaseResponse = await api.get("/purchases/");
        const matchingBill = purchaseResponse.data.find(
          (bill: any) => `${bill.id}` === `${transactionId}`
        );

        if (!matchingBill && active) {
          setError("Unable to load this bill or transaction.");
          setLoading(false);
          return;
        }

        if (active) {
          setData({
            id: matchingBill.id,
            type: "PURCHASE",
            date: matchingBill.date || new Date().toISOString(),
            stakeholder_name: matchingBill.vendor_name || "Unknown Vendor",
            total_amount: Number(matchingBill.total_amount),
            paid_amount: Number(matchingBill.total_amount),
            payment_mode: "N/A",
            file_path: matchingBill.file_path,
            items: (matchingBill.items || []).map((item: any) => ({
              product_id: item.product_id,
              product_name: item.model_name || item.product_name || `Product ${item.product_id}`,
              model_no: item.model_no || null,
              quantity: item.quantity,
              unit_price: Number(item.unit_price),
              total_price: Number(item.quantity) * Number(item.unit_price),
            })),
          });
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError("Unable to load this bill or transaction.");
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [initialData, transactionId]);

  // ─── Keyboard close ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!transactionId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, transactionId]);

  // ─── Load product images ─────────────────────────────────────────────────
  // FIX: productImages is intentionally NOT in the dependency array.
  // We use a ref (fetchedImageIds) to track what has already been fetched,
  // which prevents the infinite loop that was caused by putting productImages
  // in deps — every setProductImages call would re-trigger the effect forever.
  useEffect(() => {
    if (!data?.items?.length) return;

    const unloadedIds = [...new Set(data.items.map((item) => item.product_id))].filter(
      (id) => !fetchedImageIds.current.has(id)
    );

    if (unloadedIds.length === 0) return;

    // Mark all as fetched immediately so concurrent renders don't re-fetch
    unloadedIds.forEach((id) => fetchedImageIds.current.add(id));

    let active = true;

    const loadImages = async () => {
      const entries = await Promise.all(
        unloadedIds.map(async (productId) => {
          try {
            const response = await api.get(`/inventory/products/${productId}/details`);
            return [productId, response.data?.details?.image_url ?? null] as const;
          } catch {
            return [productId, null] as const;
          }
        })
      );

      if (active) {
        setProductImages((current) => ({ ...current, ...Object.fromEntries(entries) }));
      }
    };

    void loadImages();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.items]);

  // ─── Reset ref when overlay closes/reopens ───────────────────────────────
  useEffect(() => {
    if (!transactionId) {
      fetchedImageIds.current = new Set();
      setProductImages({});
    }
  }, [transactionId]);

  const balanceDue = useMemo(
    () => Number(data?.total_amount || 0) - Number(data?.paid_amount || 0),
    [data]
  );

  // ─── Download bill ───────────────────────────────────────────────────────
  // FIX: removed `new URL(sourceUrl, window.location.origin)` which was
  // corrupting the backend URL by replacing the host with localhost:3000.
  const downloadBillCopy = async () => {
    if (!data?.file_path) {
      setDownloadMessage("No downloadable bill copy is available.");
      return;
    }

    const sourceUrl = resolveAssetUrl(data.file_path);
    if (!sourceUrl) {
      setDownloadMessage("No downloadable bill copy is available.");
      return;
    }

    try {
      setDownloadState("downloading");
      setDownloadMessage(null);

      const fileName =
        data.file_path.split("/").filter(Boolean).pop() || `bill-${data.id}.bin`;

      const link = document.createElement("a");
      // Use sourceUrl directly — it is already an absolute URL pointing to
      // the FastAPI backend (e.g. http://localhost:8000/uploaded_bills/file.pdf).
      // Do NOT wrap in new URL(url, window.location.origin) as that replaces
      // the host with the Next.js origin (localhost:3000).
      link.href = sourceUrl;
      link.download = fileName;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        link.remove();
        setDownloadState("idle");
      }, 300);
    } catch {
      setDownloadState("idle");
      setDownloadMessage("This bill copy is not available for download right now.");
    }
  };

  if (!transactionId) return null;

  const billImageUrl = data?.file_path ? resolveAssetUrl(data.file_path) : null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/80 px-4 py-6 sm:px-8">
        <div
          className="mx-auto flex h-full max-w-4xl items-center justify-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
          role="presentation"
        >
          <Card
            className="w-full max-h-[92vh] border-2 border-white/10 bg-zinc-950 text-white shadow-2xl"
            style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
            role="dialog"
            aria-modal="true"
          >
            <CardContent
              className="p-0"
              style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", maxHeight: "92vh" }}
            >
              {/* Header */}
              <div
                className="flex items-start justify-between border-b border-white/10 px-5 py-4 sm:px-6"
                style={{ flexShrink: 0 }}
              >
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.35em] text-muted-foreground">
                    Ledger View
                  </p>
                  <h2 className="mt-2 text-2xl font-black uppercase tracking-tight sm:text-3xl">
                    Transaction #{transactionId}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data?.date ? new Date(data.date).toLocaleString() : "Loading details..."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  aria-label="Close transaction overlay"
                  className="h-10 w-10 text-muted-foreground hover:text-white"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Scrollable body */}
              <div
                className="p-5 sm:p-6"
                style={{ overflowY: "auto", flex: "1 1 auto", maxHeight: "calc(92vh - 90px)" }}
              >
                {loading ? (
                  <div className="flex h-64 items-center justify-center text-sm font-bold uppercase text-muted-foreground">
                    Loading transaction details...
                  </div>
                ) : error ? (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm font-bold text-rose-200">
                    {error}
                  </div>
                ) : data ? (
                  <div className="space-y-6">
                    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                      {/* Left — stakeholder + money cards */}
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <Badge
                              className={
                                data.type === "SALE"
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : data.type === "PURCHASE"
                                  ? "bg-rose-500/15 text-rose-200"
                                  : "bg-amber-500/15 text-amber-200"
                              }
                            >
                              {data.type}
                            </Badge>
                            <Badge variant="outline" className="border-white/10 text-white">
                              {data.payment_mode || "N/A"}
                            </Badge>
                            <span className={`text-sm font-black ${getDirectionClassName(data.type)}`}>
                              {getDirectionLabel(data.type)}
                            </span>
                          </div>
                          <p className="mt-4 text-sm font-bold uppercase text-muted-foreground">
                            Stakeholder
                          </p>
                          <p className="mt-1 text-xl font-black">{data.stakeholder_name}</p>
                          <p className="mt-2 text-[11px] font-mono text-muted-foreground">
                            {data.date ? new Date(data.date).toLocaleString() : "—"}
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <Card className="border-2 border-white/10 bg-zinc-900/70">
                            <CardContent className="p-4">
                              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
                                Total
                              </p>
                              <p className="mt-2 text-lg font-black font-mono">
                                {formatCurrency(Number(data.total_amount))}
                              </p>
                            </CardContent>
                          </Card>
                          <Card className="border-2 border-white/10 bg-zinc-900/70">
                            <CardContent className="p-4">
                              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
                                Paid
                              </p>
                              <p className="mt-2 text-lg font-black font-mono">
                                {formatCurrency(Number(data.paid_amount))}
                              </p>
                            </CardContent>
                          </Card>
                          <Card className="border-2 border-white/10 bg-zinc-900/70">
                            <CardContent className="p-4">
                              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
                                Balance Due
                              </p>
                              <p
                                className={`mt-2 text-lg font-black font-mono ${
                                  balanceDue > 0 ? "text-rose-300" : "text-emerald-400"
                                }`}
                              >
                                {formatCurrency(balanceDue)}
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      {/* Right — notes + bill attachment */}
                      <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4 flex flex-col justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                            Quick Notes
                          </p>
                          <Separator className="my-3 bg-white/10" />
                          {data.description ? (
                            <p className="text-sm text-zinc-200 mb-4">{data.description}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground mb-4">
                              No extra notes available for this record.
                            </p>
                          )}
                        </div>

                        {data.type === "PURCHASE" && billImageUrl ? (
                          <div className="mt-2 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                              Bill Copy Attachment
                            </p>
                            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-950 flex items-center justify-center">
                              <img
                                src={billImageUrl}
                                alt="Bill Document Attachment"
                                className="h-full w-full object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  const parent = e.currentTarget.parentElement;
                                  if (parent) {
                                    const fallback = parent.querySelector(".image-fallback");
                                    if (fallback) fallback.classList.remove("hidden");
                                  }
                                }}
                              />
                              <div className="image-fallback hidden flex flex-col items-center justify-center text-muted-foreground">
                                <ImageIcon className="h-8 w-8 mb-1 opacity-40" />
                                <span className="text-[11px] font-bold uppercase">View Attachment</span>
                              </div>
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              className="w-full justify-center font-bold text-xs"
                              onClick={downloadBillCopy}
                              disabled={downloadState === "downloading"}
                            >
                              {downloadState === "downloading" ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Triggering Download...
                                </>
                              ) : (
                                <>
                                  <DownloadCloud className="mr-2 h-4 w-4" />
                                  Download Bill File
                                </>
                              )}
                            </Button>
                            {downloadMessage ? (
                              <p className="text-xs text-center text-rose-300 font-medium">
                                {downloadMessage}
                              </p>
                            ) : null}
                          </div>
                        ) : data.type === "PURCHASE" ? (
                          <div className="mt-2 p-4 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-muted-foreground bg-zinc-950/40">
                            <ImageIcon className="h-6 w-6 mb-1 opacity-30" />
                            <p className="text-xs font-bold uppercase tracking-wider text-[10px]">
                              No attachment detected
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Products table */}
                    {data.type !== "EXPENSE" ? (
                      <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                              Products
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Tap any row to preview product catalogue details.
                            </p>
                          </div>
                        </div>
                        <Separator className="my-3 bg-white/10" />

                        {data.items && data.items.length > 0 ? (
                          <div className="rounded-xl border border-white/10" style={{ overflowX: "auto" }}>
                            <Table>
                              <TableHeader className="bg-zinc-950">
                                <TableRow>
                                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground">
                                    Product
                                  </TableHead>
                                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground">
                                    Model No
                                  </TableHead>
                                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground">
                                    Qty
                                  </TableHead>
                                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground">
                                    Unit Price
                                  </TableHead>
                                  <TableHead className="text-right text-[10px] font-black uppercase text-muted-foreground">
                                    Total
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {data.items.map((item) => {
                                  const thumbnail = resolveAssetUrl(
                                    productImages[item.product_id] ?? null
                                  );

                                  return (
                                    <TableRow
                                      key={`${data.id}-${item.product_id}`}
                                      className="cursor-pointer border-b border-white/10 hover:bg-white/5"
                                      onClick={() => setActiveProductId(item.product_id)}
                                    >
                                      <TableCell>
                                        <div className="flex items-center gap-3">
                                          {thumbnail ? (
                                            <img
                                              src={thumbnail}
                                              alt={item.product_name}
                                              className="h-10 w-10 rounded-lg object-cover"
                                            />
                                          ) : (
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-white/15 bg-zinc-950 text-muted-foreground">
                                              <span className="text-[10px] font-bold">IMG</span>
                                            </div>
                                          )}
                                          <div>
                                            <p className="font-bold">{item.product_name}</p>
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell className="font-mono text-sm">
                                        {item.model_no || "—"}
                                      </TableCell>
                                      <TableCell className="font-mono text-sm">
                                        {item.quantity}
                                      </TableCell>
                                      <TableCell className="font-mono text-sm">
                                        {formatCurrency(Number(item.unit_price))}
                                      </TableCell>
                                      <TableCell className="text-right font-mono font-bold">
                                        {formatCurrency(
                                          Number(item.total_price ?? item.quantity * item.unit_price)
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No product-level details are available for this record.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {activeProductId ? (
        <ProductCatalogueOverlay
          productId={activeProductId}
          onClose={() => setActiveProductId(null)}
        />
      ) : null}
    </>
  );
}