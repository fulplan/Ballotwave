import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Phone, Save, Loader2, Smartphone, Globe } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface UssdConfig {
  ussdShortCode: string;
  ussdSchoolCode: string;
  ussdLanguage: string;
  ussdEnabled: boolean;
  ussdAvailable: boolean;
  dialString: string | null;
}

export default function UssdConfigPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<UssdConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shortCode, setShortCode] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [language, setLanguage] = useState("en");
  const [enabled, setEnabled] = useState(false);

  const schoolId = (user as Record<string, unknown> | null)?.schoolId as string | undefined;

  useEffect(() => {
    if (schoolId) fetchConfig();
  }, [schoolId]);

  async function fetchConfig() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE}/api/schools/${schoolId}/ussd-config`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load");
      const data: UssdConfig = await res.json();
      setConfig(data);
      setShortCode(data.ussdShortCode);
      setSchoolCode(data.ussdSchoolCode);
      setLanguage(data.ussdLanguage);
      setEnabled(data.ussdEnabled);
    } catch {
      toast.error("Failed to load USSD configuration");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!schoolId) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE}/api/schools/${schoolId}/ussd-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          ussdShortCode: shortCode,
          ussdSchoolCode: schoolCode,
          ussdLanguage: language,
          ussdEnabled: enabled,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data: UssdConfig = await res.json();
      setConfig(data);
      toast.success("USSD configuration saved");
    } catch {
      toast.error("Failed to save USSD configuration");
    } finally {
      setSaving(false);
    }
  }

  const dialPreview = shortCode && schoolCode ? `*${shortCode}*${schoolCode}#` : null;

  if (!schoolId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">USSD Configuration</h1>
          <p className="text-muted-foreground mt-1">USSD settings are only available for school administrators.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (config && !config.ussdAvailable) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">USSD Voting Setup</h1>
          <p className="text-muted-foreground mt-1">
            Configure USSD voting for students without smartphones
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">USSD Voting requires Pro or Enterprise plan</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Upgrade your school's subscription plan to Pro or Enterprise to enable USSD voting,
                allowing students to vote from any mobile phone without internet access.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">USSD Voting Setup</h1>
        <p className="text-muted-foreground mt-1">
          Configure USSD voting for students without smartphones
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Phone className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                USSD Channel
                <Badge variant={enabled ? "default" : "secondary"}>
                  {enabled ? "Active" : "Inactive"}
                </Badge>
              </CardTitle>
              <CardDescription>
                Allow voters to cast ballots by dialing a short code on any phone
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div>
              <Label className="text-sm font-medium">Enable USSD Voting</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Students can vote via any mobile phone using USSD
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Short Code</Label>
              <Input
                placeholder="e.g. 713"
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The USSD short code registered with Arkesel
              </p>
            </div>
            <div className="space-y-2">
              <Label>School Code</Label>
              <Input
                placeholder="e.g. ACCRASHS"
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier for your school
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Alternate Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="tw">Twi</SelectItem>
                <SelectItem value="ha">Hausa</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Language used for USSD menus (voters can choose at start)
            </p>
          </div>

          {dialPreview && (
            <div className="p-4 rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50 text-center">
              <p className="text-sm text-muted-foreground mb-1">Students will dial:</p>
              <p className="text-3xl font-mono font-bold text-emerald-700">{dialPreview}</p>
              <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> Works on any phone</span>
                <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> No internet needed</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              USSD votes are billed at GHS 0.05 per session
            </p>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
