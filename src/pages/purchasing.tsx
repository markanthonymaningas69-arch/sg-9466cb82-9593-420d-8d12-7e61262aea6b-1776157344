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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ShoppingCart, Plus, Search, Building2, Warehouse as WarehouseIcon, FilterX, List, Edit2, Archive, Printer, ChevronsUpDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { projectService } from "@/services/projectService";
import { useSettings } from "@/contexts/SettingsProvider";
import { cn } from "@/lib/utils";

const STANDARD_CATEGORIES = [
  "Construction Materials",
  "Equipments",
  "Hand Tools",
  "PPE",
  "Tools"
];

const STANDARD_UNITS = [
  "Bag",
  "Bd.ft",
  "Box",
  "Cu.m",
  "Gal",
  "Kg",
  "Length",
  "Lin.m",
  "Liter",
  "Lot",
  "M",
  "Pail",
  "Pair",
  "Pc",
  "Roll",
  "Set",
  "Sq.m",
  "Unit"
];

export default function Purchasing() {
  const { formatCurrency, company, currency } = useSettings();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [viewSuppliersDialogOpen, setViewSuppliersDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [gmSubmitDialogOpen, setGmSubmitDialogOpen] = useState(false);
  const [gmSubmitForm, setGmSubmitForm] = useState<any>(null);
  const [itemPopoverOpen, setItemPopoverOpen] = useState(false);

  // Multi-item PO State
  const [poHeader, setPoHeader] = useState({
    order_number: "",
    order_date: new Date().toISOString().split("T")[0],
    supplier: "",
    destination_type: "main_warehouse",
    project_id: "none"
  });

  const [poItems, setPoItems] = useState<any[]>([]);
  const [currentItem, setCurrentItem] = useState({
    item_name: "",
    category: "Construction Materials",
    quantity: "",
    unit: "Pc",
    unit_cost: ""
  });
  
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
    order_date: new Date().toISOString().split("T")[0],
    supplier: "",
    item_name: "",
    category: "Construction Materials",
    quantity: "",
    unit: "Pc",
    unit_cost: "",
    destination_type: "main_warehouse",
    project_id: "none"
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
    const [{ data: pData }, { data: projData }, { data: supData }, { data: vouchData }, { data: masterData }] = await Promise.all([
      supabase.from("purchases").select(`*, projects(name)`).eq('is_archived', false).order('created_at', { ascending: false }),
      projectService.getAll(),
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("vouchers").select("*").order("created_at", { ascending: false }),
      projectService.getMasterItems()
    ]);
    
    const loadedPurchases = pData || [];
    setPurchases(loadedPurchases);
    setProjects(projData || []);
    setSuppliers(supData || []);
    setVouchers(vouchData || []);
    
    // Create unique catalog from master items
    const uniqueItemsMap = new Map();
    if (masterData) {
      masterData.forEach(item => {
        if (!uniqueItemsMap.has(item.name.toLowerCase())) {
          uniqueItemsMap.set(item.name.toLowerCase(), item);
        }
      });
    }
    setCatalogItems(Array.from(uniqueItemsMap.values()));
    
    if (!editingId && !poHeader.order_number) {
      setPoHeader(prev => ({ ...prev, order_number: generateNextPONumber(loadedPurchases) }));
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

  const handleAddItem = () => {
    if (!currentItem.item_name || !currentItem.quantity || !currentItem.unit_cost) {
      alert("Please fill in item name, quantity, and unit cost.");
      return;
    }
    setPoItems([...poItems, { ...currentItem }]);
    setCurrentItem({
      item_name: "",
      category: "Construction Materials",
      quantity: "",
      unit: "Pc",
      unit_cost: ""
    });
  };

  const handleRemoveItem = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const handleSubmitPO = async () => {
    if (!poHeader.supplier) {
      alert("Please select a supplier.");
      return;
    }
    if (poItems.length === 0) {
      alert("Please add at least one item to the PO.");
      return;
    }
    
    const payloadArray = poItems.map(item => ({
      order_number: poHeader.order_number,
      order_date: poHeader.order_date,
      supplier: poHeader.supplier,
      item_name: item.item_name,
      category: item.category,
      quantity: parseFloat(item.quantity) || 0,
      unit: item.unit,
      unit_cost: parseFloat(item.unit_cost) || 0,
      destination_type: poHeader.destination_type,
      project_id: poHeader.destination_type === "project_warehouse" && poHeader.project_id !== "none" ? poHeader.project_id : null,
      status: "pending_approval",
      voucher_number: null
    }));

    const { error } = await supabase.from("purchases").insert(payloadArray);
    
    if (error) {
      console.error("Error saving PO items:", error);
      alert("Failed to save PO: " + error.message);
      return;
    }

    setDialogOpen(false);
    loadData();
  };

  const handleEdit = (p: any) => {
    setEditingId(p.id);
    setFormData({
      order_number: p.order_number,
      order_date: p.order_date,
      supplier: p.supplier,
      item_name: p.item_name,
      category: p.category,
      quantity: p.quantity.toString(),
      unit: p.unit,
      unit_cost: p.unit_cost.toString(),
      destination_type: p.destination_type,
      project_id: p.project_id || "none"
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this purchase order item?")) return;
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (!error) loadData();
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Are you sure you want to archive this purchase order item?")) return;
    const { error } = await supabase.from("purchases").update({ is_archived: true }).eq("id", id);
    if (!error) loadData();
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setPoHeader(prev => ({
        ...prev,
        order_number: generateNextPONumber(purchases)
      }));
      setPoItems([]);
      setCurrentItem({
        item_name: "",
        category: "Construction Materials",
        quantity: "",
        unit: "Pc",
        unit_cost: ""
      });
    } else {
      setPoHeader(prev => ({ ...prev, order_number: generateNextPONumber(purchases) }));
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

  const handleGmSubmit = async () => {
    const uc = parseFloat(gmSubmitForm.unit_cost) || 0;
    if (uc <= 0 || !gmSubmitForm.supplier || gmSubmitForm.supplier === 'Pending Selection') {
      alert("Please provide a valid supplier and unit cost.");
      return;
    }
    const { error } = await supabase.from('purchases').update({
      supplier: gmSubmitForm.supplier,
      unit_cost: uc,
      status: 'pending_approval' // Triggers GM approval in Layout
    }).eq('id', gmSubmitForm.id);

    if (!error) {
      setGmSubmitDialogOpen(false);
      setGmSubmitForm(null);
      loadData();
    } else {
      alert("Failed to submit: " + error.message);
    }
  };

  const handlePrint = (p: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const projectName = p.projects?.name || (p.destination_type === 'main_warehouse' ? 'Main Warehouse' : 'Unknown Project');
    const logoUrl = company?.logo_url || '';
    const absoluteLogoUrl = logoUrl ? (logoUrl.startsWith('/') ? window.location.origin + logoUrl : logoUrl) : '';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Purchase Order ${p.order_number}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #222; max-width: 800px; margin: 0 auto; line-height: 1.5; }
            .header-container { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 15px; }
            .company-info { display: flex; align-items: center; gap: 15px; }
            .company-logo { max-width: 80px; max-height: 80px; object-fit: contain; }
            .company-text h3 { margin: 0; font-size: 18px; color: #111; text-transform: uppercase; font-weight: bold; }
            .company-text p { margin: 3px 0 0 0; font-size: 12px; color: #555; }
            .po-title { text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; background: #eee; padding: 10px 20px; border: 1px solid #ccc; display: inline-block; margin: 20px auto 40px auto; width: 100%; box-sizing: border-box; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
            .info-row { display: flex; margin-bottom: 12px; }
            .label { font-weight: bold; width: 120px; color: #333; }
            .value { flex: 1; border-bottom: 1px solid #999; padding-bottom: 2px; font-family: monospace; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { border: 1px solid #000; padding: 10px; text-align: left; }
            th { background: #eee; font-weight: bold; text-transform: uppercase; font-size: 12px; }
            td { font-size: 14px; }
            .text-right { text-align: right; }
            .amount-box { text-align: right; font-size: 22px; font-weight: bold; margin-bottom: 60px; padding: 15px 20px; background: #f9f9f9; border: 1px solid #000; display: inline-block; float: right; min-width: 250px; }
            .clearfix::after { content: ""; clear: both; display: table; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 60px; }
            .sig-line { border-top: 1px solid #000; text-align: center; padding-top: 10px; font-size: 12px; font-weight: bold; color: #333; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="company-info">
              ${absoluteLogoUrl ? `<img src="${absoluteLogoUrl}" class="company-logo" alt="Logo" />` : `<div style="width: 50px; height: 50px; background: #eee; display: flex; align-items: center; justify-content: center; border: 1px solid #ccc; font-size: 10px; color: #999;">LOGO</div>`}
              <div class="company-text">
                <h3>${company?.name || 'Company Name'}</h3>
                <p>${company?.address || 'Company Address line 1<br/>City, Country, ZIP'}</p>
              </div>
            </div>
          </div>
          
          <div class="po-title">PURCHASE ORDER</div>
          
          <div class="info-grid">
            <div>
              <div class="info-row"><div class="label">PO Number:</div><div class="value">${p.order_number}</div></div>
              <div class="info-row"><div class="label">Date:</div><div class="value">${new Date(p.order_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div></div>
            </div>
            <div>
              <div class="info-row"><div class="label">Supplier:</div><div class="value">${p.supplier || 'Pending'}</div></div>
              <div class="info-row"><div class="label">Deliver To:</div><div class="value">${projectName}</div></div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Category</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${p.item_name}</td>
                <td>${p.category || '-'}</td>
                <td class="text-right">${p.quantity} ${p.unit}</td>
                <td class="text-right">${currency || 'AED'} ${(p.unit_cost || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td class="text-right">${currency || 'AED'} ${(p.total_cost || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
            </tbody>
          </table>

          <div class="clearfix">
            <div class="amount-box">
              TOTAL: ${currency || 'AED'} ${(p.total_cost || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
          </div>

          <div class="signatures">
            <div class="sig-line">Prepared By</div>
            <div class="sig-line">Checked By</div>
            <div class="sig-line">Approved By</div>
          </div>
          
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

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
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Purchase Order</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Add multiple items under a single PO Number and submit to GM.
                  </p>
                </DialogHeader>
                <div className="space-y-6">
                  {/* Header Section */}
                  <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border">
                    <div className="space-y-2">
                      <Label>PO Number *</Label>
                      <Input value={poHeader.order_number} onChange={(e) => setPoHeader({ ...poHeader, order_number: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Order Date *</Label>
                      <Input type="date" value={poHeader.order_date} onChange={(e) => setPoHeader({ ...poHeader, order_date: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Supplier *</Label>
                      <Select value={poHeader.supplier} onValueChange={(val) => setPoHeader({ ...poHeader, supplier: val })} required>
                        <SelectTrigger><SelectValue placeholder="Select registered supplier" /></SelectTrigger>
                        <SelectContent>
                          {suppliers.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Destination *</Label>
                      <Select value={poHeader.destination_type} onValueChange={(val) => setPoHeader({ ...poHeader, destination_type: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="main_warehouse">Main Warehouse</SelectItem>
                          <SelectItem value="project_warehouse">Project Warehouse</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {poHeader.destination_type === "project_warehouse" && (
                      <div className="space-y-2 col-span-2">
                        <Label>Select Project *</Label>
                        <Select value={poHeader.project_id} onValueChange={(val) => setPoHeader({ ...poHeader, project_id: val })}>
                          <SelectTrigger><SelectValue placeholder="Select active project" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-- Select Project --</SelectItem>
                            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Add Item Section */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Add Line Item</h3>
                    <div className="grid grid-cols-6 gap-3 items-end">
                      <div className="space-y-2 col-span-2 flex flex-col justify-end">
                        <Label className="text-xs">Item Name *</Label>
                        <Input 
                          list="catalog-items"
                          value={currentItem.item_name}
                          onChange={(e) => {
                            const val = e.target.value;
                            const found = catalogItems.find(item => item.name === val);
                            if (found) {
                              setCurrentItem({
                                ...currentItem,
                                item_name: val,
                                category: found.category || currentItem.category,
                                unit: found.unit || currentItem.unit
                              });
                            } else {
                              setCurrentItem({ ...currentItem, item_name: val });
                            }
                          }}
                          className="h-9"
                          placeholder="Type or select item..."
                        />
                        <datalist id="catalog-items">
                          {catalogItems.map((item, i) => (
                            <option key={i} value={item.name} />
                          ))}
                        </datalist>
                      </div>
                      <div className="space-y-2 col-span-1 flex flex-col justify-end">
                        <Label className="text-xs">Category</Label>
                        <Select value={currentItem.category} onValueChange={(val) => setCurrentItem({ ...currentItem, category: val })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STANDARD_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            {!STANDARD_CATEGORIES.includes(currentItem.category) && currentItem.category && (
                              <SelectItem value={currentItem.category}>{currentItem.category}</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 col-span-1">
                        <Label className="text-xs">Qty *</Label>
                        <Input type="number" value={currentItem.quantity} onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value })} className="h-9" />
                      </div>
                      <div className="space-y-2 col-span-1">
                        <Label className="text-xs">Unit</Label>
                        <Select value={currentItem.unit} onValueChange={(val) => setCurrentItem({ ...currentItem, unit: val })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STANDARD_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            {!STANDARD_UNITS.includes(currentItem.unit) && currentItem.unit && (
                              <SelectItem value={currentItem.unit}>{currentItem.unit}</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 col-span-1">
                        <Label className="text-xs">Unit Cost *</Label>
                        <Input type="number" step="0.01" value={currentItem.unit_cost} onChange={(e) => setCurrentItem({ ...currentItem, unit_cost: e.target.value })} className="h-9" />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" variant="secondary" size="sm" onClick={handleAddItem}>
                        <Plus className="h-3 w-3 mr-1" /> Add to PO
                      </Button>
                    </div>
                  </div>

                  {/* Items Table */}
                  {poItems.length > 0 && (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8 text-xs">Item</TableHead>
                            <TableHead className="h-8 text-xs text-right">Qty</TableHead>
                            <TableHead className="h-8 text-xs text-right">Unit Cost</TableHead>
                            <TableHead className="h-8 text-xs text-right">Total</TableHead>
                            <TableHead className="h-8 text-xs text-right"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {poItems.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="py-2 text-sm">{item.item_name} <span className="text-xs text-muted-foreground block">{item.category}</span></TableCell>
                              <TableCell className="py-2 text-sm text-right">{item.quantity} {item.unit}</TableCell>
                              <TableCell className="py-2 text-sm text-right">{formatCurrency(parseFloat(item.unit_cost) || 0)}</TableCell>
                              <TableCell className="py-2 text-sm text-right font-medium">{formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0))}</TableCell>
                              <TableCell className="py-2 text-right">
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleRemoveItem(index)}>
                                  <FilterX className="h-3 w-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-4 border-t mt-6">
                    <p className="text-xs font-semibold">
                      Total PO Value: {formatCurrency(poItems.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0)), 0))}
                    </p>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                      <Button type="button" onClick={handleSubmitPO}>Submit PO to GM</Button>
                    </div>
                  </div>
                </div>
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
              <div className="flex bg-background border p-0.5 rounded-md w-fit h-9 items-center overflow-x-auto">
                <Button variant={filterStatus === "all" ? "secondary" : "ghost"} size="sm" className="h-full text-xs" onClick={() => setFilterStatus("all")}>All</Button>
                <Button variant={filterStatus === "pending" ? "secondary" : "ghost"} size="sm" className="h-full text-xs text-orange-600 dark:text-orange-400" onClick={() => setFilterStatus("pending")}>Pending</Button>
                <Button variant={filterStatus === "pending_approval" ? "secondary" : "ghost"} size="sm" className="h-full text-xs text-purple-600 dark:text-purple-400 whitespace-nowrap" onClick={() => setFilterStatus("pending_approval")}>Pending GM</Button>
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
                      <TableCell className="text-right">{formatCurrency(p.unit_cost)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(p.total_cost)}</TableCell>
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
                            p.status === 'pending_approval' ? 'bg-purple-500 hover:bg-purple-600 border-transparent text-white' : 
                            'bg-orange-500 hover:bg-orange-600 border-transparent text-white'
                          }
                        >
                          {p.status === 'pending_approval' ? 'PENDING GM' : p.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {p.status === 'pending' && p.order_number?.startsWith('PR-') && (
                            <Button variant="outline" size="sm" className="h-8 text-xs bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100" onClick={() => {
                              setGmSubmitForm({ ...p, unit_cost: p.unit_cost || '' });
                              setGmSubmitDialogOpen(true);
                            }}>
                              Price & Submit
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handlePrint(p)} title="Print PO">
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50" onClick={() => handleArchive(p.id)} title="Archive">
                            <Archive className="h-4 w-4" />
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

        {/* GM Submit Dialog */}
        <Dialog open={gmSubmitDialogOpen} onOpenChange={setGmSubmitDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit for GM Approval</DialogTitle>
              <CardDescription>Enter the unit cost and supplier before sending to the GM for approval.</CardDescription>
            </DialogHeader>
            {gmSubmitForm && (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Item</Label>
                  <Input value={`${gmSubmitForm.item_name} (${gmSubmitForm.quantity} ${gmSubmitForm.unit})`} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Select Supplier *</Label>
                  <Select value={gmSubmitForm.supplier !== 'Pending Selection' ? gmSubmitForm.supplier : ''} onValueChange={(val) => setGmSubmitForm({...gmSubmitForm, supplier: val})}>
                    <SelectTrigger><SelectValue placeholder="Choose Supplier" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unit Cost (AED) *</Label>
                  <Input type="number" step="0.01" value={gmSubmitForm.unit_cost} onChange={(e) => setGmSubmitForm({...gmSubmitForm, unit_cost: e.target.value})} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Total Estimated Cost: AED {(parseFloat(gmSubmitForm.unit_cost) || 0) * gmSubmitForm.quantity}
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setGmSubmitDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleGmSubmit}>Submit to GM</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}