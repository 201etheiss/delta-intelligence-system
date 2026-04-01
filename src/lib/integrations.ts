/**
 * Integrations Hub — Central Registry
 *
 * Defines all external integrations available in Delta Intelligence.
 * Configuration is persisted to data/integrations.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ── Types ────────────────────────────────────────────────────

export type IntegrationCategory =
  | 'messaging'
  | 'automation'
  | 'calendar'
  | 'fleet'
  | 'notifications';

export type IntegrationStatus = 'configured' | 'available' | 'coming_soon';

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'url' | 'secret';
  required: boolean;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  configFields: ConfigField[];
}

export interface IntegrationConfig {
  id: string;
  values: Record<string, string>;
  updatedAt: string;
}

export interface IntegrationsFile {
  configs: IntegrationConfig[];
}

// ── Integration Registry ─────────────────────────────────────

export const INTEGRATIONS: Readonly<Integration[]> = [
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Post messages and alerts to Teams channels via incoming webhook.',
    category: 'messaging',
    status: 'available',
    configFields: [
      { key: 'channelWebhookUrl', label: 'Channel Webhook URL', type: 'url', required: true },
    ],
  },
  {
    id: 'n8n',
    name: 'n8n Workflows',
    description: 'Trigger n8n workflows via webhook to automate multi-step processes.',
    category: 'automation',
    status: 'available',
    configFields: [
      { key: 'webhookBaseUrl', label: 'Webhook Base URL', type: 'url', required: true },
    ],
  },
  {
    id: 'power_automate',
    name: 'Power Automate',
    description: 'Trigger Microsoft Power Automate flows from Delta Intelligence events.',
    category: 'automation',
    status: 'available',
    configFields: [
      { key: 'flowTriggerUrl', label: 'Flow Trigger URL', type: 'url', required: true },
    ],
  },
  {
    id: 'resend',
    name: 'Resend Email',
    description: 'Send transactional emails via the Resend API.',
    category: 'notifications',
    status: 'available',
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'secret', required: true },
    ],
  },
  {
    id: 'twilio',
    name: 'Twilio SMS',
    description: 'Send SMS notifications via Twilio.',
    category: 'notifications',
    status: 'available',
    configFields: [
      { key: 'accountSid', label: 'Account SID', type: 'text', required: true },
      { key: 'authToken', label: 'Auth Token', type: 'secret', required: true },
      { key: 'fromNumber', label: 'From Number', type: 'text', required: true },
    ],
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect to 5000+ apps via Zapier webhook triggers.',
    category: 'automation',
    status: 'available',
    configFields: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'url', required: true },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Post messages and alerts to Slack channels via incoming webhook.',
    category: 'messaging',
    status: 'available',
    configFields: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'url', required: true },
    ],
  },
  {
    id: 'samsara_webhooks',
    name: 'Samsara Events',
    description: 'Receive fleet telemetry events from Samsara via webhooks.',
    category: 'fleet',
    status: 'available',
    configFields: [
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'secret', required: true },
    ],
  },
];

// ── Persistence ──────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), 'data');
const INTEGRATIONS_PATH = join(DATA_DIR, 'integrations.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadIntegrationConfigs(): IntegrationsFile {
  if (!existsSync(INTEGRATIONS_PATH)) {
    return { configs: [] };
  }
  try {
    const raw = readFileSync(INTEGRATIONS_PATH, 'utf-8');
    return JSON.parse(raw) as IntegrationsFile;
  } catch {
    return { configs: [] };
  }
}

export function saveIntegrationConfigs(file: IntegrationsFile): void {
  ensureDataDir();
  writeFileSync(INTEGRATIONS_PATH, JSON.stringify(file, null, 2), 'utf-8');
}

export function getIntegrationConfig(id: string): IntegrationConfig | undefined {
  const file = loadIntegrationConfigs();
  return file.configs.find((c) => c.id === id);
}

export function upsertIntegrationConfig(
  id: string,
  values: Record<string, string>
): IntegrationConfig {
  const file = loadIntegrationConfigs();
  const now = new Date().toISOString();
  const idx = file.configs.findIndex((c) => c.id === id);
  const config: IntegrationConfig = { id, values, updatedAt: now };

  const updated: IntegrationsFile = {
    configs:
      idx >= 0
        ? file.configs.map((c, i) => (i === idx ? config : c))
        : [...file.configs, config],
  };

  saveIntegrationConfigs(updated);
  return config;
}

// ── Helpers ──────────────────────────────────────────────────

export function getIntegrationWithStatus(
  integration: Integration
): Integration {
  const config = getIntegrationConfig(integration.id);
  if (!config) return integration;

  const allRequiredFilled = integration.configFields
    .filter((f) => f.required)
    .every((f) => {
      const val = config.values[f.key];
      return val !== undefined && val !== '';
    });

  return {
    ...integration,
    status: allRequiredFilled ? 'configured' : 'available',
  };
}

export function getAllIntegrationsWithStatus(): Integration[] {
  return INTEGRATIONS.map(getIntegrationWithStatus);
}
