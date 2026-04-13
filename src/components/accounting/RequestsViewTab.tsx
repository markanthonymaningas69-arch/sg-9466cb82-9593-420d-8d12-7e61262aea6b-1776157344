import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/contexts/SettingsProvider";
import { Banknote, ShoppingCart } from "lucide-react";

export function RequestsViewTab() {
  const { currency } = useSettings();
  const [materialRequests, setMaterialRequests] = useState<any[]>([]);
  const [cashAdvances, setCashAdvances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    const { data: materials } = await supabase
      .from('site_requests')
      .select('*, projects(name)')
      .order('request_date', { ascending: false });
    setMaterialRequests(materials || []);

    const { data: advances } = await supabase
      .from('cash_advance_requests')
      .select('*, personnel(name), projects(name)')
      .order('request_date', { ascending: false });
    setCashAdvances(advances || []);
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-blue-500 text-white';
      case 'fulfilled': return 'bg-green-500 text-white';
      case 'paid': return 'bg-green-500 text-white';
      case 'rejected': return 'bg-red-500 text-white';
      default: return 'bg-orange-500 text-white';
    }
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="cash_advance" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="cash_advance" className="flex items-center gap-2">
            <Banknote className="h-4 w-4" /> Cash Advances
          </TabsTrigger>
          <TabsTrigger value="materials" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Material Requests
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="cash_advance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Cash Advance Requests</CardTitle>
              <CardDescription>View-only monitoring of all personnel cash advances</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Personnel</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashAdvances.map(req => (
                    <TableRow key={req.id}>
                      <TableCell className="whitespace-nowrap">{req.request_date}</TableCell>
                      <TableCell className="font-medium">{req.personnel?.name || "Unknown"}</TableCell>
                      <TableCell>{req.projects?.name || "N/A"}</TableCell>
                      <TableCell className="font-bold text-primary">{currency || '$'} {req.amount}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={req.reason}>{req.reason}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(req.status)}>
                          {req.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cashAdvances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No cash advances found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="materials" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Material Requests</CardTitle>
              <CardDescription>View-only monitoring of all site material requests</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materialRequests.map(req => (
                    <TableRow key={req.id}>
                      <TableCell className="whitespace-nowrap">{new Date(req.request_date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{req.item_name}</TableCell>
                      <TableCell>{req.quantity} {req.unit}</TableCell>
                      <TableCell>{req.projects?.name || "N/A"}</TableCell>
                      <TableCell>{req.requested_by}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(req.status)}>
                          {req.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {materialRequests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No material requests found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}