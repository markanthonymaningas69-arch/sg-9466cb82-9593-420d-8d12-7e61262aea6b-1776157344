import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, MapPin, Calendar, Clock, TrendingUp, CheckCircle2, HardHat, Building2, Wallet, Users, LayoutDashboard } from "lucide-react";

const formatAED = (value: number) => {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(value);
};

const scopes = [
  { name: 'Permits', start: 'Feb 1', end: 'Feb 7', progress: 100, budget: 15000, spent: 15000, status: 'Completed' },
  { name: 'Mobilization', start: 'Feb 5', end: 'Feb 10', progress: 100, budget: 25000, spent: 25000, status: 'Completed' },
  { name: 'Temporary Facility', start: 'Feb 7', end: 'Feb 14', progress: 100, budget: 45000, spent: 45000, status: 'Completed' },
  { name: 'Earthworks', start: 'Feb 10', end: 'Feb 25', progress: 100, budget: 120000, spent: 120000, status: 'Completed' },
  { name: 'Structural Works', start: 'Feb 20', end: 'Mar 20', progress: 100, budget: 650000, spent: 650000, status: 'Completed' },
  { name: 'Formworks & Shuttering', start: 'Feb 25', end: 'Mar 25', progress: 100, budget: 180000, spent: 180000, status: 'Completed' },
  { name: 'Roof Framing', start: 'Mar 15', end: 'Apr 5', progress: 100, budget: 220000, spent: 220000, status: 'Completed' },
  { name: 'Masonry Works', start: 'Mar 20', end: 'Apr 20', progress: 85, budget: 350000, spent: 297500, status: 'In Progress' },
  { name: 'Plumbing Works', start: 'Mar 25', end: 'Apr 25', progress: 75, budget: 280000, spent: 210000, status: 'In Progress' },
  { name: 'Electrical Works', start: 'Mar 25', end: 'Apr 25', progress: 70, budget: 310000, spent: 217000, status: 'In Progress' },
  { name: 'Carpentry', start: 'Apr 10', end: 'Apr 30', progress: 20, budget: 150000, spent: 30000, status: 'In Progress' },
  { name: 'Ceiling Works', start: 'Apr 15', end: 'May 5', progress: 0, budget: 120000, spent: 0, status: 'Pending' },
  { name: 'Plastering', start: 'Apr 15', end: 'May 10', progress: 0, budget: 180000, spent: 0, status: 'Pending' },
  { name: 'Painting Works', start: 'Apr 20', end: 'May 15', progress: 0, budget: 140000, spent: 0, status: 'Pending' },
  { name: 'Fencing', start: 'Apr 25', end: 'May 20', progress: 0, budget: 95000, spent: 0, status: 'Pending' },
  { name: 'Thinsmitting', start: 'May 1', end: 'May 25', progress: 0, budget: 60000, spent: 0, status: 'Pending' }
];

export default function DemoProject() {
  const totalBudget = scopes.reduce((acc, curr) => acc + curr.budget, 0);
  const totalSpent = scopes.reduce((acc, curr) => acc + curr.spent, 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      {/* Sticky Top Banner CTA */}
      <div className="bg-primary text-primary-foreground py-3 px-4 sm:px-8 sticky top-0 z-50 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 rounded-full bg-green-400 animate-pulse border-2 border-white/20"></span>
          <span className="font-medium text-sm md:text-base">
            Viewing Live Demo: See how THEA-X tracks projects, scopes, and budgets in real-time.
          </span>
        </div>
        <Link href="/">
          <Button variant="secondary" className="font-bold shadow-lg hover:scale-105 transition-transform whitespace-nowrap">
            Try THEA-X Now <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </Link>
      </div>

      {/* Main Dashboard */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Project Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-100 text-blue-700 p-2 rounded-lg">
                <Building2 className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-bold font-heading">G+1 Villa Sample Project</h1>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-2">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> Internet City, Dubai, UAE
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> Started: Feb 1, 2026
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Duration: 3 Months
              </div>
            </div>
          </div>
          <div className="text-right w-full md:w-auto">
            <p className="text-sm text-muted-foreground mb-1">Overall Progress</p>
            <div className="flex items-center justify-end gap-3">
              <Progress value={75} className="w-32 md:w-48 h-3 [&>div]:bg-primary" />
              <span className="text-2xl font-bold text-primary">75%</span>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Total Budget</p>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{formatAED(totalBudget)}</div>
              <p className="text-xs text-muted-foreground mt-1">Approved project value</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Actual Spent</p>
                <TrendingUp className="h-4 w-4 text-orange-500" />
              </div>
              <div className="text-2xl font-bold text-orange-600">{formatAED(totalSpent)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {((totalSpent / totalBudget) * 100).toFixed(1)}% of total budget
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Time Elapsed</p>
                <Calendar className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold">2.5 Months</div>
              <p className="text-xs text-muted-foreground mt-1">Expected completion: May 1</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Active Manpower</p>
                <Users className="h-4 w-4 text-green-500" />
              </div>
              <div className="text-2xl font-bold">42 Personnel</div>
              <p className="text-xs text-muted-foreground mt-1">On-site today</p>
            </CardContent>
          </Card>
        </div>

        {/* Scopes of Work Table */}
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-primary" />
              <CardTitle>Bill of Materials & Scopes of Work</CardTitle>
            </div>
            <CardDescription>Real-time progress tracking across all construction phases.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-[250px] font-semibold">Scope</TableHead>
                    <TableHead className="font-semibold">Timeline</TableHead>
                    <TableHead className="font-semibold text-right">Budget</TableHead>
                    <TableHead className="font-semibold text-right">Spent</TableHead>
                    <TableHead className="w-[200px] font-semibold">Progress</TableHead>
                    <TableHead className="font-semibold text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scopes.map((scope, index) => (
                    <TableRow key={index} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium">{scope.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {scope.start} - {scope.end}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatAED(scope.budget)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatAED(scope.spent)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Progress 
                            value={scope.progress} 
                            className={`h-2 flex-1 ${scope.progress === 100 ? "[&>div]:bg-green-500" : scope.progress > 0 ? "[&>div]:bg-blue-500" : "[&>div]:bg-slate-200"}`} 
                          />
                          <span className="text-xs font-semibold w-8 text-right">{scope.progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="secondary" 
                          className={`
                            ${scope.status === 'Completed' && 'bg-green-100 text-green-700 hover:bg-green-100'}
                            ${scope.status === 'In Progress' && 'bg-blue-100 text-blue-700 hover:bg-blue-100'}
                            ${scope.status === 'Pending' && 'bg-slate-100 text-slate-600 hover:bg-slate-100'}
                          `}
                        >
                          {scope.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        
        {/* Bottom CTA */}
        <div className="text-center py-12 px-4 bg-primary/5 rounded-2xl border border-primary/10">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">Ready to manage your own projects?</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            THEA-X Construction Accounting System gives you the same level of granular control over your budgets, manpower, and schedules as you see in this demo.
          </p>
          <Link href="/">
            <Button size="lg" className="h-14 px-8 text-lg shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
              Start Free Trial Now <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
}