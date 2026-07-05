import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, DollarSign, CheckCircle, Clock, AlertCircle, Trash2 } from "lucide-react";

interface BillingRecord {
  id: string;
  project_id: string;
  billing_number: string;
  billing_date: string;
  description?: string;
  amount: number;
  status: "draft" | "sent" | "paid" | "overdue";
  payment_received: number;
  payment_date?: string;
  balance: number;
  notes?: string;
  created_at: string;
}

const BILLING_STATUS = [
  { value: "draft", label: "Draft", variant: "secondary" as const, icon: Clock },
  { value: "sent", label: "Sent", variant: "default" as const, icon: Clock },
  { value: "paid", label: "Paid", variant: "default" as const, icon: CheckCircle },
  { value: "overdue", label: "Overdue", variant: "destructive" as const, icon: AlertCircle },
];

export function ProjectBillingTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BillingRecord | null>(null);
  const [paymentRecord, setPaymentRecord] = useState<BillingRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [formData, setFormData] = useState({
    billing_number: "",
    billing_date: new Date().toISOString().split("T")[0],
    description: "",
    amount: "",
    status: "draft" as BillingRecord["status"],
    notes: "",
  });

  const [paymentData, setPaymentData] = useState({
    payment_received: "",
    payment_date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    void loadData();
  }, [projectId]);

  async function loadData() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("project_billing")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_archived", false)
        .order("billing_date", { ascending: false });

      if (error) throw error;
      setBillingRecords(data || []);
    } catch (error) {
      console.error("Error loading billing records:", error);
      toast({
        title: "Error",
        description: "Failed to load billing records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.billing_number || !formData.amount) {
      toast({ title: "Required", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.from("project_billing").insert({
        project_id: projectId,
        billing_number: formData.billing_number,
        billing_date: formData.billing_date,
        description: formData.description || null,
        amount: Number(formData.amount),
        status: formData.status,
        notes: formData.notes || null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Billing record created",
      });

      setDialogOpen(false);
      setFormData({
        billing_number: "",
        billing_date: new Date().toISOString().split("T")[0],
        description: "",
        amount: "",
        status: "draft",
        notes: "",
      });
      void loadData();
    } catch (error: any) {
      console.error("Error creating billing:", error);
      toast({
        title: "Error",
        description: error.message?.includes("duplicate") ? "Billing number already exists" : "Failed to create billing record",
        variant: "destructive",
      });
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();

    if (!editingRecord) return;

    try {
      const { error } = await supabase
        .from("project_billing")
        .update({
          billing_number: formData.billing_number,
          billing_date: formData.billing_date,
          description: formData.description || null,
          amount: Number(formData.amount),
          status: formData.status,
          notes: formData.notes || null,
        })
        .eq("id", editingRecord.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Billing record updated",
      });

      setEditDialogOpen(false);
      setEditingRecord(null);
      setFormData({
        billing_number: "",
        billing_date: new Date().toISOString().split("T")[0],
        description: "",
        amount: "",
        status: "draft",
        notes: "",
      });
      void loadData();
    } catch (error: any) {
      console.error("Error updating billing:", error);
      toast({
        title: "Error",
        description: "Failed to update billing record",
        variant: "destructive",
      });
    }
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();

    if (!paymentRecord || !paymentData.payment_received) {
      toast({ title: "Required", description: "Please enter payment amount", variant: "destructive" });
      return;
    }

    try {
      const totalPayment = Number(paymentRecord.payment_received) + Number(paymentData.payment_received);
      const newBalance = Number(paymentRecord.amount) - totalPayment;
      const newStatus = newBalance <= 0 ? "paid" : paymentRecord.status;

      const { error } = await supabase
        .from("project_billing")
        .update({
          payment_received: totalPayment,
          payment_date: paymentData.payment_date,
          status: newStatus,
        })
        .eq("id", paymentRecord.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment recorded",
      });

      setPaymentDialogOpen(false);
      setPaymentRecord(null);
      setPaymentData({
        payment_received: "",
        payment_date: new Date().toISOString().split("T")[0],
      });
      void loadData();
    } catch (error: any) {
      console.error("Error recording payment:", error);
      toast({
        title: "Error",
        description: "Failed to record payment",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Archive this billing record?")) return;

    try {
      const { error } = await supabase
        .from("project_billing")
        .update({ is_archived: true })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Archived",
        description: "Billing record archived",
      });
      void loadData();
    } catch (error) {
      console.error("Error deleting billing:", error);
      toast({
        title: "Error",
        description: "Failed to archive billing record",
        variant: "destructive",
      });
    }
  }

  function openEditDialog(record: BillingRecord) {
    setEditingRecord(record);
    setFormData({
      billing_number: record.billing_number,
      billing_date: record.billing_date,
      description: record.description || "",
      amount: String(record.amount),
      status: record.status,
      notes: record.notes || "",
    });
    setEditDialogOpen(true);
  }

  function openPaymentDialog(record: BillingRecord) {
    setPaymentRecord(record);
    setPaymentData({
      payment_received: "",
      payment_date: new Date().toISOString().split("T")[0],
    });
    setPaymentDialogOpen(true);
  }

  const filteredRecords = useMemo(() => {
    if (statusFilter === "all") return billingRecords;
    return billingRecords.filter((r) => r.status === statusFilter);
  }, [billingRecords, statusFilter]);

  const summary = useMemo(() => {
    const totalBilled = billingRecords.reduce((sum, r) => sum + Number(r.amount), 0);
    const totalPaid = billingRecords.reduce((sum, r) => sum + Number(r.payment_received), 0);
    const outstanding = totalBilled - totalPaid;

    return { totalBilled, totalPaid, outstanding };
  }, [billingRecords]);

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(amount);
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Billed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{formatCurrency(summary.totalBilled)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(summary.totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{formatCurrency(summary.outstanding)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Billing Records Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Billing Records
          </CardTitle>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {BILLING_STATUS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Billing
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Billing</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="billing_number">Billing Number *</Label>
                    <Input
                      id="billing_number"
                      value={formData.billing_number}
                      onChange={(e) => setFormData((prev) => ({ ...prev, billing_number: e.target.value }))}
                      placeholder="INV-2024-001"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="billing_date">Billing Date *</Label>
                    <Input
                      id="billing_date"
                      type="date"
                      value={formData.billing_date}
                      onChange={(e) => setFormData((prev) => ({ ...prev, billing_date: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Progress billing for..."
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="amount">Amount *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value: BillingRecord["status"]) => setFormData((prev) => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BILLING_STATUS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Create Billing
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading billing records...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No billing records found</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Billing #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => {
                      const statusInfo = BILLING_STATUS.find((s) => s.value === record.status);
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.billing_number}</TableCell>
                          <TableCell>{new Date(record.billing_date).toLocaleDateString()}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{record.description || "-"}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(record.amount)}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(record.payment_received)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {record.balance > 0 ? (
                              <span className="text-orange-600">{formatCurrency(record.balance)}</span>
                            ) : (
                              <span className="text-green-600">{formatCurrency(0)}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusInfo?.variant || "default"}>
                              {statusInfo?.label || record.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              {record.status !== "paid" && (
                                <Button variant="ghost" size="sm" onClick={() => openPaymentDialog(record)}>
                                  Record Payment
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(record)}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                  <path d="m15 5 4 4"/>
                                </svg>
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => void handleDelete(record.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Billing</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <Label htmlFor="edit_billing_number">Billing Number *</Label>
              <Input
                id="edit_billing_number"
                value={formData.billing_number}
                onChange={(e) => setFormData((prev) => ({ ...prev, billing_number: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="edit_billing_date">Billing Date *</Label>
              <Input
                id="edit_billing_date"
                type="date"
                value={formData.billing_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, billing_date: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="edit_amount">Amount *</Label>
              <Input
                id="edit_amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="edit_status">Status</Label>
              <Select value={formData.status} onValueChange={(value: BillingRecord["status"]) => setFormData((prev) => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_STATUS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit_notes">Notes</Label>
              <Textarea
                id="edit_notes"
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>

            <Button type="submit" className="w-full">
              Update Billing
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
              <p><span className="font-medium">Billing #:</span> {paymentRecord?.billing_number}</p>
              <p><span className="font-medium">Total Amount:</span> {formatCurrency(paymentRecord?.amount || 0)}</p>
              <p><span className="font-medium">Already Paid:</span> {formatCurrency(paymentRecord?.payment_received || 0)}</p>
              <p><span className="font-medium">Balance:</span> {formatCurrency(paymentRecord?.balance || 0)}</p>
            </div>

            <div>
              <Label htmlFor="payment_received">Payment Amount *</Label>
              <Input
                id="payment_received"
                type="number"
                step="0.01"
                value={paymentData.payment_received}
                onChange={(e) => setPaymentData((prev) => ({ ...prev, payment_received: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="payment_date">Payment Date *</Label>
              <Input
                id="payment_date"
                type="date"
                value={paymentData.payment_date}
                onChange={(e) => setPaymentData((prev) => ({ ...prev, payment_date: e.target.value }))}
                required
              />
            </div>

            <Button type="submit" className="w-full">
              Record Payment
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}