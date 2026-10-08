import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, DollarSign, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/contexts/SettingsProvider";
import { subcontractorService, type SubcontractorWithPayments } from "@/services/subcontractorService";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

export function SubcontractorsTab() {
  const { formatCurrency } = useSettings();
  const { toast } = useToast();
  const [subcontractors, setSubcontractors] = useState<SubcontractorWithPayments[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingSubcontractor, setEditingSubcontractor] = useState<string | null>(null);
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<SubcontractorWithPayments | null>(null);
  const [availableScopes, setAvailableScopes] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    project_id: "",
    name: "",
    scope_of_work: "",
    contract_amount: "",
    start_date: "",
    end_date: "",
    status: "active" as "active" | "completed" | "suspended" | "cancelled",
    contact_person: "",
    contact_email: "",
    contact_phone: "",
    payment_terms: "",
    notes: "",
  });

  const [paymentFormData, setPaymentFormData] = useState({
    bom_scope_id: "",
    amount: "",
    accomplishment_percent: "",
    payment_date: new Date().toISOString().split("T")[0],
    status: "pending" as "pending" | "approved" | "paid" | "cancelled",
    description: "",
    retention_amount: "",
    deductions: "",
    notes: "",
  });

  useEffect(() => {
    loadProjects();
    loadSubcontractors();

    const channel = supabase
      .channel("subcontractors_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "subcontractors" }, () => {
        void loadSubcontractors();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "subcontractor_payments" }, () => {
        void loadSubcontractors();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedProject]);

  const loadProjects = async () => {
    const { data } = await supabase.from("projects").select("id, name").order("name");
    setProjects(data || []);
  };

  const loadSubcontractors = async () => {
    setLoading(true);
    const projectId = selectedProject === "all" ? undefined : selectedProject;
    const { data } = await subcontractorService.listSubcontractors(projectId);

    if (data) {
      const enrichedData = await Promise.all(
        data.map(async (sub) => {
          const { data: subData } = await subcontractorService.getSubcontractorWithPayments(sub.id);
          
          const progressData = await subcontractorService.getProgressFromSitePersonnel(
            sub.project_id,
            sub.scope_of_work
          );

          return {
            ...sub,
            ...(subData || {}),
            accomplishment_percent: progressData.accomplishment_percent,
          } as SubcontractorWithPayments;
        })
      );

      setSubcontractors(enrichedData);
    }

    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.project_id || !formData.name || !formData.scope_of_work || !formData.contract_amount) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const submitData = {
      ...formData,
      contract_amount: parseFloat(formData.contract_amount),
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      contact_person: formData.contact_person || null,
      contact_email: formData.contact_email || null,
      contact_phone: formData.contact_phone || null,
      payment_terms: formData.payment_terms || null,
      notes: formData.notes || null,
    };

    if (editingSubcontractor) {
      const { error } = await subcontractorService.updateSubcontractor(editingSubcontractor, submitData);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Success", description: "Subcontractor updated successfully" });
    } else {
      const { error } = await subcontractorService.createSubcontractor(submitData);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Success", description: "Subcontractor created successfully" });
    }

    resetForm();
    setDialogOpen(false);
    void loadSubcontractors();
  };

  const handleEdit = async (subcontractor: SubcontractorWithPayments) => {
    setEditingSubcontractor(subcontractor.id);
    setFormData({
      project_id: subcontractor.project_id,
      name: subcontractor.name,
      scope_of_work: subcontractor.scope_of_work,
      contract_amount: subcontractor.contract_amount.toString(),
      start_date: subcontractor.start_date || "",
      end_date: subcontractor.end_date || "",
      status: subcontractor.status,
      contact_person: subcontractor.contact_person || "",
      contact_email: subcontractor.contact_email || "",
      contact_phone: subcontractor.contact_phone || "",
      payment_terms: subcontractor.payment_terms || "",
      notes: subcontractor.notes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subcontractor?")) return;

    const { error } = await subcontractorService.deleteSubcontractor(id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Subcontractor deleted successfully" });
    void loadSubcontractors();
  };

  const handlePaymentSubmit = async () => {
    if (!selectedSubcontractor || !paymentFormData.amount || !paymentFormData.accomplishment_percent) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const { data: existingPayments } = await supabase
      .from("subcontractor_payments")
      .select("payment_number")
      .eq("subcontractor_id", selectedSubcontractor.id)
      .order("payment_number", { ascending: false })
      .limit(1);

    const nextPaymentNumber = existingPayments?.[0]?.payment_number ? existingPayments[0].payment_number + 1 : 1;

    const submitData = {
      subcontractor_id: selectedSubcontractor.id,
      project_id: selectedSubcontractor.project_id,
      bom_scope_id: paymentFormData.bom_scope_id || null,
      payment_number: nextPaymentNumber,
      amount: parseFloat(paymentFormData.amount),
      accomplishment_percent: parseFloat(paymentFormData.accomplishment_percent),
      payment_date: paymentFormData.payment_date || null,
      status: paymentFormData.status,
      description: paymentFormData.description || null,
      retention_amount: parseFloat(paymentFormData.retention_amount) || 0,
      deductions: parseFloat(paymentFormData.deductions) || 0,
      notes: paymentFormData.notes || null,
    };

    const { error } = await subcontractorService.createPayment(submitData);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Payment created successfully" });
    resetPaymentForm();
    setPaymentDialogOpen(false);
    void loadSubcontractors();
  };

  const resetForm = () => {
    setFormData({
      project_id: "",
      name: "",
      scope_of_work: "",
      contract_amount: "",
      start_date: "",
      end_date: "",
      status: "active",
      contact_person: "",
      contact_email: "",
      contact_phone: "",
      payment_terms: "",
      notes: "",
    });
    setEditingSubcontractor(null);
  };

  const resetPaymentForm = () => {
    setPaymentFormData({
      bom_scope_id: "",
      amount: "",
      accomplishment_percent: "",
      payment_date: new Date().toISOString().split("T")[0],
      status: "pending",
      description: "",
      retention_amount: "",
      deductions: "",
      notes: "",
    });
    setSelectedSubcontractor(null);
    setAvailableScopes([]);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      active: { variant: "default", label: "Active" },
      completed: { variant: "secondary", label: "Completed" },
      suspended: { variant: "outline", label: "Suspended" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    };
    const config = variants[status] || variants.active;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "outline", label: "Pending" },
      approved: { variant: "secondary", label: "Approved" },
      paid: { variant: "default", label: "Paid" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subcontractors</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subcontractors.filter((s) => s.status === "active").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contract Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                subcontractors.reduce((sum, s) => sum + Number(s.contract_amount), 0)
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(subcontractors.reduce((sum, s) => sum + (s.total_paid || 0), 0))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(subcontractors.reduce((sum, s) => sum + (s.balance || 0), 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Subcontractors</CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Subcontractor
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Scope of Work</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Contract Amount</TableHead>
                  <TableHead>Accomplishment</TableHead>
                  <TableHead>Total Paid</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subcontractors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      No subcontractors found. Click "Add Subcontractor" to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  subcontractors.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.name}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{sub.scope_of_work}</TableCell>
                      <TableCell>
                        {projects.find((p) => p.id === sub.project_id)?.name || "—"}
                      </TableCell>
                      <TableCell>{formatCurrency(sub.contract_amount)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Progress value={sub.accomplishment_percent || 0} className="h-2 flex-1" />
                            <span className="text-xs font-medium whitespace-nowrap">
                              {(sub.accomplishment_percent || 0).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-success font-medium">
                        {formatCurrency(sub.total_paid || 0)}
                      </TableCell>
                      <TableCell className="text-amber-600 font-medium">
                        {formatCurrency(sub.balance || 0)}
                      </TableCell>
                      <TableCell>{getStatusBadge(sub.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const { data } = await subcontractorService.getSubcontractorWithPayments(sub.id);
                              if (data) {
                                setSelectedSubcontractor(data);
                                
                                // Load available scopes for this project
                                const { data: bomData } = await supabase
                                  .from("bill_of_materials")
                                  .select("id, bom_scope_of_work(id, name)")
                                  .eq("project_id", sub.project_id)
                                  .single();
                                
                                if (bomData?.bom_scope_of_work) {
                                  setAvailableScopes(bomData.bom_scope_of_work);
                                }
                                
                                setPaymentDialogOpen(true);
                              }
                            }}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Pay
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEdit(sub)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => void handleDelete(sub.id)}>
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
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSubcontractor ? "Edit Subcontractor" : "Add New Subcontractor"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="project_id">Project *</Label>
              <Select value={formData.project_id} onValueChange={(val) => setFormData({ ...formData, project_id: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="scope_of_work">Scope of Work *</Label>
              <Textarea
                id="scope_of_work"
                value={formData.scope_of_work}
                onChange={(e) => setFormData({ ...formData, scope_of_work: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contract_amount">Contract Amount *</Label>
                <Input
                  id="contract_amount"
                  type="number"
                  step="0.01"
                  value={formData.contract_amount}
                  onChange={(e) => setFormData({ ...formData, contract_amount: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(val: any) => setFormData({ ...formData, status: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            <Separator />

            <div className="grid gap-2">
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input
                  id="contact_phone"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="payment_terms">Payment Terms</Label>
              <Textarea
                id="payment_terms"
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDialogOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingSubcontractor ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={(open) => {
        setPaymentDialogOpen(open);
        if (!open) resetPaymentForm();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Payment for {selectedSubcontractor?.name}</DialogTitle>
          </DialogHeader>
          {selectedSubcontractor && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Contract Amount</p>
                  <p className="text-lg font-bold">{formatCurrency(selectedSubcontractor.contract_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Paid</p>
                  <p className="text-lg font-bold text-success">{formatCurrency(selectedSubcontractor.total_paid || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="text-lg font-bold text-amber-600">{formatCurrency(selectedSubcontractor.balance || 0)}</p>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="bom_scope_id">Scope of Work (Optional)</Label>
                  <Select 
                    value={paymentFormData.bom_scope_id} 
                    onValueChange={(val) => setPaymentFormData({ ...paymentFormData, bom_scope_id: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select scope (or leave unassigned)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned / General</SelectItem>
                      {availableScopes.map((scope: any) => (
                        <SelectItem key={scope.id} value={scope.id}>
                          {scope.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Link payment to a specific scope for accurate analytics tracking
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="payment_amount">Payment Amount *</Label>
                    <Input
                      id="payment_amount"
                      type="number"
                      step="0.01"
                      value={paymentFormData.amount}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="accomplishment_percent">Accomplishment (%) *</Label>
                    <Input
                      id="accomplishment_percent"
                      type="number"
                      step="0.01"
                      max="100"
                      value={paymentFormData.accomplishment_percent}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, accomplishment_percent: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="retention_amount">Retention Amount</Label>
                    <Input
                      id="retention_amount"
                      type="number"
                      step="0.01"
                      value={paymentFormData.retention_amount}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, retention_amount: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="deductions">Deductions</Label>
                    <Input
                      id="deductions"
                      type="number"
                      step="0.01"
                      value={paymentFormData.deductions}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, deductions: e.target.value })}
                    />
                  </div>
                </div>

                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="text-sm font-medium">
                    Net Payment Amount:{" "}
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(
                        (parseFloat(paymentFormData.amount) || 0) -
                        (parseFloat(paymentFormData.retention_amount) || 0) -
                        (parseFloat(paymentFormData.deductions) || 0)
                      )}
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="payment_date">Payment Date</Label>
                    <Input
                      id="payment_date"
                      type="date"
                      value={paymentFormData.payment_date}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_date: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="payment_status">Status</Label>
                    <Select value={paymentFormData.status} onValueChange={(val: any) => setPaymentFormData({ ...paymentFormData, status: val })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="payment_description">Description</Label>
                  <Textarea
                    id="payment_description"
                    value={paymentFormData.description}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, description: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="payment_notes">Notes</Label>
                  <Textarea
                    id="payment_notes"
                    value={paymentFormData.notes}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>

              {selectedSubcontractor.payments && selectedSubcontractor.payments.length > 0 && (
                <div className="space-y-2">
                  <Label>Payment History</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Accomplishment</TableHead>
                          <TableHead>Net</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSubcontractor.payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{payment.payment_number}</TableCell>
                            <TableCell>{formatCurrency(payment.amount)}</TableCell>
                            <TableCell>{payment.accomplishment_percent}%</TableCell>
                            <TableCell className="font-medium">{formatCurrency(payment.net_amount || 0)}</TableCell>
                            <TableCell>{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : "—"}</TableCell>
                            <TableCell>{getPaymentStatusBadge(payment.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPaymentDialogOpen(false);
              resetPaymentForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handlePaymentSubmit}>Create Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}