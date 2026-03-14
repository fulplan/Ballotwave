import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Tag, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PromoCode {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  planTarget: string | null;
  maxUses: number | null;
  usesCount: number;
  expiresAt: string | null;
  isActive: boolean;
  totalDiscountGiven: number;
  createdAt: string;
}

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    code: "",
    discountType: "percent" as "percent" | "flat",
    discountValue: 10,
    planTarget: "",
    maxUses: "",
    expiresAt: "",
  });

  const fetchCodes = async () => {
    try {
      const res = await fetch(`${BASE}/api/promos`);
      if (res.ok) setCodes(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchCodes(); }, []);

  const handleCreate = async () => {
    if (!form.code.trim()) { toast.error("Code is required"); return; }
    setCreating(true);
    try {
      const res = await fetch(`${BASE}/api/promos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim(),
          discountType: form.discountType,
          discountValue: form.discountValue,
          planTarget: form.planTarget || null,
          maxUses: form.maxUses ? parseInt(form.maxUses) : null,
          expiresAt: form.expiresAt || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed");
      toast.success("Promo code created!");
      setDialogOpen(false);
      setForm({ code: "", discountType: "percent", discountValue: 10, planTarget: "", maxUses: "", expiresAt: "" });
      fetchCodes();
    } catch (err: any) {
      toast.error(err.message || "Failed to create promo code");
    }
    setCreating(false);
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`${BASE}/api/promos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) fetchCodes();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this promo code?")) return;
    try {
      await fetch(`${BASE}/api/promos/${id}`, { method: "DELETE" });
      fetchCodes();
    } catch {}
  };

  const isExpired = (d: string | null) => d && new Date(d) < new Date();

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Promo Codes</h1>
            <p className="text-muted-foreground mt-1">Create and manage discount codes for school subscriptions.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl h-11"><Plus className="w-4 h-4 mr-2" /> Create Code</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader><DialogTitle>Create Promo Code</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className="rounded-xl" placeholder="e.g. LAUNCH2026" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Discount Type</Label>
                    <Select value={form.discountType} onValueChange={v => setForm({ ...form, discountType: v as any })}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percentage (%)</SelectItem>
                        <SelectItem value="flat">Flat Amount (GHS)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Value</Label>
                    <Input type="number" min={0} value={form.discountValue} onChange={e => setForm({ ...form, discountValue: parseFloat(e.target.value) || 0 })} className="rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Target Plan (optional)</Label>
                    <Select value={form.planTarget || "any"} onValueChange={v => setForm({ ...form, planTarget: v === "any" ? "" : v })}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any Plan</SelectItem>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Uses (optional)</Label>
                    <Input type="number" min={1} value={form.maxUses} onChange={e => setForm({ ...form, maxUses: e.target.value })} className="rounded-xl" placeholder="Unlimited" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Expiry Date (optional)</Label>
                  <Input type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} className="rounded-xl" />
                </div>
                <Button onClick={handleCreate} disabled={creating} className="w-full h-11 rounded-xl">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Tag className="w-4 h-4 mr-2" />}
                  Create Code
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">All Promo Codes</CardTitle>
            <CardDescription>Manage active and expired promotional discount codes.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : codes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No promo codes created yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-left">
                      <th className="py-3 px-3 font-semibold text-muted-foreground">Code</th>
                      <th className="py-3 px-3 font-semibold text-muted-foreground">Discount</th>
                      <th className="py-3 px-3 font-semibold text-muted-foreground">Plan</th>
                      <th className="py-3 px-3 font-semibold text-muted-foreground">Usage</th>
                      <th className="py-3 px-3 font-semibold text-muted-foreground">Total Discount</th>
                      <th className="py-3 px-3 font-semibold text-muted-foreground">Status</th>
                      <th className="py-3 px-3 font-semibold text-muted-foreground">Expires</th>
                      <th className="py-3 px-3 font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map(code => (
                      <tr key={code.id} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="py-3 px-3 font-mono font-bold text-foreground">{code.code}</td>
                        <td className="py-3 px-3">
                          {code.discountType === "percent" ? `${code.discountValue}%` : `GHS ${code.discountValue}`}
                        </td>
                        <td className="py-3 px-3">
                          <span className="capitalize text-muted-foreground">{code.planTarget || "Any"}</span>
                        </td>
                        <td className="py-3 px-3">
                          {code.usesCount}{code.maxUses ? ` / ${code.maxUses}` : ""}
                        </td>
                        <td className="py-3 px-3">GHS {code.totalDiscountGiven.toFixed(2)}</td>
                        <td className="py-3 px-3">
                          {isExpired(code.expiresAt) ? (
                            <Badge variant="secondary" className="text-[10px] rounded-full bg-red-100 text-red-700">Expired</Badge>
                          ) : code.isActive ? (
                            <Badge variant="secondary" className="text-[10px] rounded-full bg-emerald-100 text-emerald-700">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] rounded-full bg-gray-100 text-gray-700">Inactive</Badge>
                          )}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground text-xs">
                          {code.expiresAt ? new Date(code.expiresAt).toLocaleDateString("en-GB") : "Never"}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleToggle(code.id, code.isActive)}>
                              {code.isActive ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleDelete(code.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
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
      </div>
    </DashboardLayout>
  );
}
