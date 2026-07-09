import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Package, TrendingDown, FileText, TrendingUp, Users, Warehouse as WarehouseIcon } from "lucide-react";

// Import modular tab components
import { SiteWarehouseTab } from "@/components/site-personnel/SiteWarehouseTab";
import { SiteWarehouseInventoryTab } from "@/components/site-personnel/SiteWarehouseInventoryTab";
import { MaterialUsageTab } from "@/components/site-personnel/MaterialUsageTab";
import { SiteRequestsTab } from "@/components/site-personnel/SiteRequestsTab";
import { ProgressTab } from "@/components/site-personnel/ProgressTab";
import { AttendanceTab } from "@/components/site-personnel/AttendanceTab";
import { SitePersonnelRecycleBin } from "@/components/site-personnel/SitePersonnelRecycleBin";

interface Project {
  id: string;
  name: string;
  status: string;
}

export default function SitePersonnelPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [recycleBinVersion, setRecycleBinVersion] = useState(0);

  useEffect(() => {
    void checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (!session) {
        await router.push("/auth/login");
        return;
      }

      await loadProjects();
    } catch (error) {
      console.error("Auth check error:", error);
      toast({
        title: "Authentication Error",
        description: "Please log in to continue",
        variant: "destructive",
      });
      await router.push("/auth/login");
    }
  }

  async function loadProjects() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const projectList = data || [];
      setProjects(projectList);

      // Auto-select first active project
      const activeProject = projectList.find((p) => p.status === "active");
      if (activeProject) {
        setSelectedProjectId(activeProject.id);
      } else if (projectList.length > 0) {
        setSelectedProjectId(projectList[0].id);
      }
    } catch (error) {
      console.error("Error loading projects:", error);
      toast({
        title: "Error",
        description: "Failed to load projects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <SEO title="Site Personnel - Loading..." description="Construction site personnel management" />
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (projects.length === 0) {
    return (
      <Layout>
        <SEO title="Site Personnel - No Projects" description="Construction site personnel management" />
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>No Projects Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Create a project first in the Projects module to use Site Personnel features.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!selectedProjectId) {
    return (
      <Layout>
        <SEO title="Site Personnel" description="Construction site personnel management" />
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <p className="text-muted-foreground">Select a project to continue</p>
        </div>
      </Layout>
    );
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <Layout>
      <SEO title="Site Personnel Management" description="Manage site purchase and deliveries, warehouse, material usage, requests, progress, and attendance" />
      
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Site Personnel</h1>
            <p className="text-sm text-muted-foreground">
              Manage site operations, purchase deliveries, warehouse, and workforce
            </p>
          </div>

          <div className="flex items-center gap-2">
            <SitePersonnelRecycleBin
              projectId={selectedProjectId}
              onChange={() => setRecycleBinVersion((current) => current + 1)}
            />
            <div className="w-full sm:w-[280px]">
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Card className="border shadow-sm">
          <CardHeader className="px-3 py-3 sm:px-4">
            <CardTitle className="text-sm font-semibold">Site Operations</CardTitle>
            <div className="overflow-x-auto overflow-y-hidden pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-6 h-auto">
                  <TabsTrigger value="warehouse" className="text-xs py-2">Warehouse</TabsTrigger>
                  <TabsTrigger value="deliveries" className="text-xs py-2">Site Purchase & Deliveries</TabsTrigger>
                  <TabsTrigger value="inventory" className="text-xs py-2">Inventory</TabsTrigger>
                  <TabsTrigger value="attendance" className="text-xs py-2">Attendance</TabsTrigger>
                  <TabsTrigger value="requests" className="text-xs py-2">Site Requests</TabsTrigger>
                  <TabsTrigger value="usage" className="text-xs py-2">Material Usage</TabsTrigger>
                </TabsList>

                <CardContent className="px-4 pb-4 pt-0">
                  <TabsContent value="deliveries" className="mt-0">
                    <SiteWarehouseTab key={`deliveries-${selectedProjectId}-${recycleBinVersion}`} projectId={selectedProjectId} />
                  </TabsContent>

                  <TabsContent value="site-warehouse" className="mt-0">
                    <SiteWarehouseInventoryTab key={`inventory-${selectedProjectId}-${recycleBinVersion}`} projectId={selectedProjectId} />
                  </TabsContent>

                  <TabsContent value="usage" className="mt-0">
                    <MaterialUsageTab key={`usage-${selectedProjectId}-${recycleBinVersion}`} projectId={selectedProjectId} />
                  </TabsContent>

                  <TabsContent value="requests" className="mt-0">
                    <SiteRequestsTab key={`requests-${selectedProjectId}-${recycleBinVersion}`} projectId={selectedProjectId} />
                  </TabsContent>

                  <TabsContent value="progress" className="mt-0">
                    <ProgressTab key={`progress-${selectedProjectId}-${recycleBinVersion}`} projectId={selectedProjectId} />
                  </TabsContent>

                  <TabsContent value="attendance" className="mt-0">
                    <AttendanceTab key={`attendance-${selectedProjectId}-${recycleBinVersion}`} projectId={selectedProjectId} />
                  </TabsContent>
                </CardContent>
              </Tabs>
            </div>
          </CardHeader>
        </Card>
      </div>
    </Layout>
  );
}