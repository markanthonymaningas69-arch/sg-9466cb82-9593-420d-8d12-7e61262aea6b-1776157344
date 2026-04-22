import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Settings2, Calendar as CalendarIcon, Download } from "lucide-react";
import { projectService } from "@/services/projectService";
import { scheduleService } from "@/services/scheduleService";
import { useToast } from "@/hooks/use-toast";

export default function SchedulePage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadTasks(selectedProject);
    } else {
      setTasks([]);
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    try {
      const { data } = await projectService.getAll();
      setProjects(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async (projectId: string) => {
    try {
      setLoading(true);
      const data = await scheduleService.getTasksByProject(projectId);
      setTasks(data || []);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to load schedule", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFromBOM = async () => {
    if (!selectedProject) return;
    try {
      setLoading(true);
      await scheduleService.generateTasksFromBOM(selectedProject);
      await loadTasks(selectedProject);
      toast({ title: "Success", description: "Tasks generated from BOM successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to generate tasks", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold">Project Manager</h1>
            <p className="text-muted-foreground mt-1">Interactive Gantt Chart and Scheduling</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {!selectedProject ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Please select a project to view its schedule and Gantt chart.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left/Center - Gantt Chart Area */}
            <Card className="lg:col-span-3 min-h-[600px] flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
                <CardTitle className="text-lg">Project Schedule</CardTitle>
                <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                  <Button size="sm" variant="outline" onClick={handleGenerateFromBOM}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Auto-generate from BOM
                  </Button>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 relative bg-slate-50/50">
                {loading ? (
                  <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground">
                    <p>No tasks found for this project.</p>
                    <p className="text-sm mt-1">Generate from BOM or add tasks manually.</p>
                  </div>
                ) : (
                  <div className="p-0 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 font-medium min-w-[200px]">Task Name</th>
                          <th className="px-4 py-2 font-medium min-w-[100px]">Start</th>
                          <th className="px-4 py-2 font-medium min-w-[100px]">End</th>
                          <th className="px-4 py-2 font-medium min-w-[100px]">Duration</th>
                          <th className="px-4 py-2 font-medium min-w-[120px]">Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map(task => (
                          <tr key={task.id} className="border-b hover:bg-muted/50 cursor-pointer bg-white">
                            <td className="px-4 py-3 font-medium">
                              <div className="flex flex-col">
                                <span>{task.name}</span>
                                {task.bom_scope && (
                                  <span className="text-[10px] text-muted-foreground">Scope: {task.bom_scope.name}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">{task.start_date || '-'}</td>
                            <td className="px-4 py-3">{task.end_date || '-'}</td>
                            <td className="px-4 py-3">{task.duration_days ? `${task.duration_days} days` : '-'}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-full bg-muted rounded-full h-1.5 min-w-[60px]">
                                  <div className="bg-primary h-1.5 rounded-full" style={{ width: `${task.progress || 0}%` }}></div>
                                </div>
                                <span className="text-xs font-semibold">{task.progress || 0}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right - Control Panel */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg flex items-center">
                  <Settings2 className="h-5 w-5 mr-2 text-muted-foreground" />
                  Task Properties
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground text-center py-8">
                  Select a task from the schedule to view and edit its properties, dependencies, and resources.
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}