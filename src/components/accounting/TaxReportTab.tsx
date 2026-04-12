import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSettings } from "@/contexts/SettingsProvider";
import { accountingService } from "@/services/accountingService";
import { FileText, Download, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TaxReportTab() {
  const { formatCurrency } = useSettings();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tax Summary
  const [summary, setSummary] = useState({
    totalInputVat: 0,   // VAT paid on expenses (Debits) - Claimable
    totalOutputVat: 0,  // VAT collected on sales (Credits) - Payable
    netVatPayable: 0    // Output - Input
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    // Fetch journal entries
    const { data } = await accountingService.getJournalEntries();
    
    if (data) {
      // Only keep transactions that have VAT applied
      const taxTransactions = data.filter((t: any) => t.tax_amount && t.tax_amount > 0);
      
      let inputVat = 0;
      let outputVat = 0;
      
      taxTransactions.forEach((t: any) => {
        if (t.type === "debit") {
          inputVat += Number(t.tax_amount); // Paid to suppliers
        } else if (t.type === "credit") {
          outputVat += Number(t.tax_amount); // Collected from clients
        }
      });
      
      setTransactions(taxTransactions);
      setSummary({
        totalInputVat: inputVat,
        totalOutputVat: outputVat,
        netVatPayable: outputVat - inputVat
      });
    }
    
    setLoading(false);
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-800">Total Input VAT (5%)</CardTitle>
            <CardDescription>VAT Paid on Purchases (Claimable)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{formatCurrency(summary.totalInputVat)}</div>
          </CardContent>
        </Card>
        
        <Card className="border-orange-200 bg-orange-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Total Output VAT (5%)</CardTitle>
            <CardDescription>VAT Collected on Sales (Payable)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{formatCurrency(summary.totalOutputVat)}</div>
          </CardContent>
        </Card>
        
        <Card className={`border-2 ${summary.netVatPayable > 0 ? 'border-destructive/50 bg-destructive/5' : 'border-primary/50 bg-primary/5'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Net VAT to FTA
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
            <CardDescription>
              {summary.netVatPayable > 0 ? "Amount owed to Authority" : "Amount refundable / carried forward"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${summary.netVatPayable > 0 ? 'text-destructive' : 'text-primary'}`}>
              {formatCurrency(Math.abs(summary.netVatPayable))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>UAE VAT Report (FTA Format)</CardTitle>
            <CardDescription>Detailed ledger of all 5% taxable transactions</CardDescription>
          </div>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV for FTA
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference / Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>VAT Type</TableHead>
                  <TableHead className="text-right">Base Amount</TableHead>
                  <TableHead className="text-right font-bold">5% VAT Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No taxable transactions recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap">{t.date}</TableCell>
                      <TableCell className="font-medium">{t.account_name}</TableCell>
                      <TableCell className="max-w-[300px] truncate">{t.description}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          t.type === 'debit' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {t.type === 'debit' ? 'Input VAT (Purchase)' : 'Output VAT (Sale)'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(t.amount)}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${
                        t.type === 'debit' ? 'text-emerald-600' : 'text-orange-600'
                      }`}>
                        {formatCurrency(t.tax_amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}