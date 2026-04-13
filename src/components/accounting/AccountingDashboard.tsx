import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { accountingService } from "@/services/accountingService";
import { useSettings } from "@/contexts/SettingsProvider";
import { TrendingUp, TrendingDown, Landmark, Receipt, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

// Mock data for visualizations
const cashFlowData = [
  { name: 'Jan', income: 4000, expense: 2400 },
  { name: 'Feb', income: 3000, expense: 1398 },
  { name: 'Mar', income: 2000, expense: 9800 },
  { name: 'Apr', income: 2780, expense: 3908 },
  { name: 'May', income: 1890, expense: 4800 },
  { name: 'Jun', income: 2390, expense: 3800 },
];

const opExData = [
  { name: 'Payroll', value: 45000 },
  { name: 'Materials', value: 30000 },
  { name: 'Equipment', value: 15000 },
  { name: 'Logistics', value: 10000 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export function AccountingDashboard() {
  const { formatCurrency } = useSettings();
  const [summary, setSummary] = useState({
    totalDebits: 0,
    totalCredits: 0,
    totalTax: 0,
    balance: 0
  });
  const [loading, setLoading] = useState(true);
  const [pendingCashAdvances, setPendingCashAdvances] = useState<any[]>([]);

  useEffect(() => {
    loadSummary();
    loadPendingCashAdvances();
    
    const channel = supabase
      .channel('cash_advance_accounting_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_advance_requests' }, () => {
        loadPendingCashAdvances();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadPendingCashAdvances = async () => {
    const { data } = await supabase
      .from('cash_advance_requests')
      .select('*, personnel(name), projects(name)')
      .eq('status', 'pending');
    setPendingCashAdvances(data || []);
  };

  const loadSummary = async () => {
    setLoading(true);
    const { data } = await accountingService.getDashboardSummary();
    if (data) setSummary(data);
    setLoading(false);
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6 mt-4">
      {pendingCashAdvances.length > 0 && (
        <Alert variant="destructive" className="bg-orange-50 text-orange-900 border-orange-200">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800 font-bold">Pending Cash Advances</AlertTitle>
          <AlertDescription className="text-orange-700">
            There are {pendingCashAdvances.length} cash advance requests pending approval in the notification center. Please review them.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets/Expenses (Debits)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalDebits)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Liabilities/Revenue (Credits)</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalCredits)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Position</CardTitle>
            <Landmark className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.balance >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(summary.balance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Assets vs Liabilities</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VAT Liability (5%)</CardTitle>
            <Receipt className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(summary.totalTax)}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending to Authority</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="min-h-[300px]">
          <CardHeader>
            <CardTitle>Cash Flow Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="income" name="Income (Credits)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expenses (Debits)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="min-h-[300px]">
          <CardHeader>
            <CardTitle>OpEx Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={opExData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {opExData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}