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
import { Plus, Pencil, Trash2, Archive, Users, Truck, ClipboardList, ArrowUp, ArrowDown, Check, ArrowUpDown, ShoppingCart, Banknote, Wrench, Eye, Activity, List as ListIcon, CheckCircle2, AlertCircle } from "lucide-react";
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
  const [consumptions, setConsumptions] = useState<MaterialConsumption[]>([]);
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
  const [seenResolvedIds, setSeenResolvedIds] = useState<string>("");
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
  const [cashAdvances, setCashAdvances] = useState<CashAdvance[]>([]);
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

  useEffect(() => {
    loadProjects();
    loadPersonnel();
    checkUserAssignment();
  }, []);

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

  useEffect(() => {
    if (activeTab === 'request') {
      setSeenResolvedIds(resolvedRequestIds);
    }
  }, [activeTab, resolvedRequestIds]);

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

    await siteService.createDelivery(payload);
    
    setDeliveryForm(prev => ({ 
      ...prev, 
      item_name: "", 
      quantity: 0, 
      unit: "", 
      receipt_number: "", 
      notes: "" 
    }));
    setIsManualItem(false);
    setIsManualUnit(false);
    setDeliveryDialogOpen(false);
    loadDeliveries();
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
            <TabsList className="shrink-0 grid w-full grid-cols-6">
              <TabsTrigger value="manpower">
                <Users className="h-4 w-4 mr-2" />
                Project Manpower
              </TabsTrigger>
              <TabsTrigger value="attendance">
                <ClipboardList className="h-4 w-4 mr-2" />
                Attendance
              </TabsTrigger>
              <TabsTrigger value="deliveries">
                <Truck className="h-4 w-4 mr-2" />
                Deliveries
              </TabsTrigger>
              <TabsTrigger value="consumption">
                <ClipboardList className="h-4 w-4 mr-2" />
                Material Usage
              </TabsTrigger>
              <TabsTrigger value="request" className="relative">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Requests
                {(() => {
                  const hasNewResolved = resolvedRequestIds !== seenResolvedIds && activeTab !== 'request';
                  const resolvedCount = [...requests, ...cashAdvances].filter(r => r.status === 'approved' || r.status === 'rejected').length;
                  if (hasNewResolved && resolvedCount > 0) {
                    return (
                      <Badge variant="destructive" className="ml-2 h-5 min-w-5 flex items-center justify-center p-0 px-1.5 text-[10px]">
                        New
                      </Badge>
                    );
                  }
                  return null;
                })()}
              </TabsTrigger>
              <TabsTrigger value="scope">
                <Plus className="h-4 w-4 mr-2" />
                Update Progress
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
                              <Label>Daily Rate (₱)</Label>
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
                              <Label>Overtime Rate (₱/hr)</Label>
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
                                Daily Labor Cost: ₱{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                      <TableCell className="text-right">₱{daily.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
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
                                        ₱{rowCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                    <div className="text-sm font-bold text-primary">₱{dailyTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
                                          <TableCell className="text-right">₱{daily.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                          <TableCell>
                                            <span className={`text-sm font-semibold ${record.status === "present" ? "text-green-600" : "text-red-500"}`}>
                                              {record.status === "present" ? "Present" : "Absent"}
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-center">{record.hours_worked || 0}</TableCell>
                                          <TableCell className="text-center">{record.overtime_hours || 0}</TableCell>
                                          <TableCell className="text-right font-semibold text-primary">
                                            ₱{rowCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                      <div className="flex items-center gap-3 mt-4">
                        <Label>Date Filter:</Label>
                        <Input
                          type="date"
                          value={deliveriesDate}
                          onChange={(e) => setDeliveriesDate(e.target.value)}
                          className="w-auto h-9"
                        />
                        {deliveriesDate && (
                          <Button variant="ghost" size="sm" onClick={() => setDeliveriesDate("")} className="text-muted-foreground h-9">
                            Clear Filter
                          </Button>
                        )}
                      </div>
                    </div>
                    <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          New Delivery
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Record Delivery</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleDeliverySubmit} className="space-y-4">
                          <div className="space-y-3 pb-2 border-b">
                            <Label>Source of Delivery</Label>
                            <RadioGroup 
                              value={deliveryForm.source_type} 
                              onValueChange={(val) => {
                                if (val === "warehouse") {
                                  setDeliveryForm({ ...deliveryForm, supplier: "Main Warehouse" });
                                } else {
                                  setDeliveryForm({ ...deliveryForm, supplier: "" });
                                }
                              }}
                              className="flex gap-4"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="warehouse" id="r-warehouse" />
                                <Label htmlFor="r-warehouse" className="font-normal cursor-pointer">Main Warehouse</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="supplier" id="r-supplier" />
                                <Label htmlFor="r-supplier" className="font-normal cursor-pointer">Direct from Supplier</Label>
                              </div>
                            </RadioGroup>
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                              <Label htmlFor="item">Item Name</Label>
                              {!isManualItem ? (
                                <Select
                                  value={deliveryForm.item_name}
                                  onValueChange={(val) => {
                                    if (val === "others") {
                                      setIsManualItem(true);
                                      setDeliveryForm({ ...deliveryForm, item_name: "", unit: "" });
                                      setIsManualUnit(false);
                                    } else {
                                      const mat = bomMaterials.find(m => m.name === val);
                                      setDeliveryForm({ ...deliveryForm, item_name: val, unit: mat?.unit || deliveryForm.unit });
                                      setIsManualUnit(false);
                                    }
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select material" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {bomMaterials.map((mat) => (
                                      <SelectItem key={mat.id} value={mat.name}>{mat.name}</SelectItem>
                                    ))}
                                    <SelectItem value="others" className="font-semibold text-blue-600">Others (Manual Input)</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="flex gap-2">
                                  <Input
                                    id="item"
                                    placeholder="Custom material"
                                    value={deliveryForm.item_name}
                                    onChange={(e) => setDeliveryForm({ ...deliveryForm, item_name: e.target.value })}
                                    required
                                  />
                                  <Button type="button" variant="outline" className="px-2" onClick={() => {
                                    setIsManualItem(false);
                                    setDeliveryForm({ ...deliveryForm, item_name: "", unit: "" });
                                  }}>
                                    List
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="supplier">Supplier Name</Label>
                              <Input
                                id="supplier"
                                value={deliveryForm.supplier}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, supplier: e.target.value })}
                                disabled={deliveryForm.source_type === "warehouse"}
                                required={deliveryForm.source_type !== "warehouse"}
                                placeholder={deliveryForm.source_type === "warehouse" ? "Main Warehouse" : "Enter supplier name"}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="quantity">Quantity</Label>
                              <Input
                                id="quantity"
                                type="number"
                                step="0.01"
                                value={deliveryForm.quantity}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, quantity: parseFloat(e.target.value) })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="unit">Unit</Label>
                              {!isManualUnit ? (
                                <Select
                                  value={deliveryForm.unit}
                                  onValueChange={(val) => {
                                    if (val === "others") {
                                      setIsManualUnit(true);
                                      setDeliveryForm({ ...deliveryForm, unit: "" });
                                    } else {
                                      setDeliveryForm({ ...deliveryForm, unit: val });
                                    }
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select unit" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableUnits.map((u) => (
                                      <SelectItem key={u} value={u}>{u}</SelectItem>
                                    ))}
                                    <SelectItem value="others" className="font-semibold text-blue-600">Others (Manual Input)</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="flex gap-2">
                                  <Input
                                    id="unit"
                                    value={deliveryForm.unit}
                                    onChange={(e) => setDeliveryForm({ ...deliveryForm, unit: e.target.value })}
                                    placeholder="Custom unit"
                                    required
                                  />
                                  <Button type="button" variant="outline" className="px-2" onClick={() => {
                                    setIsManualUnit(false);
                                    setDeliveryForm({ ...deliveryForm, unit: "" });
                                  }}>
                                    List
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="receipt_number">Receipt Number</Label>
                              <Input
                                id="receipt_number"
                                value={deliveryForm.receipt_number || ""}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, receipt_number: e.target.value })}
                                placeholder="Optional"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="delivery_date">Delivery Date</Label>
                              <Input
                                id="delivery_date"
                                type="date"
                                value={deliveryForm.delivery_date}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, delivery_date: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="received_by">Received By</Label>
                              <Input
                                id="received_by"
                                value={deliveryForm.received_by}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, received_by: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="status">Status</Label>
                              <Select 
                                value={deliveryForm.status} 
                                onValueChange={(value) => setDeliveryForm({ ...deliveryForm, status: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="received">Received</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-4">
                            <Button type="button" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={resetDeliveryForm}>
                              Clear
                            </Button>
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" onClick={() => setDeliveryDialogOpen(false)}>
                                Done / Close
                              </Button>
                              <Button type="submit">Save</Button>
                            </div>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden pb-4">
                  <div className="space-y-4 overflow-y-auto h-full pr-2">
                    {Object.entries(
                      deliveries.reduce((acc, curr) => {
                        const key = `${curr.supplier}::${curr.receipt_number || 'No Receipt'}::${curr.delivery_date}`;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(curr);
                        return acc;
                      }, {} as Record<string, Delivery[]>)
                    ).map(([groupKey, groupDeliveries]) => {
                      const [supplier, receipt, date] = groupKey.split('::');
                      const isExpanded = expandedReceipts[groupKey];
                      return (
                        <div key={groupKey} className="border rounded-lg overflow-hidden">
                          <div 
                            className="bg-muted/50 p-4 flex justify-between items-center cursor-pointer hover:bg-muted transition-colors"
                            onClick={() => setExpandedReceipts(prev => ({ ...prev, [groupKey]: !isExpanded }))}
                          >
                            <div className="flex items-center gap-4">
                              <div>
                                <h4 className="font-semibold">{supplier}</h4>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span>{date}</span>
                                  {receipt !== 'No Receipt' && (
                                    <>
                                      <span>•</span>
                                      <Badge variant="outline">Receipt: {receipt}</Badge>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-sm font-medium">{groupDeliveries.length} items</div>
                              {isExpanded ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-12 text-center">#</TableHead>
                                  <TableHead className="font-medium">Item</TableHead>
                                  <TableHead>Quantity</TableHead>
                                  <TableHead>Received By</TableHead>
                                  <TableHead>Notes</TableHead>
                                  <TableHead className="text-right w-24">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {groupDeliveries.map((delivery, index) => (
                                  <TableRow key={delivery.id}>
                                    <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
                                    <TableCell className="font-medium">{delivery.item_name}</TableCell>
                                    <TableCell>{delivery.quantity} {delivery.unit}</TableCell>
                                    <TableCell>{delivery.received_by || "-"}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={delivery.notes}>{delivery.notes || "-"}</TableCell>
                                    <TableCell className="text-right">
                                      <Button size="sm" variant="ghost" onClick={async (e) => {
                                        e.stopPropagation();
                                        if(confirm("Archive this delivery?")) {
                                          await siteService.deleteDelivery(delivery.id);
                                          loadDeliveries();
                                        }
                                      }} title="Archive">
                                        <Archive className="h-4 w-4 text-orange-600" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {groupDeliveries.length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground border-2 border-dashed">
                                      No deliveries recorded for this date.
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="consumption" className="flex-1 overflow-hidden data-[state=active]:flex flex-col mt-0">
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="shrink-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Material Consumption</CardTitle>
                      <CardDescription>Track materials used and assign them to specific Scopes of Work</CardDescription>
                      <div className="flex items-center gap-3 mt-4">
                        <Label>Date Filter:</Label>
                        <Input
                          type="date"
                          value={consumptionDate}
                          onChange={(e) => setConsumptionDate(e.target.value)}
                          className="w-auto h-9"
                        />
                        {consumptionDate && (
                          <Button variant="ghost" size="sm" onClick={() => setConsumptionDate("")} className="text-muted-foreground h-9">
                            Clear Filter
                          </Button>
                        )}
                      </div>
                    </div>
                    <Dialog open={consumptionDialogOpen} onOpenChange={setConsumptionDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Log Usage
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Log Material Consumption</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleConsumptionSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="bom_scope_id">Scope of Work</Label>
                            <Select
                              value={consumptionForm.bom_scope_id}
                              onValueChange={(val) => setConsumptionForm({ ...consumptionForm, bom_scope_id: val })}
                              required
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Assign to scope..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned" className="text-muted-foreground italic">General / Unassigned</SelectItem>
                                {scopes.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="item">Item Name</Label>
                              {!isManualItem ? (
                                <Select
                                  value={consumptionForm.item_name}
                                  onValueChange={(val) => {
                                    if (val === "others") {
                                      setIsManualItem(true);
                                      setConsumptionForm({ ...consumptionForm, item_name: "", unit: "" });
                                      setIsManualUnit(false);
                                    } else {
                                      const mat = bomMaterials.find(m => m.name === val);
                                      setConsumptionForm({ ...consumptionForm, item_name: val, unit: mat?.unit || consumptionForm.unit });
                                      setIsManualUnit(false);
                                    }
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select material" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {bomMaterials
                                      .filter(mat => !consumptionForm.bom_scope_id || consumptionForm.bom_scope_id === "unassigned" || mat.scope_id === consumptionForm.bom_scope_id)
                                      .map((mat) => (
                                      <SelectItem key={mat.id} value={mat.name}>{mat.name}</SelectItem>
                                    ))}
                                    <SelectItem value="others" className="font-semibold text-blue-600">Others (Manual Input)</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="flex gap-2">
                                  <Input
                                    id="item"
                                    placeholder="Custom material"
                                    value={consumptionForm.item_name}
                                    onChange={(e) => setConsumptionForm({ ...consumptionForm, item_name: e.target.value })}
                                    required
                                  />
                                  <Button type="button" variant="outline" className="px-2" onClick={() => {
                                    setIsManualItem(false);
                                    setConsumptionForm({ ...consumptionForm, item_name: "", unit: "" });
                                  }}>
                                    List
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="date_used">Date Used</Label>
                              <Input
                                id="date_used"
                                type="date"
                                value={consumptionForm.date_used}
                                onChange={(e) => setConsumptionForm({ ...consumptionForm, date_used: e.target.value })}
                                required
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="qty">Quantity Used</Label>
                              <Input
                                id="qty"
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={consumptionForm.quantity}
                                onChange={(e) => setConsumptionForm({ ...consumptionForm, quantity: parseFloat(e.target.value) || 0 })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="unit">Unit</Label>
                              {!isManualUnit ? (
                                <Select
                                  value={consumptionForm.unit}
                                  onValueChange={(val) => {
                                    if (val === "others") {
                                      setIsManualUnit(true);
                                      setConsumptionForm({ ...consumptionForm, unit: "" });
                                    } else {
                                      setConsumptionForm({ ...consumptionForm, unit: val });
                                    }
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select unit" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableUnits.map((u) => (
                                      <SelectItem key={u} value={u}>{u}</SelectItem>
                                    ))}
                                    <SelectItem value="others" className="font-semibold text-blue-600">Others (Manual Input)</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="flex gap-2">
                                  <Input
                                    id="unit"
                                    value={consumptionForm.unit}
                                    onChange={(e) => setConsumptionForm({ ...consumptionForm, unit: e.target.value })}
                                    placeholder="Custom unit"
                                    required
                                  />
                                  <Button type="button" variant="outline" className="px-2" onClick={() => {
                                    setIsManualUnit(false);
                                    setConsumptionForm({ ...consumptionForm, unit: "" });
                                  }}>
                                    List
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="recorded_by">Recorded By</Label>
                            <Input
                              id="recorded_by"
                              value={consumptionForm.recorded_by}
                              onChange={(e) => setConsumptionForm({ ...consumptionForm, recorded_by: e.target.value })}
                            />
                          </div>
                          <div className="flex justify-between items-center pt-4 border-t">
                            <Button type="button" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={resetConsumptionForm}>
                              Clear Form
                            </Button>
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" onClick={() => setConsumptionDialogOpen(false)}>
                                Done / Close
                              </Button>
                              <Button type="submit">Save Usage</Button>
                            </div>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden pb-4">
                  {consumptions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg bg-gray-50">
                      <p className="mb-4">No material consumption recorded yet.</p>
                    </div>
                  ) : consumptionDate ? (
                    <div className="overflow-y-auto h-full border rounded-md relative">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12 text-center">Date</TableHead>
                            <TableHead className="font-medium">Item</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Scope Assignment</TableHead>
                            <TableHead>Recorded By</TableHead>
                            <TableHead className="text-right w-40">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {consumptions.map((row) => {
                            const isEditing = editingConsumptionId === row.id;
                            return (
                            <TableRow key={row.id}>
                              <TableCell className="whitespace-nowrap">
                                {isEditing ? (
                                  <Input
                                    type="date"
                                    value={row.date_used}
                                    className="w-40 h-8"
                                    onChange={(e) => {
                                      const list = [...consumptions];
                                      const idx = list.findIndex(l => l.id === row.id);
                                      list[idx].date_used = e.target.value;
                                      setConsumptions(list);
                                    }}
                                    onBlur={(e) => siteService.updateMaterialConsumption(row.id, { date_used: e.target.value })}
                                  />
                                ) : (
                                  row.date_used
                                )}
                              </TableCell>
                              <TableCell className="font-medium">
                                {isEditing ? (
                                  manualEditItems[row.id] || (row.item_name && !bomMaterials.find(m => m.name === row.item_name)) ? (
                                    <div className="flex gap-2">
                                      <Input
                                        value={row.item_name}
                                        className="h-8 w-full min-w-[120px]"
                                        placeholder="Custom material"
                                        onChange={(e) => {
                                          const list = [...consumptions];
                                          const idx = list.findIndex(l => l.id === row.id);
                                          list[idx].item_name = e.target.value;
                                          setConsumptions(list);
                                        }}
                                        onBlur={(e) => siteService.updateMaterialConsumption(row.id, { item_name: e.target.value })}
                                      />
                                      <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={() => {
                                        setManualEditItems(prev => ({ ...prev, [row.id]: false }));
                                        const list = [...consumptions];
                                        const idx = list.findIndex(l => l.id === row.id);
                                        list[idx].item_name = "";
                                        setConsumptions(list);
                                      }}>
                                        List
                                      </Button>
                                    </div>
                                  ) : (
                                    <Select
                                      value={row.item_name || ""}
                                      onValueChange={(val) => {
                                        if (val === "others") {
                                          setManualEditItems(prev => ({ ...prev, [row.id]: true }));
                                          const list = [...consumptions];
                                          const idx = list.findIndex(l => l.id === row.id);
                                          list[idx].item_name = "";
                                          setConsumptions(list);
                                        } else {
                                          const mat = bomMaterials.find(m => m.name === val);
                                          const list = [...consumptions];
                                          const idx = list.findIndex(l => l.id === row.id);
                                          list[idx].item_name = val;
                                          if (mat?.unit) list[idx].unit = mat.unit;
                                          setConsumptions(list);
                                          siteService.updateMaterialConsumption(row.id, { 
                                            item_name: val,
                                            unit: mat?.unit || list[idx].unit
                                          });
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Select material" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {bomMaterials
                                          .filter(mat => !row.bom_scope_id || row.bom_scope_id === "unassigned" || mat.scope_id === row.bom_scope_id)
                                          .map((mat) => (
                                          <SelectItem key={mat.id} value={mat.name}>{mat.name}</SelectItem>
                                        ))}
                                        <SelectItem value="others" className="font-semibold text-blue-600">Others (Manual Input)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )
                                ) : (
                                  row.item_name
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="w-20 h-8"
                                      value={row.quantity}
                                      onChange={(e) => {
                                        const list = [...consumptions];
                                        const idx = list.findIndex(l => l.id === row.id);
                                        list[idx].quantity = parseFloat(e.target.value) || 0;
                                        setConsumptions(list);
                                      }}
                                      onBlur={(e) => siteService.updateMaterialConsumption(row.id, { quantity: parseFloat(e.target.value) || 0 })}
                                    />
                                    <span>{row.unit}</span>
                                  </div>
                                ) : (
                                  `${row.quantity} ${row.unit}`
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Select
                                    value={row.bom_scope_id || "unassigned"}
                                    onValueChange={(val) => {
                                      const list = [...consumptions];
                                      const idx = list.findIndex(l => l.id === row.id);
                                      list[idx].bom_scope_id = val === "unassigned" ? null : val;
                                      
                                      const scopeName = val === "unassigned" ? undefined : scopes.find(s => s.id === val)?.name;
                                      if (scopeName) {
                                        list[idx].bom_scope_of_work = { name: scopeName };
                                      } else {
                                        delete list[idx].bom_scope_of_work;
                                      }
                                      
                                      setConsumptions(list);
                                      siteService.updateMaterialConsumption(row.id, { bom_scope_id: val === "unassigned" ? null : val });
                                    }}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unassigned" className="text-muted-foreground italic">Admin / Unassigned</SelectItem>
                                      {scopes.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  row.bom_scope_id ? (
                                    <Badge variant="secondary">{row.bom_scope_of_work?.name || "Unknown Scope"}</Badge>
                                  ) : (
                                    <span className="text-muted-foreground italic">Admin / Unassigned</span>
                                  )
                                )}
                              </TableCell>
                              <TableCell>{row.recorded_by || "-"}</TableCell>
                              <TableCell className="text-right">
                                {isEditing ? (
                                  <Button variant="ghost" size="sm" onClick={() => setEditingConsumptionId(null)}>
                                    <Check className="h-4 w-4 text-green-500" />
                                  </Button>
                                ) : (
                                  <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => setEditingConsumptionId(row.id)}>
                                      <Pencil className="h-4 w-4 text-blue-500" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={async () => {
                                      if(confirm("Archive this record?")) {
                                        await siteService.deleteMaterialConsumption(row.id);
                                        loadConsumptions();
                                      }
                                    }} title="Archive">
                                      <Archive className="h-4 w-4 text-orange-600" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="space-y-4 overflow-y-auto h-full pr-2">
                      {Object.entries(
                        consumptions.reduce((acc, curr) => {
                          const key = curr.date_used;
                          if (!acc[key]) acc[key] = [];
                          acc[key].push(curr);
                          return acc;
                        }, {} as Record<string, MaterialConsumption[]>)
                      ).sort(([a], [b]) => b.localeCompare(a)).map(([dateKey, groupConsumptions]) => {
                        const isExpanded = expandedConsumptions[dateKey];
                        return (
                          <div key={dateKey} className="border rounded-lg overflow-hidden">
                            <div 
                              className="bg-muted/50 p-4 flex justify-between items-center cursor-pointer hover:bg-muted transition-colors"
                              onClick={() => setExpandedConsumptions(prev => ({ ...prev, [dateKey]: !isExpanded }))}
                            >
                              <div className="flex items-center gap-4">
                                <div className="font-semibold flex items-center gap-2">
                                  <ClipboardList className="h-4 w-4" />
                                  {dateKey}
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-sm font-medium">{groupConsumptions.length} items used</div>
                                {isExpanded ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                              </div>
                            </div>
                            
                            {isExpanded && (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-12 text-center">#</TableHead>
                                    <TableHead>Item</TableHead>
                                    <TableHead>Quantity</TableHead>
                                    <TableHead>Scope Assignment</TableHead>
                                    <TableHead>Recorded By</TableHead>
                                    <TableHead className="text-right w-24">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {groupConsumptions.map((record, index) => (
                                    <TableRow key={record.id}>
                                      <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
                                      <TableCell className="font-medium">{record.item_name}</TableCell>
                                      <TableCell>{record.quantity} {record.unit}</TableCell>
                                      <TableCell>
                                        {record.bom_scope_id ? (
                                          <Badge variant="secondary">{record.bom_scope_of_work?.name || "Unknown Scope"}</Badge>
                                        ) : (
                                          <span className="text-muted-foreground italic">Admin / Unassigned</span>
                                        )}
                                      </TableCell>
                                      <TableCell>{record.recorded_by || "-"}</TableCell>
                                      <TableCell className="text-right">
                                        <Button size="sm" variant="ghost" onClick={async (e) => {
                                          e.stopPropagation();
                                          if(confirm("Archive this record?")) {
                                            await siteService.deleteMaterialConsumption(record.id);
                                            loadConsumptions();
                                          }
                                        }} title="Archive">
                                          <Archive className="h-4 w-4 text-orange-600" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="request" className="flex-1 overflow-hidden data-[state=active]:flex flex-col mt-0">
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="shrink-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Site Requests</CardTitle>
                      <CardDescription>Request materials, tools, equipment, PPE, and cash advances</CardDescription>
                      <div className="flex items-center gap-3 mt-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Label>Date:</Label>
                          <Input
                            type="date"
                            value={requestDate}
                            onChange={(e) => setRequestDate(e.target.value)}
                            className="w-auto h-9"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label>Type:</Label>
                          <Select value={requestFilterType} onValueChange={setRequestFilterType}>
                            <SelectTrigger className="w-[180px] h-9">
                              <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Types</SelectItem>
                              <SelectItem value="Materials">Materials</SelectItem>
                              <SelectItem value="Tools & Equipments">Tools & Equipments</SelectItem>
                              <SelectItem value="Petty Cash">Petty Cash</SelectItem>
                              <SelectItem value="Cash Advance">Cash Advance</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {(requestDate || requestFilterType !== "all") && (
                          <Button variant="ghost" size="sm" onClick={() => { setRequestDate(""); setRequestFilterType("all"); }} className="text-muted-foreground h-9">
                            Clear Filters
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 md:flex-row">
                      <Button onClick={() => openRequestDialog('Materials', 'MR')} variant="default" className="bg-blue-600 hover:bg-blue-700 text-white">
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Material Request
                      </Button>
                      <Button onClick={() => openRequestDialog('Tools & Equipments', 'TE')} variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50">
                        <Wrench className="h-4 w-4 mr-2" />
                        Tools & Equipments
                      </Button>
                      <Button onClick={() => openRequestDialog('Petty Cash', 'PC')} variant="outline" className="border-teal-600 text-teal-700 hover:bg-teal-50">
                        <Banknote className="h-4 w-4 mr-2" />
                        Petty Cash
                      </Button>
                      <Button onClick={() => openRequestDialog('Cash Advance', 'CA')} variant="outline" className="border-green-600 text-green-700 hover:bg-green-50">
                        <Banknote className="h-4 w-4 mr-2" />
                        Cash Advance
                      </Button>
                    </div>
                    
                    <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
                      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
                        <div className="p-6 pb-2 shrink-0">
                          <DialogHeader>
                            <DialogTitle>Submit Site Request</DialogTitle>
                          </DialogHeader>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto px-6">
                          <div className="flex justify-between items-center bg-muted/50 p-3 rounded-md border border-muted mb-4">
                            <div className="flex items-center">
                              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Form No:</span>
                              <span className="font-bold ml-3 text-lg text-primary">{requestForm.form_number}</span>
                            </div>
                            <Badge variant="outline" className="text-sm px-3 py-1 bg-background">{requestForm.request_type}</Badge>
                          </div>

                          <form id="request-form" onSubmit={handleRequestSubmit} className="space-y-4 pb-4">
                            <div className="grid grid-cols-2 gap-4 border-b pb-4">
                              <div className="space-y-2">
                                <Label>Date Required *</Label>
                                <Input
                                  type="date"
                                  value={requestForm.request_date}
                                  onChange={(e) => setRequestForm({ ...requestForm, request_date: e.target.value })}
                                  required
                                />
                              </div>
                              {requestForm.request_type !== "Cash Advance" && requestForm.request_type !== "Petty Cash" && (
                                <div className="space-y-2">
                                  <Label>Requested By *</Label>
                                  <Input
                                    value={requestForm.requested_by}
                                    onChange={(e) => setRequestForm({ ...requestForm, requested_by: e.target.value })}
                                    required
                                  />
                                </div>
                              )}
                            </div>

                            {requestForm.request_type === "Cash Advance" || requestForm.request_type === "Petty Cash" ? (
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-2 md:col-span-1">
                                  <Label>Personnel *</Label>
                                  <Select
                                    value={requestForm.personnel_id}
                                    onValueChange={(val) => setRequestForm({ ...requestForm, personnel_id: val })}
                                    required
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select worker" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {projectPersonnelList.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.role})</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Amount *</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={requestForm.amount}
                                    onChange={(e) => setRequestForm({ ...requestForm, amount: parseFloat(e.target.value) || 0 })}
                                    required
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="bg-muted/30 p-4 rounded-md border space-y-4">
                                  <h4 className="font-semibold text-sm">Add Item to Request</h4>
                                  <div className="grid grid-cols-2 gap-4">
                                    {requestForm.request_type === "Materials" && (
                                      <div className="space-y-2 col-span-2 md:col-span-1">
                                        <Label>Scope of Work (Optional)</Label>
                                        <Select
                                          value={requestForm.bom_scope_id}
                                          onValueChange={(val) => setRequestForm({ ...requestForm, bom_scope_id: val })}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Assign to scope..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="unassigned" className="text-muted-foreground italic">General / Unassigned</SelectItem>
                                            {scopes.map((s) => (
                                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}
                                    <div className={`space-y-2 col-span-2 ${requestForm.request_type === "Materials" ? "md:col-span-1" : ""}`}>
                                      <Label>Requested Item *</Label>
                                      {requestForm.request_type !== "Materials" ? (
                                        <Input
                                          placeholder="Type item name"
                                          value={requestForm.item_name}
                                          onChange={(e) => setRequestForm({ ...requestForm, item_name: e.target.value })}
                                        />
                                      ) : !isManualRequestItem ? (
                                        <Select
                                          value={requestForm.item_name}
                                          onValueChange={(val) => {
                                            if (val === "others") {
                                              setIsManualRequestItem(true);
                                              setRequestForm({ ...requestForm, item_name: "", unit: "" });
                                              setIsManualRequestUnit(false);
                                            } else {
                                              const mat = bomMaterials.find(m => m.name === val);
                                              setRequestForm({ ...requestForm, item_name: val, unit: mat?.unit || requestForm.unit });
                                              setIsManualRequestUnit(false);
                                            }
                                          }}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select from BOM" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {bomMaterials
                                              .filter(mat => !requestForm.bom_scope_id || requestForm.bom_scope_id === "unassigned" || mat.scope_id === requestForm.bom_scope_id)
                                              .map((mat) => (
                                              <SelectItem key={mat.id} value={mat.name}>{mat.name}</SelectItem>
                                            ))}
                                            <SelectItem value="others" className="font-semibold text-blue-600">Others (Manual Input)</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <div className="flex gap-2">
                                          <Input
                                            placeholder="Type item name"
                                            value={requestForm.item_name}
                                            onChange={(e) => setRequestForm({ ...requestForm, item_name: e.target.value })}
                                            required
                                          />
                                          <Button type="button" variant="outline" className="px-2" onClick={() => {
                                            setIsManualRequestItem(false);
                                            setRequestForm({ ...requestForm, item_name: "", unit: "" });
                                          }}>
                                            BOM
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Quantity</Label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={requestForm.quantity}
                                        onChange={(e) => setRequestForm({ ...requestForm, quantity: parseFloat(e.target.value) || 0 })}
                                        placeholder="Required"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Unit</Label>
                                      {!isManualRequestUnit ? (
                                        <Select
                                          value={requestForm.unit}
                                          onValueChange={(val) => {
                                            if (val === "others") {
                                              setIsManualRequestUnit(true);
                                              setRequestForm({ ...requestForm, unit: "" });
                                            } else {
                                              setRequestForm({ ...requestForm, unit: val });
                                            }
                                          }}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select unit" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {availableUnits.map((u) => (
                                              <SelectItem key={u} value={u}>{u}</SelectItem>
                                            ))}
                                            <SelectItem value="others" className="font-semibold text-blue-600">Others (Manual Input)</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <div className="flex gap-2">
                                          <Input
                                            value={requestForm.unit}
                                            onChange={(e) => setRequestForm({ ...requestForm, unit: e.target.value })}
                                            placeholder="Custom unit"
                                            required
                                          />
                                          <Button type="button" variant="outline" className="px-2" onClick={() => {
                                            setIsManualRequestUnit(false);
                                            setRequestForm({ ...requestForm, unit: "" });
                                          }}>
                                            List
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Item Notes</Label>
                                    <Textarea
                                      value={requestForm.notes}
                                      onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
                                      placeholder="Any specific details for this item..."
                                      rows={2}
                                    />
                                  </div>
                                  <Button type="button" onClick={handleAddItem} variant="secondary" className="w-full">
                                    <Plus className="w-4 h-4 mr-2" /> Add Item to Request List
                                  </Button>
                                </div>

                                {requestItems.length > 0 && (
                                  <div className="border rounded-md mt-4 max-h-[30vh] overflow-y-auto">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="bg-muted/50">
                                          <TableHead>Scope</TableHead>
                                          <TableHead>Item Details</TableHead>
                                          <TableHead>Qty</TableHead>
                                          <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {requestItems.map((item, idx) => (
                                          <TableRow key={idx}>
                                            <TableCell>
                                              {item.bom_scope_id === "unassigned" || !item.bom_scope_id ? (
                                                <span className="text-muted-foreground italic text-xs">General</span>
                                              ) : (
                                                <Badge variant="secondary" className="text-xs">
                                                  {scopes.find(s => s.id === item.bom_scope_id)?.name || "Unknown"}
                                                </Badge>
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              <div className="font-medium text-sm">{item.item_name}</div>
                                              {item.notes && <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{item.notes}</div>}
                                            </TableCell>
                                            <TableCell className="text-sm">{item.quantity} {item.unit}</TableCell>
                                            <TableCell className="text-right">
                                              <Button type="button" size="sm" variant="ghost" onClick={() => handleRemoveItem(idx)} className="h-6 w-6 p-0 text-red-500">
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                              </div>
                            )}
                          </form>
                        </div>
                        
                        <div className="flex justify-between items-center p-6 pt-4 border-t shrink-0">
                          <Button type="button" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={resetRequestForm}>
                            Clear Form
                          </Button>
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => setRequestDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" form="request-form">Submit Request</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden pb-4">
                  {(() => {
                    const groupedRequests = requests.reduce((acc: any, r: any) => {
                      const key = r.form_number || r.id;
                      if (!acc[key]) {
                        acc[key] = {
                          id: r.id,
                          isCA: false,
                          form_number: r.form_number || '-',
                          request_type: r.request_type || 'Materials',
                          request_date: r.request_date,
                          requested_by: r.requested_by,
                          status: r.status,
                          items: []
                        };
                      }
                      acc[key].items.push({
                        id: r.id,
                        item_name: r.item_name,
                        quantity: r.quantity,
                        unit: r.unit,
                        amount: r.amount,
                        bom_scope_id: r.bom_scope_id,
                        bom_scope_of_work: r.bom_scope_of_work,
                        notes: r.notes
                      });
                      return acc;
                    }, {});

                    const combinedGroups = [
                      ...Object.values(groupedRequests),
                      ...cashAdvances.map((c: any) => ({
                        id: c.id,
                        isCA: true,
                        form_number: c.form_number || '-',
                        request_type: 'Cash Advance',
                        request_date: c.request_date,
                        requested_by: c.personnel?.name || '-',
                        status: c.status,
                        items: [{
                          id: c.id,
                          item_name: `${c.personnel?.name} (${c.personnel?.role})`,
                          amount: c.amount,
                          notes: c.reason
                        }]
                      }))
                    ].sort((a: any, b: any) => new Date(b.request_date).getTime() - new Date(a.request_date).getTime());

                    const filteredGroups = combinedGroups.filter((g: any) => {
                      if (requestFilterType !== "all" && g.request_type !== requestFilterType) return false;
                      return true;
                    });

                    if (filteredGroups.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg bg-gray-50 mt-4">
                          <p className="mb-4">No requests found matching your filters.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="flex flex-col h-full space-y-4 mt-4">
                        <div className="overflow-y-auto flex-1 border rounded-md relative">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-24">Date</TableHead>
                                <TableHead className="w-32">Form No.</TableHead>
                                <TableHead className="w-32">Type</TableHead>
                                <TableHead>Requested By</TableHead>
                                <TableHead>Details / Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right w-24">Act</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredGroups.map((group: any) => (
                                <TableRow key={group.id}>
                                  <TableCell className="whitespace-nowrap text-sm">{group.request_date}</TableCell>
                                  <TableCell className="font-mono text-xs font-bold text-primary">{group.form_number}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="font-normal text-xs">{group.request_type}</Badge>
                                  </TableCell>
                                  <TableCell className="text-sm font-medium">{group.requested_by}</TableCell>
                                  <TableCell className="text-sm">
                                    {(group.request_type === "Petty Cash" || group.request_type === "Cash Advance") ? (
                                      <span className="font-semibold text-green-700">₱{group.items[0]?.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}</span>
                                    ) : (
                                      <span>{group.items.length} item(s)</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Badge 
                                      variant="outline" 
                                      className={`text-[10px] ${
                                        group.status === 'fulfilled' || group.status === 'paid' ? 'bg-green-500 text-white' : 
                                        group.status === 'approved' ? 'bg-blue-500 text-white' : 
                                        group.status === 'rejected' ? 'bg-red-500 text-white' : 
                                        'bg-orange-500 text-white'
                                      }`}
                                    >
                                      {group.status?.toUpperCase()}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-500 hover:bg-blue-50" onClick={() => {
                                        setSelectedFormGroup(group);
                                        setViewFormDialogOpen(true);
                                      }}>
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-orange-600 hover:bg-orange-50" onClick={(e) => {
                                        if(confirm("Archive this request?")) {
                                          e.stopPropagation();
                                          if (group.isCA) {
                                            siteService.deleteCashAdvance(group.id).then(() => loadCashAdvances());
                                          } else {
                                            const ids = group.items.map((i: any) => i.id);
                                            supabase.from('site_requests').update({ is_archived: true }).in('id', ids).then(() => loadRequests());
                                          }
                                        }
                                      }} title="Archive">
                                        <Archive className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>

                {/* View Details Modal */}
                <Dialog open={viewFormDialogOpen} onOpenChange={setViewFormDialogOpen}>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        Request Details: <span className="font-mono text-primary">{selectedFormGroup?.form_number}</span>
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-lg border border-border/50">
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Request Type</div>
                          <div className="font-medium text-sm">
                            <Badge variant="secondary">{selectedFormGroup?.request_type}</Badge>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Requested By</div>
                          <div className="font-medium text-sm">{selectedFormGroup?.requested_by}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Date Required</div>
                          <div className="font-medium text-sm">{selectedFormGroup?.request_date}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</div>
                          <div className="font-medium text-sm">
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] ${
                                selectedFormGroup?.status === 'fulfilled' || selectedFormGroup?.status === 'paid' ? 'bg-green-500 text-white' : 
                                selectedFormGroup?.status === 'approved' ? 'bg-blue-500 text-white' : 
                                selectedFormGroup?.status === 'rejected' ? 'bg-red-500 text-white' : 
                                'bg-orange-500 text-white'
                              }`}
                            >
                              {selectedFormGroup?.status?.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className="border rounded-md overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              {!selectedFormGroup?.isCA && <TableHead>Scope of Work</TableHead>}
                              <TableHead>Item / Description</TableHead>
                              {!selectedFormGroup?.isCA && <TableHead>Quantity</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedFormGroup?.items.map((item: any, idx: number) => (
                              <TableRow key={idx}>
                                {!selectedFormGroup?.isCA && (
                                  <TableCell>
                                    {item.bom_scope_id ? (
                                      <Badge variant="outline" className="text-xs">
                                        {item.bom_scope_of_work?.name || "Unknown"}
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground italic text-xs">General / Unassigned</span>
                                    )}
                                  </TableCell>
                                )}
                                <TableCell>
                                  <div className="font-medium">{item.item_name}</div>
                                  {item.notes && <div className="text-xs text-muted-foreground mt-1 max-w-[250px] truncate" title={item.notes}>{item.notes}</div>}
                                </TableCell>
                                {!selectedFormGroup?.isCA && (
                                  <TableCell>{item.quantity > 0 ? `${item.quantity} ${item.unit}` : '-'}</TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

              </Card>
            </TabsContent>

            <TabsContent value="scope" className="flex-1 overflow-hidden data-[state=active]:flex flex-col mt-0">
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="shrink-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Update Progress History</CardTitle>
                      <CardDescription>Track historical completion updates for Scopes of Work</CardDescription>
                      {!showProgressChart ? (
                        <div className="flex items-center gap-3 mt-4 flex-wrap">
                          <Label>Scope Filter:</Label>
                          <Select value={progressScopeFilter} onValueChange={setProgressScopeFilter}>
                            <SelectTrigger className="w-[200px] h-9">
                              <SelectValue placeholder="All Scopes" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Scopes</SelectItem>
                              {scopes.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Label className="ml-2">Date Filter:</Label>
                          <Input
                            type="date"
                            value={progressFilterDate}
                            onChange={(e) => setProgressFilterDate(e.target.value)}
                            className="w-auto h-9"
                          />
                          {progressFilterDate && (
                            <Button variant="ghost" size="sm" onClick={() => setProgressFilterDate("")} className="text-muted-foreground h-9">
                              Clear
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 mt-4 flex-wrap">
                          <Label>Scope Filter:</Label>
                          <Select value={progressScopeFilter} onValueChange={setProgressScopeFilter}>
                            <SelectTrigger className="w-[200px] h-9">
                              <SelectValue placeholder="All Scopes" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Scopes</SelectItem>
                              {scopes.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Label className="ml-2">Range:</Label>
                          <Select value={progressChartRange} onValueChange={setProgressChartRange}>
                            <SelectTrigger className="w-32 h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="7">Last 7 Days</SelectItem>
                              <SelectItem value="30">Last 30 Days</SelectItem>
                              <SelectItem value="all">All Time</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex bg-muted p-1 rounded-md">
                        <Button variant={!showProgressChart ? "secondary" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setShowProgressChart(false)}>
                          <ListIcon className="h-3 w-3 mr-1" /> List
                        </Button>
                        <Button variant={showProgressChart ? "secondary" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setShowProgressChart(true)}>
                          <Activity className="h-3 w-3 mr-1" /> Chart
                        </Button>
                      </div>
                      <Dialog open={updateProgressDialogOpen} onOpenChange={setUpdateProgressDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="bg-green-600 hover:bg-green-700 text-white h-9">
                            <Plus className="h-4 w-4 mr-2" /> Update Progress
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Update Scope Progress</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleProgressSubmit} className="space-y-4">
                            <div className="space-y-2">
                              <Label>Scope of Work *</Label>
                              <Select required value={progressForm.bom_scope_id} onValueChange={(val) => setProgressForm({...progressForm, bom_scope_id: val})}>
                                <SelectTrigger><SelectValue placeholder="Select scope..." /></SelectTrigger>
                                <SelectContent>
                                  {scopes.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name} (Currently {s.completion_percentage || 0}%)</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>New Completion % *</Label>
                                <Input type="number" min="0" max="100" step="0.1" required value={progressForm.percentage} onChange={(e) => setProgressForm({...progressForm, percentage: parseFloat(e.target.value) || 0})} />
                              </div>
                              <div className="space-y-2">
                                <Label>Update Date *</Label>
                                <Input type="date" required value={progressForm.update_date} onChange={(e) => setProgressForm({...progressForm, update_date: e.target.value})} />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Notes / Details</Label>
                              <Textarea value={progressForm.notes} onChange={(e) => setProgressForm({...progressForm, notes: e.target.value})} placeholder="Describe the work completed..." />
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                              <Button type="button" variant="outline" onClick={() => setUpdateProgressDialogOpen(false)}>Cancel</Button>
                              <Button type="submit">Save Update</Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden pb-4">
                  {(() => {
                    if (showProgressChart) {
                      const sorted = [...progressUpdates].sort((a,b) => new Date(a.update_date).getTime() - new Date(b.update_date).getTime());
                      const dailyScopes: Record<string, number> = {};
                      const dataPoints: any[] = [];
                      
                      const uniqueDates = Array.from(new Set(sorted.map(u => u.update_date)));
                      
                      for (const date of uniqueDates) {
                        const updatesOnDate = sorted.filter(u => u.update_date === date);
                        updatesOnDate.forEach(u => {
                          dailyScopes[u.bom_scope_id] = u.percentage_completed || 0;
                        });
                        
                        let totalPct = 0;
                        let count = scopes.length || 1;
                        
                        if (progressScopeFilter !== 'all') {
                          totalPct = dailyScopes[progressScopeFilter] || 0;
                          count = 1;
                        } else {
                          scopes.forEach(s => {
                            totalPct += (dailyScopes[s.id] || 0);
                          });
                        }
                        
                        dataPoints.push({
                          date,
                          completion: parseFloat((totalPct / count).toFixed(2))
                        });
                      }
                      
                      let finalData = dataPoints;
                      if (progressChartRange !== 'all') {
                        const days = parseInt(progressChartRange);
                        const cutoff = new Date();
                        cutoff.setDate(cutoff.getDate() - days);
                        finalData = dataPoints.filter(d => new Date(d.date) >= cutoff);
                      }

                      if (finalData.length === 0) {
                        return (
                          <div className="flex items-center justify-center h-full text-muted-foreground border-2 border-dashed rounded-lg bg-gray-50">
                            No chart data available for the selected range.
                          </div>
                        );
                      }

                      return (
                        <div className="h-full w-full min-h-[300px] border rounded-lg p-4 bg-white">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={finalData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
                              <ChartTooltip formatter={(value) => [`${value}%`, progressScopeFilter === 'all' ? 'Overall Completion' : 'Scope Completion']} />
                              <Line type="monotone" dataKey="completion" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    }

                    const filteredUpdates = progressUpdates.filter(pu => {
                      if (progressScopeFilter !== 'all' && pu.bom_scope_id !== progressScopeFilter) return false;
                      if (progressFilterDate) return pu.update_date === progressFilterDate;
                      const puDate = new Date(pu.update_date);
                      const today = new Date();
                      const sixDaysAgo = new Date();
                      sixDaysAgo.setDate(today.getDate() - 6);
                      sixDaysAgo.setHours(0, 0, 0, 0);
                      puDate.setHours(0, 0, 0, 0);
                      return puDate >= sixDaysAgo;
                    });

                    if (filteredUpdates.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg bg-gray-50">
                          <p>No progress updates found for the selected period.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="overflow-y-auto h-full border rounded-md relative">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-32">Date</TableHead>
                              <TableHead>Scope of Work</TableHead>
                              <TableHead className="w-32">Completion</TableHead>
                              <TableHead>Updated By</TableHead>
                              <TableHead>Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredUpdates.map((update) => (
                              <TableRow key={update.id}>
                                <TableCell className="whitespace-nowrap">{update.update_date}</TableCell>
                                <TableCell className="font-medium">{update.bom_scope_of_work?.name || "Unknown Scope"}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 bg-secondary rounded-full h-2 overflow-hidden">
                                      <div className="bg-green-500 h-full" style={{ width: `${update.percentage_completed || 0}%` }} />
                                    </div>
                                    <span className="font-bold text-sm">{update.percentage_completed || 0}%</span>
                                  </div>
                                </TableCell>
                                <TableCell>{update.updated_by}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{update.notes || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}