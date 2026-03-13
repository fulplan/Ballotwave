import { useState } from "react";
import { useListSchools, useCreateSchool } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Building, MoreVertical } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListSchoolsQueryKey } from "@workspace/api-client-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const createSchoolSchema = z.object({
  name: z.string().min(2, "Name required"),
  email: z.string().email(),
  country: z.string().min(2),
  plan: z.enum(["free", "basic", "pro", "enterprise"])
});

export default function SchoolsPage() {
  const { data: schools, isLoading } = useListSchools();
  const createMutation = useCreateSchool();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof createSchoolSchema>>({
    resolver: zodResolver(createSchoolSchema),
    defaultValues: { name: "", email: "", country: "", plan: "basic" }
  });

  const onSubmit = async (data: z.infer<typeof createSchoolSchema>) => {
    await createMutation.mutateAsync({ data: data as any });
    queryClient.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
    setIsDialogOpen(false);
    form.reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Registered Schools</h1>
          <p className="text-muted-foreground mt-1">Manage institutions and their platform access.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-md shadow-primary/20 rounded-xl px-6 h-11">
              <Plus className="w-5 h-5 mr-2" /> Add School
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl">Register New School</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Institution Name</Label>
                <Input {...form.register("name")} className="rounded-xl" placeholder="e.g. University of Ghana" />
              </div>
              <div className="space-y-2">
                <Label>Admin Email</Label>
                <Input {...form.register("email")} type="email" className="rounded-xl" placeholder="admin@ug.edu.gh" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input {...form.register("country")} className="rounded-xl" placeholder="Ghana" />
                </div>
                <div className="space-y-2">
                  <Label>Subscription Plan</Label>
                  <Select onValueChange={(v) => form.setValue("plan", v as any)} defaultValue="basic">
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="pt-4">
                <Button type="submit" className="w-full h-11 rounded-xl" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Institution"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold text-foreground/80">Institution</TableHead>
                <TableHead className="font-semibold text-foreground/80">Country</TableHead>
                <TableHead className="font-semibold text-foreground/80">Plan</TableHead>
                <TableHead className="font-semibold text-foreground/80">Elections</TableHead>
                <TableHead className="font-semibold text-foreground/80 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Building className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    No schools registered yet.
                  </TableCell>
                </TableRow>
              )}
              {schools?.map((school) => (
                <TableRow key={school.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium text-foreground">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                        {school.name.substring(0, 2)}
                      </div>
                      <div className="flex flex-col">
                        <span>{school.name}</span>
                        <span className="text-xs text-muted-foreground font-normal">{school.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{school.country}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize bg-background">{school.plan}</Badge>
                  </TableCell>
                  <TableCell>{school.totalElections || 0}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground rounded-xl">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
