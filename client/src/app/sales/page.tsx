"use client";

import { useState, useEffect } from "react";
import { ChevronsUpDown, Plus, Trash2, Loader2, Search, UserPlus } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Input } from "../../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { useCartStore } from "../../store/useCartStore";
import api from "../../lib/api";
import type { Product, Entity } from "../../lib/types";

export default function SalesPage() {
  const [open, setOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Customer State
  const [customerPhone, setCustomerPhone] = useState("");
  const [customer, setCustomer] = useState<Entity | null>(null);
  const [searchingCustomer, setSearchingCustomer] = useState(false);

  // Payment State
  const [paymentMode, setPaymentMode] = useState<"CASH" | "ONLINE">("CASH");
  const [paidAmount, setPaidAmount] = useState<string>("");

  // New Customer Dialog
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustDialogOpen, setNewCustDialogOpen] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // Submitting sale
  const [submitting, setSubmitting] = useState(false);

  const { items, addItem, removeItem, updateItem, clearCart } = useCartStore();

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

  const handleCustomerSearch = async () => {
    if (!customerPhone) return;
    try {
      setSearchingCustomer(true);
      const res = await api.get(`/stakeholders/search/${customerPhone}`);
      setCustomer(res.data);
    } catch {
      alert("Customer not found. Register them first.");
      setCustomer(null);
    } finally {
      setSearchingCustomer(false);
    }
  };

  const handleCreateCustomer = async () => {
    if (!newCustName || !newCustPhone) return;
    try {
      setCreatingCustomer(true);
      const res = await api.post(
        `/stakeholders/entities/?name=${encodeURIComponent(newCustName)}&phone_no=${encodeURIComponent(newCustPhone)}&entity_type=CUSTOMER`
      );
      setCustomer(res.data);
      setCustomerPhone(newCustPhone);
      setNewCustDialogOpen(false);
      setNewCustName("");
      setNewCustPhone("");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create customer");
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleAdd = () => {
    if (!selectedProduct) return;
    addItem({
      id: selectedProduct.id,
      name: `${selectedProduct.brand} ${selectedProduct.model_name}`,
      price: 0,
      qty: 1,
      cost_price: selectedProduct.cost_price,
    });
    setSelectedProduct(null);
    setOpen(false);
  };

  const handleGenerateInvoice = async () => {
    if (!customer) return alert("Select a customer first!");
    if (items.length === 0) return alert("Cart is empty!");
    if (items.some(i => i.price <= 0)) return alert("All items must have a selling price > 0!");

    const totalAmount = items.reduce((acc, i) => acc + i.price * i.qty, 0);
    const paid = paidAmount ? parseFloat(paidAmount) : totalAmount;

    const salePayload = {
      entity_id: customer.id,
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
        <div className="md:col-span-1 p-4 bg-card border-2 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase text-muted-foreground">Customer (Phone)</label>
            <Dialog open={newCustDialogOpen} onOpenChange={setNewCustDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold gap-1">
                  <UserPlus className="h-3 w-3" /> NEW
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-black">Register New Customer</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase">Full Name</Label>
                    <Input value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="Rajesh Kumar" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase">Phone Number</Label>
                    <Input value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} placeholder="9876543210" />
                  </div>
                  <Button onClick={handleCreateCustomer} disabled={creatingCustomer} className="w-full font-bold">
                    {creatingCustomer ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Register Customer"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex gap-2">
            <Input placeholder="98765..." value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            <Button size="icon" onClick={handleCustomerSearch} disabled={searchingCustomer}>
              {searchingCustomer ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {customer && (
            <div className="p-2 bg-primary/5 rounded border border-primary/20">
              <p className="text-sm font-bold text-primary">{customer.name}</p>
              <p className="text-[10px] font-mono">ID: {customer.id} | Balance: ₹{customer.balance}</p>
            </div>
          )}
        </div>

        {/* PRODUCT SEARCH */}
        <div className="md:col-span-2 flex items-center gap-3 p-4 bg-card border-2 rounded-xl">
          <div className="flex-1">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-12 text-lg border-2">
                  {loading ? "Syncing..." : selectedProduct ? `${selectedProduct.brand} ${selectedProduct.model_no}` : "Select Product..."}
                  <ChevronsUpDown className="ml-2 h-5 w-5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[450px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search Brand or Model No..." />
                  <CommandList>
                    <CommandEmpty>No product found.</CommandEmpty>
                    <CommandGroup>
                      {inventory.map((product) => (
                        <CommandItem key={product.id} value={`${product.brand} ${product.model_no}`} onSelect={() => { setSelectedProduct(product); setOpen(false); }}>
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
                  <div className="text-[10px] text-muted-foreground font-mono">Cost: ₹{item.cost_price}</div>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="w-28 h-8 font-bold"
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
          disabled={items.length === 0 || !customer || submitting}
          onClick={handleGenerateInvoice}
          className="w-full md:w-auto h-16 px-12 text-xl font-black rounded-xl shadow-xl hover:scale-[1.02] transition-transform"
        >
          {submitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />PROCESSING...</> : "CONFIRM & PRINT INVOICE"}
        </Button>
      </div>
    </div>
  );
}