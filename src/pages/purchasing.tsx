import { useEffect, useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ShoppingCart, Plus, Search, Building2, Warehouse as WarehouseIcon, FilterX, List, Edit2, Archive, Printer, ChevronsUpDown, Check, Filter, Receipt, Eye, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { projectService } from "@/services/projectService";
import { useSettings } from "@/contexts/SettingsProvider";
import { cn } from "@/lib/utils";
import { approvalCenterService, type ApprovalRequest } from "@/services/approvalCenterService";
import { requestWorkflowService } from "@/services/requestWorkflowService";
import { RequestDetailsButton } from "@/components/approval/RequestDetailsButton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STANDARD_CATEGORIES = [
  "Construction Materials",
  "Equipments",
  "Hand Tools",
  "PPE",
  "Tools"
];

const STANDARD_UNITS = [
  "Bag",
  "Bd.ft",
  "Box",
  "Cu.m",
  "Gal",
  "Kg",
  "Length",
  "Lin.m",
  "Liter",
  "Lot",
  "M",
  "Pail",
  "Pair",
  "Pc",
  "Roll",
  "Set",
  "Sq.m",
  "Unit"
];

function TruncatedText({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  const text = value && value.trim() ? value : "—";

  if (text === "—") {
    return <span className={cn("block truncate whitespace-nowrap", className)}>{text}</span>;
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("block truncate whitespace-nowrap", className)}>{text}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatCompactDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Purchasing() {
  const { formatCurrency, company, currency, isLocked } = useSettings();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [voucherRequests, setVoucherRequests] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [viewSuppliersDialogOpen, setViewSuppliersDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"incoming" | "purchase-orders">("incoming");
  const [incomingRequests, setIncomingRequests] = useState<ApprovalRequest[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState("");
  const [creatingVoucherId, setCreatingVoucherId] = useState("");
  const [voucherDialogOpen, setVoucherDialogOpen] = useState(false);
  const [selectedVoucherRecord, setSelectedVoucherRecord] = useState<any | null>(null);
  const [viewGroupDialogOpen, setViewGroupDialogOpen] = useState(false);
  const [selectedPurchaseGroup, setSelectedPurchaseGroup] = useState<any[] | null>(null);

  const [gmSubmitDialogOpen, setGmSubmitDialogOpen] = useState(false);
  const [gmSubmitForm, setGmSubmitForm] = useState<any>(null);
  const [itemPopoverOpen, setItemPopoverOpen] = useState(false);

  // Multi-item PO State
  const [poHeader, setPoHeader] = useState({
    order_number: "",
    order_date: new Date().toISOString().split("T")[0],
    supplier: "",
    destination_type: "main_warehouse",
    project_id: "none"
  });

  const [poItems, setPoItems] = useState<any[]>([]);
  const [currentItem, setCurrentItem] = useState({
    item_name: "",
    category: "Construction Materials",
    quantity: "",
    unit: "Pc",
    unit_cost: ""
  });
  
  // Filters
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterItem, setFilterItem] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  
  const generateNextPONumber = (list: any[]) => {
    let max = 0;
    list.forEach(p => {
      if (p.order_number && p.order_number.startsWith("PO-")) {
        const num = parseInt(p.order_number.replace("PO-", ""), 10);
        if (!isNaN(num) && num > max) max = num;
      }
    });
    return `PO-${String(max + 1).padStart(5, '0')}`;
  };

  const [formData, setFormData] = useState({
    order_number: "",
    order_date: new Date().toISOString().split("T")[0],
    supplier: "",
    item_name: "",
    category: "Construction Materials",
    quantity: "",
    unit: "Pc",
    unit_cost: "",
    destination_type: "main_warehouse",
    project_id: "none"
  });

  const [supplierForm, setSupplierForm] = useState({
    name: "",
    contact_person: "",
    phone: "",
    address: ""
  });

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("purchasing_workflow_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_requests" }, () => {
        void loadData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, () => {
        void loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: pData }, { data: projData }, { data: supData }, { data: vouchData }, { data: voucherReqData }, { data: masterData }, incomingData] = await Promise.all([
      supabase.from("purchases").select(`*, projects(name)`).eq('is_archived', false).order('created_at', { ascending: false }),
      projectService.getAll(),
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("vouchers").select("*").order("created_at", { ascending: false }),
      supabase.from("voucher_requests").select("*").order("created_at", { ascending: false }),
      projectService.getMasterItems(),
      approvalCenterService.listModuleInbox("Purchasing")
    ]);
    
    const loadedPurchases = pData || [];
    const loadedIncoming = incomingData || [];

    // Merge incoming requests with purchases
    const mergedList = [
      ...loadedPurchases,
      ...loadedIncoming
        .filter((req) => req.workflowStatus === "in_purchasing")
        .map((req) => {
          const payload = req.payload && typeof req.payload === "object" && !Array.isArray(req.payload) ? req.payload : {};
          return {
            id: req.sourceRecordId,
            order_number: (payload.orderNumber as string) || `AR-${req.id.slice(0, 8)}`,
            order_date: req.requestedAt.split("T")[0],
            supplier: (payload.supplier as string) || "Pending Selection",
            item_name: (payload.itemName as string) || req.summary || "Request item",
            category: (payload.category as string) || "Materials",
            quantity: typeof payload.quantity === "number" ? payload.quantity : 0,
            unit: (payload.unit as string) || "unit",
            unit_cost: 0,
            destination_type: "project_warehouse",
            project_id: req.projectId,
            status: "pending",
            voucher_number: null,
            is_archived: false,
            approval_request_id: req.id,
            is_from_approval: true,
            projects: req.projectName ? { name: req.projectName } : null,
          };
        }),
    ];

    setPurchases(mergedList);
    setProjects(projData || []);
    setSuppliers(supData || []);
    setVouchers(vouchData || []);
    setVoucherRequests(voucherReqData || []);
    
    // Create unique catalog from master items
    const uniqueItemsMap = new Map();
    if (masterData) {
      masterData.forEach(item => {
        if (!uniqueItemsMap.has(item.name.toLowerCase())) {
          uniqueItemsMap.set(item.name.toLowerCase(), item);
        }
      });
    }
    setCatalogItems(Array.from(uniqueItemsMap.values()));
    setIncomingRequests(loadedIncoming || []);
    
    if (!editingId && !poHeader.order_number) {
      setPoHeader(prev => ({ ...prev, order_number: generateNextPONumber(mergedList) }));
    }
    setLoading(false);
  };

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("suppliers").insert(supplierForm);
    if (!error) {
      setSupplierDialogOpen(false);
      setSupplierForm({ name: "", contact_person: "", phone: "", address: "" });
      loadData();
    }
  };

  const handleAddItem = () => {
    if (!currentItem.item_name || !currentItem.quantity || !currentItem.unit_cost) {
      alert("Please fill in item name, quantity, and unit cost.");
      return;
    }
    setPoItems([...poItems, { ...currentItem }]);
    setCurrentItem({
      item_name: "",
      category: "Construction Materials",
      quantity: "",
      unit: "Pc",
      unit_cost: ""
    });
  };

  const handleRemoveItem = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const handleSubmitPO = async () => {
    if (!poHeader.supplier) {
      alert("Please select a supplier.");
      return;
    }
    if (poItems.length === 0) {
      alert("Please add at least one item to the PO.");
      return;
    }
    
    const payloadArray = poItems.map(item => ({
      order_number: poHeader.order_number,
      order_date: poHeader.order_date,
      supplier: poHeader.supplier,
      item_name: item.item_name,
      category: item.category,
      quantity: parseFloat(item.quantity) || 0,
      unit: item.unit,
      unit_cost: parseFloat(item.unit_cost) || 0,
      destination_type: poHeader.destination_type,
      project_id: poHeader.destination_type === "project_warehouse" && poHeader.project_id !== "none" ? poHeader.project_id : null,
      status: "pending_approval",
      voucher_number: null
    }));

    const { data: createdPurchases, error: insertError } = await supabase
      .from("purchases")
      .insert(payloadArray)
      .select("id, order_number, item_name, project_id");

    if (insertError) {
      console.error("Error saving PO items:", insertError);
      alert("Failed to save PO: " + insertError.message);
      return;
    }

    await Promise.all(
      (createdPurchases || []).map((purchase) =>
        approvalCenterService.createRequest({
          sourceModule: "Purchasing",
          sourceTable: "purchases",
          sourceRecordId: purchase.id,
          requestType: "Purchase Order",
          requestedBy: "Purchasing Team",
          projectId: purchase.project_id,
          summary: `${purchase.order_number}: ${purchase.item_name}`,
        })
      )
    );

    setDialogOpen(false);
    loadData();
  };

  const handleEdit = (p: any) => {
    setEditingId(p.id);
    setFormData({
      order_number: p.order_number,
      order_date: p.order_date,
      supplier: p.supplier,
      item_name: p.item_name,
      category: p.category,
      quantity: p.quantity.toString(),
      unit: p.unit,
      unit_cost: p.unit_cost.toString(),
      destination_type: p.destination_type,
      project_id: p.project_id || "none"
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string, approvalRequestId?: string) => {
    if (!confirm("Are you sure you want to delete this purchase order item?")) return;

    try {
      const { error: purchaseError } = await supabase.from("purchases").delete().eq("id", id);
      if (purchaseError) throw purchaseError;

      if (approvalRequestId) {
        const { error: approvalError } = await supabase.from("approval_requests").delete().eq("id", approvalRequestId);
        if (approvalError) console.error("Failed to delete approval request:", approvalError);
      }

      loadData();
    } catch (error) {
      console.error("Error deleting purchase:", error);
      alert("Failed to delete purchase order item");
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Are you sure you want to archive this purchase order item?")) return;
    const { error } = await supabase.from("purchases").update({ is_archived: true }).eq("id", id);
    if (!error) loadData();
  };

  const uniqueSuppliers = Array.from(new Set(purchases.map(p => p.supplier))).filter(Boolean);

  const filteredPurchases = purchases.filter(p => {
    const matchSupplier = filterSupplier === "all" || p.supplier === filterSupplier;
    const matchDate = !filterDate || p.order_date === filterDate;
    const matchItem = !filterItem || p.item_name.toLowerCase().includes(filterItem.toLowerCase());
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSupplier && matchDate && matchItem && matchStatus;
  });

  const handleArchiveGroup = async (groupKey: string) => {
    if (!confirm("Are you sure you want to archive all items in this group?")) return;
    
    const groupItems = filteredPurchases.filter((p) => getGroupKey(p) === groupKey);
    const hasApprovalResults = groupItems.some((p) => p.status === "approved" || p.status === "rejected");

    if (!hasApprovalResults) {
      alert("Can only archive items that have been approved or rejected in Approval Center.");
      return;
    }

    try {
      await Promise.all(
        groupItems.map((p) => supabase.from("purchases").update({ is_archived: true }).eq("id", p.id))
      );
      loadData();
    } catch (error) {
      console.error("Error archiving group:", error);
      alert("Failed to archive group");
    }
  };

  const handleDeleteGroup = async (groupKey: string) => {
    if (!confirm("Are you sure you want to delete all pending items in this group?")) return;
    
    const groupItems = filteredPurchases.filter((p) => getGroupKey(p) === groupKey);
    const allPending = groupItems.every((p) => p.status === "pending");

    if (!allPending) {
      alert("Can only delete items that are still pending (not yet approved/rejected).");
      return;
    }

    try {
      await Promise.all(
        groupItems.map(async (p) => {
          await supabase.from("purchases").delete().eq("id", p.id);
          if (p.approval_request_id) {
            await supabase.from("approval_requests").delete().eq("id", p.approval_request_id);
          }
        })
      );
      loadData();
    } catch (error) {
      console.error("Error deleting group:", error);
      alert("Failed to delete group");
    }
  };

  const getGroupKey = (purchase: any) => {
    if (purchase.voucher_number) return purchase.voucher_number;
    if (purchase.order_number) return purchase.order_number;
    return `ungrouped-${purchase.id}`;
  };

  const groupedPurchases = useMemo(() => {
    const groups = new Map<string, any[]>();

    filteredPurchases.forEach((purchase) => {
      const key = getGroupKey(purchase);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(purchase);
    });

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      displayKey: key.startsWith("ungrouped-") ? items[0].order_number || "—" : key,
      items,
      firstItem: items[0],
      totalCost: items.reduce((sum, item) => sum + (item.total_cost || 0), 0),
      itemCount: items.length,
    }));
  }, [filteredPurchases]);

  const openViewGroupDialog = (group: any) => {
    setSelectedPurchaseGroup(group.items);
    setViewGroupDialogOpen(true);
  };

  const canArchiveGroup = (group: any) => {
    return group.items.some((item: any) => item.status === "approved" || item.status === "rejected");
  };

  const canDeleteGroup = (group: any) => {
    return group.items.every((item: any) => item.status === "pending");
  };

  const canPriceAndSubmit = (group: any) => {
    return group.items.some((item: any) => item.status === "pending" && item.order_number?.startsWith("PR-"));
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setPoHeader(prev => ({
        ...prev,
        order_number: generateNextPONumber(purchases)
      }));
      setPoItems([]);
      setCurrentItem({
        item_name: "",
        category: "Construction Materials",
        quantity: "",
        unit: "Pc",
        unit_cost: ""
      });
    } else {
      setPoHeader(prev => ({ ...prev, order_number: generateNextPONumber(purchases) }));
    }
  };

  const getVoucherRequestForPurchase = (purchaseId: string) =>
    voucherRequests.find((voucherRequest) => voucherRequest.purchase_id === purchaseId) || null;

  const getVoucherDisplayValue = (purchase: any) => {
    const voucherRequest = getVoucherRequestForPurchase(purchase.id);

    if (purchase.voucher_number) {
      return purchase.voucher_number;
    }

    if (voucherRequest?.accounting_status) {
      return voucherRequest.accounting_status.replaceAll("_", " ");
    }

    return "—";
  };

  const openVoucherDialog = (purchase: any) => {
    const voucherRequest = getVoucherRequestForPurchase(purchase.id);
    const linkedVoucher = purchase.voucher_number
      ? vouchers.find((voucher) => voucher.voucher_number === purchase.voucher_number)
      : null;

    if (!voucherRequest && !linkedVoucher) {
      return;
    }

    setSelectedVoucherRecord({
      request: voucherRequest,
      voucher: linkedVoucher,
      purchase,
    });
    setVoucherDialogOpen(true);
  };

  const handleGmSubmit = async () => {
    const uc = parseFloat(gmSubmitForm.unit_cost) || 0;
    if (uc <= 0 || !gmSubmitForm.supplier || gmSubmitForm.supplier === 'Pending Selection') {
      alert("Please provide a valid supplier and unit cost.");
      return;
    }

    const { error } = await supabase.from('purchases').update({
      supplier: gmSubmitForm.supplier,
      unit_cost: uc,
      status: 'pending_approval'
    }).eq('id', gmSubmitForm.id);

    if (!error) {
      await approvalCenterService.createRequest({
        sourceModule: "Purchasing",
        sourceTable: "purchases",
        sourceRecordId: gmSubmitForm.id,
        requestType: "Purchase Order",
        requestedBy: "Purchasing Team",
        projectId: gmSubmitForm.project_id || null,
        summary: `${gmSubmitForm.order_number}: ${gmSubmitForm.item_name}`,
      });

      setGmSubmitDialogOpen(false);
      setGmSubmitForm(null);
      loadData();
    } else {
      alert("Failed to submit: " + error.message);
    }
  };

  const handlePrint = (p: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const projectName = p.projects?.name || (p.destination_type === 'main_warehouse' ? 'Main Warehouse' : 'Unknown Project');
    const logoUrl = company?.logo_url || '';
    const absoluteLogoUrl = logoUrl ? (logoUrl.startsWith('/') ? window.location.origin + logoUrl : logoUrl) : '';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Purchase Order ${p.order_number}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #222; max-width: 800px; margin: 0 auto; line-height: 1.5; }
            .header-container { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 15px; }
            .company-info { display: flex; align-items: center; gap: 15px; }
            .company-logo { max-width: 80px; max-height: 80px; object-fit: contain; }
            .company-text h3 { margin: 0; font-size: 18px; color: #111; text-transform: uppercase; font-weight: bold; }
            .company-text p { margin: 3px 0 0 0; font-size: 12px; color: #555; }
            .po-title { text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; background: #eee; padding: 10px 20px; border: 1px solid #ccc; display: inline-block; margin: 20px auto 40px auto; width: 100%; box-sizing: border-box; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
            .info-row { display: flex; margin-bottom: 12px; }
            .label { font-weight: bold; width: 120px; color: #333; }
            .value { flex: 1; border-bottom: 1px solid #999; padding-bottom: 2px; font-family: monospace; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { border: 1px solid #000; padding: 10px; text-align: left; }
            th { background: #eee; font-weight: bold; text-transform: uppercase; font-size: 12px; }
            td { font-size: 14px; }
            .text-right { text-align: right; }
            .amount-box { text-align: right; font-size: 22px; font-weight: bold; margin-bottom: 60px; padding: 15px 20px; background: #f9f9f9; border: 1px solid #000; display: inline-block; float: right; min-width: 250px; }
            .clearfix::after { content: ""; clear: both; display: table; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 60px; }
            .sig-line { border-top: 1px solid #000; text-align: center; padding-top: 10px; font-size: 12px; font-weight: bold; color: #333; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="company-info">
              ${absoluteLogoUrl ? `<img src="${absoluteLogoUrl}" class="company-logo" alt="Logo" />` : `<div style="width: 50px; height: 50px; background: #eee; display: flex; align-items: center; justify-content: center; border: 1px solid #ccc; font-size: 10px; color: #999;">LOGO</div>`}
              <div class="company-text">
                <h3>${company?.name || 'Company Name'}</h3>
                <p>${company?.address || 'Company Address line 1<br/>City, Country, ZIP'}</p>
              </div>
            </div>
          </div>
          
          <div class="po-title">PURCHASE ORDER</div>
          
          <div class="info-grid">
            <div>
              <div class="info-row"><div class="label">PO Number:</div><div class="value">${p.order_number}</div></div>
              <div class="info-row"><div class="label">Date:</div><div class="value">${new Date(p.order_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div></div>
            </div>
            <div>
              <div class="info-row"><div class="label">Supplier:</div><div class="value">${p.supplier || 'Pending'}</div></div>
              <div class="info-row"><div class="label">Deliver To:</div><div class="value">${projectName}</div></div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Category</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${p.item_name}</td>
                <td>${p.category || '-'}</td>
                <td class="text-right">${p.quantity} ${p.unit}</td>
                <td class="text-right">${currency || 'AED'} ${(p.unit_cost || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td class="text-right">${currency || 'AED'} ${(p.total_cost || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
            </tbody>
          </table>

          <div class="clearfix">
            <div class="amount-box">
              TOTAL: ${currency || 'AED'} ${(p.total_cost || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
          </div>

          <div class="signatures">
            <div class="sig-line">Prepared By</div>
            <div class="sig-line">Checked By</div>
            <div class="sig-line">Approved By</div>
          </div>
          
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleCreateVoucherRequest = async (purchase: any) => {
    const existingVoucherRequest = getVoucherRequestForPurchase(purchase.id);

    if (existingVoucherRequest) {
      openVoucherDialog(purchase);
      return;
    }

    if (!purchase.supplier || purchase.supplier === "Pending Selection") {
      alert("Assign a supplier before creating a voucher request.");
      return;
    }

    if (Number(purchase.total_cost || 0) <= 0) {
      alert("Add a valid total cost before creating a voucher request.");
      return;
    }

    try {
      setCreatingVoucherId(purchase.id);
      const workflow = await requestWorkflowService.getByPurchaseId(purchase.id);

      if (!workflow?.site_request_id) {
        alert("This purchase is not linked to a site request yet.");
        return;
      }

      const description = `Voucher for ${purchase.order_number} • ${purchase.item_name}`;
      const timestamp = new Date().toISOString();

      const { data: voucherRequest, error } = await supabase
        .from("voucher_requests")
        .insert({
          purchase_id: purchase.id,
          site_request_id: workflow.site_request_id,
          project_id: purchase.project_id || null,
          source_approval_request_id: workflow.initial_approval_request_id || null,
          supplier: purchase.supplier,
          total_amount: Number(purchase.total_cost || 0),
          description,
          requested_by: "Purchasing Team",
          accounting_status: "voucher_pending_approval",
          updated_at: timestamp,
        })
        .select("*")
        .maybeSingle();

      if (error || !voucherRequest) {
        throw error || new Error("Failed to create voucher request");
      }

      await requestWorkflowService.linkVoucherRequest({
        siteRequestId: workflow.site_request_id,
        voucherRequestId: voucherRequest.id,
        supplier: purchase.supplier,
        totalAmount: Number(purchase.total_cost || 0),
      });

      await approvalCenterService.createRequest({
        sourceModule: "Purchasing",
        sourceTable: "voucher_requests",
        sourceRecordId: voucherRequest.id,
        requestType: "Voucher Request",
        requestedBy: "Purchasing Team",
        projectId: purchase.project_id || null,
        summary: `${purchase.order_number}: ${purchase.item_name}`,
        latestComment: `Supplier: ${purchase.supplier}`,
        payload: {
          requestType: "Voucher Request",
          purchaseId: purchase.id,
          siteRequestId: workflow.site_request_id,
          orderNumber: purchase.order_number,
          itemName: purchase.item_name,
          supplier: purchase.supplier,
          totalAmount: Number(purchase.total_cost || 0),
          description,
        },
      });

      await loadData();
      alert("Voucher request sent to Approval Center.");
    } catch (error: any) {
      console.error("Error creating voucher request:", error);
      alert(error?.message || "Failed to create voucher request.");
    } finally {
      setCreatingVoucherId("");
    }
  };

  const handleCompleteIncomingRequest = async (approvalRequestId: string) => {
    try {
      setProcessingRequestId(approvalRequestId);
      await approvalCenterService.updateWorkflowStatus(approvalRequestId, "completed");
      await loadData();
    } finally {
      setProcessingRequestId("");
    }
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 flex flex-col h-full px-3 sm:px-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold">Purchasing</h1>
            <p className="text-sm text-muted-foreground mt-1">Procurement and purchase orders</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isLocked} className="w-full sm:w-auto">
                  <Building2 className="h-4 w-4 mr-2" />
                  Suppliers
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setSupplierDialogOpen(true)} className="cursor-pointer">
                  <Plus className="h-4 w-4 mr-2" />
                  Register Supplier
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewSuppliersDialogOpen(true)} className="cursor-pointer">
                  <List className="h-4 w-4 mr-2" />
                  View Suppliers
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
              <DialogContent className="max-w-[95vw] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Register New Supplier</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSupplierSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Supplier Name *</Label>
                    <Input value={supplierForm.name} onChange={(e) => setSupplierForm({...supplierForm, name: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Person</Label>
                    <Input value={supplierForm.contact_person} onChange={(e) => setSupplierForm({...supplierForm, contact_person: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input value={supplierForm.phone} onChange={(e) => setSupplierForm({...supplierForm, phone: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input value={supplierForm.address} onChange={(e) => setSupplierForm({...supplierForm, address: e.target.value})} />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setSupplierDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">Save Supplier</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={viewSuppliersDialogOpen} onOpenChange={setViewSuppliersDialogOpen}>
              <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader className="shrink-0">
                  <DialogTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Registered Suppliers
                  </DialogTitle>
                </DialogHeader>
                <div className="overflow-y-auto border rounded-md flex-1">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Contact Person</TableHead>
                        <TableHead className="hidden md:table-cell">Phone</TableHead>
                        <TableHead className="hidden lg:table-cell">Address</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suppliers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No suppliers registered yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        suppliers.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell className="hidden sm:table-cell">{s.contact_person || <span className="text-muted-foreground">-</span>}</TableCell>
                            <TableCell className="hidden md:table-cell">{s.phone || <span className="text-muted-foreground">-</span>}</TableCell>
                            <TableCell className="hidden lg:table-cell">{s.address || <span className="text-muted-foreground">-</span>}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild>
                <Button disabled={isLocked} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  New Purchase
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Purchase Order</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Add multiple items under a single PO Number and send them to Approval Center.
                  </p>
                </DialogHeader>
                <div className="space-y-6">
                  {/* Header Section */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border">
                    <div className="space-y-2">
                      <Label>PO Number *</Label>
                      <Input value={poHeader.order_number} onChange={(e) => setPoHeader({ ...poHeader, order_number: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Order Date *</Label>
                      <Input type="date" value={poHeader.order_date} onChange={(e) => setPoHeader({ ...poHeader, order_date: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Supplier *</Label>
                      <Select value={poHeader.supplier} onValueChange={(val) => setPoHeader({ ...poHeader, supplier: val })} required>
                        <SelectTrigger><SelectValue placeholder="Select registered supplier" /></SelectTrigger>
                        <SelectContent>
                          {suppliers.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Destination *</Label>
                      <Select value={poHeader.destination_type} onValueChange={(val) => setPoHeader({ ...poHeader, destination_type: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="main_warehouse">Main Warehouse</SelectItem>
                          <SelectItem value="project_warehouse">Project Warehouse</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {poHeader.destination_type === "project_warehouse" && (
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Select Project *</Label>
                        <Select value={poHeader.project_id} onValueChange={(val) => setPoHeader({ ...poHeader, project_id: val })}>
                          <SelectTrigger><SelectValue placeholder="Select active project" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-- Select Project --</SelectItem>
                            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Add Item Section */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Add Line Item</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2 flex flex-col justify-end">
                          <Label className="text-xs">Item Name *</Label>
                          <Input 
                            list="catalog-items"
                            value={currentItem.item_name}
                            onChange={(e) => {
                              const val = e.target.value;
                              const found = catalogItems.find(item => item.name === val);
                              if (found) {
                                setCurrentItem({
                                  ...currentItem,
                                  item_name: val,
                                  category: found.category || currentItem.category,
                                  unit: found.unit || currentItem.unit
                                });
                              } else {
                                setCurrentItem({ ...currentItem, item_name: val });
                              }
                            }}
                            className="h-9"
                            placeholder="Type or select item..."
                          />
                          <datalist id="catalog-items">
                            {catalogItems.map((item, i) => (
                              <option key={i} value={item.name} />
                            ))}
                          </datalist>
                        </div>
                        <div className="space-y-2 flex flex-col justify-end">
                          <Label className="text-xs">Category</Label>
                          <Select value={currentItem.category} onValueChange={(val) => setCurrentItem({ ...currentItem, category: val })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STANDARD_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              {!STANDARD_CATEGORIES.includes(currentItem.category) && currentItem.category && (
                                <SelectItem value={currentItem.category}>{currentItem.category}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Qty *</Label>
                          <Input type="number" value={currentItem.quantity} onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value })} className="h-9" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Unit</Label>
                          <Select value={currentItem.unit} onValueChange={(val) => setCurrentItem({ ...currentItem, unit: val })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STANDARD_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                              {!STANDARD_UNITS.includes(currentItem.unit) && currentItem.unit && (
                                <SelectItem value={currentItem.unit}>{currentItem.unit}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Unit Cost *</Label>
                          <Input type="number" step="0.01" value={currentItem.unit_cost} onChange={(e) => setCurrentItem({ ...currentItem, unit_cost: e.target.value })} className="h-9" />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" variant="secondary" size="sm" onClick={handleAddItem}>
                        <Plus className="h-3 w-3 mr-1" /> Add to PO
                      </Button>
                    </div>
                  </div>

                  {/* Items Table */}
                  {poItems.length > 0 && (
                    <div className="border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8 text-xs">Item</TableHead>
                            <TableHead className="h-8 text-xs text-right hidden sm:table-cell">Qty</TableHead>
                            <TableHead className="h-8 text-xs text-right hidden md:table-cell">Unit Cost</TableHead>
                            <TableHead className="h-8 text-xs text-right">Total</TableHead>
                            <TableHead className="h-8 text-xs text-right w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {poItems.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="py-2 text-sm">{item.item_name} <span className="text-xs text-muted-foreground block sm:hidden">{item.quantity} {item.unit}</span></TableCell>
                              <TableCell className="py-2 text-sm text-right hidden sm:table-cell">{item.quantity} {item.unit}</TableCell>
                              <TableCell className="py-2 text-sm text-right hidden md:table-cell">{formatCurrency(parseFloat(item.unit_cost) || 0)}</TableCell>
                              <TableCell className="py-2 text-sm text-right font-medium">{formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0))}</TableCell>
                              <TableCell className="py-2 text-right">
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleRemoveItem(index)}>
                                  <FilterX className="h-3 w-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-4 border-t mt-6">
                    <p className="text-xs font-semibold">
                      Total PO Value: {formatCurrency(poItems.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0)), 0))}
                    </p>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 sm:flex-initial">Cancel</Button>
                      <Button type="button" onClick={handleSubmitPO} className="flex-1 sm:flex-initial">Submit PO for Approval</Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-hidden rounded-lg border bg-card p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="text-sm font-medium text-muted-foreground px-2">Purchase Orders</div>
        </div>

        <Card className="flex-1 flex flex-col min-h-0 border-0 shadow-none">
          <div className="flex justify-end mb-3 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="h-8 px-2 text-xs">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              {showFilters ? "Hide Filters" : "Filters"}
              {(filterSupplier !== "all" || filterStatus !== "all" || filterItem || filterDate) && (
                <span className="ml-2 flex h-2 w-2 rounded-full bg-primary shadow-[0_0_4px_rgba(var(--primary),0.5)]"></span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="bg-muted/30 p-2.5 mb-3 border rounded-lg shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px]">Filter by Supplier:</Label>
                  <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                    <SelectTrigger className="w-full h-8 bg-white text-xs dark:bg-background">
                      <SelectValue placeholder="All Suppliers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Suppliers</SelectItem>
                      {uniqueSuppliers.map((s: any) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1">
                  <Label className="text-[11px]">Filter by Status:</Label>
                  <div className="flex bg-background border p-0.5 rounded-md w-full h-8 items-center overflow-x-auto">
                    <Button variant={filterStatus === "all" ? "secondary" : "ghost"} size="sm" className="h-full px-2 text-[11px] flex-1" onClick={() => setFilterStatus("all")}>All</Button>
                    <Button variant={filterStatus === "pending" ? "secondary" : "ghost"} size="sm" className="h-full px-2 text-[11px] text-orange-600 dark:text-orange-400 flex-1" onClick={() => setFilterStatus("pending")}>Pending</Button>
                    <Button variant={filterStatus === "pending_approval" ? "secondary" : "ghost"} size="sm" className="h-full px-2 text-[11px] text-purple-600 dark:text-purple-400 whitespace-nowrap flex-1" onClick={() => setFilterStatus("pending_approval")}>P. Approval</Button>
                    <Button variant={filterStatus === "approved" ? "secondary" : "ghost"} size="sm" className="h-full px-2 text-[11px] text-blue-600 dark:text-blue-400 flex-1" onClick={() => setFilterStatus("approved")}>Approved</Button>
                    <Button variant={filterStatus === "received" ? "secondary" : "ghost"} size="sm" className="h-full px-2 text-[11px] text-green-600 dark:text-green-400 flex-1" onClick={() => setFilterStatus("received")}>Received</Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px]">Search Item:</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input 
                      type="text" 
                      placeholder="Item name..." 
                      className="w-full h-8 pl-7 text-xs bg-white dark:bg-background"
                      value={filterItem}
                      onChange={(e) => setFilterItem(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px]">Filter by Date:</Label>
                  <Input 
                    type="date" 
                    className="w-full h-8 text-xs bg-white dark:bg-background" 
                    value={filterDate} 
                    onChange={(e) => setFilterDate(e.target.value)} 
                  />
                </div>

                <div className="space-y-1 flex items-end">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-[11px] text-muted-foreground w-full"
                    onClick={() => {
                      setFilterSupplier("all");
                      setFilterStatus("all");
                      setFilterItem("");
                      setFilterDate("");
                    }}
                  >
                    <FilterX className="h-3.5 w-3.5 mr-1.5" />
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-auto rounded-md border h-full relative -mx-3 sm:mx-0">
            <Table className="min-w-[1200px] table-fixed text-xs">
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow className="border-b">
                  <TableHead className="h-8 min-w-[120px] whitespace-nowrap px-2 text-[11px] uppercase tracking-wide">Group ID</TableHead>
                  <TableHead className="hidden md:table-cell h-8 min-w-[96px] whitespace-nowrap px-2 text-[11px] uppercase tracking-wide">Date</TableHead>
                  <TableHead className="hidden sm:table-cell h-8 min-w-[140px] whitespace-nowrap px-2 text-[11px] uppercase tracking-wide">Supplier</TableHead>
                  <TableHead className="h-8 min-w-[200px] whitespace-nowrap px-2 text-[11px] uppercase tracking-wide">Items</TableHead>
                  <TableHead className="text-right h-8 min-w-[110px] whitespace-nowrap px-2 text-[11px] uppercase tracking-wide">Total Cost</TableHead>
                  <TableHead className="hidden lg:table-cell h-8 min-w-[140px] whitespace-nowrap px-2 text-[11px] uppercase tracking-wide">Destination</TableHead>
                  <TableHead className="h-8 min-w-[100px] whitespace-nowrap px-2 text-[11px] uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-right h-8 min-w-[200px] whitespace-nowrap px-2 text-[11px] uppercase tracking-wide">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">Loading purchases...</TableCell>
                  </TableRow>
                ) : groupedPurchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">No purchase orders found.</TableCell>
                  </TableRow>
                ) : (
                  groupedPurchases.map((group) => {
                    const p = group.firstItem;
                    return (
                      <TableRow key={group.key} className="border-b last:border-b-0">
                        <TableCell className="px-2 py-1.5 align-middle font-medium text-primary whitespace-nowrap">{group.displayKey}</TableCell>
                        <TableCell className="hidden md:table-cell px-2 py-1.5 align-middle text-muted-foreground whitespace-nowrap">{p.order_date}</TableCell>
                        <TableCell className="hidden sm:table-cell px-2 py-1.5 align-middle whitespace-nowrap">
                          <TruncatedText value={p.supplier || "—"} className="max-w-[124px]" />
                        </TableCell>
                        <TableCell className="px-2 py-1.5 align-middle">
                          <div className="min-w-0 space-y-0.5">
                            <TruncatedText value={group.itemCount === 1 ? p.item_name : `${group.itemCount} items`} className="max-w-[180px] font-medium text-foreground" />
                            {group.itemCount > 1 ? (
                              <TruncatedText value={group.items.map((item: any) => item.item_name).join(", ")} className="max-w-[180px] text-[11px] text-muted-foreground" />
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-2 py-1.5 align-middle font-semibold whitespace-nowrap">{formatCurrency(group.totalCost)}</TableCell>
                        <TableCell className="hidden lg:table-cell px-2 py-1.5 align-middle">
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 overflow-hidden whitespace-nowrap text-[11px]">
                                  {p.destination_type === "main_warehouse" ? (
                                    <WarehouseIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  ) : (
                                    <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  )}
                                  <span className="truncate">
                                    {p.destination_type === "main_warehouse" ? "Main Warehouse" : p.projects?.name || "Project"}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                {p.destination_type === "main_warehouse" ? "Main Warehouse" : p.projects?.name || "Project"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="px-2 py-1.5 align-middle whitespace-nowrap">
                          <Badge 
                            variant="outline" 
                            className={
                              p.status === "received" ? "h-5 whitespace-nowrap bg-green-500 hover:bg-green-600 border-transparent px-1.5 text-[10px] text-white" : 
                              p.status === "approved" ? "h-5 whitespace-nowrap bg-blue-500 hover:bg-blue-600 border-transparent px-1.5 text-[10px] text-white" : 
                              p.status === "pending_approval" ? "h-5 whitespace-nowrap bg-purple-500 hover:bg-purple-600 border-transparent px-1.5 text-[10px] text-white" : 
                              "h-5 whitespace-nowrap bg-orange-500 hover:bg-orange-600 border-transparent px-1.5 text-[10px] text-white"
                            }
                          >
                            {p.status === "pending_approval" ? "P. APPROVAL" : p.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right px-2 py-1.5 align-middle">
                          <div className="flex justify-end gap-1 whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openViewGroupDialog(group)}
                              title="View Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {canPriceAndSubmit(group) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[11px] bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                                onClick={() => {
                                  setGmSubmitForm({ ...group.firstItem, unit_cost: group.firstItem.unit_cost || "" });
                                  setGmSubmitDialogOpen(true);
                                }}
                                disabled={isLocked}
                              >
                                Price & Submit
                              </Button>
                            )}
                            {canArchiveGroup(group) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                onClick={() => void handleArchiveGroup(group.key)}
                                title="Archive"
                                disabled={isLocked}
                              >
                                <Archive className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canDeleteGroup(group) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => void handleDeleteGroup(group.key)}
                                title="Delete"
                                disabled={isLocked}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Dialog open={viewGroupDialogOpen} onOpenChange={setViewGroupDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Purchase Order Details</DialogTitle>
              <CardDescription>
                {selectedPurchaseGroup && selectedPurchaseGroup.length > 0
                  ? `${selectedPurchaseGroup[0].order_number} • ${selectedPurchaseGroup.length} item${selectedPurchaseGroup.length > 1 ? "s" : ""}`
                  : ""}
              </CardDescription>
            </DialogHeader>
            {selectedPurchaseGroup && selectedPurchaseGroup.length > 0 ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1 rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Order Number</p>
                    <p className="font-medium">{selectedPurchaseGroup[0].order_number}</p>
                  </div>
                  <div className="space-y-1 rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Order Date</p>
                    <p className="font-medium">{new Date(selectedPurchaseGroup[0].order_date).toLocaleDateString()}</p>
                  </div>
                  <div className="space-y-1 rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Supplier</p>
                    <p className="font-medium">{selectedPurchaseGroup[0].supplier || "—"}</p>
                  </div>
                  <div className="space-y-1 rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium">{selectedPurchaseGroup[0].status.replaceAll("_", " ")}</p>
                  </div>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPurchaseGroup.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.item_name}</TableCell>
                          <TableCell>{item.category || "—"}</TableCell>
                          <TableCell className="text-right">
                            {item.quantity} {item.unit}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unit_cost)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(item.total_cost || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between items-center pt-4 border-t">
                  <p className="text-sm font-semibold">
                    Total: {formatCurrency(selectedPurchaseGroup.reduce((sum, item) => sum + (item.total_cost || 0), 0))}
                  </p>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* GM Submit Dialog */}
        <Dialog open={gmSubmitDialogOpen} onOpenChange={setGmSubmitDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Submit for Approval</DialogTitle>
              <CardDescription>Enter the unit cost and supplier before routing this purchase to Approval Center.</CardDescription>
            </DialogHeader>
            {gmSubmitForm && (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Item</Label>
                  <Input value={`${gmSubmitForm.item_name} (${gmSubmitForm.quantity} ${gmSubmitForm.unit})`} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Select Supplier *</Label>
                  <Select value={gmSubmitForm.supplier !== 'Pending Selection' ? gmSubmitForm.supplier : ''} onValueChange={(val) => setGmSubmitForm({...gmSubmitForm, supplier: val})}>
                    <SelectTrigger><SelectValue placeholder="Choose Supplier" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unit Cost (AED) *</Label>
                  <Input type="number" step="0.01" value={gmSubmitForm.unit_cost} onChange={(e) => setGmSubmitForm({...gmSubmitForm, unit_cost: e.target.value})} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Total Estimated Cost: AED {(parseFloat(gmSubmitForm.unit_cost) || 0) * gmSubmitForm.quantity}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setGmSubmitDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                  <Button onClick={handleGmSubmit} className="w-full sm:w-auto">Send to Approval Center</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={voucherDialogOpen} onOpenChange={setVoucherDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Voucher Details</DialogTitle>
              <CardDescription>Review linked voucher request and approval status.</CardDescription>
            </DialogHeader>
            {selectedVoucherRecord ? (
              <div className="space-y-3 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1 rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Purchase Order</p>
                    <p className="font-medium">{selectedVoucherRecord.purchase?.order_number || "—"}</p>
                  </div>
                  <div className="space-y-1 rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Voucher Number</p>
                    <p className="font-medium">
                      {selectedVoucherRecord.voucher?.voucher_number || selectedVoucherRecord.request?.voucher_number || "Pending Approval"}
                    </p>
                  </div>
                  <div className="space-y-1 rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Supplier / Payee</p>
                    <p className="font-medium">
                      {selectedVoucherRecord.request?.supplier || selectedVoucherRecord.voucher?.payee || selectedVoucherRecord.purchase?.supplier || "—"}
                    </p>
                  </div>
                  <div className="space-y-1 rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Voucher Status</p>
                    <p className="font-medium">
                      {(selectedVoucherRecord.request?.accounting_status || selectedVoucherRecord.voucher?.status || "Pending").replaceAll("_", " ")}
                    </p>
                  </div>
                </div>
                <div className="space-y-1 rounded-md border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="font-medium">
                    {selectedVoucherRecord.request?.description || selectedVoucherRecord.voucher?.description || "No description available"}
                  </p>
                </div>
                <div className="space-y-1 rounded-md border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="font-medium">
                    {formatCurrency(
                      Number(
                        selectedVoucherRecord.request?.total_amount ||
                          selectedVoucherRecord.voucher?.amount ||
                          selectedVoucherRecord.purchase?.total_cost ||
                          0
                      )
                    )}
                  </p>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}