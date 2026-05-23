"use client";

import { useState, useEffect } from "react";
import { ChevronsUpDown, Plus, Trash2, Loader2, Search, UserPlus } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Input } from "../../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Switch } from "../../components/ui/switch";
import { useCartStore } from "../../store/useCartStore";
import api from "../../lib/api";
import type { Product, Stakeholder } from "../../lib/types";

export default function SalesPage() {
  const [open, setOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Customer State (null = Retail / Walk-in)
  const [customerPhone, setCustomerPhone] = useState("");
  const [customer, setCustomer] = useState<Stakeholder | null>(null);
  const [searchingCustomer, setSearchingCustomer] = useState(false);

  // Payment State
  const [paymentMode, setPaymentMode] = useState<"CASH" | "ONLINE">("CASH");
  const [paidAmount, setPaidAmount] = useState<string>("");

  // New Customer Dialog
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustWholesale, setNewCustWholesale] = useState(false);
  const [newCustDialogOpen, setNewCustDialogOpen] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // Submitting sale
  const [submitting, setSubmitting] = useState(false);

  const { items, addItem, removeItem, updateItem, clearCart } = useCartStore();

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        setLoading(true);
        const response = await api.get("/inventory/low-stock?threshold=10000"); // Just getting all products basically
        setInventory(response.data);
      } catch (error) {
        console.error("Backend Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchInventory();
  }, []);

  const handleCustomerSearch = async () => {
    if (!customerPhone) return;
    try {
      setSearchingCustomer(true);
      const res = await api.get(`/customers/search?q=${encodeURIComponent(customerPhone)}`);
      const found = res.data[0] as Stakeholder | undefined;
      if (found) {
        setCustomer(found);
      } else {
        setCustomer(null);
        alert("Customer not found. Register them first.");
      }
    } catch {
      alert("Failed to search customer.");
      setCustomer(null);
    } finally {
      setSearchingCustomer(false);
    }
  };

  const handleCreateCustomer = async () => {
    if (!newCustName) return;
    try {
      setCreatingCustomer(true);
      const res = await api.post("/customers/", {
        name: newCustName,
        phone_no: newCustPhone || null,
        type: "CUSTOMER",
        is_wholesale: newCustWholesale
      });
      setCustomer(res.data);
      setCustomerPhone(newCustPhone);
      setNewCustDialogOpen(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustWholesale(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create customer");
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleClearCustomer = () => {
    setCustomer(null);
    setCustomerPhone("");
  };

  const handleAdd = () => {
    if (!selectedProduct) return;
    addItem({
      id: selectedProduct.id,
      name: `${selectedProduct.brand} ${selectedProduct.model_name}`,
      price: selectedProduct.min_selling_price || selectedProduct.cost_price, // Start with a safe price
      qty: 1,
      cost_price: selectedProduct.cost_price,
      min_selling_price: selectedProduct.min_selling_price || 0,
    });
    setSelectedProduct(null);
    setOpen(false);
  };

  const handleGenerateInvoice = async () => {
    if (items.length === 0) return alert("Cart is empty!");
    if (items.some(i => i.price <= 0)) return alert("All items must have a selling price > 0!");

    // Loss Warning Check
    const lossItems = items.filter(i => i.price < i.min_selling_price);
    if (lossItems.length > 0) {
      const names = lossItems.map(i => i.name).join(", ");
      const confirmed = window.confirm(`WARNING: You are selling the following items below their Minimum Selling Price: ${names}.\n\nAre you sure you want to proceed and record a loss?`);
      if (!confirmed) return;
    }

    const totalAmount = items.reduce((acc, i) => acc + i.price * i.qty, 0);
    const paid = paidAmount ? parseFloat(paidAmount) : totalAmount;

    const salePayload = {
      stakeholder_id: customer ? customer.id : null, // Null for Retail Walk-in
      items: items.map(item => ({
        product_id: item.id,
        quantity: item.qty,
        unit_price: item.price,
        cost_price_at_sale: item.cost_price,
      })),
      total_amount: totalAmount,
      paid_amount: paid,
      payment_mode: paymentMode,
    };

    try {
      setSubmitting(true);
      await api.post("/sales/", salePayload);
      alert("Sale Recorded Successfully!");
      clearCart();
      setCustomer(null);
      setCustomerPhone("");
      setPaidAmount("");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Transaction Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const total = items.reduce((acc, item) => acc + item.price * item.qty, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 text-left">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase italic">Quick Sale</h1>
          <p className="text-muted-foreground text-sm font-bold uppercase opacity-50">Retail POS Interface</p>
        </div>
        <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive font-bold">RESET CART</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CUSTOMER SECTION */}
        <div className="md:col-span-1 p-4 bg-card border-2 rounded-xl space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Customer</label>
              <Dialog open={newCustDialogOpen} onOpenChange={setNewCustDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold gap-1">
                    <UserPlus className="h-3 w-3" /> NEW
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-black">Register New Customer</DialogTitle>
                    <DialogDescription>Add a new customer to your records</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase">Full Name</Label>
                      <Input value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="Rajesh Kumar" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase">Phone Number</Label>
                      <Input value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} placeholder="9876543210" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="wholesale" checked={newCustWholesale} onCheckedChange={setNewCustWholesale} />
                      <Label htmlFor="wholesale" className="font-bold">Wholesale Customer</Label>
                    </div>
                    <Button onClick={handleCreateCustomer} disabled={creatingCustomer || !newCustName} className="w-full font-bold">
                      {creatingCustomer ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Register Customer"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            {!customer ? (
              <div className="flex gap-2">
                <Input placeholder="Search customer name..." value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                <Button size="icon" onClick={handleCustomerSearch} disabled={searchingCustomer}>
                  {searchingCustomer ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <div className="p-3 bg-primary/5 rounded border border-primary/20 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-primary flex items-center gap-2">
                    {customer.name}
                    {customer.is_wholesale && <Badge variant="secondary" className="text-[9px]">WHOLESALE</Badge>}
                  </p>
                  <p className="text-[10px] font-mono mt-1">Phone: {customer.phone_no || 'N/A'}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleClearCustomer} className="h-6 w-6">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )}
          </div>
          
          {!customer && (
            <div className="mt-2 text-xs font-bold text-muted-foreground bg-muted p-2 rounded text-center">
              DEFAULTING TO RETAIL WALK-IN
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
              <TableHead className="font-black uppercase text-xs">Sell Price (₹)</TableHead>
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
                    Cost: ₹{item.cost_price} | Min: ₹{item.min_selling_price}
                  </div>
                  {item.price < item.min_selling_price && (
                    <Badge variant="destructive" className="mt-1 text-[9px]">WARNING: LOSS</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className={cn("w-28 h-8 font-bold", item.price < item.min_selling_price && "border-destructive text-destructive")}
                    value={item.price || ""}
                    min={0}
                    onChange={(e) => updateItem(item.id, { price: parseFloat(e.target.value) || 0 })}
                    placeholder="Enter price"
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
                <TableCell className="text-right font-black font-mono">₹{(item.price * item.qty).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                  Cart is empty. Search a product to begin.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* CHECKOUT */}
      <div className="p-8 border-4 border-primary/10 rounded-2xl bg-card space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Payment Mode */}
          <div className="space-y-2">
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
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-foreground">Paid Amount</label>
            <Input
              type="number"
              className="h-12 text-lg font-bold"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder={`${total} (full)`}
            />
          </div>
          {/* Grand Total */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-foreground">Grand Total</label>
            <p className="text-4xl font-black text-primary font-mono tracking-tighter">₹{total.toLocaleString()}</p>
            {paidAmount && parseFloat(paidAmount) < total && (
              <Badge variant="destructive" className="text-[10px] font-bold">
                DUE: ₹{(total - parseFloat(paidAmount)).toLocaleString()}
              </Badge>
            )}
          </div>
        </div>
        <Button
          size="lg"
          disabled={items.length === 0 || submitting}
          onClick={handleGenerateInvoice}
          className="w-full md:w-auto h-16 px-12 text-xl font-black rounded-xl shadow-xl hover:scale-[1.02] transition-transform"
        >
          {submitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />PROCESSING...</> : "CONFIRM & RECORD SALE"}
        </Button>
      </div>
    </div>
  );
}