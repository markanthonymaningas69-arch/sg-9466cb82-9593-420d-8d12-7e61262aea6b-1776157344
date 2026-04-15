import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { accountingService } from "@/services/accountingService";
import { useSettings } from "@/contexts/SettingsProvider";
import { TrendingUp, TrendingDown, Landmark, Receipt, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ef4444', '#f59e0b'];

export function AccountingDashboard({ onTabChange }: { onTabChange?: (tab: string) => void }) {
  const { formatCurrency } = useSettings();
  const [summary, setSummary] = useState({
    totalDebits: 0,
    totalCredits: 0,
    totalTax: 0,
    balance: 0
  });
  const [cashFlowData, setCashFlowData] = useState<any[]>([]);
  const [opExData, setOpExData] = useState<any[]>([]);
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
    const { data } = await accountingService.getJournalEntries();
    
    if (data) {
      let totalDebits = 0;
      let totalCredits = 0;
      let totalTax = 0;
      
      const cfMap: Record<string, { name: string, dateVal: number, income: number, expense: number }> = {};
      const opexMap: Record<string, number> = {};

      data.forEach(d => {
        const amt = Number(d.amount);
        if (d.type === 'debit') totalDebits += amt;
        if (d.type === 'credit') totalCredits += amt;
        totalTax += Number(d.tax_amount || 0);

        // Cash flow grouping by Month-Year
        const date = new Date(d.date);
        const month = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear();
        const key = `${month} ${year}`;
        
        if (!cfMap[key]) cfMap[key] = { name: key, dateVal: date.getTime(), income: 0, expense: 0 };
        
        if (d.type === 'credit' || d.category === 'revenue') cfMap[key].income += amt;
        if (d.type === 'debit' || d.category === 'operational' || d.category === 'capital') cfMap[key].expense += amt;
        
        // OpEx Breakdown
        if (d.category === 'operational') {
          opexMap[d.account_name] = (opexMap[d.account_name] || 0) + amt;
        }
      });
      
      setSummary({ totalDebits, totalCredits, totalTax, balance: totalDebits - totalCredits });
      
      const sortedCfData = Object.values(cfMap).sort((a, b) => a.dateVal - b.dateVal);
      setCashFlowData(sortedCfData);
      
      setOpExData(Object.entries(opexMap).map(([name, value]) => ({ name, value })));
    }
    
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
              {new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(summary.balance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Assets vs Liabilities</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors border-orange-200" onClick={() => onTabChange && onTabChange('tax')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VAT Liability (5%)</CardTitle>
            <Receipt className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(summary.totalTax)}
            </div>
            <p className="text-xs text-orange-600/80 mt-1 font-medium">Click to view Tax Module →</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="min-h-[300px]">
          <CardHeader>
            <CardTitle>Cash Flow Trend (Actual)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {cashFlowData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">No transaction data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlowData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `AED ${value}`} />
                  <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(value)} />
                  <Legend />
                  <Bar dataKey="income" name="Income (Credits)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Expenses (Debits)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="min-h-[300px]">
          <CardHeader>
            <CardTitle>OpEx Breakdown (Actual)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {opExData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">No operational expenses recorded</div>
            ) : (
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
                  <RechartsTooltip formatter={(value: number) => new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(value)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}