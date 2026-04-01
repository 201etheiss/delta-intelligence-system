/**
 * Plugin Registry — Core Types
 *
 * Defines the type system for the plugin infrastructure including
 * capability categories, configuration, call logging, and routing results.
 */

/** Plugin capability categories — what a plugin can do */
export type PluginCapability =
  | 'image_gen' | 'video_gen' | 'design_automation' | 'copywriting'
  | 'social_management' | 'seo_content' | 'brand_assets'
  | 'legal_ai' | 'contract_analysis' | 'e_signature' | 'compliance' | 'document_ocr'
  | 'speech_to_text' | 'text_to_speech' | 'meeting_intelligence' | 'call_analytics'
  | 'sales_intelligence' | 'proposal_gen' | 'revenue_intelligence' | 'email_outreach'
  | 'expense_management' | 'invoice_processing' | 'tax_compliance' | 'banking' | 'fpa'
  | 'route_optimization' | 'weather_commodity' | 'iot_telematics' | 'inventory_fuel' | 'mapping'
  | 'recruiting' | 'learning_training' | 'employee_engagement' | 'background_checks' | 'benefits'
  | 'identity_sso' | 'monitoring' | 'security_scanning' | 'knowledge_base'
  | 'bi_visualization' | 'data_enrichment' | 'etl_pipeline' | 'vector_search'
  | 'llm_chat' | 'llm_code' | 'llm_reasoning' | 'llm_vision' | 'llm_embedding';

/** Top-level plugin category for grouping */
export type PluginCategory =
  | 'marketing' | 'legal' | 'audio' | 'sales' | 'finance'
  | 'operations' | 'hr' | 'it_security' | 'data_analytics' | 'base_models';

/** Plugin lifecycle status */
export type PluginStatus = 'active' | 'configured' | 'available' | 'deprecated';

/** Supported authentication mechanisms */
export type AuthType = 'api_key' | 'oauth2' | 'bearer' | 'basic' | 'none' | 'session';

/**
 * Full plugin configuration — stored in data/plugins.json.
 * Immutable by convention: all updates produce new objects via spread.
 */
export interface PluginConfig {
  /** Unique plugin identifier (kebab-case, e.g. "openai-dalle") */
  readonly id: string;
  /** Human-readable display name */
  readonly name: string;
  /** Vendor or service provider */
  readonly provider: string;
  /** Short description of what this plugin does */
  readonly description: string;
  /** Top-level category */
  readonly category: PluginCategory;
  /** Capabilities this plugin provides */
  readonly capabilities: readonly PluginCapability[];
  /** Current lifecycle status */
  readonly status: PluginStatus;

  // --- Connection ---

  /** Base URL for API requests */
  readonly baseUrl: string;
  /** Authentication mechanism */
  readonly authType: AuthType;
  /** Environment variable name holding the API key/token */
  readonly authEnvVar: string;
  /** Custom header name for auth (default: "Authorization") */
  readonly authHeader?: string;

  // --- Routing weights (0-1, continuously updated) ---

  /** Quality score from user feedback and outcome tracking (0-1) */
  readonly qualityScore: number;
  /** Estimated USD cost per API call */
  readonly costPerCall: number;
  /** p95 latency in milliseconds */
  readonly latencyP95Ms: number;
  /** Uptime / reliability ratio (0-1) */
  readonly reliabilityScore: number;

  // --- Limits ---

  /** Maximum requests per minute */
  readonly rateLimitPerMinute: number;
  /** Maximum requests per day */
  readonly rateLimitPerDay: number;
  /** Maximum request body size in bytes */
  readonly maxRequestSizeBytes?: number;

  // --- Metadata ---

  /** Link to provider documentation */
  readonly docsUrl: string;
  /** Link to provider pricing page */
  readonly pricingUrl?: string;
  /** Searchable tags */
  readonly tags: readonly string[];
  /** Roles/teams allowed to use this plugin */
  readonly teamAccess: readonly string[];
  /** ISO 8601 creation timestamp */
  readonly createdAt: string;
  /** ISO 8601 last-update timestamp */
  readonly updatedAt: string;

  // --- Usage tracking ---

  /** Lifetime total API calls */
  readonly totalCalls: number;
  /** Lifetime total estimated cost (USD) */
  readonly totalCost: number;
  /** Average user rating (1-5) */
  readonly avgRating: number;
  /** Number of ratings received */
  readonly ratingCount: number;
}

/**
 * Single plugin call log entry — stored in data/plugin-call-log.json.
 * Append-only, capped at 500 entries (oldest trimmed first).
 */
export interface PluginCallLog {
  /** Unique log entry ID */
  readonly id: string;
  /** Plugin that was called */
  readonly pluginId: string;
  /** Capability that was invoked */
  readonly capability: PluginCapability;
  /** Email of the user who made the call */
  readonly userEmail: string;
  /** Optional workspace context */
  readonly workspaceId?: string;
  /** Brief summary of the request */
  readonly requestSummary: string;
  /** Outcome of the call */
  readonly responseStatus: 'success' | 'error' | 'timeout' | 'rate_limited';
  /** Actual latency in milliseconds */
  readonly latencyMs: number;
  /** Estimated cost of this call (USD) */
  readonly estimatedCost: number;
  /** Optional user rating (1-5) */
  readonly userRating?: number;
  /** ISO 8601 timestamp */
  readonly timestamp: string;
}

/**
 * Result of the plugin routing engine — includes the selected plugin,
 * its composite score, reasoning, and ranked alternatives.
 */
export interface PluginRouteResult {
  /** Selected plugin */
  readonly plugin: PluginConfig;
  /** Composite routing score (0-1) */
  readonly score: number;
  /** Human-readable reason for selection */
  readonly reason: string;
  /** Ranked alternative plugins */
  readonly alternatives: ReadonlyArray<{ readonly plugin: PluginConfig; readonly score: number }>;
}
