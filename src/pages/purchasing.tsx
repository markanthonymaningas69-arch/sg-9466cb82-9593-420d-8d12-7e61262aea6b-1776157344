import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Search, Building2, Warehouse as WarehouseIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { projectService } from "@/services/projectService";

export default function Purchasing() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [formData, setFormData] = useState({
    order_number: `PO-${Math.floor(Math.random() * 10000)}`,
    order_date: new Date().toISOString().split("T")[0],
    supplier: "",
    item_name: "",
    category: "Construction Materials",
    quantity: "",
    unit: "pcs",
    unit_cost: "",
    destination_type: "main_warehouse",
    project_id: "none",
    status: "ordered"
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: pData }, { data: projData }] = await Promise.all([
      supabase.from("purchases").select(`*, projects(name)`).order('created_at', { ascending: false }),
      projectService.getAll()
    ]);
    
    setPurchases(pData || []);
    setProjects(projData || []);
    setLoading(false);
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
      destination_type: formData.destination_type,
      project_id: formData.destination_type === "project_warehouse" && formData.project_id !== "none" ? formData.project_id : null,
      status: formData.status
    };

    const { error } = await supabase.from("purchases").insert(payload);
    
    if (!error) {
      setDialogOpen(false);
      setFormData({
        order_number: `PO-${Math.floor(Math.random() * 10000)}`,
        order_date: new Date().toISOString().split("T")[0],
        supplier: "",
        item_name: "",
        category: "Construction Materials",
        quantity: "",
        unit: "pcs",
        unit_cost: "",
        destination_type: "main_warehouse",
        project_id: "none",
        status: "ordered"
      });
      loadData();
    }
  };

  const filteredPurchases = purchases.filter(p => 
    p.item_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.supplier.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6 flex flex-col h-full">
        <div className="flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-3xl font-heading font-bold">Purchasing</h1>
            <p className="text-muted-foreground mt-1">Manage purchase orders and direct deliveries to warehouses</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Purchase Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Purchase Order</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>PO Number *</Label>
                    <Input value={formData.order_number} onChange={(e) => setFormData({ ...formData, order_number: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Order Date *</Label>
                    <Input type="date" value={formData.order_date} onChange={(e) => setFormData({ ...formData, order_date: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Supplier *</Label>
                    <Input value={formData.supplier} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} required />
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
                      <Input value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} required />
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
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit">Save PO</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="flex-1 flex flex-col min-h-0 border-0 shadow-none">
          <div className="flex items-center gap-4 pb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                type="search" 
                placeholder="Search PO, item, or supplier..." 
                className="pl-8 bg-white dark:bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-y-auto rounded-md border h-full relative">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading purchases...</TableCell>
                  </TableRow>
                ) : filteredPurchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No purchase orders found.</TableCell>
                  </TableRow>
                ) : (
                  filteredPurchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-primary">{p.order_number}</TableCell>
                      <TableCell className="text-muted-foreground">{p.order_date}</TableCell>
                      <TableCell>{p.supplier}</TableCell>
                      <TableCell className="font-medium">
                        {p.item_name}
                        <div className="text-xs text-muted-foreground">{p.category}</div>
                      </TableCell>
                      <TableCell className="text-right">{p.quantity} {p.unit}</TableCell>
                      <TableCell className="text-right font-bold">₱{Number(p.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        {p.destination_type === 'main_warehouse' ? (
                          <Badge variant="outline" className="flex w-fit items-center gap-1"><WarehouseIcon className="h-3 w-3" /> Main</Badge>
                        ) : (
                          <Badge variant="secondary" className="flex w-fit items-center gap-1 bg-blue-50 text-blue-700 border-blue-200"><Building2 className="h-3 w-3" /> {p.projects?.name || 'Project'}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'ordered' ? 'default' : 'secondary'} className={p.status === 'ordered' ? 'bg-orange-500 hover:bg-orange-600' : ''}>
                          {p.status.toUpperCase()}
                        </Badge>
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