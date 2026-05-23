"use client";

import Image from "next/image";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, RefreshCw, Loader2, FolderPlus, Search, Edit, Trash2, Copy, Settings, Package, ImageIcon, Upload, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "../../components/ui/dropdown-menu";
import { cn } from "../../lib/utils";
import api, { resolveAssetUrl } from "../../lib/api";
import type { Product, Category } from "../../lib/types";

function InventoryContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [searching, setSearching] = useState(false);

  // Modal states
  const [prodDialogOpen, setProdDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);

  // Product Form State
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [brand, setBrand] = useState("");
  const [modelName, setModelName] = useState("");
  const [modelNo, setModelNo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [minSellingPrice, setMinSellingPrice] = useState("");
  const [currentStock, setCurrentStock] = useState(""); 
  const [selectedFile, setSelectedFile] = useState<File | null>(null); 
  const [savingProduct, setSavingProduct] = useState(false);

  // Category Form
  const [catName, setCatName] = useState("");
  const [catParentId, setCatParentId] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes] = await Promise.all([
        api.get("/inventory/low-stock?threshold=100000"), 
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

  const handleSearch = async (query?: string) => {
    const effectiveQuery = query !== undefined ? query : searchQuery;
    if (!effectiveQuery) {
      fetchData();
      return;
    }
    if (query !== undefined) {
      setSearchQuery(query);
    }
    try {
      setSearching(true);
      const res = await api.get(`/inventory/laser-search?q=${encodeURIComponent(effectiveQuery)}`);
      setProducts(res.data);
    } catch {
      alert("Search failed.");
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const search = searchParams.get("search");
    if (search) {
      handleSearch(search);
      return;
    }
    fetchData();
  }, [searchParams]);

  const openAddProduct = () => {
    setEditMode(false); setEditId(null);
    setBrand(""); setModelName(""); setModelNo(""); setCategoryId(""); setCostPrice(""); setCurrentStock(""); setMinSellingPrice(""); setSelectedFile(null);
    setProdDialogOpen(true);
  };

  const openDuplicateProduct = (p: Product) => {
    setEditMode(false); setEditId(null);
    setBrand(p.brand); setModelName(p.model_name); setModelNo(""); 
    setCategoryId(p.category_id.toString()); setCostPrice(p.cost_price.toString()); setMinSellingPrice(p.min_selling_price?.toString() || "0"); setCurrentStock("0"); setSelectedFile(null);
    setProdDialogOpen(true);
  };

  const openEditProduct = (p: Product) => {
    setEditMode(true); setEditId(p.id);
    setBrand(p.brand); setModelName(p.model_name); setModelNo(p.model_no);
    setCategoryId(p.category_id.toString()); setCostPrice(p.cost_price.toString()); setMinSellingPrice(p.min_selling_price?.toString() || "0"); setCurrentStock(p.current_stock.toString()); setSelectedFile(null);
    setProdDialogOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName || !modelNo || !categoryId) return alert("Model Name, Model No, and Category are required!");
    try {
      setSavingProduct(true);
      
      const formData = new FormData();
      formData.append("brand", brand);
      formData.append("model_name", modelName);
      formData.append("model_no", modelNo);
      formData.append("category_id", categoryId);
      
      // Guard empty numeric fields from causing Backend API standard string casting crashes
      formData.append("cost_price", costPrice.trim() !== "" ? costPrice : "0");
      formData.append("min_selling_price", minSellingPrice.trim() !== "" ? minSellingPrice : "0");
      formData.append("current_stock", currentStock.trim() !== "" ? currentStock : "0");
      
      if (selectedFile) {
        formData.append("file", selectedFile);
      }

      const config = { headers: { "Content-Type": "multipart/form-data" } };

      if (editMode && editId) {
        await api.put(`/inventory/products/${editId}`, formData, config);
      } else {
        await api.post(`/inventory/products/`, formData, config);
      }
      setProdDialogOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to save product.");
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm("Are you SURE you want to delete this product?")) return;
    try {
      await api.delete(`/inventory/products/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete product.");
    }
  };

  const handleAddCategory = async () => {
    if (!catName) return;
    try {
      setAddingCategory(true);
      await api.post(`/inventory/categories/`, {
        name: catName, parent_id: catParentId ? parseInt(catParentId) : null
      });
      setCatName(""); setCatParentId("");
      setCatDialogOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create category");
    } finally {
      setAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!window.confirm("Are you SURE you want to delete this category?")) return;
    try {
      await api.delete(`/inventory/categories/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete category.");
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

  const flatCats = flattenCategories(categories);

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase">Inventory Management</h1>
          <p className="text-muted-foreground text-sm font-bold uppercase opacity-50">Stock, Categories, and Pricing</p>
        </div>
        
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="font-bold shadow-xl"><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 font-bold uppercase text-xs">
              <DropdownMenuItem onClick={openAddProduct} className="cursor-pointer">
                <Package className="mr-2 h-4 w-4" /> New Product
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCatDialogOpen(true)} className="cursor-pointer">
                <FolderPlus className="mr-2 h-4 w-4" /> New Category
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="icon" onClick={fetchData}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            className="pl-9 h-12 border-2 text-lg font-bold" 
            placeholder="Super Search: Brand, Name, Model No..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <Button onClick={() => handleSearch()} disabled={searching} className="h-12 px-8 font-bold">
          {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : "Search"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* CATEGORIES SIDEBAR */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase flex justify-between items-center">
                Categories
                <Button variant="ghost" size="icon" onClick={() => setCatDialogOpen(true)} className="h-6 w-6"><Plus className="h-4 w-4" /></Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 max-h-[600px] overflow-y-auto">
              {flatCats.map(cat => (
                <div key={cat.id} className="flex justify-between items-center group p-2 hover:bg-muted/50 rounded-md">
                  <span className="text-xs font-bold">{cat.name}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* PRODUCT TABLE */}
        <div className="lg:col-span-3">
          <Card className="border-2 overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px] w-[70px]">Image</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Product</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Category</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-center">Stock</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-right">Cost Price</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
                ) : products.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic font-bold">No products found.</TableCell></TableRow>
                ) : (
                  products.map((p) => {
                    const catName = flatCats.find(c => c.id === p.category_id)?.name.replace(/—/g, "").trim() || "Unknown";
                    const fullImageUrl = resolveAssetUrl(p.image_url);

                    return (
                      <TableRow key={p.id} className="hover:bg-muted/20">
                        <TableCell>
                          {fullImageUrl ? (
                            <Image
                              src={fullImageUrl}
                              alt={p.model_name}
                              width={40}
                              height={40}
                              className="h-10 w-10 object-cover rounded-lg border bg-background"
                            />
                          ) : (
                            <div className="h-10 w-10 bg-muted rounded-lg flex items-center justify-center border border-dashed text-muted-foreground/50">
                              <ImageIcon className="h-4 w-4" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-sm text-primary">{p.brand} {p.model_name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono bg-muted inline-block px-1 rounded mt-1">{p.model_no}</div>
                          {p.min_selling_price > 0 && <span className="ml-2 text-[9px] text-warning font-bold">MIN: ₹{p.min_selling_price}</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[9px] font-bold">{catName}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{getStockBadge(p.current_stock)}</TableCell>
                        <TableCell className="text-right font-mono font-black text-sm">₹{p.cost_price.toLocaleString()}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><Settings className="h-4 w-4 text-muted-foreground" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-32">
                              <DropdownMenuItem onClick={() => openEditProduct(p)} className="font-bold text-xs"><Edit className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDuplicateProduct(p)} className="font-bold text-xs"><Copy className="mr-2 h-3 w-3" /> Duplicate</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDeleteProduct(p.id)} className="font-bold text-xs text-destructive focus:text-destructive"><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>

      {/* PRODUCT DIALOG */}
      <Dialog open={prodDialogOpen} onOpenChange={setProdDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">
              {editMode ? "Edit Product Details" : "Register New Product"}
            </DialogTitle>
            <DialogDescription>Configure details, prices, stock, and snap or select item photos.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveProduct} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Brand</Label>
                <Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Havells" className="font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Model Name <span className="text-destructive">*</span></Label>
                <Input value={modelName} onChange={e => setModelName(e.target.value)} placeholder="Nicola" className="font-bold" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Model Number <span className="text-destructive">*</span></Label>
              <Input value={modelNo} onChange={e => setModelNo(e.target.value)} placeholder="HAV-101" className="font-bold font-mono" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Category <span className="text-destructive">*</span></Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-bold" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Select Category</option>
                {flatCats.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Cost Price (₹)</Label>
                <Input type="number" value={costPrice} onChange={e => setCostPrice(e.target.value)} className="font-mono font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Min Sell Price (₹)</Label>
                <Input type="number" value={minSellingPrice} onChange={e => setMinSellingPrice(e.target.value)} className="font-mono font-bold" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                {editMode ? "Manual Stock Adjust" : "Initial Stock"}
              </Label>
              <Input type="number" value={currentStock} onChange={e => setCurrentStock(e.target.value)} className="font-mono font-bold" />
            </div>
            
            {/* Image input handling */}
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Product Image (Optional)</Label>
              <div className="flex items-center gap-3">
                <Input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)} 
                  className="font-bold text-xs pt-2 flex-1"
                />
                {selectedFile ? (
                  <Button 
                    type="button" 
                    variant="destructive" 
                    size="icon" 
                    onClick={() => setSelectedFile(null)}
                    className="h-10 w-10 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : (
                  <div className="h-10 w-10 bg-muted rounded-lg flex items-center justify-center border border-dashed border-zinc-700 shrink-0">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
              {selectedFile && <p className="text-[10px] font-mono text-success font-bold">Selected picture: {selectedFile.name}</p>}
            </div>

            <Button type="submit" disabled={savingProduct} className="w-full h-12 font-black uppercase text-lg shadow-lg">
              {savingProduct ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Saving...</> : "Confirm Details"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* CATEGORY DIALOG */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-black uppercase">Create Category</DialogTitle>
            <DialogDescription>Add a new product category to organize your inventory</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Category Name</Label>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Switches" className="font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Parent Category (Optional)</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-bold" value={catParentId} onChange={(e) => setCatParentId(e.target.value)}>
                <option value="">None (Top Level)</option>
                {flatCats.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
              </select>
            </div>
            <Button onClick={handleAddCategory} disabled={addingCategory || !catName} className="w-full h-10 font-bold uppercase shadow-lg">
              {addingCategory ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Category"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <InventoryContent />
    </Suspense>
  );
}