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
  const existingMap = new Map(existingRows.map((r) => [r.key, r]));
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
  const rowMap = new Map(rows.map((r) => [r.key, r]));

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
  } catch (err) {
    console.error("Failed to update settings:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to update settings" });
  }
});

router.get("/payouts", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden", message: "Super admin access required" });
    return;
  }
  try {
    const rows = await db.select().from(platformSettingsTable);
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const payoutConfig = {
      platformCutFree: parseFloat(map.get("payout_cut_free") || "10"),
      platformCutBasic: parseFloat(map.get("payout_cut_basic") || "10"),
      platformCutPro: parseFloat(map.get("payout_cut_pro") || "8"),
      platformCutEnterprise: parseFloat(map.get("payout_cut_enterprise") || "5"),
      ussdFeePassthrough: map.get("payout_ussd_passthrough") === "true",
      invoiceDay: parseInt(map.get("invoice_generation_day") || "1"),
      paymentGraceDays: parseInt(map.get("payment_grace_days") || "14"),
      schoolOverrides: JSON.parse(map.get("payout_school_overrides") || "{}"),
    };
    res.json(payoutConfig);
  } catch (err) {
    console.error("Failed to load payout settings:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to load payout settings" });
  }
});

router.patch("/payouts", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden", message: "Super admin access required" });
    return;
  }
  try {
    const body = req.body;
    const now = new Date();
    const updates: [string, string][] = [];

    if (body.platformCutFree !== undefined) updates.push(["payout_cut_free", String(body.platformCutFree)]);
    if (body.platformCutBasic !== undefined) updates.push(["payout_cut_basic", String(body.platformCutBasic)]);
    if (body.platformCutPro !== undefined) updates.push(["payout_cut_pro", String(body.platformCutPro)]);
    if (body.platformCutEnterprise !== undefined) updates.push(["payout_cut_enterprise", String(body.platformCutEnterprise)]);
    if (body.ussdFeePassthrough !== undefined) updates.push(["payout_ussd_passthrough", String(body.ussdFeePassthrough)]);
    if (body.invoiceDay !== undefined) updates.push(["invoice_generation_day", String(body.invoiceDay)]);
    if (body.paymentGraceDays !== undefined) updates.push(["payment_grace_days", String(body.paymentGraceDays)]);
    if (body.schoolOverrides !== undefined) updates.push(["payout_school_overrides", JSON.stringify(body.schoolOverrides)]);

    for (const [key, value] of updates) {
      await db.insert(platformSettingsTable)
        .values({ key, value, updatedAt: now })
        .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value, updatedAt: now } });
    }

    res.json({ success: true, updated: updates.length });
  } catch (err) {
    console.error("Failed to update payout settings:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to update payout settings" });
  }
});

export default router;
