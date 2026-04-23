import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings2, Calendar as CalendarIcon, Save, Trash2, AlignLeft, Clock, Users, DollarSign } from "lucide-react";
import { projectService } from "@/services/projectService";
import { scheduleService } from "@/services/scheduleService";
import { useToast } from "@/hooks/use-toast";

export default function SchedulePage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "gantt">("list");
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

  const handleUpdateTask = async () => {
    if (!selectedTask) return;
    try {
      setSaving(true);
      const taskPayload = {
        name: selectedTask.name,
        project_id: selectedTask.project_id,
        start_date: selectedTask.start_date,
        end_date: selectedTask.end_date,
        duration_days: selectedTask.duration_days,
        progress: selectedTask.progress,
        status: selectedTask.status,
        priority: selectedTask.priority,
        notes: selectedTask.notes
      };

      if (selectedTask.id) {
        await scheduleService.updateTask(selectedTask.id, taskPayload);
        toast({ title: "Success", description: "Task updated successfully" });
      } else {
        await scheduleService.createTask(taskPayload);
        toast({ title: "Success", description: "Task created successfully" });
        setSelectedTask(null);
      }
      await loadTasks(selectedProject);
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Calculate Gantt timeline bounds
  const timelineBounds = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;
    let minDate = new Date();
    let maxDate = new Date();
    let hasValidDates = false;

    tasks.forEach(t => {
      if (t.start_date) {
        const d = new Date(t.start_date);
        if (!hasValidDates || d < minDate) minDate = d;
        hasValidDates = true;
      }
      if (t.end_date) {
        const d = new Date(t.end_date);
        if (!hasValidDates || d > maxDate) maxDate = d;
        hasValidDates = true;
      }
    });

    if (!hasValidDates) return null;
    
    // Pad by 7 days on each side
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 14);
    
    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 3600 * 24));
    
    return { minDate, maxDate, totalDays };
  }, [tasks]);

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
                  <div className="flex items-center space-x-2 mr-4 bg-muted/50 p-1 rounded-md">
                    <Button 
                      size="sm" 
                      variant={viewMode === "list" ? "default" : "ghost"} 
                      onClick={() => setViewMode("list")}
                      className="h-7 text-xs"
                    >
                      List View
                    </Button>
                    <Button 
                      size="sm" 
                      variant={viewMode === "gantt" ? "default" : "ghost"} 
                      onClick={() => setViewMode("gantt")}
                      className="h-7 text-xs"
                    >
                      Gantt View
                    </Button>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleGenerateFromBOM}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Auto-generate from BOM
                  </Button>
                  <Button size="sm" onClick={() => {
                    setSelectedTask({
                      name: "New Task",
                      status: "pending",
                      progress: 0,
                      project_id: selectedProject
                    });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 relative bg-background overflow-hidden flex flex-col">
                {loading ? (
                  <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : tasks.length === 0 && !selectedTask ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground p-8 text-center">
                    <div className="bg-muted h-16 w-16 rounded-full flex items-center justify-center mb-4">
                      <CalendarIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-medium text-foreground">No tasks found for this project</p>
                    <p className="text-sm mt-1 max-w-md">Generate your schedule automatically from the project's Bill of Materials, or create tasks manually to build your Gantt chart.</p>
                    <Button className="mt-6" onClick={handleGenerateFromBOM}>
                      Auto-generate from BOM
                    </Button>
                  </div>
                ) : viewMode === "list" ? (
                  <div className="p-0 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted text-muted-foreground sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 font-medium min-w-[200px]">Task Name</th>
                          <th className="px-4 py-3 font-medium min-w-[100px]">Start Date</th>
                          <th className="px-4 py-3 font-medium min-w-[100px]">End Date</th>
                          <th className="px-4 py-3 font-medium min-w-[100px]">Duration</th>
                          <th className="px-4 py-3 font-medium min-w-[120px]">Progress</th>
                          <th className="px-4 py-3 font-medium min-w-[100px]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map(task => (
                          <tr 
                            key={task.id} 
                            onClick={() => setSelectedTask(task)}
                            className={`border-b cursor-pointer transition-colors ${selectedTask?.id === task.id ? 'bg-primary/10 border-primary/20' : 'bg-card hover:bg-muted/50'}`}
                          >
                            <td className="px-4 py-3 font-medium">
                              <div className="flex flex-col">
                                <span className={selectedTask?.id === task.id ? 'text-primary' : 'text-foreground'}>{task.name}</span>
                                {task.bom_scope && (
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[250px]">Scope: {task.bom_scope.name}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs">{task.start_date ? new Date(task.start_date).toLocaleDateString() : '-'}</td>
                            <td className="px-4 py-3 text-xs">{task.end_date ? new Date(task.end_date).toLocaleDateString() : '-'}</td>
                            <td className="px-4 py-3 text-xs">{task.duration_days ? `${task.duration_days} d` : '-'}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-full bg-muted rounded-full h-1.5 min-w-[60px]">
                                  <div className="bg-primary h-1.5 rounded-full" style={{ width: `${task.progress || 0}%` }}></div>
                                </div>
                                <span className="text-xs font-semibold">{task.progress || 0}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={`text-[10px] capitalize ${
                                task.status === 'completed' ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                                task.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                task.status === 'delayed' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                                'bg-muted text-muted-foreground border-border'
                              }`}>
                                {task.status?.replace('_', ' ') || 'Pending'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* Visual Gantt View */
                  <div className="flex-1 overflow-auto relative flex flex-col bg-background">
                    {timelineBounds ? (
                      <div className="min-w-max">
                        {/* Gantt Header */}
                        <div className="flex border-b bg-muted/30 sticky top-0 z-20">
                          <div className="w-[250px] shrink-0 border-r p-3 font-medium text-xs text-muted-foreground bg-card sticky left-0 z-30">
                            Task Name
                          </div>
                          <div className="flex-1 relative h-10 flex">
                            {Array.from({ length: timelineBounds.totalDays }).map((_, i) => {
                              const d = new Date(timelineBounds.minDate);
                              d.setDate(d.getDate() + i);
                              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                              const isStartOfMonth = d.getDate() === 1;
                              
                              return (
                                <div 
                                  key={i} 
                                  className={`w-[30px] shrink-0 border-r text-[9px] flex flex-col items-center justify-center ${isWeekend ? 'bg-muted/50 text-muted-foreground/50' : 'text-muted-foreground'}`}
                                >
                                  {isStartOfMonth && <span className="font-bold text-foreground absolute -top-4 whitespace-nowrap">{d.toLocaleString('default', { month: 'short' })}</span>}
                                  <span>{d.getDate()}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* Gantt Body */}
                        {tasks.map((task, idx) => {
                          // Calculate position
                          let leftOffset = 0;
                          let barWidth = 0;
                          
                          if (task.start_date && task.end_date) {
                            const start = new Date(task.start_date);
                            const end = new Date(task.end_date);
                            
                            leftOffset = Math.max(0, Math.floor((start.getTime() - timelineBounds.minDate.getTime()) / (1000 * 3600 * 24))) * 30;
                            barWidth = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24))) * 30;
                          }
                          
                          const isSelected = selectedTask?.id === task.id;
                          
                          return (
                            <div 
                              key={task.id} 
                              className={`flex border-b hover:bg-muted/50 cursor-pointer ${isSelected ? 'bg-primary/10' : ''}`}
                              onClick={() => setSelectedTask(task)}
                            >
                              <div className={`w-[250px] shrink-0 border-r p-2 text-xs truncate bg-card text-foreground sticky left-0 z-10 ${isSelected ? 'border-primary/30 font-medium' : ''}`}>
                                {task.name}
                              </div>
                              <div className="flex-1 relative h-10 flex border-l border-border/50" style={{ backgroundImage: "linear-gradient(to right, hsl(var(--border) / 0.5) 1px, transparent 1px)", backgroundSize: "30px 100%" }}>
                                {task.start_date && task.end_date && (
                                  <div 
                                    className={`absolute top-2 h-6 rounded-md shadow-sm border overflow-hidden flex items-center group transition-all
                                      ${task.status === 'completed' ? 'bg-green-500 border-green-600' :
                                        task.status === 'in_progress' ? 'bg-blue-500 border-blue-600' :
                                        task.status === 'delayed' ? 'bg-red-500 border-red-600' :
                                        'bg-slate-400 border-slate-500'}
                                      ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}
                                    `}
                                    style={{ 
                                      left: `${leftOffset}px`, 
                                      width: `${barWidth}px`,
                                      minWidth: '4px'
                                    }}
                                  >
                                    <div 
                                      className="h-full bg-black/20" 
                                      style={{ width: `${task.progress || 0}%` }}
                                    />
                                    <div className="absolute inset-0 px-2 flex items-center justify-between text-[10px] text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden">
                                      <span>{task.progress || 0}%</span>
                                      {barWidth > 60 && <span>{task.duration_days}d</span>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        Define start and end dates for your tasks to generate the timeline view.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right - Control Panel */}
            <Card className="lg:col-span-1 flex flex-col h-[600px] overflow-hidden">
              <CardHeader className="pb-3 border-b shrink-0 bg-muted/10">
                <CardTitle className="text-base flex items-center">
                  <Settings2 className="h-4 w-4 mr-2 text-primary" />
                  Task Configuration
                </CardTitle>
              </CardHeader>
              
              {!selectedTask ? (
                <CardContent className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                  <div className="bg-muted h-12 w-12 rounded-full flex items-center justify-center mb-3">
                    <AlignLeft className="h-6 w-6 text-muted-foreground/70" />
                  </div>
                  <p className="text-sm">Select a task from the schedule to view and edit its properties, dependencies, and resources.</p>
                </CardContent>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <Tabs defaultValue="parameters" className="w-full">
                    <TabsList className="w-full rounded-none border-b bg-transparent p-0 h-10">
                      <TabsTrigger value="parameters" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Parameters</TabsTrigger>
                      <TabsTrigger value="scheduling" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Schedule</TabsTrigger>
                      <TabsTrigger value="resources" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">Resources</TabsTrigger>
                    </TabsList>
                    
                    <div className="p-4 space-y-4">
                      <TabsContent value="parameters" className="space-y-4 mt-0">
                        <div className="space-y-2">
                          <Label htmlFor="task-name" className="text-xs">Task Name</Label>
                          <Input 
                            id="task-name" 
                            value={selectedTask.name || ''} 
                            onChange={(e) => setSelectedTask({...selectedTask, name: e.target.value})}
                            className="h-8 text-sm"
                          />
                        </div>
                        
                        {selectedTask.bom_scope && (
                          <div className="bg-muted/50 p-3 rounded-md border text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <DollarSign className="h-4 w-4 text-primary" />
                              <span className="font-semibold">Linked Scope</span>
                            </div>
                            <p className="text-muted-foreground text-xs">{selectedTask.bom_scope.name}</p>
                            <div className="mt-2 flex justify-between text-xs">
                              <span>Budget Allocation:</span>
                              <span className="font-medium text-foreground">AED {(selectedTask.bom_scope.total_labor_cost + selectedTask.bom_scope.total_material_cost).toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs">Status</Label>
                            <Select value={selectedTask.status || 'pending'} onValueChange={(v) => setSelectedTask({...selectedTask, status: v})}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="delayed">Delayed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Priority</Label>
                            <Select value={selectedTask.priority || 'medium'} onValueChange={(v) => setSelectedTask({...selectedTask, priority: v})}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label className="text-xs">Progress ({selectedTask.progress || 0}%)</Label>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={selectedTask.progress || 0}
                            onChange={(e) => setSelectedTask({...selectedTask, progress: parseInt(e.target.value)})}
                            className="w-full accent-primary"
                          />
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="scheduling" className="space-y-4 mt-0">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs">Start Date</Label>
                            <Input 
                              type="date"
                              value={selectedTask.start_date || ''} 
                              onChange={(e) => setSelectedTask({...selectedTask, start_date: e.target.value})}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">End Date</Label>
                            <Input 
                              type="date"
                              value={selectedTask.end_date || ''} 
                              onChange={(e) => setSelectedTask({...selectedTask, end_date: e.target.value})}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-xs">Duration (Days)</Label>
                          <div className="flex items-center gap-2">
                            <Input 
                              type="number"
                              value={selectedTask.duration_days || ''} 
                              onChange={(e) => setSelectedTask({...selectedTask, duration_days: parseInt(e.target.value)})}
                              className="h-8 text-sm"
                            />
                            <div className="flex items-center space-x-2">
                              <Switch id="auto-schedule" defaultChecked />
                              <Label htmlFor="auto-schedule" className="text-[10px]">Auto-calc</Label>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2 pt-2 border-t">
                          <Label className="text-xs flex items-center">
                            <Clock className="h-3 w-3 mr-1" /> Dependencies
                          </Label>
                          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md text-center">
                            Select predecessor tasks to build critical path logic.
                            <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-xs">Manage Links</Button>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="resources" className="space-y-4 mt-0">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs flex items-center">
                              <Users className="h-3 w-3 mr-1" /> Assigned Teams
                            </Label>
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2">Add</Button>
                          </div>
                          <div className="text-xs text-muted-foreground border border-dashed rounded-md p-4 text-center">
                            No resources explicitly assigned to this specific task timeframe.
                          </div>
                          
                          <div className="space-y-2 pt-4 border-t">
                            <Label className="text-xs">Notes / Constraints</Label>
                            <textarea 
                              className="w-full min-h-[100px] p-2 text-sm border rounded-md bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
                              placeholder="Enter schedule constraints, weather risks, or execution notes..."
                              value={selectedTask.notes || ''}
                              onChange={(e) => setSelectedTask({...selectedTask, notes: e.target.value})}
                            ></textarea>
                          </div>
                        </div>
                      </TabsContent>
                    </div>
                  </Tabs>
                </div>
              )}
              
              {selectedTask && (
                <div className="p-4 border-t bg-muted/10 shrink-0 flex gap-2">
                  <Button 
                    className="flex-1 h-9 text-xs" 
                    onClick={handleUpdateTask} 
                    disabled={saving}
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Save className="h-3 w-3 mr-1.5" />
                    )}
                    Save Task
                  </Button>
                  <Button variant="outline" className="h-9 w-9 p-0 shrink-0 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}