"use client";

import { useState, useEffect } from "react";
import { ChevronsUpDown, Plus, Trash2, Loader2, Search, UserPlus, Upload } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Input } from "../../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import api from "../../lib/api";
import type { Product, Stakeholder } from "../../lib/types";

// Local cart item type for Purchases (uses unit_cost instead of price)
interface PurchaseCartItem {
  id: number;
  name: string;
  unit_cost: number;
  qty: number;
}

export default function PurchasesPage() {
  const [open, setOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart
  const [items, setItems] = useState<PurchaseCartItem[]>([]);

  // Vendor State
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendor, setVendor] = useState<Stakeholder | null>(null);
  const [searchingVendor, setSearchingVendor] = useState(false);

  // Payment State
  const [paymentMode, setPaymentMode] = useState<"CASH" | "ONLINE">("ONLINE");
  const [paidAmount, setPaidAmount] = useState<string>("");

  // Bill Details
  const [billNo, setBillNo] = useState("");
  const [billFile, setBillFile] = useState<File | null>(null);

  // New Vendor Dialog
  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorPhone, setNewVendorPhone] = useState("");
  const [newVendorDialogOpen, setNewVendorDialogOpen] = useState(false);
  const [creatingVendor, setCreatingVendor] = useState(false);

  // Submitting
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        setLoading(true);
        const response = await api.get("/inventory/low-stock?threshold=10000"); 
        setInventory(response.data);
      } catch (error) {
        console.error("Backend Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchInventory();
  }, []);

  const handleVendorSearch = async () => {
    if (!vendorPhone) return;
    try {
      setSearchingVendor(true);
      const res = await api.get(`/vendors/search?q=${encodeURIComponent(vendorPhone)}`);
      const found = res.data[0] as Stakeholder | undefined;
      if (found) {
        setVendor(found);
      } else {
        setVendor(null);
        alert("Vendor not found. Register them first.");
      }
    } catch {
      alert("Failed to search vendor.");
      setVendor(null);
    } finally {
      setSearchingVendor(false);
    }
  };

  const handleCreateVendor = async () => {
    if (!newVendorName) return;
    try {
      setCreatingVendor(true);
      const res = await api.post("/vendors/", {
        name: newVendorName,
        phone_no: newVendorPhone || null,
        type: "VENDOR",
        is_wholesale: false
      });
      setVendor(res.data);
      setVendorPhone(newVendorPhone);
      setNewVendorDialogOpen(false);
      setNewVendorName("");
      setNewVendorPhone("");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create vendor");
    } finally {
      setCreatingVendor(false);
    }
  };

  const handleClearVendor = () => {
    setVendor(null);
    setVendorPhone("");
  };

  const handleAdd = () => {
    if (!selectedProduct) return;
    const existing = items.find(i => i.id === selectedProduct.id);
    if (!existing) {
      setItems([...items, {
        id: selectedProduct.id,
        name: `${selectedProduct.brand} ${selectedProduct.model_name} ${selectedProduct.model_no}`,
        unit_cost: selectedProduct.cost_price,
        qty: 1,
      }]);
    }
    setSelectedProduct(null);
    setOpen(false);
  };

  const updateItem = (id: number, updates: Partial<PurchaseCartItem>) => {
    setItems(items.map(i => i.id === id ? { ...i, ...updates } : i));
  };
  const removeItem = (id: number) => setItems(items.filter(i => i.id !== id));
  const clearCart = () => setItems([]);

  const handleGeneratePurchase = async () => {
    if (!vendor) return alert("Select a Vendor first!");
    if (!billNo) return alert("Enter the Bill Number provided by the vendor!");
    if (items.length === 0) return alert("Cart is empty!");
    if (items.some(i => i.unit_cost <= 0)) return alert("All items must have a cost price > 0!");

    const totalAmount = items.reduce((acc, i) => acc + i.unit_cost * i.qty, 0);
    const paid = paidAmount ? parseFloat(paidAmount) : totalAmount;

    // Use FormData for Multipart Upload
    const formData = new FormData();
    formData.append("vendor_id", vendor.id.toString());
    formData.append("bill_no", billNo);
    formData.append("total_amount", totalAmount.toString());
    formData.append("paid_amount", paid.toString());
    formData.append("payment_mode", paymentMode);
    
    const itemsJson = JSON.stringify(items.map(item => ({
      product_id: item.id,
      quantity: item.qty,
      unit_cost: item.unit_cost
    })));
    formData.append("items_json", itemsJson);

    if (billFile) {
      formData.append("file", billFile);
    }

    try {
      setSubmitting(true);
      await api.post("/purchases/", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      alert("Purchase Bill & Stock Recorded Successfully!");
      clearCart();
      setVendor(null);
      setVendorPhone("");
      setPaidAmount("");
      setBillNo("");
      setBillFile(null);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Transaction Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const total = items.reduce((acc, item) => acc + item.unit_cost * item.qty, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 text-left">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase italic">Purchases</h1>
          <p className="text-muted-foreground text-sm font-bold uppercase opacity-50">Add Stock & Record Bills</p>
        </div>
        <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive font-bold">RESET CART</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* VENDOR SECTION */}
        <div className="md:col-span-1 p-4 bg-card border-2 rounded-xl space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Vendor</label>
              <Dialog open={newVendorDialogOpen} onOpenChange={setNewVendorDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold gap-1">
                    <UserPlus className="h-3 w-3" /> NEW
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-black">Register New Vendor</DialogTitle>
                    <DialogDescription>Add a new vendor or supplier to your records</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase">Vendor Name / Company</Label>
                      <Input value={newVendorName} onChange={(e) => setNewVendorName(e.target.value)} placeholder="XYZ Distributors" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase">Phone Number</Label>
                      <Input value={newVendorPhone} onChange={(e) => setNewVendorPhone(e.target.value)} placeholder="9876543210" />
                    </div>
                    <Button onClick={handleCreateVendor} disabled={creatingVendor || !newVendorName} className="w-full font-bold">
                      {creatingVendor ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Register Vendor"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            {!vendor ? (
              <div className="flex gap-2">
                <Input placeholder="Search vendor name..." value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} />
                <Button size="icon" onClick={handleVendorSearch} disabled={searchingVendor}>
                  {searchingVendor ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <div className="p-3 bg-primary/5 rounded border border-primary/20 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-primary">{vendor.name}</p>
                  <p className="text-[10px] font-mono mt-1">Phone: {vendor.phone_no || 'N/A'}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleClearVendor} className="h-6 w-6">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )}
          </div>
          
          {!vendor && (
            <div className="mt-2 text-xs font-bold text-destructive bg-destructive/10 p-2 rounded text-center">
              VENDOR SELECTION REQUIRED
            </div>
          )}
        </div>

        {/* PRODUCT SEARCH */}
        <div className="md:col-span-2 flex items-center gap-3 p-4 bg-card border-2 rounded-xl">
          <div className="flex-1">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-12 text-lg border-2">
                  {loading ? "Syncing inventory..." : selectedProduct ? `${selectedProduct.brand} ${selectedProduct.model_no}` : "Select Product to Add..."}
                  <ChevronsUpDown className="ml-2 h-5 w-5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[450px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search Brand, Model Name, or Model No..." />
                  <CommandList>
                    <CommandEmpty>No product found.</CommandEmpty>
                    <CommandGroup>
                      {inventory.map((product) => (
                        <CommandItem key={product.id} value={`${product.brand} ${product.model_name} ${product.model_no}`} onSelect={() => { setSelectedProduct(product); setOpen(false); }}>
                          <div className="flex justify-between w-full items-center">
                            <div>
                              <span className="font-bold text-primary">{product.brand}</span>
                              <span className="ml-2 text-muted-foreground">{product.model_no}</span>
                            </div>
                            <span className="text-xs bg-secondary px-2 py-1 rounded font-mono">Stock: {product.current_stock}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={handleAdd} disabled={!selectedProduct} className="h-12 px-8 font-bold">
            <Plus className="mr-2 h-5 w-5" /> ADD
          </Button>
        </div>
      </div>

      {/* BILLING TABLE */}
      <div className="rounded-xl border-2 bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-black uppercase text-xs">Product</TableHead>
              <TableHead className="font-black uppercase text-xs">Unit Cost (₹)</TableHead>
              <TableHead className="font-black uppercase text-xs text-center">Qty</TableHead>
              <TableHead className="text-right font-black uppercase text-xs">Subtotal</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length > 0 ? items.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/20">
                <TableCell>
                  <div className="font-bold">{item.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Current Cost: ₹{item.unit_cost}
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="w-28 h-8 font-bold"
                    value={item.unit_cost || ""}
                    min={0}
                    onChange={(e) => updateItem(item.id, { unit_cost: parseFloat(e.target.value) || 0 })}
                    placeholder="Enter cost"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Input
                    type="number"
                    className="w-20 h-8 font-bold text-center mx-auto"
                    value={item.qty}
                    min={1}
                    onChange={(e) => updateItem(item.id, { qty: parseInt(e.target.value) || 1 })}
                  />
                </TableCell>
                <TableCell className="text-right font-black font-mono">₹{(item.unit_cost * item.qty).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                  Cart is empty. Search a product to begin adding stock.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* CHECKOUT */}
      <div className="p-8 border-4 border-primary/10 rounded-2xl bg-card space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          
          {/* Bill No and File */}
          <div className="md:col-span-2 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Bill Number (Required)</label>
              <Input
                className="h-10 font-bold font-mono"
                value={billNo}
                onChange={(e) => setBillNo(e.target.value)}
                placeholder="e.g. INV-2024-001"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Upload Bill (Optional)</label>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  onChange={(e) => setBillFile(e.target.files ? e.target.files[0] : null)}
                  className="file:border-0 file:bg-primary file:text-primary-foreground file:h-full file:px-4 file:mr-4 file:font-bold hover:file:bg-primary/90 h-10 w-full cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 md:col-span-2 grid grid-cols-2 gap-4">
            {/* Payment Mode */}
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Payment Mode</label>
              <div className="flex gap-2">
                <Button
                  variant={paymentMode === "CASH" ? "default" : "outline"}
                  className="flex-1 font-bold"
                  onClick={() => setPaymentMode("CASH")}
                >CASH</Button>
                <Button
                  variant={paymentMode === "ONLINE" ? "default" : "outline"}
                  className="flex-1 font-bold"
                  onClick={() => setPaymentMode("ONLINE")}
                >ONLINE</Button>
              </div>
            </div>
            
            {/* Paid Amount */}
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Paid Amount</label>
              <Input
                type="number"
                className="h-10 font-bold"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder={`${total} (full)`}
              />
            </div>

            {/* Grand Total */}
            <div className="space-y-2 col-span-2 mt-4 text-right">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Total Bill Amount</label>
              <p className="text-4xl font-black text-primary font-mono tracking-tighter">₹{total.toLocaleString()}</p>
              {paidAmount && parseFloat(paidAmount) < total && (
                <Badge variant="destructive" className="text-[10px] font-bold mt-1">
                  UNPAID: ₹{(total - parseFloat(paidAmount)).toLocaleString()}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Button
          size="lg"
          disabled={items.length === 0 || !vendor || !billNo || submitting}
          onClick={handleGeneratePurchase}
          className="w-full h-16 px-12 text-xl font-black rounded-xl shadow-xl hover:scale-[1.02] transition-transform"
        >
          {submitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />PROCESSING...</> : "RECORD PURCHASE & ADD STOCK"}
        </Button>
      </div>
    </div>
  );
}
