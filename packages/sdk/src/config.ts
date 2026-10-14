export type CaptureMode = 'always' | 'on_error' | 'never';

export interface AgentTraceConfig {
  apiUrl?: string;
  apiKey?: string;
  otlpEndpoint?: string;
  capture: CaptureMode;
  environment?: string;
  /** Scrub common PII patterns from captures before persistence */
  redact: boolean;
}

const defaultConfig: AgentTraceConfig = {
  capture: 'always',
  redact: true,
};

let config: AgentTraceConfig = { ...defaultConfig };

export function configure(partial: Partial<AgentTraceConfig>): void {
  config = { ...config, ...partial };
}

export function getConfig(): AgentTraceConfig {
  return config;
}

export function resetConfig(): void {
  config = { ...defaultConfig };
}
