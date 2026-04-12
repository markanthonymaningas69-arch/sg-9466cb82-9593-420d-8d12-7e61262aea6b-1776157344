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
import { Plus, Receipt, CheckCircle, Clock } from "lucide-react";

export function LiquidationsTab() {
  const { formatCurrency } = useSettings();
  const [liquidations, setLiquidations] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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
    await accountingService.createLiquidation({
      ...form,
      advance_amount: parseFloat(form.advance_amount) || 0,
      actual_amount: parseFloat(form.actual_amount) || 0,
      project_id: form.project_id === "office" ? null : form.project_id
    });
    
    setDialogOpen(false);
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
    loadData();
  };

  const handleApprove = async (id: string) => {
    await accountingService.updateLiquidation(id, { status: "approved" });
    loadData();
  };

  return (
    <Card className="mt-4 border-t-0 rounded-t-none shadow-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Cash Advances & Liquidations</CardTitle>
          <CardDescription>Track cash given to personnel vs actual spent receipts</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Log Advance
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Log Cash Advance or Liquidation</DialogTitle>
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
                  <Label>Cash Advance Given (₱)</Label>
                  <Input type="number" step="0.01" value={form.advance_amount} onChange={e => setForm({...form, advance_amount: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Actual Amount Spent (₱)</Label>
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
                <Button type="submit">Save Record</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : liquidations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No liquidations recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                liquidations.map(liq => {
                  const variance = liq.advance_amount - (liq.actual_amount || 0);
                  const isNegative = variance < 0; // Means they spent more than advanced (company owes them)
                  
                  return (
                    <TableRow key={liq.id}>
                      <TableCell className="whitespace-nowrap">{liq.date}</TableCell>
                      <TableCell className="font-medium">{liq.personnel_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={liq.particulars}>{liq.particulars}</TableCell>
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
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleApprove(liq.id)}>
                            <Clock className="h-3 w-3 mr-1" /> Approve
                          </Button>
                        )}
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