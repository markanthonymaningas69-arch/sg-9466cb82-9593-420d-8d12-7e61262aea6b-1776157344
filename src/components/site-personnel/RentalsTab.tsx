import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Wrench, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type RentalExpense = Database["public"]["Tables"]["rental_expenses"]["Row"];

interface RentalFormData {
  rental_type: "Tools" | "Equipment" | "Accommodation" | "Other";
  item_name: string;
  quantity: string;
  unit: string;
  rate_per_unit: string;
  rental_start_date: string;
  rental_end_date: string;
  supplier: string;
  notes: string;
}

const initialFormData: RentalFormData = {
  rental_type: "Tools",
  item_name: "",
  quantity: "1",
  unit: "day",
  rate_per_unit: "",
  rental_start_date: new Date().toISOString().split("T")[0],
  rental_end_date: new Date().toISOString().split("T")[0],
  supplier: "",
  notes: ""
};

function calculateRentalDays(startDate: string, endDate?: string | null): number {
  if (!endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays + 1);
}

function calculateRentalCost(quantity: number, ratePerUnit: number, startDate: string, endDate?: string | null): number {
  const days = calculateRentalDays(startDate, endDate);
  if (days === 0) return 0;
  return quantity * ratePerUnit * days;
}

export function RentalsTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [rentals, setRentals] = useState<RentalExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<RentalFormData>(initialFormData);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    rentalType: "all",
    itemName: "",
    supplier: "",
    dateFrom: "",
    dateTo: ""
  });

  const clearFilters = () => {
    setFilters({
      rentalType: "all",
      itemName: "",
      supplier: "",
      dateFrom: "",
      dateTo: ""
    });
  };

  useEffect(() => {
    if (projectId) {
      loadRentals();
    }
  }, [projectId]);

  const loadRentals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rental_expenses")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_archived", false)
        .order("rental_start_date", { ascending: false });

      if (error) throw error;
      setRentals(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading rentals",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("Company ID not found");

      const { error } = await supabase.from("rental_expenses").insert({
        company_id: profile.company_id,
        project_id: projectId,
        rental_type: formData.rental_type,
        item_name: formData.item_name,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        rate_per_unit: Number(formData.rate_per_unit),
        rental_start_date: formData.rental_start_date,
        rental_end_date: formData.rental_end_date || null,
        supplier: formData.supplier || null,
        notes: formData.notes || null
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Rental expense recorded"
      });

      setFormData(initialFormData);
      setDialogOpen(false);
      await loadRentals();
    } catch (error: any) {
      console.error("Error recording rental:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to record rental expense",
        variant: "destructive"
      });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this rental record?")) return;

    try {
      const { error } = await supabase
        .from("rental_expenses")
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Moved to recycle bin",
        description: "Rental record archived"
      });

      await loadRentals();
    } catch (error) {
      console.error("Error deleting rental:", error);
      toast({
        title: "Error",
        description: "Failed to delete rental record",
        variant: "destructive"
      });
    }
  }

  const filteredRentals = useMemo(() => {
    return rentals.filter(rental => {
      if (filters.rentalType !== "all" && rental.rental_type !== filters.rentalType) {
        return false;
      }
      
      if (filters.itemName && !rental.item_name.toLowerCase().includes(filters.itemName.toLowerCase())) {
        return false;
      }
      
      if (filters.supplier && (!rental.supplier || !rental.supplier.toLowerCase().includes(filters.supplier.toLowerCase()))) {
        return false;
      }
      
      if (filters.dateFrom && rental.rental_start_date < filters.dateFrom) {
        return false;
      }
      
      if (filters.dateTo && rental.rental_start_date > filters.dateTo) {
        return false;
      }
      
      return true;
    });
  }, [rentals, filters]);

  const rentalsSummary = useMemo(() => {
    const totalCost = filteredRentals.reduce((sum, rental) => {
      return sum + calculateRentalCost(
        Number(rental.quantity),
        Number(rental.rate_per_unit),
        rental.rental_start_date,
        rental.rental_end_date
      );
    }, 0);

    const typeCount = new Set(filteredRentals.map((r) => r.rental_type)).size;

    return {
      recordCount: filteredRentals.length,
      typeCount,
      totalCost
    };
  }, [filteredRentals]);

  const estimatedCost = useMemo(() => {
    if (!formData.quantity || !formData.rate_per_unit || !formData.rental_start_date) {
      return null;
    }
    
    return calculateRentalCost(
      Number(formData.quantity),
      Number(formData.rate_per_unit),
      formData.rental_start_date,
      formData.rental_end_date || null
    );
  }, [formData.quantity, formData.rate_per_unit, formData.rental_start_date, formData.rental_end_date]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Rental Expenses
          </CardTitle>
          <CardDescription className="mt-1.5">
            Track tools, equipment, accommodation, and other rental costs
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Rental
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Record Rental Expense</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="rental_type">Rental Type</Label>
                <Select
                  value={formData.rental_type}
                  onValueChange={(value: "Tools" | "Equipment" | "Accommodation" | "Other") =>
                    setFormData(prev => ({ ...prev, rental_type: value }))
                  }
                >
                  <SelectTrigger id="rental_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tools">Tools</SelectItem>
                    <SelectItem value="Equipment">Equipment</SelectItem>
                    <SelectItem value="Accommodation">Accommodation</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="item_name">Item Name</Label>
                <Input
                  id="item_name"
                  value={formData.item_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, item_name: e.target.value }))}
                  placeholder="e.g., Scaffolding, Excavator, Worker Housing"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value }))}
                    placeholder="unit, set, room"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="rate_per_unit">Rate per Unit (per day)</Label>
                <Input
                  id="rate_per_unit"
                  type="number"
                  step="0.01"
                  value={formData.rate_per_unit}
                  onChange={(e) => setFormData((prev) => ({ ...prev, rate_per_unit: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rental_start_date">Start Date</Label>
                  <Input
                    id="rental_start_date"
                    type="date"
                    value={formData.rental_start_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, rental_start_date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="rental_end_date">End Date (Optional)</Label>
                  <Input
                    id="rental_end_date"
                    type="date"
                    value={formData.rental_end_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, rental_end_date: e.target.value }))}
                  />
                </div>
              </div>

              {estimatedCost !== null && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Estimated Cost {formData.rental_end_date && `(${calculateRentalDays(formData.rental_start_date, formData.rental_end_date)} days)`}:
                    </span>
                    <span className="font-semibold text-primary">{estimatedCost.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="supplier">Supplier (Optional)</Label>
                <Input
                  id="supplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData((prev) => ({ ...prev, supplier: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <Button type="submit" className="w-full">
                Record Rental
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading rental records...</div>
        ) : rentals.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No rental expenses recorded yet</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Rental History</p>
                  <p className="text-xs text-muted-foreground">
                    Track and filter rental expenses by type, item, supplier, and date.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => setFiltersOpen((current) => !current)}
                  >
                    <Filter className="mr-2 h-3.5 w-3.5" />
                    {filtersOpen ? "Hide filters" : "Filter"}
                  </Button>
                  {filtersOpen && (
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  )}
                </div>
              </div>

              {filtersOpen && (
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="space-y-1">
                    <Label htmlFor="filter-rental-type" className="text-[11px]">
                      Type
                    </Label>
                    <Select
                      value={filters.rentalType}
                      onValueChange={(value) => setFilters((current) => ({ ...current, rentalType: value }))}
                    >
                      <SelectTrigger id="filter-rental-type" className="h-8 text-xs">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="Tools">Tools</SelectItem>
                        <SelectItem value="Equipment">Equipment</SelectItem>
                        <SelectItem value="Accommodation">Accommodation</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="filter-item-name" className="text-[11px]">
                      Item Name
                    </Label>
                    <Input
                      id="filter-item-name"
                      className="h-8 text-xs"
                      value={filters.itemName}
                      onChange={(e) => setFilters((current) => ({ ...current, itemName: e.target.value }))}
                      placeholder="Search item"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="filter-supplier" className="text-[11px]">
                      Supplier
                    </Label>
                    <Input
                      id="filter-supplier"
                      className="h-8 text-xs"
                      value={filters.supplier}
                      onChange={(e) => setFilters((current) => ({ ...current, supplier: e.target.value }))}
                      placeholder="Search supplier"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="filter-date-from" className="text-[11px]">
                      Date From
                    </Label>
                    <Input
                      id="filter-date-from"
                      type="date"
                      className="h-8 text-xs"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters((current) => ({ ...current, dateFrom: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="filter-date-to" className="text-[11px]">
                      Date To
                    </Label>
                    <Input
                      id="filter-date-to"
                      type="date"
                      className="h-8 text-xs"
                      value={filters.dateTo}
                      onChange={(e) => setFilters((current) => ({ ...current, dateTo: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>{rentalsSummary.recordCount} records</span>
                <span>{rentalsSummary.typeCount} types</span>
                <span className="font-semibold">Total Cost: {rentalsSummary.totalCost.toFixed(2)}</span>
              </div>
            </div>

            {filteredRentals.length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                No rental records match the current filters.
              </div>
            ) : (
              <div className="h-[420px] overflow-auto overscroll-contain rounded-md border text-xs [&_td]:py-2 [&_th]:py-2 [&_th]:text-[11px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Rate/Day</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Total Cost</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRentals.map((rental) => {
                      const days = calculateRentalDays(rental.rental_start_date, rental.rental_end_date);
                      const totalCost = calculateRentalCost(
                        Number(rental.quantity),
                        Number(rental.rate_per_unit),
                        rental.rental_start_date,
                        rental.rental_end_date
                      );

                      return (
                        <TableRow key={rental.id}>
                          <TableCell>
                            <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                              {rental.rental_type}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">{rental.item_name}</TableCell>
                          <TableCell>
                            {rental.quantity} {rental.unit}
                          </TableCell>
                          <TableCell>{Number(rental.rate_per_unit).toFixed(2)}</TableCell>
                          <TableCell>{new Date(rental.rental_start_date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {rental.rental_end_date ? new Date(rental.rental_end_date).toLocaleDateString() : "Ongoing"}
                          </TableCell>
                          <TableCell>{days > 0 ? days : "—"}</TableCell>
                          <TableCell className="font-semibold">{totalCost > 0 ? totalCost.toFixed(2) : "—"}</TableCell>
                          <TableCell>{rental.supplier || "—"}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                            {rental.notes || "—"}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => void handleDelete(rental.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="border-t-2 bg-muted/50 font-semibold">
                      <TableCell colSpan={7} className="text-right">
                        Grand Total:
                      </TableCell>
                      <TableCell className="font-bold text-primary">{rentalsSummary.totalCost.toFixed(2)}</TableCell>
                      <TableCell colSpan={3}></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}