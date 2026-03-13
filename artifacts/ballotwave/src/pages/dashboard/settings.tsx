import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Save, Key, Settings2, ToggleLeft, AlertTriangle } from "lucide-react";

interface SettingItem {
  key: string;
  label: string;
  description: string;
  category: string;
  type: "secret" | "text" | "boolean";
  loadMode: "runtime" | "boot";
  value: string;
  maskedValue: string;
  hasValue: boolean;
  updatedAt: string | null;
}

interface CategoryGroup {
  category: string;
  label: string;
  settings: SettingItem[];
}

interface SettingsResponse {
  groups: CategoryGroup[];
}

const CATEGORY_ICONS: Record<string, typeof Key> = {
  api_keys: Key,
  platform_config: Settings2,
  feature_flags: ToggleLeft,
  boot_time: AlertTriangle,
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  api_keys: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-600 dark:text-green-400" },
  platform_config: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400" },
  feature_flags: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-400" },
  boot_time: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400" },
};

export default function SettingsPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string | boolean>>({});
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      const data: SettingsResponse = await res.json();
      setGroups(data.groups);
      setEditedValues({});
      setVisibleSecrets(new Set());
    } catch {
      toast({ title: "Error", description: "Failed to load settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function updateValue(key: string, value: string | boolean) {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSecretVisibility(key: string) {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function getCategoryEditedKeys(group: CategoryGroup): string[] {
    return group.settings
      .filter((s) => editedValues[s.key] !== undefined)
      .map((s) => s.key);
  }

  async function handleSaveCategory(group: CategoryGroup) {
    const editedKeys = getCategoryEditedKeys(group);
    if (editedKeys.length === 0) {
      toast({ title: "No changes", description: "No settings were modified in this section" });
      return;
    }

    setSavingCategory(group.category);
    try {
      const body: Record<string, string | boolean> = {};
      for (const key of editedKeys) {
        body[key] = editedValues[key];
      }

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Failed to save settings");
      }

      toast({ title: "Settings saved", description: `${group.label} updated successfully` });
      await fetchSettings();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSavingCategory(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage API keys, platform configuration, and feature flags
        </p>
      </div>

      {groups.map((group) => {
        const Icon = CATEGORY_ICONS[group.category] || Settings2;
        const colors = CATEGORY_COLORS[group.category] || CATEGORY_COLORS.platform_config;
        const editedKeys = getCategoryEditedKeys(group);
        const isSaving = savingCategory === group.category;

        return (
          <Card key={group.category}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                </div>
                <div>
                  <CardTitle>{group.label}</CardTitle>
                  <CardDescription>
                    {group.category === "api_keys" && "External service API keys and secrets"}
                    {group.category === "platform_config" && "General platform configuration values"}
                    {group.category === "feature_flags" && "Toggle platform features on or off"}
                    {group.category === "boot_time" && "Variables that require a server restart to take effect"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {group.category === "boot_time" && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200 text-sm">
                      Restart Required
                    </p>
                    <p className="text-amber-700 dark:text-amber-300 text-sm mt-0.5">
                      Changes to these variables take effect on the next server restart.
                    </p>
                  </div>
                </div>
              )}

              {group.settings.map((setting) => (
                <SettingField
                  key={setting.key}
                  setting={setting}
                  editedValue={editedValues[setting.key]}
                  isSecretVisible={visibleSecrets.has(setting.key)}
                  onToggleVisibility={() => toggleSecretVisibility(setting.key)}
                  onChange={(val) => updateValue(setting.key, val)}
                />
              ))}

              <div className="flex justify-end pt-2 border-t">
                <Button
                  onClick={() => handleSaveCategory(group)}
                  disabled={isSaving || editedKeys.length === 0}
                  size="sm"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : `Save ${group.label}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SettingField({
  setting,
  editedValue,
  isSecretVisible,
  onToggleVisibility,
  onChange,
}: {
  setting: SettingItem;
  editedValue: string | boolean | undefined;
  isSecretVisible: boolean;
  onToggleVisibility: () => void;
  onChange: (val: string | boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{setting.label}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
        </div>
        {setting.updatedAt && (
          <span className="text-xs text-muted-foreground/60 whitespace-nowrap ml-4">
            Updated {new Date(setting.updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {setting.type === "boolean" ? (
        <BooleanField setting={setting} editedValue={editedValue} onChange={onChange} />
      ) : setting.type === "secret" ? (
        <SecretField
          setting={setting}
          editedValue={editedValue as string | undefined}
          isVisible={isSecretVisible}
          onToggleVisibility={onToggleVisibility}
          onChange={(val) => onChange(val)}
        />
      ) : (
        <TextField
          setting={setting}
          editedValue={editedValue as string | undefined}
          onChange={(val) => onChange(val)}
        />
      )}
    </div>
  );
}

function BooleanField({
  setting,
  editedValue,
  onChange,
}: {
  setting: SettingItem;
  editedValue: string | boolean | undefined;
  onChange: (val: boolean) => void;
}) {
  const currentValue =
    editedValue !== undefined
      ? editedValue === true || editedValue === "true"
      : setting.value === "true";

  return (
    <div className="flex items-center gap-3">
      <Switch checked={currentValue} onCheckedChange={onChange} />
      <span className="text-sm text-muted-foreground">{currentValue ? "Enabled" : "Disabled"}</span>
    </div>
  );
}

function SecretField({
  setting,
  editedValue,
  isVisible,
  onToggleVisibility,
  onChange,
}: {
  setting: SettingItem;
  editedValue: string | undefined;
  isVisible: boolean;
  onToggleVisibility: () => void;
  onChange: (val: string) => void;
}) {
  const isEditing = editedValue !== undefined;

  return (
    <div className="space-y-2">
      {setting.hasValue && !isEditing && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            Current value:{" "}
            <code className="bg-muted px-2 py-0.5 rounded text-xs">{setting.maskedValue}</code>
          </span>
        </div>
      )}
      <div className="relative">
        <Input
          type={isVisible ? "text" : "password"}
          placeholder={setting.hasValue ? "Enter new value to replace..." : "Enter value..."}
          value={editedValue ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function TextField({
  setting,
  editedValue,
  onChange,
}: {
  setting: SettingItem;
  editedValue: string | undefined;
  onChange: (val: string) => void;
}) {
  const currentValue = editedValue !== undefined ? editedValue : setting.value;

  return (
    <Input
      type="text"
      placeholder={`Enter ${setting.label.toLowerCase()}...`}
      value={currentValue}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
