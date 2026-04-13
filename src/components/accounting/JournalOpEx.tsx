import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Trash2 } from "lucide-react";

type EntryType = "debit" | "credit";

export function JournalOpEx() {
  const { formatCurrency } = useSettings();
  const [entries, setEntries] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    account_name: "",
    type: "debit" as EntryType,
    category: "operational",
    amount: "",
    project_id: "office"
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [entriesData, projectsData] = await Promise.all([
      accountingService.getJournalEntries(),
      projectService.getAll()
    ]);
    setEntries(entriesData.data || []);
    setProjects(projectsData.data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const baseAmount = parseFloat(form.amount) || 0;
    
    await accountingService.createJournalEntry({
      date: form.date,
      description: form.description,
      account_name: form.account_name,
      type: form.type,
      category: form.category,
      amount: baseAmount,
      tax_amount: 0,
      project_id: form.project_id === "office" ? null : form.project_id
    });
    
    setDialogOpen(false);
    setForm({ ...form, description: "", amount: "", account_name: "" });
    loadData();
  };

  return (
    <Card className="mt-4 border-t-0 rounded-t-none shadow-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>General Journal & OpEx</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Log Journal Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Account Name *</Label>
                  <Input placeholder="e.g. Cash, Accounts Payable, Fuel..." value={form.account_name} onChange={e => setForm({...form, account_name: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Entry Type *</Label>
                  <Select value={form.type} onValueChange={(val: "debit"|"credit") => setForm({...form, type: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Debit (Assets/Expenses)</SelectItem>
                      <SelectItem value="credit">Credit (Liabilities/Revenue)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={val => setForm({...form, category: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operational">Operational Expense (OpEx)</SelectItem>
                      <SelectItem value="capital">Capital Expense (CapEx)</SelectItem>
                      <SelectItem value="revenue">Revenue / Income</SelectItem>
                      <SelectItem value="liability">Liability / Loan</SelectItem>
                      <SelectItem value="equity">Equity / Capital</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Allocation *</Label>
                  <Select value={form.project_id} onValueChange={val => setForm({...form, project_id: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="office" className="font-bold text-primary">🏢 Main Office / General</SelectItem>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>🏗️ {p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (Base) *</Label>
                  <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Description / Memo</Label>
                  <Textarea rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} required />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit">Post to Ledger</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Allocation</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No journal entries found.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">{entry.date}</TableCell>
                    <TableCell className="font-medium">
                      {entry.account_name}
                      <div className="text-xs text-muted-foreground">{entry.category}</div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{entry.description}</TableCell>
                    <TableCell>
                      {entry.project_id ? (
                        <Badge variant="outline">{entry.projects?.name}</Badge>
                      ) : (
                        <Badge>Main Office</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-blue-600">
                      {entry.type === "debit" ? formatCurrency(entry.amount) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">
                      {entry.type === "credit" ? formatCurrency(entry.amount) : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}