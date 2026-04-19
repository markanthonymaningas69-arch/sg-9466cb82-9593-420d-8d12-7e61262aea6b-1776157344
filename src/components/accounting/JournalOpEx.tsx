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
import { Plus, Trash2, Pencil, Filter } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type EntryType = "debit" | "credit";

export function JournalOpEx() {
  const { formatCurrency, isLocked } = useSettings();
  const [entries, setEntries] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Filters
  const [filterDate, setFilterDate] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

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

  const openEdit = (entry: any) => {
    setEditingId(entry.id);
    setForm({
      date: entry.date,
      description: entry.description || "",
      account_name: entry.account_name,
      type: entry.type as EntryType,
      category: entry.category,
      amount: entry.amount.toString(),
      project_id: entry.project_id || "office"
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this journal entry?")) {
      await accountingService.deleteJournalEntry(id);
      toast({ title: "Deleted", description: "Journal entry removed successfully." });
      loadData();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const baseAmount = parseFloat(form.amount) || 0;
    
    const entryData = {
      date: form.date,
      description: form.description,
      account_name: form.account_name,
      type: form.type,
      category: form.category,
      amount: baseAmount,
      tax_amount: 0,
      project_id: form.project_id === "office" ? null : form.project_id
    };

    if (editingId) {
      await accountingService.updateJournalEntry(editingId, entryData);
      toast({ title: "Updated", description: "Journal entry updated successfully." });
    } else {
      await accountingService.createJournalEntry(entryData);
      toast({ title: "Created", description: "Journal entry posted successfully." });
    }
    
    setDialogOpen(false);
    setEditingId(null);
    setForm({ date: new Date().toISOString().split("T")[0], description: "", account_name: "", type: "debit", category: "operational", amount: "", project_id: "office" });
    loadData();
  };

  const filteredEntries = entries.filter(entry => {
    if (filterDate && entry.date !== filterDate) return false;
    if (filterType !== "all" && entry.type !== filterType) return false;
    if (filterCategory !== "all" && entry.category !== filterCategory) return false;
    if (filterProject !== "all") {
      if (filterProject === "office" && entry.project_id !== null) return false;
      if (filterProject !== "office" && entry.project_id !== filterProject) return false;
    }
    return true;
  });

  return (
    <Card className="mt-4 border-t-0 rounded-t-none shadow-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>General Journal & OpEx</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingId(null);
              setForm({ date: new Date().toISOString().split("T")[0], description: "", account_name: "", type: "debit", category: "operational", amount: "", project_id: "office" });
            }
          }}>
            <DialogTrigger asChild>
              <Button disabled={isLocked}>
                <Plus className="h-4 w-4 mr-2" />
                New Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Journal Entry" : "Log Journal Entry"}</DialogTitle>
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
                  <Button type="submit">{editingId ? "Update Entry" : "Post to Ledger"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {showFilters && (
          <div className="grid grid-cols-4 gap-4 mb-4 p-4 bg-muted/30 rounded-lg border">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="All Types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="debit">Debit</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="All Categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="capital">Capital</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="liability">Liability</SelectItem>
                  <SelectItem value="equity">Equity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Allocation</Label>
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="All Allocations" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Allocations</SelectItem>
                  <SelectItem value="office">Main Office</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Allocation</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit (AED)</TableHead>
                <TableHead className="text-right">Credit (AED)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No journal entries found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">{entry.date}</TableCell>
                    <TableCell className="font-medium">
                      {entry.account_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={entry.type === 'debit' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}>
                        {entry.type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs capitalize">{entry.category}</Badge>
                    </TableCell>
                    <TableCell>
                      {entry.project_id ? (
                        <Badge variant="outline" className="bg-amber-50">{entry.projects?.name}</Badge>
                      ) : (
                        <Badge>Main Office</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={entry.description}>{entry.description}</TableCell>
                    <TableCell className="text-right font-semibold text-blue-600">
                      {entry.type === "debit" ? formatCurrency(entry.amount) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">
                      {entry.type === "credit" ? formatCurrency(entry.amount) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(entry)} disabled={isLocked}>
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)} disabled={isLocked}>
                          <Trash2 className="h-4 w-4 text-red-600" />
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
  );
}