import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { personnelService } from "@/services/personnelService";
import { projectService } from "@/services/projectService";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Personnel = Database["public"]["Tables"]["site_personnel"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];

export default function Personnel() {
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    project_id: "",
    contact_number: "",
    email: "",
    daily_rate: "",
    status: "active" as const
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [personnelData, projectsData] = await Promise.all([
      personnelService.getAll(),
      projectService.getAll()
    ]);
    setPersonnel(personnelData.data || []);
    setProjects(projectsData.data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const personnelData = {
      ...formData,
      daily_rate: parseFloat(formData.daily_rate)
    };

    if (editingPersonnel) {
      await personnelService.update(editingPersonnel.id, personnelData);
    } else {
      await personnelService.create(personnelData);
    }

    setDialogOpen(false);
    resetForm();
    loadData();
  };

  const handleEdit = (person: Personnel) => {
    setEditingPersonnel(person);
    setFormData({
      name: person.name,
      role: person.role,
      project_id: person.project_id || "",
      contact_number: person.contact_number || "",
      email: person.email || "",
      daily_rate: person.daily_rate?.toString() || "",
      status: person.status
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this personnel?")) {
      await personnelService.delete(id);
      loadData();
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      role: "",
      project_id: "",
      contact_number: "",
      email: "",
      daily_rate: "",
      status: "active"
    });
    setEditingPersonnel(null);
  };

  const statusColors = {
    active: "bg-green-100 text-green-800",
    on_leave: "bg-yellow-100 text-yellow-800",
    inactive: "bg-gray-100 text-gray-800"
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-heading font-bold">Site Personnel</h1>
            <p className="text-muted-foreground mt-1">Manage construction workers and staff</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Personnel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingPersonnel ? "Edit Personnel" : "Add New Personnel"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Input
                      id="role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      placeholder="e.g., Site Engineer, Foreman"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project_id">Assigned Project</Label>
                    <Select value={formData.project_id} onValueChange={(value) => setFormData({ ...formData, project_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="on_leave">On Leave</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_number">Contact Number</Label>
                    <Input
                      id="contact_number"
                      value={formData.contact_number}
                      onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="daily_rate">Daily Rate ($)</Label>
                    <Input
                      id="daily_rate"
                      type="number"
                      step="0.01"
                      value={formData.daily_rate}
                      onChange={(e) => setFormData({ ...formData, daily_rate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingPersonnel ? "Update" : "Add"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Personnel</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Daily Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {personnel.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">{person.name}</TableCell>
                    <TableCell>{person.role}</TableCell>
                    <TableCell>{person.projects?.name || "Unassigned"}</TableCell>
                    <TableCell>{person.contact_number || "-"}</TableCell>
                    <TableCell>${person.daily_rate?.toLocaleString() || 0}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[person.status]}>
                        {person.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(person)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(person.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}