import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Building, Pencil, Trash2 } from "lucide-react";
import { SkeletonCard } from "@/components/skeleton-cards";
import { EmptyState } from "@/components/empty-state";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const deptSchema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
});

async function fetchDepartments(schoolId: string) {
  const res = await fetch(`${BASE}/api/departments?schoolId=${schoolId}`);
  if (!res.ok) throw new Error("Failed to fetch departments");
  return res.json();
}

async function createDepartment(data: any) {
  const res = await fetch(`${BASE}/api/departments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create department");
  return res.json();
}

async function updateDepartment(id: string, data: any) {
  const res = await fetch(`${BASE}/api/departments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update department");
  return res.json();
}

async function deleteDepartment(id: string) {
  const res = await fetch(`${BASE}/api/departments/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete department");
  return res.json();
}

export default function DepartmentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: departments, isLoading } = useQuery({
    queryKey: ["departments", user?.schoolId],
    queryFn: () => fetchDepartments(user!.schoolId!),
    enabled: !!user?.schoolId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => createDepartment({ ...data, schoolId: user!.schoolId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setIsCreateOpen(false);
      form.reset();
      toast.success("Department created");
    },
    onError: () => toast.error("Failed to create department"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateDepartment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setEditingDept(null);
      toast.success("Department updated");
    },
    onError: () => toast.error("Failed to update department"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setDeletingId(null);
      toast.success("Department deleted");
    },
    onError: () => toast.error("Failed to delete department"),
  });

  const form = useForm<z.infer<typeof deptSchema>>({
    resolver: zodResolver(deptSchema),
    defaultValues: { name: "", description: "" },
  });

  const editForm = useForm<z.infer<typeof deptSchema>>({
    resolver: zodResolver(deptSchema),
  });

  const onSubmit = (data: z.infer<typeof deptSchema>) => createMutation.mutate(data);
  const onEditSubmit = (data: z.infer<typeof deptSchema>) => {
    if (!editingDept) return;
    updateMutation.mutate({ id: editingDept.id, data });
  };

  const openEdit = (dept: any) => {
    setEditingDept(dept);
    editForm.reset({ name: dept.name, description: dept.description || "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Departments</h1>
          <p className="text-muted-foreground mt-1">Manage your institution's departments and faculties.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-md shadow-primary/20 rounded-xl px-6 h-11">
              <Plus className="w-5 h-5 mr-2" /> Add Department
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl">New Department</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Department Name</Label>
                <Input {...form.register("name")} className="rounded-xl" placeholder="e.g. Computer Science" />
                {form.formState.errors.name && <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea {...form.register("description")} className="rounded-xl" placeholder="Brief description..." rows={2} />
              </div>
              <Button type="submit" className="w-full rounded-xl h-11" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Department
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : !departments?.length ? (
        <EmptyState
          icon={Building}
          title="No Departments Yet"
          description="Add your first department to organize voters by their course of study."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept: any) => (
            <Card key={dept.id} className="p-5 rounded-2xl border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Building className="w-5 h-5" />
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(dept)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setDeletingId(dept.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <h3 className="font-bold text-lg text-foreground">{dept.name}</h3>
              {dept.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{dept.description}</p>}
              <div className="mt-3 flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dept.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                  {dept.isActive ? "Active" : "Archived"}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingDept} onOpenChange={(o) => !o && setEditingDept(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input {...editForm.register("name")} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea {...editForm.register("description")} className="rounded-xl" rows={2} />
            </div>
            <Button type="submit" className="w-full rounded-xl h-11" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. Users in this department will be unaffected but will no longer be linked to it.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-red-600 hover:bg-red-700" onClick={() => deletingId && deleteMutation.mutate(deletingId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
