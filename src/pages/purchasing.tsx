import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Search, Building2, Warehouse as WarehouseIcon, FilterX, List, Edit2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { projectService } from "@/services/projectService";

const STANDARD_UNITS = ["pcs", "bags", "kgs", "liters", "units", "set", "lot", "m", "sq.m", "cu.m", "length", "box", "roll"];

export default function Purchasing() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [viewSuppliersDialogOpen, setViewSuppliersDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Filters
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterItem, setFilterItem] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  
  const generateNextPONumber = (list: any[]) => {
    let max = 0;
    list.forEach(p => {
      if (p.order_number && p.order_number.startsWith("PO-")) {
        const num = parseInt(p.order_number.replace("PO-", ""), 10);
        if (!isNaN(num) && num > max) max = num;
      }
    });
    return `PO-${String(max + 1).padStart(5, '0')}`;
  };

  const [formData, setFormData] = useState({
    order_number: "",
    voucher_number: "none",
    order_date: new Date().toISOString().split("T")[0],
    supplier: "",
    item_name: "",
    category: "Construction Materials",
    quantity: "",
    unit: "pcs",
    unit_cost: "",
    destination_type: "main_warehouse",
    project_id: "none",
    status: "pending"
  });

  const [supplierForm, setSupplierForm] = useState({
    name: "",
    contact_person: "",
    phone: "",
    address: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: pData }, { data: projData }, { data: supData }, { data: vouchData }] = await Promise.all([
      supabase.from("purchases").select(`*, projects(name)`).order('created_at', { ascending: false }),
      projectService.getAll(),
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("vouchers").select("*").order("created_at", { ascending: false })
    ]);
    
    const loadedPurchases = pData || [];
    setPurchases(loadedPurchases);
    setProjects(projData || []);
    setSuppliers(supData || []);
    setVouchers(vouchData || []);
    
    if (!editingId && !formData.order_number) {
      setFormData(prev => ({ ...prev, order_number: generateNextPONumber(loadedPurchases) }));
    }
    setLoading(false);
  };

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("suppliers").insert(supplierForm);
    if (!error) {
      setSupplierDialogOpen(false);
      setSupplierForm({ name: "", contact_person: "", phone: "", address: "" });
      loadData();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      order_number: formData.order_number,
      order_date: formData.order_date,
      supplier: formData.supplier,
      item_name: formData.item_name,
      category: formData.category,
      quantity: parseFloat(formData.quantity) || 0,
      unit: formData.unit,
      unit_cost: parseFloat(formData.unit_cost) || 0,
      total_cost: (parseFloat(formData.quantity) || 0) * (parseFloat(formData.unit_cost) || 0),
      destination_type: formData.destination_type,
      project_id: formData.destination_type === "project_warehouse" && formData.project_id !== "none" ? formData.project_id : null,
      status: formData.status,
      voucher_number: formData.voucher_number === "none" ? null : formData.voucher_number
    };

    const { error } = editingId 
      ? await supabase.from("purchases").update(payload).eq("id", editingId)
      : await supabase.from("purchases").insert(payload);
    
    if (!error) {
      if (editingId) {
        setEditingId(null);
        setDialogOpen(false);
      } else {
        // Do not close dialog. Only clear item-specific fields for fast multi-item entry
        setFormData({
          ...formData,
          item_name: "",
          quantity: "",
          unit: "pcs",
          unit_cost: ""
        });
      }
      loadData();
    }
  };

  const handleEdit = (p: any) => {
    setEditingId(p.id);
    setFormData({
      order_number: p.order_number,
      voucher_number: p.voucher_number || "none",
      order_date: p.order_date,
      supplier: p.supplier,
      item_name: p.item_name,
      category: p.category,
      quantity: p.quantity.toString(),
      unit: p.unit,
      unit_cost: p.unit_cost.toString(),
      destination_type: p.destination_type,
      project_id: p.project_id || "none",
      status: p.status
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this purchase order item?")) return;
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (!error) loadData();
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingId(null);
      setFormData(prev => ({
        ...prev,
        order_number: generateNextPONumber(purchases),
        item_name: "",
        quantity: "",
        unit: "pcs",
        unit_cost: ""
      }));
    } else if (!editingId) {
      setFormData(prev => ({ ...prev, order_number: prev.order_number || generateNextPONumber(purchases) }));
    }
  };

  const uniqueSuppliers = Array.from(new Set(purchases.map(p => p.supplier))).filter(Boolean);

  const filteredPurchases = purchases.filter(p => {
    const matchSupplier = filterSupplier === "all" || p.supplier === filterSupplier;
    const matchDate = !filterDate || p.order_date === filterDate;
    const matchItem = !filterItem || p.item_name.toLowerCase().includes(filterItem.toLowerCase());
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSupplier && matchDate && matchItem && matchStatus;
  });

  return (
    <Layout>
      <div className="space-y-6 flex flex-col h-full">
        <div className="flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-3xl font-heading font-bold">Purchasing</h1>
            <p className="text-muted-foreground mt-1">Manage purchase orders and direct deliveries to warehouses</p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Building2 className="h-4 w-4 mr-2" />
                  Suppliers
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setSupplierDialogOpen(true)} className="cursor-pointer">
                  <Plus className="h-4 w-4 mr-2" />
                  Register Supplier
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewSuppliersDialogOpen(true)} className="cursor-pointer">
                  <List className="h-4 w-4 mr-2" />
                  View Suppliers
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register New Supplier</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSupplierSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Supplier Name *</Label>
                    <Input value={supplierForm.name} onChange={(e) => setSupplierForm({...supplierForm, name: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Person</Label>
                    <Input value={supplierForm.contact_person} onChange={(e) => setSupplierForm({...supplierForm, contact_person: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input value={supplierForm.phone} onChange={(e) => setSupplierForm({...supplierForm, phone: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input value={supplierForm.address} onChange={(e) => setSupplierForm({...supplierForm, address: e.target.value})} />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setSupplierDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">Save Supplier</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={viewSuppliersDialogOpen} onOpenChange={setViewSuppliersDialogOpen}>
              <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader className="shrink-0">
                  <DialogTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Registered Suppliers
                  </DialogTitle>
                </DialogHeader>
                <div className="overflow-y-auto border rounded-md flex-1">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Contact Person</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Address</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suppliers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No suppliers registered yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        suppliers.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell>{s.contact_person || <span className="text-muted-foreground">-</span>}</TableCell>
                            <TableCell>{s.phone || <span className="text-muted-foreground">-</span>}</TableCell>
                            <TableCell>{s.address || <span className="text-muted-foreground">-</span>}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Purchase Order
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Edit Purchase Order Item" : "Create Purchase Order"}</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    {editingId ? "Update details for this specific item." : "PO Header details remain saved to easily add multiple items."}
                  </p>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>PO Number *</Label>
                      <Input value={formData.order_number} onChange={(e) => setFormData({ ...formData, order_number: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Voucher Number</Label>
                      <Select value={formData.voucher_number} onValueChange={(val) => setFormData({ ...formData, voucher_number: val })}>
                        <SelectTrigger><SelectValue placeholder="Select issued voucher" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- None --</SelectItem>
                          {vouchers.map(v => <SelectItem key={v.id} value={v.voucher_number}>{v.voucher_number} ({v.payee})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Order Date *</Label>
                      <Input type="date" value={formData.order_date} onChange={(e) => setFormData({ ...formData, order_date: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Supplier *</Label>
                      <Select value={formData.supplier} onValueChange={(val) => setFormData({ ...formData, supplier: val })} required>
                        <SelectTrigger><SelectValue placeholder="Select registered supplier" /></SelectTrigger>
                        <SelectContent>
                          {suppliers.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Category *</Label>
                      <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Construction Materials">Construction Materials</SelectItem>
                          <SelectItem value="Tools">Tools</SelectItem>
                          <SelectItem value="Equipments">Equipments</SelectItem>
                          <SelectItem value="PPE">PPE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Item Name *</Label>
                      <Input value={formData.item_name} onChange={(e) => setFormData({ ...formData, item_name: e.target.value })} required />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>Quantity *</Label>
                        <Input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Unit *</Label>
                        <Select value={formData.unit} onValueChange={(val) => setFormData({ ...formData, unit: val })} required>
                          <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                          <SelectContent>
                            {STANDARD_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Unit Cost (₱) *</Label>
                      <Input type="number" step="0.01" value={formData.unit_cost} onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })} required />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Destination *</Label>
                      <Select value={formData.destination_type} onValueChange={(val) => setFormData({ ...formData, destination_type: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="main_warehouse">Main Warehouse</SelectItem>
                          <SelectItem value="project_warehouse">Project Warehouse</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2 col-span-2">
                      <Label>Status *</Label>
                      <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="received">Received</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {formData.destination_type === "project_warehouse" && (
                      <div className="space-y-2 col-span-2">
                        <Label>Select Project *</Label>
                        <Select value={formData.project_id} onValueChange={(val) => setFormData({ ...formData, project_id: val })}>
                          <SelectTrigger><SelectValue placeholder="Select active project" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-- Select Project --</SelectItem>
                            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t">
                    <p className="text-xs text-muted-foreground">
                      {editingId ? "* Changes will only apply to this item" : "* Click Save Item to record and clear fields for the next item"}
                    </p>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                      <Button type="submit">{editingId ? "Update Item" : "Save Item to PO"}</Button>
                    </div>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="flex-1 flex flex-col min-h-0 border-0 shadow-none">
          <div className="bg-muted/30 p-3 mb-4 border rounded-lg flex flex-wrap gap-4 shrink-0">
            <div className="space-y-1">
              <Label className="text-xs">Filter by Supplier:</Label>
              <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                <SelectTrigger className="w-[180px] h-9 bg-white dark:bg-background">
                  <SelectValue placeholder="All Suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {uniqueSuppliers.map((s: any) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs">Filter by Status:</Label>
              <div className="flex bg-background border p-0.5 rounded-md w-fit h-9 items-center">
                <Button variant={filterStatus === "all" ? "secondary" : "ghost"} size="sm" className="h-full text-xs" onClick={() => setFilterStatus("all")}>All</Button>
                <Button variant={filterStatus === "pending" ? "secondary" : "ghost"} size="sm" className="h-full text-xs text-orange-600 dark:text-orange-400" onClick={() => setFilterStatus("pending")}>Pending</Button>
                <Button variant={filterStatus === "approved" ? "secondary" : "ghost"} size="sm" className="h-full text-xs text-blue-600 dark:text-blue-400" onClick={() => setFilterStatus("approved")}>Approved</Button>
                <Button variant={filterStatus === "received" ? "secondary" : "ghost"} size="sm" className="h-full text-xs text-green-600 dark:text-green-400" onClick={() => setFilterStatus("received")}>Received</Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Search Item:</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="text" 
                  placeholder="Item name..." 
                  className="w-[180px] h-9 pl-8 bg-white dark:bg-background"
                  value={filterItem}
                  onChange={(e) => setFilterItem(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Filter by Date:</Label>
              <Input 
                type="date" 
                className="w-[160px] h-9 bg-white dark:bg-background" 
                value={filterDate} 
                onChange={(e) => setFilterDate(e.target.value)} 
              />
            </div>

            <div className="space-y-1 flex items-end pb-0.5">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-muted-foreground"
                onClick={() => {
                  setFilterSupplier("all");
                  setFilterStatus("all");
                  setFilterItem("");
                  setFilterDate("");
                }}
              >
                <FilterX className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>

          <div className="overflow-y-auto rounded-md border h-full relative">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Voucher No.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Loading purchases...</TableCell>
                  </TableRow>
                ) : filteredPurchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No purchase orders found.</TableCell>
                  </TableRow>
                ) : (
                  filteredPurchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-primary">{p.order_number}</TableCell>
                      <TableCell className="text-muted-foreground">{p.voucher_number || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.order_date}</TableCell>
                      <TableCell>{p.supplier}</TableCell>
                      <TableCell className="font-medium">
                        {p.item_name}
                        <div className="text-xs text-muted-foreground">{p.category}</div>
                      </TableCell>
                      <TableCell className="text-right">{p.quantity} {p.unit}</TableCell>
                      <TableCell className="text-right">₱{Number(p.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-bold">₱{Number(p.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        {p.destination_type === 'main_warehouse' ? (
                          <Badge variant="outline" className="flex w-fit items-center gap-1"><WarehouseIcon className="h-3 w-3" /> Main</Badge>
                        ) : (
                          <Badge variant="secondary" className="flex w-fit items-center gap-1 bg-blue-50 text-blue-700 border-blue-200"><Building2 className="h-3 w-3" /> {p.projects?.name || 'Project'}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={
                            p.status === 'received' ? 'bg-green-500 hover:bg-green-600 border-transparent text-white' : 
                            p.status === 'approved' ? 'bg-blue-500 hover:bg-blue-600 border-transparent text-white' : 
                            'bg-orange-500 hover:bg-orange-600 border-transparent text-white'
                          }
                        >
                          {p.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleEdit(p)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(p.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </Layout>
  );
}