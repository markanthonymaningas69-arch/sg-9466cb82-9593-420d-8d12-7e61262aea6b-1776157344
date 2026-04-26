import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Package, TrendingDown, FileText, TrendingUp, Users } from "lucide-react";

// Import modular tab components
import { SiteWarehouseTab } from "@/components/site-personnel/SiteWarehouseTab";
import { MaterialUsageTab } from "@/components/site-personnel/MaterialUsageTab";
import { SiteRequestsTab } from "@/components/site-personnel/SiteRequestsTab";
import { ProgressTab } from "@/components/site-personnel/ProgressTab";
import { AttendanceTab } from "@/components/site-personnel/AttendanceTab";

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
      <SEO title="Site Personnel Management" description="Manage site deliveries, material usage, requests, progress, and attendance" />
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Site Personnel</h1>
            <p className="text-muted-foreground">
              Manage site operations, deliveries, and workforce
            </p>
          </div>

          <div className="w-full sm:w-[300px]">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
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

        {/* Tabs */}
        <Tabs defaultValue="warehouse" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="warehouse" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Warehouse</span>
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-2">
              <TrendingDown className="h-4 w-4" />
              <span className="hidden sm:inline">Usage</span>
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Requests</span>
            </TabsTrigger>
            <TabsTrigger value="progress" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Progress</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Attendance</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="warehouse">
            <SiteWarehouseTab projectId={selectedProjectId} />
          </TabsContent>

          <TabsContent value="usage">
            <MaterialUsageTab projectId={selectedProjectId} />
          </TabsContent>

          <TabsContent value="requests">
            <SiteRequestsTab projectId={selectedProjectId} />
          </TabsContent>

          <TabsContent value="progress">
            <ProgressTab projectId={selectedProjectId} />
          </TabsContent>

          <TabsContent value="attendance">
            <AttendanceTab projectId={selectedProjectId} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}