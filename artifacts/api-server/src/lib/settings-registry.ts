export type SettingType = "secret" | "text" | "boolean";
export type LoadMode = "runtime" | "boot";
export type SettingCategory = "api_keys" | "platform_config" | "feature_flags" | "boot_time";

export interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  category: SettingCategory;
  type: SettingType;
  loadMode: LoadMode;
  default: string;
}

export const SETTINGS_REGISTRY: SettingDefinition[] = [
  {
    key: "paystack_secret_key",
    label: "Paystack Secret Key",
    description: "Used for Mobile Money and card payments via Paystack",
    category: "api_keys",
    type: "secret",
    loadMode: "runtime",
    default: "",
  },
  {
    key: "arkesel_api_key",
    label: "Arkesel API Key",
    description: "Used for SMS OTP verification and USSD voting via Arkesel",
    category: "api_keys",
    type: "secret",
    loadMode: "runtime",
    default: "",
  },
  {
    key: "platform_name",
    label: "Platform Name",
    description: "The display name of the platform shown to users",
    category: "platform_config",
    type: "text",
    loadMode: "runtime",
    default: "BallotWave",
  },
  {
    key: "support_email",
    label: "Support Email",
    description: "Contact email displayed for user support inquiries",
    category: "platform_config",
    type: "text",
    loadMode: "runtime",
    default: "",
  },
  {
    key: "platform_url",
    label: "Platform URL",
    description: "The public URL of the platform",
    category: "platform_config",
    type: "text",
    loadMode: "runtime",
    default: "",
  },
  {
    key: "default_voting_fee",
    label: "Default Voting Fee",
    description: "Default fee charged per vote in GHS",
    category: "platform_config",
    type: "text",
    loadMode: "runtime",
    default: "1.00",
  },
  {
    key: "enable_ussd_voting",
    label: "Enable USSD Voting",
    description: "Allow voters to cast votes via USSD shortcode",
    category: "feature_flags",
    type: "boolean",
    loadMode: "runtime",
    default: "false",
  },
  {
    key: "enable_mobile_money",
    label: "Enable Mobile Money",
    description: "Allow Mobile Money as a payment method for voting fees",
    category: "feature_flags",
    type: "boolean",
    loadMode: "runtime",
    default: "true",
  },
  {
    key: "maintenance_mode",
    label: "Maintenance Mode",
    description: "When enabled, non-admin users see a maintenance page",
    category: "feature_flags",
    type: "boolean",
    loadMode: "runtime",
    default: "false",
  },
  {
    key: "jwt_secret",
    label: "JWT Secret",
    description: "Secret key used to sign and verify authentication tokens",
    category: "boot_time",
    type: "secret",
    loadMode: "boot",
    default: "",
  },
];

export const CATEGORY_LABELS: Record<SettingCategory, string> = {
  api_keys: "API Keys",
  platform_config: "Platform Config",
  feature_flags: "Feature Flags",
  boot_time: "Boot-time Variables",
};

export function getRegistryEntry(key: string): SettingDefinition | undefined {
  return SETTINGS_REGISTRY.find((s) => s.key === key);
}

export function getRegistryKeys(): string[] {
  return SETTINGS_REGISTRY.map((s) => s.key);
}
