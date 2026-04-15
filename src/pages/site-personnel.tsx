import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { siteService } from "@/services/siteService";
import { projectService } from "@/services/projectService";
import { personnelService } from "@/services/personnelService";
import { Plus, Pencil, Trash2, Archive, Users, Truck, ClipboardList, ArrowUp, ArrowDown, Check, ArrowUpDown, ShoppingCart, Banknote, Wrench, Eye, Activity, List as ListIcon, CheckCircle2, AlertCircle, Warehouse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from "recharts";

type Project = { id: string; name: string; location: string; status: string };
type Personnel = { id: string; name: string; role: string; daily_rate: number; overtime_rate: number; created_source?: string; updated_source?: string };
type SiteAttendance = { id: string; personnel_id: string; project_id: string; date: string; status: string; hours_worked: number; overtime_hours?: number; bom_scope_id?: string; notes: string; personnel?: { name: string; role: string; daily_rate: number; overtime_rate: number } };
type AttendanceRow = { personnel_id: string; name: string; role: string; daily_rate: number; overtime_rate: number; status: string; hours_worked: number; overtime_hours: number; bom_scope_id: string | null };
type Delivery = { id: string; project_id: string; delivery_date: string; item_name: string; quantity: number; unit: string; supplier: string; received_by: string; status: string; notes: string; receipt_number?: string };
type ScopeOfWork = { id: string; name: string; description?: string; order_number: number; completion_percentage?: number; status?: string; bom_id: string };
type MaterialConsumption = { id: string; project_id: string; bom_scope_id: string | null; date_used: string; item_name: string; quantity: number; unit: string; recorded_by: string; notes: string; bom_scope_of_work?: { name: string } };
type CashAdvance = { id: string; personnel_id: string; project_id: string; amount: number; reason: string; status: string; request_date: string; form_number?: string; personnel?: { name: string; role: string } };

const STANDARD_ROLES = ["Admin", "Carpenter", "Electrician", "Helper", "Mason", "Plumber", "Skilled", "Steelman", "Tile Mason", "Welder"];

export default function SitePersonnel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [activeTab, setActiveTab] = useState("manpower");
  
  const todayStr = new Date().toISOString().split("T")[0];
  const [attendanceDate, setAttendanceDate] = useState<string>(todayStr);
  const [deliveriesDate, setDeliveriesDate] = useState<string>(todayStr);
  const [deliverySupplierFilter, setDeliverySupplierFilter] = useState<string>("all");
  const [scopeDate, setScopeDate] = useState<string>(todayStr);
  
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  
  // Site Attendance (Roll Call)
  const [attendanceList, setAttendanceList] = useState<AttendanceRow[]>([]);
  const [historicalAttendance, setHistoricalAttendance] = useState<Record<string, any[]>>({});
  const [attendanceMonthFilter, setAttendanceMonthFilter] = useState<string>("");
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [addManpowerDialogOpen, setAddManpowerDialogOpen] = useState(false);
  const [projectPersonnelList, setProjectPersonnelList] = useState<Personnel[]>([]);
  const [editingPersonnelId, setEditingPersonnelId] = useState<string | null>(null);
  const [manualRoles, setManualRoles] = useState<Record<string, boolean>>({});
  const [isManualRole, setIsManualRole] = useState(false);
  const [otFactor, setOtFactor] = useState<number>(1.25);
  const [manpowerSort, setManpowerSort] = useState<{key: string, direction: 'asc' | 'desc'} | null>({ key: "name", direction: "asc" });
  const [attendanceSort, setAttendanceSort] = useState<{key: string, direction: 'asc' | 'desc'} | null>({ key: "bom_scope_id", direction: "asc" });
  
  const [enrollForm, setEnrollForm] = useState({
    name: "",
    role: "",
    daily_rate: 0,
    overtime_rate: 0
  });

  // Deliveries
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [bomMaterials, setBomMaterials] = useState<{id: string, name: string, unit: string, scope_id?: string}[]>([]);
  const [isManualItem, setIsManualItem] = useState(false);
  const [isManualUnit, setIsManualUnit] = useState(false);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null);
  const [expandedReceipts, setExpandedReceipts] = useState<Record<string, boolean>>({});
  const [deliveryForm, setDeliveryForm] = useState({
    project_id: "",
    delivery_date: new Date().toISOString().split("T")[0],
    item_name: "",
    quantity: 0,
    unit: "",
    source_type: "warehouse", // 'warehouse' or 'supplier'
    supplier: "Main Warehouse",
    receipt_number: "",
    received_by: "",
    status: "pending",
    notes: ""
  });

  // Material Consumption
  const [consumptions, setConsumptions] = useState<any[]>([]);
  const [consumptionDate, setConsumptionDate] = useState<string>(todayStr);
  const [consumptionDialogOpen, setConsumptionDialogOpen] = useState(false);
  const [editingConsumptionId, setEditingConsumptionId] = useState<string | null>(null);
  const [manualEditItems, setManualEditItems] = useState<Record<string, boolean>>({});
  const [expandedConsumptions, setExpandedConsumptions] = useState<Record<string, boolean>>({});
  const [consumptionForm, setConsumptionForm] = useState({
    bom_scope_id: "",
    date_used: new Date().toISOString().split("T")[0],
    item_name: "",
    quantity: 0,
    unit: "",
    recorded_by: "",
    notes: ""
  });

  // Requests
  const [requests, setRequests] = useState<any[]>([]);
  const [requestDate, setRequestDate] = useState<string>(todayStr);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [viewFormDialogOpen, setViewFormDialogOpen] = useState(false);
  const [selectedFormGroup, setSelectedFormGroup] = useState<any>(null);
  const [isManualRequestItem, setIsManualRequestItem] = useState(false);
  const [isManualRequestUnit, setIsManualRequestUnit] = useState(false);
  const [requestItems, setRequestItems] = useState<any[]>([]);
  const [requestFilterType, setRequestFilterType] = useState<string>("all");
  const [seenResolvedIds, setSeenResolvedIds] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('seenResolvedIds') || "" : "");
  const [requestForm, setRequestForm] = useState({
    request_type: "Materials",
    form_number: "",
    bom_scope_id: "unassigned",
    request_date: todayStr,
    item_name: "",
    personnel_id: "",
    quantity: 0,
    unit: "",
    amount: 0,
    requested_by: "",
    notes: ""
  });

  // Cash Advances
  const [cashAdvances, setCashAdvances] = useState<any[]>([]);
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({
    personnel_id: "",
    amount: "",
    reason: "",
    request_date: todayStr
  });

  // Scope of Works
  const [scopes, setScopes] = useState<ScopeOfWork[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<any[]>([]);
  const [progressFilterDate, setProgressFilterDate] = useState<string>("");
  const [progressScopeFilter, setProgressScopeFilter] = useState<string>("all");
  const [showProgressChart, setShowProgressChart] = useState(false);
  const [progressChartRange, setProgressChartRange] = useState("7");
  const [updateProgressDialogOpen, setUpdateProgressDialogOpen] = useState(false);
  const [progressForm, setProgressForm] = useState({
    bom_scope_id: "",
    percentage: 0,
    update_date: todayStr,
    notes: ""
  });

  const [masterItems, setMasterItems] = useState<any[]>([]);
  const [warehouseSearch, setWarehouseSearch] = useState("");
  const [warehouseTypeFilter, setWarehouseTypeFilter] = useState("all");

  useEffect(() => {
    loadProjects();
    loadPersonnel();
    checkUserAssignment();
    loadMasterItems();
  }, []);

  const loadMasterItems = async () => {
    const { data } = await projectService.getMasterItems();
    setMasterItems(data || []);
  };

  const checkUserAssignment = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profile) {
        setUserRole(profile.assigned_module);
        if (profile.assigned_project_ids && profile.assigned_project_ids.length > 0) {
          setAssignedProjectIds(profile.assigned_project_ids);
          setSelectedProject(profile.assigned_project_ids[0]);
        }
      }
    }
  };

  useEffect(() => {
    if (selectedProject) {
      loadAttendanceData();
    }
  }, [selectedProject, attendanceDate]);

  useEffect(() => {
    if (selectedProject) {
      loadProjectPersonnelList();
      loadScopes();
      loadBomMaterials();
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProject) {
      loadDeliveries();
      loadConsumptions();
      loadRequests();
      loadCashAdvances();
    }
  }, [selectedProject, deliveriesDate, consumptionDate, requestDate]);

  const resolvedRequestIds = [...requests, ...cashAdvances]
    .filter(r => r.status === 'approved' || r.status === 'rejected')
    .map(r => `${r.id}-${r.status}`)
    .sort()
    .join(',');

  const pendingDeliveryIds = deliveries
    .filter(d => d.supplier === "Main Warehouse" && d.status === "pending")
    .map(d => d.id)
    .sort()
    .join(',');

  const [seenDeliveryIds, setSeenDeliveryIds] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('seenDeliveryIds') || "" : "");

  useEffect(() => {
    if (activeTab === 'request') {
      setSeenResolvedIds(resolvedRequestIds);
      if (typeof window !== 'undefined') localStorage.setItem('seenResolvedIds', resolvedRequestIds);
    }
  }, [activeTab, resolvedRequestIds]);

  useEffect(() => {
    if (activeTab === 'deliveries') {
      setSeenDeliveryIds(pendingDeliveryIds);
      if (typeof window !== 'undefined') localStorage.setItem('seenDeliveryIds', pendingDeliveryIds);
    }
  }, [activeTab, pendingDeliveryIds]);

  useEffect(() => {
    if (!selectedProject) return;

    // Set up real-time subscription for site_requests
    const channel = supabase
      .channel('site_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_requests',
          filter: `project_id=eq.${selectedProject}`
        },
        (payload) => {
          // Reload requests when any change occurs
          loadRequests();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cash_advance_requests',
          filter: `project_id=eq.${selectedProject}`
        },
        () => {
          loadCashAdvances();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedProject, requestDate]);

  const loadProjects = async () => {
    const { data } = await projectService.getAll();
    setProjects(data || []);
  };

  const loadPersonnel = async () => {
    // Only needed globally if you want, but we rely on project specific personnel now
  };

  const loadProjectPersonnelList = async () => {
    if (!selectedProject) return;
    const { data } = await siteService.getProjectPersonnel(selectedProject);
    setProjectPersonnelList(data || []);
  };

  const loadAttendanceData = async () => {
    if (!selectedProject) return;

    if (attendanceDate) {
      const { data: projectPersonnel } = await siteService.getProjectPersonnel(selectedProject);
      setProjectPersonnelList(projectPersonnel || []);
      const { data: attendance } = await siteService.getSiteAttendance(selectedProject, attendanceDate);

      // Only show personnel who actually have an attendance record for this date
      const merged = (attendance || []).map((att: any) => {
        const p = projectPersonnel?.find((p: any) => p.id === att.personnel_id);
        return {
          personnel_id: att.personnel_id,
          name: p?.name || "Unknown",
          role: p?.role || "Unknown",
          daily_rate: p?.daily_rate || 0,
          overtime_rate: p?.overtime_rate || 0,
          status: att.status || "present",
          hours_worked: att.hours_worked ?? 8,
          overtime_hours: att.overtime_hours ?? 0,
          bom_scope_id: att.bom_scope_id || null,
        };
      });
      setAttendanceList(merged);
    } else {
      const { data } = await siteService.getSiteAttendance(selectedProject);
      const grouped = (data || []).reduce((acc: any, curr: any) => {
        const d = curr.date;
        if (!acc[d]) acc[d] = [];
        acc[d].push(curr);
        return acc;
      }, {});
      setHistoricalAttendance(grouped);
    }
  };

  const handleManpowerSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (manpowerSort && manpowerSort.key === key && manpowerSort.direction === 'asc') {
      direction = 'desc';
    }
    setManpowerSort({ key, direction });
  };

  const handleAttendanceSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (attendanceSort && attendanceSort.key === key && attendanceSort.direction === 'asc') {
      direction = 'desc';
    }
    setAttendanceSort({ key, direction });
  };

  const getSortIcon = (config: {key: string, direction: 'asc' | 'desc'} | null, key: string) => {
    if (config?.key !== key) return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-50" />;
    return config.direction === "asc" ? <ArrowUp className="ml-1 h-3 w-3 inline" /> : <ArrowDown className="ml-1 h-3 w-3 inline" />;
  };

  const handleAddWorkerToRollCall = async (personnel_id: string) => {
    await siteService.upsertAttendance({
      project_id: selectedProject,
      personnel_id: personnel_id,
      date: attendanceDate,
      status: "present",
      hours_worked: 8,
      overtime_hours: 0,
      bom_scope_id: null
    });
    loadAttendanceData();
  };

  const handleAddAllToRollCall = async () => {
    const availableToAdd = projectPersonnelList
      .filter(p => !attendanceList.find(a => a.personnel_id === p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    await Promise.all(availableToAdd.map(p => siteService.upsertAttendance({
      project_id: selectedProject,
      personnel_id: p.id,
      date: attendanceDate,
      status: "present",
      hours_worked: 8,
      overtime_hours: 0,
      bom_scope_id: null
    })));
    loadAttendanceData();
    setAddManpowerDialogOpen(false);
  };

  const loadDeliveries = async () => {
    if (!selectedProject) return;
    const { data } = await siteService.getDeliveries(selectedProject, deliveriesDate);
    setDeliveries(data || []);
  };

  const loadConsumptions = async () => {
    if (!selectedProject) return;
    const { data } = await siteService.getMaterialConsumption(selectedProject, consumptionDate === "" ? undefined : consumptionDate);
    setConsumptions(data || []);
  };

  const loadRequests = async () => {
    if (!selectedProject) return;
    let query = supabase.from('site_requests').select(`*, bom_scope_of_work(name)`).eq('project_id', selectedProject).order('request_date', { ascending: false });
    if (requestDate) {
      query = query.eq('request_date', requestDate);
    }
    const { data } = await query;
    setRequests(data || []);
  };

  const loadCashAdvances = async () => {
    if (!selectedProject) return;
    const { data } = await siteService.getCashAdvances(selectedProject);
    setCashAdvances(data || []);
  };

  const loadScopes = async () => {
    if (!selectedProject) return;
    const { data } = await siteService.getScopeOfWorks(selectedProject);
    setScopes(data || []);
    
    if (data && data.length > 0) {
      const scopeIds = data.map((s: any) => s.id);
      const { data: progressData } = await supabase
        .from('bom_progress_updates')
        .select('*, bom_scope_of_work(name)')
        .in('bom_scope_id', scopeIds)
        .order('update_date', { ascending: false });
      setProgressUpdates(progressData || []);
    } else {
      setProgressUpdates([]);
    }
  };

  const loadBomMaterials = async () => {
    if (!selectedProject) return;
    const { data } = await siteService.getBomMaterials(selectedProject);
    setBomMaterials(data || []);
  };

  const handleProgressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await siteService.createProgressUpdate({
      bom_scope_id: progressForm.bom_scope_id,
      percentage_completed: parseFloat(progressForm.percentage.toString()),
      update_date: progressForm.update_date,
      updated_by: "Site App",
      notes: progressForm.notes
    });
    setUpdateProgressDialogOpen(false);
    setProgressForm(prev => ({ ...prev, percentage: 0, notes: "" }));
    loadScopes();
  };

  const handleMoveScope = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === scopes.length - 1) return;

    const newScopes = [...scopes];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap order numbers
    const currentScope = newScopes[index];
    const targetScope = newScopes[targetIndex];
    
    const tempOrder = currentScope.order_number;
    currentScope.order_number = targetScope.order_number;
    targetScope.order_number = tempOrder;
    
    // Swap positions in array for immediate UI update
    newScopes[index] = targetScope;
    newScopes[targetIndex] = currentScope;
    
    setScopes(newScopes);

    // Save to database
    await Promise.all([
      siteService.updateScopeOfWork(currentScope.id, { order_number: currentScope.order_number }),
      siteService.updateScopeOfWork(targetScope.id, { order_number: targetScope.order_number })
    ]);
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await siteService.enrollPersonnel({
      project_id: selectedProject,
      name: enrollForm.name,
      role: enrollForm.role,
      daily_rate: enrollForm.daily_rate,
      overtime_rate: enrollForm.overtime_rate,
      hourly_rate: enrollForm.daily_rate > 0 ? enrollForm.daily_rate / 8 : 0,
      status: "active",
      hire_date: new Date().toISOString().split("T")[0],
      email: `${enrollForm.name.replace(/\s+/g, '').toLowerCase()}${Date.now()}@example.com`
    });
    
    // Rapid Entry: Do NOT close dialog, just reset form
    setEnrollForm({ name: "", role: "", daily_rate: 0, overtime_rate: 0 });
    setIsManualRole(false);
    loadProjectPersonnelList();
  };

  const handleAttendanceChange = async (personnel_id: string, field: string, value: any) => {
    const list = [...attendanceList];
    const idx = list.findIndex(r => r.personnel_id === personnel_id);
    if (idx === -1) return;

    const newRow = { ...list[idx], [field]: value };
    
    // Auto-adjust hours based on presence
    if (field === "status" && value === "absent") {
      newRow.hours_worked = 0;
      newRow.overtime_hours = 0;
      newRow.bom_scope_id = null;
    } else if (field === "status" && value === "present") {
      newRow.hours_worked = 8;
    }

    list[idx] = newRow;
    setAttendanceList(list);

    await siteService.upsertAttendance({
      project_id: selectedProject,
      personnel_id: personnel_id,
      date: attendanceDate,
      status: newRow.status,
      hours_worked: newRow.hours_worked,
      overtime_hours: newRow.overtime_hours,
      bom_scope_id: newRow.bom_scope_id
    });
  };

  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Explicitly define payload so we don't send `source_type` to DB
    const payload = {
      project_id: selectedProject,
      delivery_date: deliveryForm.delivery_date,
      item_name: deliveryForm.item_name,
      quantity: parseFloat(deliveryForm.quantity.toString()),
      unit: deliveryForm.unit,
      supplier: deliveryForm.source_type === "warehouse" ? "Main Warehouse" : deliveryForm.supplier,
      receipt_number: deliveryForm.receipt_number || "",
      received_by: deliveryForm.received_by,
      status: deliveryForm.status,
      notes: deliveryForm.notes
    };

    if (editingDeliveryId) {
      await siteService.updateDelivery(editingDeliveryId, payload);
    } else {
      await siteService.createDelivery(payload);
    }
    
    setDeliveryForm(prev => ({ 
      ...prev, 
      item_name: "", 
      quantity: 0, 
      unit: "", 
      notes: "" 
    }));
    setIsManualItem(false);
    setIsManualUnit(false);
    setEditingDeliveryId(null);
    // Keep dialog open for rapid entry
    loadDeliveries();
  };

  const openEditDelivery = (delivery: Delivery) => {
    const isWarehouse = delivery.supplier === "Main Warehouse";
    setDeliveryForm({
      project_id: delivery.project_id,
      delivery_date: delivery.delivery_date,
      item_name: delivery.item_name,
      quantity: delivery.quantity,
      unit: delivery.unit,
      source_type: isWarehouse ? "warehouse" : "supplier",
      supplier: delivery.supplier,
      receipt_number: delivery.receipt_number || "",
      received_by: delivery.received_by || "",
      status: delivery.status || "pending",
      notes: delivery.notes || ""
    });
    setEditingDeliveryId(delivery.id);
    setIsManualItem(!bomMaterials.some(m => m.name === delivery.item_name));
    setIsManualUnit(!availableUnits.includes(delivery.unit));
    setDeliveryDialogOpen(true);
  };

  const resetDeliveryForm = () => {
    setDeliveryForm({
      project_id: "",
      delivery_date: new Date().toISOString().split("T")[0],
      item_name: "",
      quantity: 0,
      unit: "",
      source_type: "warehouse",
      supplier: "Main Warehouse",
      receipt_number: "",
      received_by: "",
      status: "pending",
      notes: ""
    });
    setIsManualItem(false);
    setIsManualUnit(false);
    setEditingDeliveryId(null);
  };

  const handleMarkReceived = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const userName = typeof window !== 'undefined' ? localStorage.getItem('app_user_name') || "Site User" : "Site User";
    await siteService.updateDelivery(id, { 
      status: "received", 
      received_by: userName 
    });
    loadDeliveries();
  };

  const handleConsumptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await siteService.createMaterialConsumption({
      ...consumptionForm,
      bom_scope_id: consumptionForm.bom_scope_id === "unassigned" ? null : consumptionForm.bom_scope_id,
      project_id: selectedProject,
      quantity: parseFloat(consumptionForm.quantity.toString())
    });
    setConsumptionForm(prev => ({ ...prev, item_name: "", quantity: 0, unit: "" }));
    setIsManualItem(false);
    setIsManualUnit(false);
    loadConsumptions();
  };

  const resetConsumptionForm = () => {
    setConsumptionForm({
      bom_scope_id: "",
      date_used: new Date().toISOString().split("T")[0],
      item_name: "",
      quantity: 0,
      unit: "",
      recorded_by: "",
      notes: ""
    });
    setIsManualItem(false);
    setIsManualUnit(false);
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requestForm.request_type === "Cash Advance") {
      await siteService.createCashAdvance({
        project_id: selectedProject,
        personnel_id: requestForm.personnel_id,
        amount: parseFloat(requestForm.amount.toString()) || 0,
        reason: "",
        request_date: requestForm.request_date,
        form_number: requestForm.form_number,
        status: 'pending'
      });
    } else if (requestForm.request_type === "Petty Cash") {
      const personName = projectPersonnelList.find(p => p.id === requestForm.personnel_id)?.name || "Site Worker";
      await supabase.from('site_requests').insert({
        project_id: selectedProject,
        request_date: requestForm.request_date,
        item_name: "Petty Cash",
        amount: parseFloat(requestForm.amount.toString()) || 0,
        request_type: requestForm.request_type,
        form_number: requestForm.form_number,
        requested_by: personName,
        status: 'pending',
        quantity: 1,
        unit: 'lot'
      });
    } else {
      if (requestItems.length === 0) {
        alert("Please add at least one item to the list before submitting.");
        return;
      }
      const inserts = requestItems.map(item => ({
        project_id: selectedProject,
        bom_scope_id: item.bom_scope_id === "unassigned" ? null : item.bom_scope_id,
        request_date: requestForm.request_date,
        item_name: item.item_name,
        quantity: parseFloat(item.quantity.toString()) || 0,
        unit: item.unit,
        amount: parseFloat(item.amount.toString()) || 0,
        request_type: requestForm.request_type,
        form_number: requestForm.form_number,
        requested_by: requestForm.requested_by,
        notes: item.notes,
        status: 'pending'
      }));
      await supabase.from('site_requests').insert(inserts);
    }
    setRequestDialogOpen(false);
    resetRequestForm();
    loadRequests();
    loadCashAdvances();
  };
  
  const handleAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await siteService.createCashAdvance({
      project_id: selectedProject,
      personnel_id: advanceForm.personnel_id,
      amount: parseFloat(advanceForm.amount),
      reason: advanceForm.reason,
      request_date: advanceForm.request_date,
      status: 'pending'
    });
    setAdvanceDialogOpen(false);
    setAdvanceForm({ personnel_id: "", amount: "", reason: "", request_date: todayStr });
    loadCashAdvances();
  };

  const handleAddItem = () => {
    if (!requestForm.item_name) {
      alert("Please enter an item name or select one from the BOM.");
      return;
    }
    setRequestItems([...requestItems, { ...requestForm }]);
    setRequestForm(prev => ({
      ...prev,
      item_name: "",
      quantity: 0,
      amount: 0,
      notes: "",
      bom_scope_id: "unassigned"
    }));
    setIsManualRequestItem(false);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...requestItems];
    newItems.splice(index, 1);
    setRequestItems(newItems);
  };

  const resetRequestForm = () => {
    setRequestForm({
      request_type: "Materials",
      form_number: "",
      bom_scope_id: "unassigned",
      request_date: todayStr,
      item_name: "",
      personnel_id: "",
      quantity: 0,
      unit: "",
      amount: 0,
      requested_by: "",
      notes: ""
    });
    setRequestItems([]);
    setIsManualRequestItem(false);
    setIsManualRequestUnit(false);
  };

  const openRequestDialog = (type: string, prefix: string) => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    setRequestForm({
      ...requestForm,
      request_type: type,
      form_number: `${prefix}-${randomNum}`,
      item_name: "",
      quantity: 0,
      amount: 0,
      notes: ""
    });
    setRequestItems([]);
    setIsManualRequestItem(false);
    setIsManualRequestUnit(false);
    setRequestDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      present: "bg-green-500",
      absent: "bg-red-500",
      late: "bg-yellow-500",
      half_day: "bg-orange-500",
      pending: "bg-yellow-500",
      received: "bg-green-500",
      not_started: "bg-gray-500",
      in_progress: "bg-blue-500",
      completed: "bg-green-500"
    };
    return <Badge className={colors[status]}>{status.replace("_", " ").toUpperCase()}</Badge>;
  };

  const standardUnits = ["pcs", "bags", "m2", "m3", "kg", "ton", "L", "rolls", "length", "box", "set", "lot", "cu.m", "sq.m"];
  const availableUnits = Array.from(new Set([...standardUnits, ...bomMaterials.map(m => m.unit).filter(Boolean)]));

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-120px)] space-y-4 overflow-hidden">
        <div className="flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-3xl font-bold">Site Personnel</h1>
            <p className="text-muted-foreground">Daily site operations, attendance, deliveries & progress tracking</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-1 shrink-0">
          <div>
            <Label htmlFor="project">Select Project</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject} disabled={assignedProjectIds.length === 1}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.filter(p => assignedProjectIds.length === 0 || assignedProjectIds.includes(p.id)).map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {assignedProjectIds.length > 0 && <p className="text-xs text-muted-foreground mt-1">Your account is restricted to {assignedProjectIds.length} assigned project(s).</p>}
          </div>
        </div>

        {selectedProject && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden space-y-4">
            <TabsList className="shrink-0 flex flex-wrap w-full gap-1 h-auto bg-transparent p-0">
              <TabsTrigger 
                value="manpower" 
                className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-blue-700 bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                <Users className="h-3 w-3 mr-1.5 hidden sm:inline" />
                Manpower
              </TabsTrigger>
              <TabsTrigger 
                value="attendance" 
                className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-indigo-700 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              >
                <ClipboardList className="h-3 w-3 mr-1.5 hidden sm:inline" />
                Attendance
              </TabsTrigger>
              <TabsTrigger 
                value="deliveries" 
                className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-emerald-700 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 relative"
              >
                <Truck className="h-3 w-3 mr-1.5 hidden sm:inline" />
                Deliveries
                {(() => {
                  const hasNewDeliveries = pendingDeliveryIds !== seenDeliveryIds && activeTab !== 'deliveries';
                  const pendingCount = deliveries.filter(d => d.supplier === "Main Warehouse" && d.status === "pending").length;
                  if (hasNewDeliveries && pendingCount > 0) {
                    return (
                      <Badge variant="destructive" className="ml-1 h-4 min-w-4 flex items-center justify-center p-0 px-1 text-[9px] absolute -top-1 -right-1">
                        New
                      </Badge>
                    );
                  }
                  return null;
                })()}
              </TabsTrigger>
              <TabsTrigger 
                value="warehouse" 
                className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-amber-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-amber-700 bg-amber-50 text-amber-700 hover:bg-amber-100"
              >
                <Warehouse className="h-3 w-3 mr-1.5 hidden sm:inline" />
                Warehouse
              </TabsTrigger>
              <TabsTrigger 
                value="consumption" 
                className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-orange-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-orange-700 bg-orange-50 text-orange-700 hover:bg-orange-100"
              >
                <ClipboardList className="h-3 w-3 mr-1.5 hidden sm:inline" />
                Usage
              </TabsTrigger>
              <TabsTrigger 
                value="request" 
                className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-rose-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-rose-700 bg-rose-50 text-rose-700 hover:bg-rose-100 relative"
              >
                <ShoppingCart className="h-3 w-3 mr-1.5 hidden sm:inline" />
                Requests
                {(() => {
                  const hasNewResolved = resolvedRequestIds !== seenResolvedIds && activeTab !== 'request';
                  const resolvedCount = [...requests, ...cashAdvances].filter(r => r.status === 'approved' || r.status === 'rejected').length;
                  if (hasNewResolved && resolvedCount > 0) {
                    return (
                      <Badge variant="destructive" className="ml-1 h-4 min-w-4 flex items-center justify-center p-0 px-1 text-[9px] absolute -top-1 -right-1">
                        New
                      </Badge>
                    );
                  }
                  return null;
                })()}
              </TabsTrigger>
              <TabsTrigger 
                value="scope" 
                className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-purple-700 bg-purple-50 text-purple-700 hover:bg-purple-100"
              >
                <Activity className="h-3 w-3 mr-1.5 hidden sm:inline" />
                Progress
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manpower" className="flex-1 overflow-hidden data-[state=active]:flex flex-col mt-0">
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="shrink-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Project Manpower</CardTitle>
                      <CardDescription>Master list of enrolled workers for this project</CardDescription>
                    </div>
                    <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Manpower
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Worker to Project</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleEnrollSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label>Name (Surname, First Name, Middle Name)</Label>
                            <Input
                              required
                              placeholder="e.g. Dela Cruz, Juan, Santos"
                              value={enrollForm.name}
                              onChange={(e) => setEnrollForm({ ...enrollForm, name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Position / Role</Label>
                            {!isManualRole ? (
                              <Select
                                value={enrollForm.role}
                                onValueChange={(val) => {
                                  if (val === "others") {
                                    setIsManualRole(true);
                                    setEnrollForm({ ...enrollForm, role: "" });
                                  } else {
                                    setEnrollForm({ ...enrollForm, role: val });
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select position" />
                                </SelectTrigger>
                                <SelectContent>
                                  {STANDARD_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                  <SelectItem value="others" className="font-semibold text-blue-600">Others (Manual Input)</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Custom position"
                                  value={enrollForm.role}
                                  onChange={(e) => setEnrollForm({ ...enrollForm, role: e.target.value })}
                                  required
                                />
                                <Button type="button" variant="outline" className="px-2" onClick={() => {
                                  setIsManualRole(false);
                                  setEnrollForm({ ...enrollForm, role: "" });
                                }}>
                                  List
                                </Button>
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Daily Rate (AED)</Label>
                              <Input
                                required
                                type="number"
                                min="0"
                                step="0.01"
                                value={enrollForm.daily_rate}
                                onChange={(e) => {
                                  const rate = parseFloat(e.target.value) || 0;
                                  setEnrollForm({ 
                                    ...enrollForm, 
                                    daily_rate: rate,
                                    overtime_rate: (rate / 8) * otFactor
                                  });
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>OT Factor</Label>
                              <Select value={otFactor.toString()} onValueChange={(val) => {
                                const factor = parseFloat(val);
                                setOtFactor(factor);
                                setEnrollForm(prev => ({
                                  ...prev,
                                  overtime_rate: (prev.daily_rate / 8) * factor
                                }));
                              }}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1.0x (Regular)</SelectItem>
                                  <SelectItem value="1.25">1.25x (Standard OT)</SelectItem>
                                  <SelectItem value="1.3">1.3x (Special/Rest)</SelectItem>
                                  <SelectItem value="1.5">1.5x (Night Shift)</SelectItem>
                                  <SelectItem value="2">2.0x (Double Pay)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Overtime Rate (AED/hr)</Label>
                              <Input
                                required
                                type="number"
                                min="0"
                                step="0.01"
                                value={enrollForm.overtime_rate}
                                onChange={(e) => setEnrollForm({ ...enrollForm, overtime_rate: parseFloat(e.target.value) || 0 })}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setEnrollDialogOpen(false)}>
                              Done / Close
                            </Button>
                            <Button type="submit">Add Worker</Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden pb-4">
                  <div className="overflow-y-auto h-full border rounded-md relative">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleManpowerSort("name")}>Name {getSortIcon(manpowerSort, "name")}</TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleManpowerSort("role")}>Position {getSortIcon(manpowerSort, "role")}</TableHead>
                          <TableHead className="w-32 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleManpowerSort("daily_rate")}>Daily Rate {getSortIcon(manpowerSort, "daily_rate")}</TableHead>
                          <TableHead className="w-32">OT Rate</TableHead>
                          <TableHead className="w-32">Source</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const sortedManpower = [...projectPersonnelList].sort((a, b) => {
                            if (!manpowerSort) return a.name.localeCompare(b.name);
                            let comparison = 0;
                            if (manpowerSort.key === "name") {
                              comparison = a.name.localeCompare(b.name);
                            } else if (manpowerSort.key === "role") {
                              comparison = (a.role || "").localeCompare(b.role || "");
                            } else if (manpowerSort.key === "daily_rate") {
                              comparison = (a.daily_rate || 0) - (b.daily_rate || 0);
                            }
                            return manpowerSort.direction === "asc" ? comparison : -comparison;
                          });

                          return sortedManpower.map(p => {
                            const isEditing = editingPersonnelId === p.id;
                            return (
                          <TableRow key={p.id}>
                            <TableCell>
                              {isEditing ? (
                                <Input 
                                  value={p.name} 
                                  onChange={e => {
                                    const l = [...projectPersonnelList];
                                    const i = l.findIndex(x => x.id === p.id);
                                    l[i].name = e.target.value;
                                    setProjectPersonnelList(l);
                                  
                                    // Sync to attendance
                                    const attIdx = attendanceList.findIndex(a => a.personnel_id === p.id);
                                    if (attIdx > -1) {
                                      const attList = [...attendanceList];
                                      attList[attIdx].name = e.target.value;
                                      setAttendanceList(attList);
                                    }
                                  }}
                                  onBlur={e => siteService.updatePersonnel(p.id, { name: e.target.value })}
                                />
                              ) : (
                                <span>{p.name}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                manualRoles[p.id] || (p.role && !STANDARD_ROLES.includes(p.role)) ? (
                                  <div className="flex gap-2">
                                    <Input 
                                      placeholder="Custom position"
                                      value={p.role} 
                                      onChange={e => {
                                        const l = [...projectPersonnelList];
                                        const i = l.findIndex(x => x.id === p.id);
                                        l[i].role = e.target.value;
                                        setProjectPersonnelList(l);
                                      
                                        // Sync to attendance
                                        const attIdx = attendanceList.findIndex(a => a.personnel_id === p.id);
                                        if (attIdx > -1) {
                                          const attList = [...attendanceList];
                                          attList[attIdx].role = e.target.value;
                                          setAttendanceList(attList);
                                        }
                                      }}
                                      onBlur={e => siteService.updatePersonnel(p.id, { role: e.target.value })}
                                    />
                                    <Button type="button" variant="outline" className="px-2" onClick={() => {
                                      setManualRoles(prev => ({ ...prev, [p.id]: false }));
                                      const l = [...projectPersonnelList];
                                      const i = l.findIndex(x => x.id === p.id);
                                      l[i].role = "";
                                      setProjectPersonnelList(l);
                                      
                                      // Sync to attendance
                                      const attIdx = attendanceList.findIndex(a => a.personnel_id === p.id);
                                      if (attIdx > -1) {
                                        const attList = [...attendanceList];
                                        attList[attIdx].role = "";
                                        setAttendanceList(attList);
                                      }
                                    }}>
                                      List
                                    </Button>
                                  </div>
                                ) : (
                                  <Select 
                                    value={p.role || ""} 
                                    onValueChange={val => {
                                      if (val === "others") {
                                        setManualRoles(prev => ({ ...prev, [p.id]: true }));
                                        const l = [...projectPersonnelList];
                                        const i = l.findIndex(x => x.id === p.id);
                                        l[i].role = "";
                                        setProjectPersonnelList(l);
                                      
                                        // Sync to attendance
                                        const attIdx = attendanceList.findIndex(a => a.personnel_id === p.id);
                                        if (attIdx > -1) {
                                          const attList = [...attendanceList];
                                          attList[attIdx].role = "";
                                          setAttendanceList(attList);
                                        }
                                      } else {
                                        const l = [...projectPersonnelList];
                                        const i = l.findIndex(x => x.id === p.id);
                                        l[i].role = val;
                                        setProjectPersonnelList(l);
                                        siteService.updatePersonnel(p.id, { role: val });
                                      
                                        // Sync to attendance
                                        const attIdx = attendanceList.findIndex(a => a.personnel_id === p.id);
                                        if (attIdx > -1) {
                                          const attList = [...attendanceList];
                                          attList[attIdx].role = val;
                                          setAttendanceList(attList);
                                        }
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Position" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {STANDARD_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                      <SelectItem value="others" className="font-semibold text-blue-600">Others (Manual Input)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )
                              ) : (
                                <span>{p.role}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Input 
                                type="number"
                                value={p.daily_rate} 
                                onChange={e => {
                                  const l = [...projectPersonnelList];
                                  const i = l.findIndex(x => x.id === p.id);
                                  l[i].daily_rate = parseFloat(e.target.value) || 0;
                                  setProjectPersonnelList(l);
                                  
                                  // Sync to attendance
                                  const attIdx = attendanceList.findIndex(a => a.personnel_id === p.id);
                                  if (attIdx > -1) {
                                    const attList = [...attendanceList];
                                    attList[attIdx].daily_rate = parseFloat(e.target.value) || 0;
                                    setAttendanceList(attList);
                                  }
                                }}
                                onBlur={e => siteService.updatePersonnel(p.id, { daily_rate: parseFloat(e.target.value) || 0 })}
                              />
                            ) : (
                              <span>{p.daily_rate}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input 
                                type="number"
                                value={p.overtime_rate} 
                                onChange={e => {
                                  const l = [...projectPersonnelList];
                                  const i = l.findIndex(x => x.id === p.id);
                                  l[i].overtime_rate = parseFloat(e.target.value) || 0;
                                  setProjectPersonnelList(l);
                                }}
                                onBlur={e => siteService.updatePersonnel(p.id, { overtime_rate: parseFloat(e.target.value) || 0 })}
                              />
                            ) : (
                              <span>{p.overtime_rate}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] bg-muted/50">
                              {p.updated_source || p.created_source || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Button variant="ghost" size="sm" onClick={() => setEditingPersonnelId(null)}>
                                <Check className="h-4 w-4 text-green-500" />
                              </Button>
                            ) : (
                              <div className="flex gap-2 justify-end">
                                <Button variant="ghost" size="sm" onClick={() => setEditingPersonnelId(p.id)}>
                                  <Pencil className="h-4 w-4 text-blue-500" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={async () => {
                                  if(confirm("Archive this personnel?")) {
                                    await siteService.deletePersonnel(p.id);
                                    loadProjectPersonnelList();
                                  }
                                }} title="Archive">
                                  <Archive className="h-4 w-4 text-orange-600" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                        {projectPersonnelList.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground border-2 border-dashed">
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attendance" className="flex-1 overflow-hidden data-[state=active]:flex flex-col mt-0">
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="shrink-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Daily Roll Call & Assignment</CardTitle>
                      <CardDescription>Manage presence, overtime, and tasks</CardDescription>
                      <div className="flex items-center gap-3 mt-4">
                        <Label>Date Filter:</Label>
                        <Input
                          type="date"
                          value={attendanceDate}
                          onChange={(e) => {
                            setAttendanceDate(e.target.value);
                            setIsEditMode(false);
                          }}
                          className="w-auto h-9"
                        />
                        {attendanceDate && (
                          <Button variant="ghost" size="sm" onClick={() => {
                            setAttendanceDate("");
                            setIsEditMode(false);
                          }} className="text-muted-foreground h-9">
                            Clear Filter
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Dialog open={addManpowerDialogOpen} onOpenChange={setAddManpowerDialogOpen}>
                        <DialogTrigger asChild>
                          <Button disabled={!attendanceDate}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Manpower from List
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Add Manpower to {attendanceDate || 'Selected'} Roll Call</DialogTitle>
                          </DialogHeader>
                          {(() => {
                            const availableToAdd = projectPersonnelList
                              .filter(p => !attendanceList.find(a => a.personnel_id === p.id))
                              .sort((a, b) => a.name.localeCompare(b.name));
                            return (
                              <div className="space-y-4 mt-4">
                                <div className="flex justify-between items-center border-b pb-4">
                                  <p className="text-sm text-muted-foreground">Select workers from your master list to add to today's roll call.</p>
                                  <Button onClick={handleAddAllToRollCall} disabled={availableToAdd.length === 0}>
                                    Add All Missing
                                  </Button>
                                </div>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Name</TableHead>
                                      <TableHead>Position</TableHead>
                                      <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {availableToAdd.map(p => (
                                      <TableRow key={p.id}>
                                        <TableCell className="font-medium">{p.name}</TableCell>
                                        <TableCell>{p.role}</TableCell>
                                        <TableCell className="text-right">
                                          <Button size="sm" variant="outline" onClick={() => handleAddWorkerToRollCall(p.id)}>
                                            Add
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                    {availableToAdd.length === 0 && (
                                      <TableRow>
                                        <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                                          All enrolled workers are already on the roll call for this date!
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            );
                          })()}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden pb-4 flex flex-col">
                  {attendanceDate ? (
                    <div className="flex flex-col flex-1 overflow-hidden space-y-4">
                      {attendanceList.length > 0 && (() => {
                        const presentWorkers = attendanceList.filter(r => r.status !== "absent");
                        const totalCost = presentWorkers.reduce((sum, r) => {
                          const daily = r.daily_rate || 0;
                          const ot = r.overtime_rate || 0;
                          const hrs = r.hours_worked ?? 8;
                          const oth = r.overtime_hours ?? 0;
                          return sum + ((daily / 8) * hrs) + (ot * oth);
                        }, 0);
                        const roleCounts = presentWorkers.reduce((acc, r) => {
                          acc[r.role] = (acc[r.role] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>);

                        return (
                          <div className="bg-muted/30 p-4 rounded-lg border flex flex-wrap gap-4 items-center justify-between shrink-0">
                            <div className="flex flex-wrap gap-4 items-center">
                              <div className="font-semibold text-lg border-r pr-4 text-primary">
                                Daily Labor Cost: AED {totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div className="flex items-center flex-wrap gap-2 text-sm">
                                <Badge variant="secondary">Total Workers: {presentWorkers.length}</Badge>
                                {Object.entries(roleCounts).map(([role, count]) => (
                                  <Badge key={role} variant="outline">{role}: {count}</Badge>
                                ))}
                              </div>
                            </div>
                            {!isEditMode ? (
                              <Button type="button" variant="outline" onClick={(e) => { e.preventDefault(); setIsEditMode(true); }}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit Roll Call
                              </Button>
                            ) : (
                              <Button type="button" variant="default" onClick={(e) => { e.preventDefault(); setIsEditMode(false); }}>
                                <Check className="h-4 w-4 mr-2" />
                                Done Editing
                              </Button>
                            )}
                          </div>
                        );
                      })()}
                      <div className="overflow-y-auto h-full border rounded-md relative">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12 text-center">#</TableHead>
                              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleAttendanceSort("name")}>Worker {getSortIcon(attendanceSort, "name")}</TableHead>
                              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleAttendanceSort("role")}>Position {getSortIcon(attendanceSort, "role")}</TableHead>
                              <TableHead className="w-[200px] cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleAttendanceSort("bom_scope_id")}>Scope Assignment {getSortIcon(attendanceSort, "bom_scope_id")}</TableHead>
                              <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleAttendanceSort("daily_rate")}>Daily Rate {getSortIcon(attendanceSort, "daily_rate")}</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="w-24 text-center">Reg. Hrs</TableHead>
                              <TableHead className="w-32 text-center">Overtime (Hrs)</TableHead>
                              <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleAttendanceSort("total_cost")}>Total Cost</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {attendanceList.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground border-2 border-dashed">
                                  No manpower enrolled. Click "Add Manpower from List" to add workers to this roll call.
                                </TableCell>
                              </TableRow>
                            ) : (
                              (() => {
                                const sortedAttendance = [...attendanceList].sort((a, b) => {
                                  const scopeA = scopes.find(s => s.id === a.bom_scope_id)?.name || "Z_Admin / Unassigned";
                                  const scopeB = scopes.find(s => s.id === b.bom_scope_id)?.name || "Z_Admin / Unassigned";
                                  return scopeA.localeCompare(scopeB);
                                });

                                return sortedAttendance.map((row, index) => {
                                  const canEdit = isEditMode;
                                  const daily = row.daily_rate || 0;
                                  const ot = row.overtime_rate || 0;
                                  const hrs = row.hours_worked || 0;
                                  const oth = row.overtime_hours || 0;
                                  const rowCost = row.status === "absent" ? 0 : ((daily / 8) * hrs) + (ot * oth);

                                  return (
                                    <TableRow key={row.personnel_id} className={row.status === "absent" ? "bg-muted/50 opacity-75" : ""}>
                                      <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
                                      <TableCell>
                                        <span className="font-medium">{row.name}</span>
                                      </TableCell>
                                      <TableCell>{row.role}</TableCell>
                                      <TableCell>
                                        <Select
                                          value={row.bom_scope_id || "unassigned"}
                                          disabled={!canEdit || row.status === "absent"}
                                          onValueChange={(val) => handleAttendanceChange(row.personnel_id, "bom_scope_id", val === "unassigned" ? null : val)}
                                        >
                                          <SelectTrigger className="h-8">
                                            <SelectValue placeholder="Assign task..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="unassigned" className="text-muted-foreground italic">Admin / Unassigned</SelectItem>
                                            {scopes.map((s) => (
                                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell className="text-right">AED {daily.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <Switch
                                            checked={row.status === "present"}
                                            disabled={!canEdit || row.status === "absent"}
                                            onCheckedChange={(checked) => handleAttendanceChange(row.personnel_id, "status", checked ? "present" : "absent")}
                                          />
                                          <span className={`text-xs font-semibold ${row.status === "present" ? "text-green-600" : "text-red-500"}`}>
                                            {row.status === "present" ? "Present" : "Absent"}
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          min="0"
                                          max="24"
                                          step="0.5"
                                          className="w-16 mx-auto text-center h-8"
                                          value={row.hours_worked}
                                          disabled={!canEdit || row.status === "absent"}
                                          onChange={(e) => {
                                            const list = [...attendanceList];
                                            const idx = list.findIndex(l => l.personnel_id === row.personnel_id);
                                            list[idx].hours_worked = parseFloat(e.target.value) || 0;
                                            setAttendanceList(list);
                                          }}
                                          onBlur={(e) => handleAttendanceChange(row.personnel_id, "hours_worked", parseFloat(e.target.value) || 0)}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.5"
                                          className="w-20 mx-auto text-center h-8"
                                          value={row.overtime_hours}
                                          disabled={!canEdit || row.status === "absent"}
                                          onChange={(e) => {
                                            const list = [...attendanceList];
                                            const idx = list.findIndex(l => l.personnel_id === row.personnel_id);
                                            list[idx].overtime_hours = parseFloat(e.target.value) || 0;
                                            setAttendanceList(list);
                                          }}
                                          onBlur={(e) => handleAttendanceChange(row.personnel_id, "overtime_hours", parseFloat(e.target.value) || 0)}
                                        />
                                      </TableCell>
                                      <TableCell className="text-right font-semibold text-primary">
                                        AED {rowCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </TableCell>
                                    </TableRow>
                                  );
                                });
                              })()
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 overflow-y-auto h-full pr-2">
                      <div className="flex items-center gap-3 bg-muted/30 p-4 rounded-lg border shrink-0">
                        <Label>Month Filter:</Label>
                        <Input
                          type="month"
                          value={attendanceMonthFilter}
                          onChange={(e) => setAttendanceMonthFilter(e.target.value)}
                          className="w-auto h-9"
                        />
                        {attendanceMonthFilter && (
                          <Button variant="ghost" size="sm" onClick={() => setAttendanceMonthFilter("")} className="text-muted-foreground h-9">
                            Clear
                          </Button>
                        )}
                        <span className="text-sm text-muted-foreground ml-4">Select a month to see all weeks/days inside it.</span>
                      </div>
                      
                      {Object.entries(historicalAttendance)
                        .filter(([date]) => {
                          if (!attendanceMonthFilter) return true;
                          return date.startsWith(attendanceMonthFilter);
                        })
                        .sort(([a], [b]) => b.localeCompare(a))
                        .map(([date, records]) => {
                        const isExpanded = expandedDates[date];
                        return (
                          <div key={date} className="border rounded-lg overflow-hidden">
                            <div 
                              className="bg-muted/50 p-4 flex justify-between items-center cursor-pointer hover:bg-muted transition-colors"
                              onClick={() => setExpandedDates(prev => ({ ...prev, [date]: !isExpanded }))}
                            >
                              <div className="font-semibold flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                {date}
                              </div>
                              {(() => {
                                const presentWorkers = records.filter(r => r.status !== 'absent');
                                const dailyTotal = presentWorkers.reduce((sum, r) => {
                                  const daily = r.personnel?.daily_rate || 0;
                                  const ot = r.personnel?.overtime_rate || 0;
                                  const hrs = r.hours_worked || 0;
                                  const oth = r.overtime_hours || 0;
                                  return sum + ((daily / 8) * hrs) + (ot * oth);
                                }, 0);
                                
                                return (
                                  <div className="flex items-center gap-4">
                                    <div className="text-sm font-bold text-primary">AED {dailyTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    <div className="text-sm font-medium">{presentWorkers.length} Workers</div>
                                    {isExpanded ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                                  </div>
                                );
                              })()}
                            </div>
                            
                            {isExpanded && (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-12 text-center">#</TableHead>
                                    <TableHead>Worker</TableHead>
                                    <TableHead>Position</TableHead>
                                    <TableHead className="w-[200px]">Scope Assignment</TableHead>
                                    <TableHead className="text-right">Daily Rate</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-center">Overtime (Hrs)</TableHead>
                                    <TableHead className="text-right">Total Cost</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {(() => {
                                    const sortedRecords = [...records].sort((a, b) => {
                                      const scopeA = scopes.find(s => s.id === a.bom_scope_id)?.name || "Z_Admin / Unassigned";
                                      const scopeB = scopes.find(s => s.id === b.bom_scope_id)?.name || "Z_Admin / Unassigned";
                                      return scopeA.localeCompare(scopeB);
                                    });

                                    return sortedRecords.map((record, index) => {
                                      const daily = record.personnel?.daily_rate || 0;
                                      const ot = record.personnel?.overtime_rate || 0;
                                      const hrs = record.hours_worked || 0;
                                      const oth = record.overtime_hours || 0;
                                      const rowCost = record.status === "absent" ? 0 : ((daily / 8) * hrs) + (ot * oth);

                                      return (
                                        <TableRow key={record.id} className={record.status === "absent" ? "bg-muted/50 opacity-75" : ""}>
                                          <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
                                          <TableCell className="font-medium">{record.personnel?.name || "Unknown"}</TableCell>
                                          <TableCell>{record.personnel?.role}</TableCell>
                                          <TableCell>{scopes.find(s => s.id === record.bom_scope_id)?.name || "Admin / Unassigned"}</TableCell>
                                          <TableCell className="text-right">AED {daily.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                          <TableCell>
                                            <span className={`text-sm font-semibold ${record.status === "present" ? "text-green-600" : "text-red-500"}`}>
                                              {record.status === "present" ? "Present" : "Absent"}
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-center">{record.hours_worked || 0}</TableCell>
                                          <TableCell className="text-right font-semibold text-primary">
                                            AED {rowCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    });
                                  })()}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        );
                      })}
                      {Object.keys(historicalAttendance).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-md">
                          No historical attendance records found for this project.
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deliveries" className="flex-1 overflow-hidden data-[state=active]:flex flex-col mt-0">
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="shrink-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Material Deliveries</CardTitle>
                      <CardDescription>Track deliveries to site</CardDescription>
                      <div className="flex items-center gap-3 mt-4 flex-nowrap shrink-0 overflow-x-auto pb-1">
                        <div className="flex items-center gap-2 shrink-0">
                          <Label className="whitespace-nowrap">Date:</Label>
                          <Input
                            type="date"
                            value={deliveriesDate}
                            onChange={(e) => setDeliveriesDate(e.target.value)}
                            className="w-auto h-9 min-w-[130px]"
                          />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Label className="whitespace-nowrap">Supplier:</Label>
                          <Select value={deliverySupplierFilter} onValueChange={setDeliverySupplierFilter}>
                            <SelectTrigger className="w-[180px] h-9">
                              <SelectValue placeholder="All Suppliers" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Suppliers</SelectItem>
                              {Array.from(new Set(deliveries.map(d => d.supplier))).filter(Boolean).sort().map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {(deliveriesDate || deliverySupplierFilter !== "all") && (
                          <Button variant="ghost" size="sm" onClick={() => { setDeliveriesDate(""); setDeliverySupplierFilter("all"); }} className="text-muted-foreground h-9 shrink-0">
                            Clear Filters
                          </Button>
                        )}
                      </div>
                    </div>
                    <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
                      <DialogTrigger asChild>
                        <Button onClick={() => { resetDeliveryForm(); set