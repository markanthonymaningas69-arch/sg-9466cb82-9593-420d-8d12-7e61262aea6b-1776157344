import React, { useState } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity, Users, DollarSign, Building2, PackagePlus, BarChart3, Filter, FilterX, LogOut } from "lucide-react";

// Simulated Data for the Super Admin
const MOCK_GMS = [
  { id: 1, gmName: "John Carter", email: "john@buildcorp.com", company: "BuildCorp Inc.", plan: "Professional", cycle: "Annual", addons: ["Warehouse", "Purchasing", "Accounting"], mrr: 299 },
  { id: 2, gmName: "Sarah Jenkins", email: "s.jenkins@apexconst.com", company: "Apex Construction", plan: "Starter", cycle: "Monthly", addons: ["Site Personnel"], mrr: 49 },
  { id: 3, gmName: "Michael Chen", email: "michael@chenbuilders.net", company: "Chen Builders", plan: "Professional", cycle: "Monthly", addons: ["Accounting", "Purchasing", "Warehouse", "Human Resources"], mrr: 349 },
  { id: 4, gmName: "Emma Watson", email: "emma.w@skyline.co", company: "Skyline Developments", plan: "Starter", cycle: "Annual", addons: [], mrr: 39 },
  { id: 5, gmName: "David Rodriguez", email: "david@rodriguez-sons.com", company: "Rodriguez & Sons", plan: "Professional", cycle: "Annual", addons: ["Purchasing", "Warehouse"], mrr: 249 },
  { id: 6, gmName: "Amanda Foster", email: "amanda@fostergroup.com", company: "Foster Group", plan: "Starter", cycle: "Monthly", addons: ["Accounting"], mrr: 79 },
];

const MOCK_REVENUE_DATA = [
  { month: "Nov 2025", revenue: 4200 },
  { month: "Dec 2025", revenue: 5100 },
  { month: "Jan 2026", revenue: 6800 },
  { month: "Feb 2026", revenue: 8400 },
  { month: "Mar 2026", revenue: 10200 },
  { month: "Apr 2026", revenue: 12450 },
];

