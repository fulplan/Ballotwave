import { Router } from "express";
import { db, platformSettingsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  SETTINGS_REGISTRY,
  CATEGORY_LABELS,
  getRegistryEntry,
  getRegistryKeys,
  type SettingCategory,
} from "../lib/settings-registry";

const router = Router();

function maskValue(value: string): string {
  if (!value || value.length <= 8) return value ? "********" : "";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

interface SettingResponse {
  key: string;
  label: string;
  description: string;
  category: SettingCategory;
  type: "secret" | "text" | "boolean";
  loadMode: "runtime" | "boot";
  value: string;
  maskedValue: string;
  hasValue: boolean;
  updatedAt: string | null;
}

interface CategoryGroup {
  category: SettingCategory;
  label: string;
  settings: SettingResponse[];
}

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden", message: "Super admin access required" });
    return;
  }

  const allKeys = getRegistryKeys();
  const existingRows = await db.select().from(platformSettingsTable);
  const existingMap = new Map(existingRows.map((r: any) => [r.key, r]));
  const now = new Date();

  for (const key of allKeys) {
    if (!existingMap.has(key)) {
      const entry = getRegistryEntry(key)!;
      await db
        .insert(platformSettingsTable)
        .values({ key, value: entry.default, updatedAt: now })
        .onConflictDoNothing();
    }
  }

  const rows = await db.select().from(platformSettingsTable);
  const rowMap = new Map(rows.map((r: any) => [r.key, r]));

  const categoryOrder: SettingCategory[] = ["api_keys", "platform_config", "feature_flags", "boot_time"];
  const groups: CategoryGroup[] = categoryOrder.map((cat) => {
    const entries = SETTINGS_REGISTRY.filter((s) => s.category === cat);
    const settings: SettingResponse[] = entries.map((entry) => {
      const row = rowMap.get(entry.key);
      const val = row?.value || entry.default;
      return {
        key: entry.key,
        label: entry.label,
        description: entry.description,
        category: entry.category,
        type: entry.type,
        loadMode: entry.loadMode,
        value: entry.type === "secret" ? "" : val,
        maskedValue: entry.type === "secret" ? maskValue(val) : val,
        hasValue: val.length > 0,
        updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
      };
    });
    return {
      category: cat,
      label: CATEGORY_LABELS[cat],
      settings,
    };
  });

  res.json({ groups });
});

router.patch("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden", message: "Super admin access required" });
    return;
  }

  try {
    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "Validation Error", message: "Request body must be an object" });
      return;
    }

    const allKeys = getRegistryKeys();
    const now = new Date();
    const updated: string[] = [];

    for (const [key, rawValue] of Object.entries(body)) {
      if (!allKeys.includes(key)) continue;
      const entry = getRegistryEntry(key)!;

      let value: string;
      if (entry.type === "boolean") {
        if (typeof rawValue !== "boolean" && rawValue !== "true" && rawValue !== "false") {
          res.status(400).json({
            error: "Validation Error",
            message: `${entry.label} must be a boolean value`,
          });
          return;
        }
        value = String(rawValue);
      } else {
        if (typeof rawValue !== "string") {
          res.status(400).json({
            error: "Validation Error",
            message: `${entry.label} must be a string value`,
          });
          return;
        }
        value = rawValue;
      }

      await db
        .insert(platformSettingsTable)
        .values({ key, value, updatedAt: now })
        .onConflictDoUpdate({
          target: platformSettingsTable.key,
          set: { value, updatedAt: now },
        });
      updated.push(key);
    }

    if (updated.length === 0) {
      res.status(400).json({ error: "Validation Error", message: "No valid settings keys provided" });
      return;
    }

    res.json({ success: true, updated });
  } catch {
    res.status(500).json({ error: "Internal Error", message: "Failed to update settings" });
  }
});

export default router;
