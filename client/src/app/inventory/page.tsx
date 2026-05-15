"use client";

import { useState, useEffect } from "react";
import { Plus, RefreshCw, Loader2, FolderPlus, Search } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { cn } from "../../lib/utils";
import api from "../../lib/api";
import type { Product, Category } from "../../lib/types";

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<Product | null>(null);

  // Product Form
  const [brand, setBrand] = useState("");
  const [modelName, setModelName] = useState("");
  const [modelNo, setModelNo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [initialStock, setInitialStock] = useState("");
  const [addingProduct, setAddingProduct] = useState(false);

  // Category Form
  const [catName, setCatName] = useState("");
  const [catParentId, setCatParentId] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes] = await Promise.all([
        api.get("/inventory/low-stock?threshold=10000"),
        api.get("/inventory/categories/tree"),
      ]);
      setProducts(prodRes.data);
      setCategories(catRes.data);
    } catch (err) {
      console.error("Backend Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !modelNo || !categoryId) return alert("Brand, Model No, and Category are required!");
    try {
      setAddingProduct(true);
      // Backend expects query parameters, NOT a JSON body
      const params = new URLSearchParams({
        brand,
        model_name: modelName,
        model_no: modelNo,
        category_id: categoryId,
        cost_price: costPrice || "0",
        initial_stock: initialStock || "0",
      });
      await api.post(`/inventory/products/?${params.toString()}`);
      setBrand(""); setModelName(""); setModelNo(""); setCostPrice(""); setInitialStock("");
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error: Check Model No uniqueness or backend status.");
    } finally {
      setAddingProduct(false);
    }
  };

  const handleAddCategory = async () => {
    if (!catName) return;
    try {
      setAddingCategory(true);
      const params = new URLSearchParams({ name: catName });
      if (catParentId) params.set("parent_id", catParentId);
      await api.post(`/inventory/categories/?${params.toString()}`);
      setCatName(""); setCatParentId("");
      setCatDialogOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create category");
    } finally {
      setAddingCategory(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    try {
      setSearching(true);
      const res = await api.get(`/inventory/products/search/${encodeURIComponent(searchQuery)}`);
      setSearchResult(res.data);
    } catch {
      setSearchResult(null);
      alert("Product not found with that model number.");
    } finally {
      setSearching(false);
    }
  };

  const getStockBadge = (stock: number) => {
    if (stock <= 0) return <Badge variant="destructive" className="font-bold text-[10px]">OUT</Badge>;
    if (stock < 5) return <Badge variant="destructive" className="font-bold text-[10px]">{stock}</Badge>;
    if (stock < 15) return <Badge className="font-bold text-[10px] bg-warning text-black">{stock}</Badge>;
    return <Badge className="font-bold text-[10px] bg-success text-white">{stock}</Badge>;
  };

  const flattenCategories = (cats: any[], depth = 0): Category[] =>
  cats.flatMap(c => [
    { ...c, name: "—".repeat(depth) + (depth ? " " : "") + c.name },
    ...flattenCategories(c.subcategories || [], depth + 1)
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 text-left">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-black tracking-tight uppercase">Inventory</h1>
        <div className="flex gap-2">
          <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><FolderPlus className="mr-2 h-4 w-4" />Add Category</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-black">Create Category</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase">Category Name</Label>
                  <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Switches" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase">Parent Category (Optional)</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={catParentId} onChange={(e) => setCatParentId(e.target.value)}>
                    <option value="">None (Top Level)</option>
                    {flattenCategories(categories).map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                  </select>
                </div>
                <Button onClick={handleAddCategory} disabled={addingCategory || !catName} className="w-full font-bold">
                  {addingCategory ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Category"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} /> Sync
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <Input className="max-w-xs" placeholder="Search by Model No..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
      {searchResult && (
        <Card className="border-2 border-primary/20">
          <CardContent className="p-4 flex items-center gap-6">
            <div>
              <p className="font-black text-lg">{searchResult.brand} {searchResult.model_name}</p>
              <p className="text-xs font-mono text-muted-foreground">{searchResult.model_no}</p>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Stock</p>
              {getStockBadge(searchResult.current_stock)}
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Cost</p>
              <p className="font-mono font-bold">₹{searchResult.cost_price}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSearchResult(null)}>Clear</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* PRODUCT REGISTRATION FORM */}
        <Card className="lg:col-span-1 border-2">
          <CardHeader><CardTitle className="text-lg">Register Product</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase">Brand</Label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Havells" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase">Model Name</Label>
              <Input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="e.g. Nicola" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase">Model Number (Unique)</Label>
              <Input value={modelNo} onChange={(e) => setModelNo(e.target.value)} placeholder="e.g. HAV-101" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase">Category</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Select Category</option>
                {flattenCategories(categories).map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase">Cost Price (₹)</Label>
              <Input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase">Initial Stock</Label>
              <Input type="number" value={initialStock} onChange={(e) => setInitialStock(e.target.value)} placeholder="0" />
            </div>
            <Button onClick={handleAddProduct} disabled={addingProduct} className="w-full font-bold py-6">
              {addingProduct ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save to System"}
            </Button>
          </CardContent>
        </Card>

        {/* PRODUCT TABLE */}
        <Card className="lg:col-span-3 border-2 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-bold uppercase text-xs">Product Details</TableHead>
                <TableHead className="font-bold uppercase text-xs text-center">Stock</TableHead>
                <TableHead className="font-bold uppercase text-xs text-right">Cost Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="h-32 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
              ) : products.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="h-32 text-center text-muted-foreground italic">No products yet. Register one to begin.</TableCell></TableRow>
              ) : (
                products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-bold">{p.brand} {p.model_name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{p.model_no}</div>
                    </TableCell>
                    <TableCell className="text-center">{getStockBadge(p.current_stock)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">₹{p.cost_price.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}