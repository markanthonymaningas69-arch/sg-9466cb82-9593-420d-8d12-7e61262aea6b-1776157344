import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { accountingService } from "@/services/accountingService";
import { projectService } from "@/services/projectService";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Transaction = Database["public"]["Tables"]["accounting_transactions"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];

export default function Accounting() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0, pending: 0, completed: 0 });
  const [formData, setFormData] = useState({
    project_id: "",
    type: "income" as const,
    amount: "",
    description: "",
    transaction_date: new Date().toISOString().split("T")[0],
    category: "",
    status: "pending" as const
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [transactionData, projectsData, summaryData] = await Promise.all([
      accountingService.getAll(),
      projectService.getAll(),
      accountingService.getSummary()
    ]);
    setTransactions(transactionData.data || []);
    setProjects(projectsData.data || []);
    setSummary(summaryData.data || { totalIncome: 0, totalExpense: 0, pending: 0, completed: 0 });
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const transactionData = {
      ...formData,
      amount: parseFloat(formData.amount),
      project_id: formData.project_id || null
    };

    if (editingTransaction) {
      await accountingService.update(editingTransaction.id, transactionData);
    } else {
      await accountingService.create(transactionData);
    }

    setDialogOpen(false);
    resetForm();
    loadData();
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      project_id: transaction.project_id || "",
      type: transaction.type,
      amount: transaction.amount.toString(),
      description: transaction.description || "",
      transaction_date: transaction.transaction_date,
      category: transaction.category || "",
      status: transaction.status
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      await accountingService.delete(id);
      loadData();
    }
  };

  const resetForm = () => {
    setFormData({
      project_id: "",
      type: "income",
      amount: "",
      description: "",
      transaction_date: new Date().toISOString().split("T")[0],
      category: "",
      status: "pending"
    });
    setEditingTransaction(null);
  };

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800"
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-heading font-bold">Accounting</h1>
            <p className="text-muted-foreground mt-1">Track income and expenses</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                New Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingTransaction ? "Edit Transaction" : "Create New Transaction"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Type *</Label>
                    <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount ($) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project_id">Project</Label>
                    <Select value={formData.project_id} onValueChange={(value) => setFormData({ ...formData, project_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">General</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="e.g., Materials, Labor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transaction_date">Date *</Label>
                    <Input
                      id="transaction_date"
                      type="date"
                      value={formData.transaction_date}
                      onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingTransaction ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Income</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">${summary.totalIncome.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">${summary.totalExpense.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                ${(summary.totalIncome - summary.totalExpense).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">${summary.pending.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{new Date(transaction.transaction_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={transaction.type === "income" ? "default" : "secondary"}>
                        {transaction.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{transaction.category || "-"}</TableCell>
                    <TableCell>{transaction.projects?.name || "General"}</TableCell>
                    <TableCell className="max-w-xs truncate">{transaction.description || "-"}</TableCell>
                    <TableCell className={transaction.type === "income" ? "text-success font-semibold" : "text-destructive font-semibold"}>
                      ${transaction.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[transaction.status]}>
                        {transaction.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(transaction)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(transaction.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}