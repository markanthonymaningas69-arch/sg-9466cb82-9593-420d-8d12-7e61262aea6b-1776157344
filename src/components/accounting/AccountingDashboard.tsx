import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { accountingService } from "@/services/accountingService";
import { useSettings } from "@/contexts/SettingsProvider";
import { TrendingUp, TrendingDown, Landmark, Receipt, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
          <CardContent className="flex items-center justify-center text-muted-foreground">
            Chart visualization will be activated here
          </CardContent>
        </Card>
        <Card className="min-h-[300px]">
          <CardHeader>
            <CardTitle>OpEx Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center text-muted-foreground">
            Pie chart visualization will be activated here
          </CardContent>
        </Card>
      </div>
    </div>
  );
}