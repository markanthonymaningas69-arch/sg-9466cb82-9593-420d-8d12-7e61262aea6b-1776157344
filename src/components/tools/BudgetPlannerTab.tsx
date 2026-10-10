import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createBudgetPlan,
  getBudgetPlans,
  logExpense,
  getBudgetExpenses,
  deleteBudgetExpense,
  deleteBudgetPlan,
  updateBudgetPlan,
  updateBudgetPlanStatus,
  type BudgetPlanWithDetails,
  type BudgetExpense,
} from "@/services/budgetService";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Package,
  ChevronRight,
  Wallet,
  PiggyBank,
  Pencil,
  BarChart3,
} from "lucide-react";

const COLORS = ["#E1662A", "#0F766E", "#1E40AF", "#7C3AED", "#BE185D", "#D97706", "#059669", "#DC2626"];

export function BudgetPlannerTab() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<BudgetPlanWithDetails[]>([]);
  const [expenses, setExpenses] = useState<BudgetExpense[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [newPlan, setNewPlan] = useState({
    name: "",
    description: "",
    categories: [{ category_name: "", allocated_amount: "" }],
  });

  const [editingPlan, setEditingPlan] = useState<{
    id: string;
    name: string;
    description: string;
    categories: { category_name: string; allocated_amount: string }[];
  } | null>(null);

  const [newExpense, setNewExpense] = useState({
    budgetCategoryId: "",
    expenseDate: new Date().toISOString().split("T")[0],
    description: "",
    amount: "",
    vendor: "",
    receiptNumber: "",
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const plansData = await getBudgetPlans();
      setPlans(plansData);
      if (plansData.length > 0 && !selectedPlanId) {
        setSelectedPlanId(plansData[0].id);
      }
      const allExpenses = await getBudgetExpenses();
      setExpenses(allExpenses);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  const selectedPlan = useMemo(() => plans.find((p) => p.id === selectedPlanId), [plans, selectedPlanId]);

  const planExpenses = useMemo(
    () => expenses.filter((e) => e.budget_plan_id === selectedPlanId),
    [expenses, selectedPlanId]
  );

  const isLastDayOfMonth = useMemo(() => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return today.getDate() === lastDay;
  }, []);

  const monthlySavings = useMemo(() => {
    if (!selectedPlan || !isLastDayOfMonth) return null;
    const monthlyBudget = Number(selectedPlan.total_budget) / 12;
    return Math.max(0, monthlyBudget - selectedPlan.monthly_spent);
  }, [selectedPlan, isLastDayOfMonth]);

  async function handleCreatePlan() {
    try {
      const cats = newPlan.categories
        .filter((c) => c.category_name && c.allocated_amount)
        .map((c) => ({
          category_name: c.category_name,
          allocated_amount: Number(c.allocated_amount),
        }));
      await createBudgetPlan(
        newPlan.name,
        cats.reduce((s, c) => s + c.allocated_amount, 0),
        newPlan.description || null,
        cats
      );
      toast({ title: "Budget plan created" });
      setCreateOpen(false);
      setNewPlan({
        name: "",
        description: "",
        categories: [{ category_name: "", allocated_amount: "" }],
      });
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function handleUpdatePlan() {
    if (!editingPlan) return;
    try {
      const cats = editingPlan.categories
        .filter((c) => c.category_name && c.allocated_amount)
        .map((c) => ({
          category_name: c.category_name,
          allocated_amount: Number(c.allocated_amount),
        }));
      const totalBudget = cats.reduce((s, c) => s + c.allocated_amount, 0);
      await updateBudgetPlan(
        editingPlan.id,
        editingPlan.name,
        totalBudget,
        editingPlan.description || null,
        cats
      );
      toast({ title: "Budget plan updated" });
      setEditOpen(false);
      setEditingPlan(null);
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  function openEdit(plan: BudgetPlanWithDetails) {
    setEditingPlan({
      id: plan.id,
      name: plan.name,
      description: plan.description || "",
      categories: plan.categories.map((c) => ({
        category_name: c.category_name,
        allocated_amount: String(c.allocated_amount),
      })),
    });
    setEditOpen(true);
  }

  function addEditCategoryField() {
    if (!editingPlan) return;
    setEditingPlan({
      ...editingPlan,
      categories: [...editingPlan.categories, { category_name: "", allocated_amount: "" }],
    });
  }

  function updateEditCategory(index: number, field: string, value: string) {
    if (!editingPlan) return;
    const cats = [...editingPlan.categories];
    cats[index] = { ...cats[index], [field]: value };
    setEditingPlan({ ...editingPlan, categories: cats });
  }

  function removeEditCategory(index: number) {
    if (!editingPlan) return;
    setEditingPlan({
      ...editingPlan,
      categories: editingPlan.categories.filter((_, i) => i !== index),
    });
  }

  async function handleLogExpense() {
    if (!selectedPlanId || !newExpense.budgetCategoryId) return;
    try {
      await logExpense(
        selectedPlanId,
        newExpense.budgetCategoryId,
        newExpense.expenseDate,
        newExpense.description,
        Number(newExpense.amount),
        newExpense.vendor || null,
        newExpense.receiptNumber || null,
        newExpense.notes || null
      );
      toast({ title: "Expense logged" });
      setExpenseOpen(false);
      setNewExpense({
        budgetCategoryId: "",
        expenseDate: new Date().toISOString().split("T")[0],
        description: "",
        amount: "",
        vendor: "",
        receiptNumber: "",
        notes: "",
      });
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function handleDeleteExpense(id: string) {
    try {
      await deleteBudgetExpense(id);
      toast({ title: "Expense deleted" });
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function handleDeletePlan(id: string) {
    try {
      await deleteBudgetPlan(id);
      toast({ title: "Budget plan deleted" });
      if (selectedPlanId === id) setSelectedPlanId(null);
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  function addCategoryField() {
    setNewPlan((p) => ({
      ...p,
      categories: [...p.categories, { category_name: "", allocated_amount: "" }],
    }));
  }

  function updateCategory(index: number, field: string, value: string) {
    setNewPlan((p) => {
      const cats = [...p.categories];
      cats[index] = { ...cats[index], [field]: value };
      return { ...p, categories: cats };
    });
  }

  function removeCategory(index: number) {
    setNewPlan((p) => ({
      ...p,
      categories: p.categories.filter((_, i) => i !== index),
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Budget Planner</h2>
          <p className="text-muted-foreground">Create budgets, log expenses, and monitor spending.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Budget Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Budget Plan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Budget Name</Label>
                <Input value={newPlan.name} onChange={(e) => setNewPlan((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Office Renovation Budget" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={newPlan.description} onChange={(e) => setNewPlan((p) => ({ ...p, description: e.target.value }))} placeholder="Brief description..." rows={2} />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Budget Categories</Label>
                {newPlan.categories.map((cat, i) => (
                  <div key={i} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Input
                        value={cat.category_name}
                        onChange={(e) => updateCategory(i, "category_name", e.target.value)}
                        placeholder="Category name"
                        className="mb-1"
                      />
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        value={cat.allocated_amount}
                        onChange={(e) => updateCategory(i, "allocated_amount", e.target.value)}
                        placeholder="Amount"
                      />
                    </div>
                    {newPlan.categories.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeCategory(i)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addCategoryField} className="mt-2">
                  <Plus className="w-4 h-4 mr-1" /> Add Category
                </Button>
              </div>
              <Button onClick={handleCreatePlan} className="w-full">Create Plan</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Budget Plan</DialogTitle>
          </DialogHeader>
          {editingPlan && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Budget Name</Label>
                <Input
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan((p) => p && { ...p, name: e.target.value })}
                  placeholder="e.g. Office Renovation Budget"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingPlan.description}
                  onChange={(e) => setEditingPlan((p) => p && { ...p, description: e.target.value })}
                  placeholder="Brief description..."
                  rows={2}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Budget Categories</Label>
                {editingPlan.categories.map((cat, i) => (
                  <div key={i} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Input
                        value={cat.category_name}
                        onChange={(e) => updateEditCategory(i, "category_name", e.target.value)}
                        placeholder="Category name"
                        className="mb-1"
                      />
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        value={cat.allocated_amount}
                        onChange={(e) => updateEditCategory(i, "allocated_amount", e.target.value)}
                        placeholder="Amount"
                      />
                    </div>
                    {editingPlan.categories.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeEditCategory(i)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addEditCategoryField} className="mt-2">
                  <Plus className="w-4 h-4 mr-1" /> Add Category
                </Button>
              </div>
              <Button onClick={handleUpdatePlan} className="w-full">Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-3 row-span-5 space-y-6">
          {selectedPlan ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="w-3.5 h-3.5 text-primary shrink-0" />
                      <p className="text-[11px] text-muted-foreground leading-tight">Total Budget</p>
                    </div>
                    <p className="text-sm font-semibold leading-tight truncate">{formatCurrency(Number(selectedPlan.total_budget))}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown className="w-3.5 h-3.5 text-destructive shrink-0" />
                      <p className="text-[11px] text-muted-foreground leading-tight">Spent</p>
                    </div>
                    <p className="text-sm font-semibold leading-tight truncate">{formatCurrency(selectedPlan.total_spent)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <p className="text-[11px] text-muted-foreground leading-tight">Remaining</p>
                    </div>
                    <p className="text-sm font-semibold leading-tight truncate">{formatCurrency(selectedPlan.total_remaining)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <p className="text-[11px] text-muted-foreground leading-tight">Utilization</p>
                    </div>
                    <p className="text-sm font-semibold leading-tight truncate">{selectedPlan.utilization_percent.toFixed(1)}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <p className="text-[11px] text-muted-foreground leading-tight">This Month</p>
                    </div>
                    <p className="text-sm font-semibold leading-tight truncate">{formatCurrency(selectedPlan.monthly_spent)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <PiggyBank className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <p className="text-[11px] text-muted-foreground leading-tight">Savings</p>
                    </div>
                    <p className="text-sm font-semibold leading-tight truncate">
                      {monthlySavings !== null ? formatCurrency(monthlySavings) : "Pending (month end)"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="expenses">Expenses</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Categories</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Allocated</TableHead>
                            <TableHead className="text-right">Spent</TableHead>
                            <TableHead className="text-right">Remaining</TableHead>
                            <TableHead className="w-[120px]">Progress</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedPlan.categories.map((cat) => {
                            const pct = Number(cat.allocated_amount) > 0
                              ? ((cat.total_spent || 0) / Number(cat.allocated_amount)) * 100
                              : 0;
                            return (
                              <TableRow key={cat.id}>
                                <TableCell className="font-medium">{cat.category_name}</TableCell>
                                <TableCell className="text-right">{formatCurrency(Number(cat.allocated_amount))}</TableCell>
                                <TableCell className="text-right">{formatCurrency(cat.total_spent || 0)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(cat.remaining || 0)}</TableCell>
                                <TableCell>
                                  <Progress value={Math.min(pct, 100)} className="h-1.5" />
                                  <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="expenses" className="space-y-4 mt-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium">Recent Expenses</h3>
                    <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="w-4 h-4 mr-1" /> Log Expense
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Log Expense</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                          <div className="space-y-2">
                            <Label>Category</Label>
                            <Select
                              value={newExpense.budgetCategoryId}
                              onValueChange={(v) => setNewExpense((e) => ({ ...e, budgetCategoryId: v }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedPlan.categories.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.category_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Date</Label>
                              <Input
                                type="date"
                                value={newExpense.expenseDate}
                                onChange={(e) => setNewExpense((p) => ({ ...p, expenseDate: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Amount</Label>
                              <Input
                                type="number"
                                value={newExpense.amount}
                                onChange={(e) => setNewExpense((p) => ({ ...p, amount: e.target.value }))}
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                              value={newExpense.description}
                              onChange={(e) => setNewExpense((p) => ({ ...p, description: e.target.value }))}
                              placeholder="Expense description"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Vendor</Label>
                              <Input
                                value={newExpense.vendor}
                                onChange={(e) => setNewExpense((p) => ({ ...p, vendor: e.target.value }))}
                                placeholder="Vendor name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Receipt #</Label>
                              <Input
                                value={newExpense.receiptNumber}
                                onChange={(e) => setNewExpense((p) => ({ ...p, receiptNumber: e.target.value }))}
                                placeholder="Receipt number"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                              value={newExpense.notes}
                              onChange={(e) => setNewExpense((p) => ({ ...p, notes: e.target.value }))}
                              placeholder="Additional notes..."
                              rows={2}
                            />
                          </div>
                          <Button onClick={handleLogExpense} className="w-full">Log Expense</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {planExpenses.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                No expenses logged yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            planExpenses.map((exp) => (
                              <TableRow key={exp.id}>
                                <TableCell className="text-xs">{exp.expense_date}</TableCell>
                                <TableCell className="max-w-[200px] truncate">{exp.description}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-[10px]">
                                    {exp.category_name || "Unknown"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(Number(exp.amount))}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteExpense(exp.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(selectedPlan)}
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  Edit Plan
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeletePlan(selectedPlan.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1 text-destructive" />
                  Delete Plan
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateBudgetPlanStatus(selectedPlan.id, selectedPlan.status === "active" ? "completed" : "active").then(() => loadData())}
                >
                  Mark {selectedPlan.status === "active" ? "Completed" : "Active"}
                </Button>
              </div>
            </>
          ) : (
            <Card className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Select a budget plan to view details</p>
              </div>
            </Card>
          )}
        </div>

        <Card className="col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Budget Plans</CardTitle>
          </CardHeader>
          <CardContent>
            {plans.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No budget plans yet.</div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`shrink-0 w-[220px] text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors ${selectedPlanId === plan.id ? "bg-muted border-primary" : "border-border"}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate">{plan.name}</p>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {plan.categories.length} categories
                    </p>
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="truncate">{formatCurrency(plan.total_spent)}</span>
                        <span className="truncate">{formatCurrency(Number(plan.total_budget))}</span>
                      </div>
                      <Progress value={Math.min(plan.utilization_percent, 100)} className="h-1.5" />
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge variant={plan.status === "active" ? "default" : "secondary"} className="text-[10px]">
                        {plan.status}
                      </Badge>
                      <span className={`text-[10px] ${plan.utilization_percent > 90 ? "text-destructive" : "text-muted-foreground"}`}>
                        {plan.utilization_percent.toFixed(1)}%
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}