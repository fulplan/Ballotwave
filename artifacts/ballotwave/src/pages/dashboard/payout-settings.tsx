import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Percent, Calendar, Clock, Building2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PayoutConfig {
  platformCutFree: number;
  platformCutBasic: number;
  platformCutPro: number;
  platformCutEnterprise: number;
  ussdFeePassthrough: boolean;
  invoiceDay: number;
  paymentGraceDays: number;
  schoolOverrides: Record<string, number>;
}

interface School {
  id: string;
  name: string;
  plan: string;
}

export default function PayoutSettingsPage() {
  const [config, setConfig] = useState<PayoutConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [newOverrideSchoolId, setNewOverrideSchoolId] = useState("");
  const [newOverrideCut, setNewOverrideCut] = useState(10);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/api/settings/payouts`).then(r => r.json()),
      fetch(`${BASE}/api/schools`).then(r => r.json()),
    ])
      .then(([payoutData, schoolData]) => {
        setConfig(payoutData);
        setSchools(Array.isArray(schoolData) ? schoolData : schoolData.schools || []);
      })
      .catch(() => toast.error("Failed to load payout settings"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/settings/payouts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Payout settings saved");
    } catch {
      toast.error("Failed to save payout settings");
    }
    setSaving(false);
  };

  const addOverride = () => {
    if (!config || !newOverrideSchoolId) return;
    setConfig({
      ...config,
      schoolOverrides: { ...config.schoolOverrides, [newOverrideSchoolId]: newOverrideCut },
    });
    setNewOverrideSchoolId("");
    setNewOverrideCut(10);
  };

  const removeOverride = (schoolId: string) => {
    if (!config) return;
    const updated = { ...config.schoolOverrides };
    delete updated[schoolId];
    setConfig({ ...config, schoolOverrides: updated });
  };

  if (loading || !config) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const tiers = [
    { key: "platformCutFree" as const, label: "Free Plan", color: "bg-gray-100 text-gray-700" },
    { key: "platformCutBasic" as const, label: "Basic Plan", color: "bg-blue-100 text-blue-700" },
    { key: "platformCutPro" as const, label: "Pro Plan", color: "bg-violet-100 text-violet-700" },
    { key: "platformCutEnterprise" as const, label: "Enterprise Plan", color: "bg-amber-100 text-amber-700" },
  ];

  const overrideSchoolIds = Object.keys(config.schoolOverrides);
  const availableSchoolsForOverride = schools.filter(s => !overrideSchoolIds.includes(s.id));

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Payout Settings</h1>
            <p className="text-muted-foreground mt-1">Configure platform revenue share and invoicing rules.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl h-11 px-6">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>

        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Percent className="w-5 h-5" /> Platform Cut by Plan Tier</CardTitle>
            <CardDescription>Set the percentage BallotWave takes from each subscription payment per plan.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {tiers.map(tier => (
                <div key={tier.key} className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${tier.color}`}>{tier.label}</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={config[tier.key]}
                      onChange={e => setConfig({ ...config, [tier.key]: parseFloat(e.target.value) || 0 })}
                      className="rounded-xl w-20 text-center"
                    />
                    <span className="text-sm text-muted-foreground font-medium">%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Building2 className="w-5 h-5" /> Per-School Overrides</CardTitle>
            <CardDescription>Override the default platform cut for specific schools. These take priority over plan-level defaults.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {overrideSchoolIds.length > 0 && (
              <div className="space-y-2">
                {overrideSchoolIds.map(schoolId => {
                  const school = schools.find(s => s.id === schoolId);
                  return (
                    <div key={schoolId} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                      <div>
                        <p className="text-sm font-medium">{school?.name || schoolId}</p>
                        {school && <span className="text-[10px] text-muted-foreground capitalize">{school.plan} plan</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={config.schoolOverrides[schoolId]}
                            onChange={e => setConfig({
                              ...config,
                              schoolOverrides: { ...config.schoolOverrides, [schoolId]: parseFloat(e.target.value) || 0 },
                            })}
                            className="rounded-xl w-20 text-center h-8 text-sm"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeOverride(schoolId)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {availableSchoolsForOverride.length > 0 && (
              <div className="flex items-end gap-3 p-3 rounded-xl bg-muted/10 border border-dashed border-border/50">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">School</Label>
                  <Select value={newOverrideSchoolId} onValueChange={setNewOverrideSchoolId}>
                    <SelectTrigger className="rounded-xl h-9">
                      <SelectValue placeholder="Select a school..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSchoolsForOverride.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.plan})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cut %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={newOverrideCut}
                    onChange={e => setNewOverrideCut(parseFloat(e.target.value) || 0)}
                    className="rounded-xl w-20 text-center h-9"
                  />
                </div>
                <Button size="sm" className="rounded-xl h-9" onClick={addOverride} disabled={!newOverrideSchoolId}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
            )}
            {overrideSchoolIds.length === 0 && availableSchoolsForOverride.length === 0 && (
              <p className="text-center py-4 text-muted-foreground text-sm">No schools available.</p>
            )}
            {overrideSchoolIds.length === 0 && availableSchoolsForOverride.length > 0 && (
              <p className="text-center py-2 text-muted-foreground text-xs">No per-school overrides configured. Add one above.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5" /> Invoice Generation</CardTitle>
              <CardDescription>Invoices are auto-generated on this day each month.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Invoice Generation Day (1-28)</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={config.invoiceDay}
                  onChange={e => setConfig({ ...config, invoiceDay: parseInt(e.target.value) || 1 })}
                  className="rounded-xl w-24"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Grace Period (days)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={90}
                    value={config.paymentGraceDays}
                    onChange={e => setConfig({ ...config, paymentGraceDays: parseInt(e.target.value) || 14 })}
                    className="rounded-xl w-24"
                  />
                  <span className="text-sm text-muted-foreground">days after invoice is sent</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Clock className="w-5 h-5" /> USSD Fee Configuration</CardTitle>
              <CardDescription>How USSD gateway fees are handled.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
                <div>
                  <p className="text-sm font-medium">USSD Fee Pass-through</p>
                  <p className="text-xs text-muted-foreground">When enabled, USSD gateway fees (GHS 0.05/session) are charged to schools on their invoice.</p>
                </div>
                <Switch
                  checked={config.ussdFeePassthrough}
                  onCheckedChange={v => setConfig({ ...config, ussdFeePassthrough: v })}
                />
              </div>
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300">Current USSD gateway rate: <strong>GHS 0.05</strong> per session. This is the Arkesel platform cost charged to BallotWave.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
