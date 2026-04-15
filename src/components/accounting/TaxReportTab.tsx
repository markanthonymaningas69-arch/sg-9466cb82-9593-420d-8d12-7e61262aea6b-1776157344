import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSettings } from "@/contexts/SettingsProvider";
import { accountingService } from "@/services/accountingService";
import { FileText, Download, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TAX_RULES = [
  { id: 'uae', name: 'UAE VAT', rate: 0.05, code: 'VAT' }
];

export function TaxReportTab() {
  const { formatCurrency } = useSettings();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTax, setSelectedTax] = useState(TAX_RULES[0]);

  // Tax Summary
  const [summary, setSummary] = useState({
    totalInputVat: 0,   // VAT paid on expenses (Debits) - Claimable
    totalOutputVat: 0,  // VAT collected on sales (Credits) - Payable
    netVatPayable: 0    // Output - Input
  });

  useEffect(() => {
    loadData();
  }, [selectedTax]);

  const loadData = async () => {
    setLoading(true);
    // Fetch journal entries
    const { data } = await accountingService.getJournalEntries();
    
    if (data) {
      // Treat operational and revenue categories as taxable for demonstration
      const taxTransactions = data.filter((t: any) => t.category === "operational" || t.category === "revenue");
      
      let inputTax = 0;
      let outputTax = 0;
      
      const enrichedTransactions = taxTransactions.map((t: any) => {
        const calcTax = Number(t.amount) * selectedTax.rate;
        if (t.type === "debit") {
          inputTax += calcTax;
        } else if (t.type === "credit") {
          outputTax += calcTax;
        }
        return { ...t, calculated_tax: calcTax };
      });
      
      setTransactions(enrichedTransactions);
      setSummary({
        totalInputVat: inputTax,
        totalOutputVat: outputTax,
        netVatPayable: outputTax - inputTax
      });
    }
    
    setLoading(false);
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) return;
    
    const headers = ["Date", "Account / Reference", "Description", "Tax Type", "Base Amount", "Calculated Tax"];
    const csvRows = [headers.join(",")];
    
    transactions.forEach(t => {
      const typeStr = t.type === 'debit' ? `Input ${selectedTax.code}` : `Output ${selectedTax.code}`;
      const safeDesc = t.description ? t.description.replace(/"/g, '""') : "";
      
      const row = [
        t.date,
        `"${t.account_name}"`,
        `"${safeDesc}"`,
        typeStr,
        t.amount,
        t.calculated_tax
      ];
      csvRows.push(row.join(","));
    });
    
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedTax.name}_Report.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg border">
        <div>
          <h3 className="font-semibold">Taxation Rule</h3>
          <p className="text-sm text-muted-foreground">Applicable tax jurisdiction for your reports</p>
        </div>
        <div className="text-right">
          <div className="font-medium">{selectedTax.name}</div>
          <div className="text-sm text-muted-foreground">Standard Rate ({(selectedTax.rate * 100).toFixed(1)}%)</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-800">Total Input {selectedTax.code}</CardTitle>
            <CardDescription>Tax Paid on Purchases (Claimable)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{formatCurrency(summary.totalInputVat)}</div>
          </CardContent>
        </Card>
        
        <Card className="border-orange-200 bg-orange-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Total Output {selectedTax.code}</CardTitle>
            <CardDescription>Tax Collected on Sales (Payable)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{formatCurrency(summary.totalOutputVat)}</div>
          </CardContent>
        </Card>
        
        <Card className={`border-2 ${summary.netVatPayable > 0 ? 'border-destructive/50 bg-destructive/5' : 'border-primary/50 bg-primary/5'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Net {selectedTax.code} Payable
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
            <CardTitle>{selectedTax.name} Report</CardTitle>
            <CardDescription>Detailed ledger of all taxable transactions</CardDescription>
          </div>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV for Authority
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
                  <TableHead>Tax Type</TableHead>
                  <TableHead className="text-right">Base Amount</TableHead>
                  <TableHead className="text-right font-bold">{(selectedTax.rate * 100).toFixed(1)}% {selectedTax.code} Amount</TableHead>
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
                          {t.type === 'debit' ? `Input ${selectedTax.code}` : `Output ${selectedTax.code}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(t.amount)}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${
                        t.type === 'debit' ? 'text-emerald-600' : 'text-orange-600'
                      }`}>
                        {formatCurrency(t.calculated_tax)}
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