export default function SystemMonitor() {
  const router = useRouter();
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterCycle, setFilterCycle] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const handleLogout = () => {
    router.replace("/auth/login");
  };

  // Derived Metrics
  const totalGMs = MOCK_GMS.length;
  const totalAddons = MOCK_GMS.reduce((sum, gm) => sum + gm.addons.length, 0);
  
  const starterMonthly = MOCK_GMS.filter(g => g.plan === "Starter" && g.cycle === "Monthly");
  const starterAnnual = MOCK_GMS.filter(g => g.plan === "Starter" && g.cycle === "Annual");
  const proMonthly = MOCK_GMS.filter(g => g.plan === "Professional" && g.cycle === "Monthly");
  const proAnnual = MOCK_GMS.filter(g => g.plan === "Professional" && g.cycle === "Annual");

  const sumMRR = (arr: typeof MOCK_GMS) => arr.reduce((sum, g) => sum + g.mrr, 0);

  // Apply Filters to Table
  const filteredGMs = MOCK_GMS.filter(gm => {
    if (filterPlan !== "all" && gm.plan.toLowerCase() !== filterPlan) return false;
    if (filterCycle !== "all" && gm.cycle.toLowerCase() !== filterCycle) return false;
    if (searchTerm && !gm.company.toLowerCase().includes(searchTerm.toLowerCase()) && !gm.gmName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const maxRevenue = Math.max(...MOCK_REVENUE_DATA.map(d => d.revenue));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-slate-900 text-white sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-lg shadow-inner">
            TX
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Super Admin Portal</h1>
            <p className="text-xs text-slate-400">System Monitoring & Global Analytics</p>
          </div>
        </div>
        <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Secure Exit
        </Button>
      </header>

      {/* Main Dashboard */}
      <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-blue-600 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                Active GM Accounts
                <Building2 className="h-4 w-4 text-blue-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{totalGMs}</div>
              <p className="text-xs text-muted-foreground mt-1">Total registered companies</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-600 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                Active Add-ons
                <PackagePlus className="h-4 w-4 text-purple-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{totalAddons}</div>
              <p className="text-xs text-muted-foreground mt-1">Modules purchased across platform</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-600 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                Total MRR
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">${sumMRR(MOCK_GMS)}</div>
              <p className="text-xs text-muted-foreground mt-1">Monthly Recurring Revenue</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                Professional Users
                <Users className="h-4 w-4 text-amber-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{proMonthly.length + proAnnual.length}</div>
              <p className="text-xs text-muted-foreground mt-1">vs {starterMonthly.length + starterAnnual.length} Starter users</p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Breakdown Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          
          {/* Subscription Breakdown */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-slate-700" />
                Subscription Breakdown
              </CardTitle>
              <CardDescription>Number and amount of active subscriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-3 border-b pb-1">Starter Tier</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-lg border">
                      <div className="text-xs text-slate-500 font-semibold uppercase mb-1">Monthly</div>
                      <div className="text-2xl font-bold">{starterMonthly.length} <span className="text-sm font-normal text-slate-500">accounts</span></div>
                      <div className="text-sm text-emerald-600 font-semibold mt-1">${sumMRR(starterMonthly)}/mo</div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border">
                      <div className="text-xs text-slate-500 font-semibold uppercase mb-1">Annual</div>
                      <div className="text-2xl font-bold">{starterAnnual.length} <span className="text-sm font-normal text-slate-500">accounts</span></div>
                      <div className="text-sm text-emerald-600 font-semibold mt-1">${sumMRR(starterAnnual)}/mo avg</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-3 border-b pb-1">Professional Tier</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                      <div className="text-xs text-blue-600 font-semibold uppercase mb-1">Monthly</div>
                      <div className="text-2xl font-bold text-blue-900">{proMonthly.length} <span className="text-sm font-normal text-blue-700">accounts</span></div>
                      <div className="text-sm text-emerald-600 font-semibold mt-1">${sumMRR(proMonthly)}/mo</div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                      <div className="text-xs text-blue-600 font-semibold uppercase mb-1">Annual</div>
                      <div className="text-2xl font-bold text-blue-900">{proAnnual.length} <span className="text-sm font-normal text-blue-700">accounts</span></div>
                      <div className="text-sm text-emerald-600 font-semibold mt-1">${sumMRR(proAnnual)}/mo avg</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revenue Graph */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-600" />
                Accumulated Monthly Revenue
              </CardTitle>
              <CardDescription>MRR growth over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-end gap-2 pb-4 pt-8">
              {MOCK_REVENUE_DATA.map((data, index) => {
                const heightPercent = (data.revenue / maxRevenue) * 100;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="w-full relative flex items-end justify-center h-full rounded-t-sm bg-slate-100 overflow-hidden">
                      <div 
                        className="w-full bg-emerald-500 rounded-t-sm transition-all duration-500 group-hover:bg-emerald-400 relative"
                        style={{ height: `${heightPercent}%` }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-lg">
                          ${data.revenue.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 font-medium rotate-[-45deg] origin-top-left mt-2 whitespace-nowrap">
                      {data.month}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

        </div>

        {/* Global GM Directory */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b">
            <div>
              <CardTitle>Global GM Directory</CardTitle>
              <CardDescription>Monitor user accounts, company details, and add-ons</CardDescription>
            </div>
            <div className="flex items-center gap-2 mt-4 sm:mt-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search company or GM..." 
                  className="pl-9 h-9 w-[200px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" className="h-9" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {(filterPlan !== "all" || filterCycle !== "all") && (
                  <span className="ml-2 flex h-2 w-2 rounded-full bg-blue-600"></span>
                )}
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {showFilters && (
              <div className="bg-slate-50 p-4 border-b flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-500">Subscription Tier</span>
                  <Select value={filterPlan} onValueChange={setFilterPlan}>
                    <SelectTrigger className="w-[150px] bg-white h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tiers</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-500">Billing Cycle</span>
                  <Select value={filterCycle} onValueChange={setFilterCycle}>
                    <SelectTrigger className="w-[150px] bg-white h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cycles</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(filterPlan !== "all" || filterCycle !== "all") && (
                  <Button variant="ghost" size="sm" className="h-9" onClick={() => { setFilterPlan("all"); setFilterCycle("all"); }}>
                    <FilterX className="h-4 w-4 mr-2" /> Clear
                  </Button>
                )}
              </div>
            )}

            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Company & GM</TableHead>
                  <TableHead>Plan & Cycle</TableHead>
                  <TableHead>Active Add-ons</TableHead>
                  <TableHead className="text-right">Est. MRR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGMs.map((gm) => (
                  <TableRow key={gm.id}>
                    <TableCell>
                      <div className="font-bold text-slate-900">{gm.company}</div>
                      <div className="text-sm text-slate-500">{gm.gmName}</div>
                      <div className="text-xs text-blue-600">{gm.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={gm.plan === "Professional" ? "default" : "outline"} className={gm.plan === "Professional" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}>
                        {gm.plan}
                      </Badge>
                      <div className="text-xs text-slate-500 mt-1 font-medium">{gm.cycle} Billing</div>
                    </TableCell>
                    <TableCell>
                      {gm.addons.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {gm.addons.map((addon, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                              {addon}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">
                      ${gm.mrr}/mo
                    </TableCell>
                  </TableRow>
                ))}
                {filteredGMs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                      No companies match your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </main>
    </div>
  );
}

function Search(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
}