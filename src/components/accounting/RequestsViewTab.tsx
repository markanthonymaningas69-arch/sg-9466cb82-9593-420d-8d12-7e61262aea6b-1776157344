import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/contexts/SettingsProvider";
import { Banknote, ShoppingCart } from "lucide-react";
import { projectService } from "@/services/projectService";

export function RequestsViewTab() {
  const { currency } = useSettings();
  const [materialRequests, setMaterialRequests] = useState<any[]>([]);
  const [cashAdvances, setCashAdvances] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState("all");
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
    
    const { data: pData } = await projectService.getAll();
    setProjects(pData || []);
    
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

  const filteredMaterials = selectedProject === "all" ? materialRequests : materialRequests.filter(r => r.project_id === selectedProject);
  const filteredCashAdvances = selectedProject === "all" ? cashAdvances : cashAdvances.filter(r => r.project_id === selectedProject);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="cash_advance" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="cash_advance" className="flex items-center gap-2">
              <Banknote className="h-4 w-4" /> Cash Advances
            </TabsTrigger>
            <TabsTrigger value="materials" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Site Requests
            </TabsTrigger>
          </TabsList>
          
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-full sm:w-[250px]">
              <SelectValue placeholder="Filter by Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
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
                  {filteredCashAdvances.map(req => (
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
                  {filteredCashAdvances.length === 0 && (
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
                  {filteredMaterials.map(req => (
                    <TableRow key={req.id}>
                      <TableCell className="whitespace-nowrap">{new Date(req.request_date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">
                        <div>{req.item_name}</div>
                        <div className="text-xs text-muted-foreground">{req.request_type || 'Materials'}</div>
                      </TableCell>
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
                  {filteredMaterials.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No site requests found.</TableCell>
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