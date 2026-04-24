import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useSettings } from "@/contexts/SettingsProvider";
import { accountingService } from "@/services/accountingService";
import { projectService } from "@/services/projectService";
import { personnelService } from "@/services/personnelService";
import { Plus, Receipt, CheckCircle, Trash2, Pencil, Filter } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/router";

export function LiquidationsTab() {
  const { formatCurrency, isLocked } = useSettings();
  const router = useRouter();
  const [liquidations, setLiquidations] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filters
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    personnel_id: "",
    project_id: "office",
    advance_amount: "",
    actual_amount: "",
    particulars: "",
    status: "pending",
    receipt_attached: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [liqData, pData, persData] = await Promise.all([
      accountingService.getLiquidations(),
      projectService.getAll(),
      personnelService.getAll()
    ]);
    
    // Map personnel names to liquidations
    const formattedLiq = (liqData.data || []).map((l: any) => {
      const person = persData.data?.find(p => p.id === l.personnel_id);
      const project = pData.data?.find(p => p.id === l.project_id);
      return {
        ...l,
        personnel_name: person ? person.name : "Unknown",
        project_name: project ? project.name : "Main Office"
      };
    });
    
    setLiquidations(formattedLiq);
    setProjects(pData.data || []);
    setPersonnel(persData.data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const person = personnel.find((item) => item.id === form.personnel_id);
    const submittedBy = person ? person.name : "Unknown Employee";

    const payload = {
      date: form.date,
      personnel_id: form.personnel_id,
      project_id: form.project_id === "office" ? null : form.project_id,
      advance_amount: parseFloat(form.advance_amount) || 0,
      actual_amount: parseFloat(form.actual_amount) || 0,
      purpose: form.particulars,
      status: form.status,
      receipt_attached: form.receipt_attached,
      submitted_by: submittedBy,
    };

    const response = editingId
      ? await accountingService.updateLiquidation(editingId, payload)
      : await accountingService.createLiquidation(payload);

    if (response.error) {
      toast({
        title: "Unable to save",
        description: response.error.message || "Approval Center routing failed.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: editingId ? "Updated" : "Submitted",
      description: editingId
        ? "Record updated and synced with Approval Center."
        : "Liquidation request sent to Approval Center.",
    });

    setDialogOpen(false);
    setEditingId(null);
    setForm({
      date: new Date().toISOString().split("T")[0],
      personnel_id: "",
      project_id: "office",
      advance_amount: "",
      actual_amount: "",
      particulars: "",
      status: "pending",
      receipt_attached: false,
    });
    loadData();
  };

  const handleApprove = async (id: string) => {
    await accountingService.updateLiquidation(id, { status: "approved" });
    toast({ title: "Approved", description: "Liquidation cleared." });
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this record?")) {
      await accountingService.deleteLiquidation(id);
      toast({ title: "Deleted", description: "Record removed successfully." });
      loadData();
    }
  };

  const openEdit = (liq: any) => {
    setEditingId(liq.id);
    setForm({
      date: liq.date,
      personnel_id: liq.personnel_id || "",
      project_id: liq.project_id || "office",
      advance_amount: liq.advance_amount?.toString() || "",
      actual_amount: liq.actual_amount?.toString() || "",
      particulars: liq.purpose || liq.particulars || "",
      status: liq.status || "pending",
      receipt_attached: !!liq.receipt_attached
    });
    setDialogOpen(true);
  };

  const filteredLiquidations = liquidations.filter(liq => {
    if (filterDate && liq.date !== filterDate) return false;
    if (filterStatus !== "all" && liq.status !== filterStatus) return false;
    if (filterAssignee !== "all" && liq.personnel_id !== filterAssignee) return false;
    return true;
  });

  return (
    <Card className="mt-4 border-t-0 rounded-t-none shadow-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Cash Advances & Liquidations</CardTitle>
          <CardDescription>Track cash given to personnel vs actual spent receipts</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingId(null);
              setForm({
                date: new Date().toISOString().split("T")[0],
                personnel_id: "",
                project_id: "office",
                advance_amount: "",
                actual_amount: "",
                particulars: "",
                status: "pending",
                receipt_attached: false
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button disabled={isLocked}>
                <Plus className="h-4 w-4 mr-2" />
                Log
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Record" : "Log Cash Advance or Liquidation"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Employee / Assignee</Label>
                    <Select value={form.personnel_id} onValueChange={val => setForm({...form, personnel_id: val})} required>
                      <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                      <SelectContent>
                        {personnel.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Project Allocation</Label>
                    <Select value={form.project_id} onValueChange={val => setForm({...form, project_id: val})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="office" className="font-bold text-primary">🏢 Office / General</SelectItem>
                        {projects.map(p => <SelectItem key={p.id} value={p.id}>🏗️ {p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={val => setForm({...form, status: val})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending Liquidation</SelectItem>
                        <SelectItem value="approved">Approved & Cleared</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Approval Status</Label>
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      Pending requests are reviewed in Approval Center. Approved records remain read-only here.
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cash Advance Given (AED)</Label>
                    <Input type="number" step="0.01" value={form.advance_amount} onChange={e => setForm({...form, advance_amount: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Actual Amount Spent (AED)</Label>
                    <Input type="number" step="0.01" value={form.actual_amount} onChange={e => setForm({...form, actual_amount: e.target.value})} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Particulars / Purpose</Label>
                    <Textarea rows={2} value={form.particulars} onChange={e => setForm({...form, particulars: e.target.value})} required />
                  </div>
                  <div className="flex items-center space-x-2 col-span-2">
                    <Checkbox 
                      id="receipt" 
                      checked={form.receipt_attached} 
                      onCheckedChange={(val) => setForm({...form, receipt_attached: !!val})} 
                    />
                    <label htmlFor="receipt" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Physical receipts attached / submitted
                    </label>
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit">{editingId ? "Update Record" : "Save Record"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {showFilters && (
          <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-muted/30 rounded-lg border">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Assignee</Label>
              <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="All Personnel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Personnel</SelectItem>
                  {personnel.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved & Cleared</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <div className="border rounded-md">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Allocation</TableHead>
                <TableHead className="text-right">Advanced</TableHead>
                <TableHead className="text-right">Actual Spent</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="text-center">Receipt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredLiquidations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No liquidations recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLiquidations.map(liq => {
                  const variance = liq.advance_amount - (liq.actual_amount || 0);
                  const isNegative = variance < 0; // Means they spent more than advanced (company owes them)
                  
                  return (
                    <TableRow key={liq.id}>
                      <TableCell className="whitespace-nowrap">{liq.date}</TableCell>
                      <TableCell className="font-medium">{liq.personnel_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={liq.purpose || liq.particulars}>{liq.purpose || liq.particulars}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{liq.project_name}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-blue-600">
                        {formatCurrency(liq.advance_amount)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-purple-600">
                        {liq.actual_amount ? formatCurrency(liq.actual_amount) : "-"}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${variance === 0 ? 'text-gray-500' : isNegative ? 'text-orange-500' : 'text-emerald-600'}`}>
                        {variance === 0 ? "Settled" : isNegative ? `Owe: ${formatCurrency(Math.abs(variance))}` : `Return: ${formatCurrency(variance)}`}
                      </TableCell>
                      <TableCell className="text-center">
                        {liq.receipt_attached ? (
                          <Receipt className="h-4 w-4 mx-auto text-green-600" />
                        ) : (
                          <span className="text-muted-foreground text-xs">No</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {liq.status === "approved" ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle className="h-3 w-3 mr-1" /> Cleared
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => void router.push("/approval-center")}
                            disabled={isLocked}
                          >
                            Approval Center
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(liq)} disabled={isLocked}>
                            <Pencil className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(liq.id)} disabled={isLocked}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}