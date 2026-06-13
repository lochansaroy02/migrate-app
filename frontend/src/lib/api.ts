export type DatabaseType = "postgres" | "mysql" | "sqlite";
export type ConnectionMethod = "url" | "credentials";

export type ConnectionCredentials = {
  database_type: DatabaseType;
  connection_method: ConnectionMethod;
  database_url?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  file_path?: string;
};

export type TableInfo = {
  name: string;
  rows: number;
  schema_name?: string | null;
};

export type MigrationSettings = {
  include_schema: boolean;
  include_data: boolean;
  batch_size: number;
  truncate_destination: boolean;
  continue_on_error: boolean;
  max_retries: number;
};

export type MigrationStatus = {
  id: string;
  status: "pending" | "planning" | "running" | "paused" | "completed" | "failed" | "cancelled";
  progress: number;
  current_table: string | null;
  processed_rows: number;
  total_rows: number;
  speed: number;
  estimated_time_remaining: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
};

export type MigrationLog = {
  id: string;
  timestamp: string;
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  table_name: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload?.detail && Array.isArray(payload.detail)
        ? payload.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(", ")
        : payload?.detail;
    throw new Error(detail || payload?.error || `Request failed (${response.status})`);
  }
  return payload as T;
}

export const api = {
  testConnection: (credentials: ConnectionCredentials) =>
    request<{ success: boolean; message: string; latency_ms: number | null }>(
      "/api/connections/test",
      { method: "POST", body: JSON.stringify(credentials) },
    ),

  discoverTables: (credentials: ConnectionCredentials) =>
    request<{ tables: TableInfo[]; database_type: string }>("/api/schema/tables", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),

  createMigration: (payload: {
    source: ConnectionCredentials;
    destination: ConnectionCredentials;
    tables: string[];
    settings: MigrationSettings;
  }) =>
    request<{ migration_id: string }>("/api/migration/create", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  startMigration: (migrationId: string) =>
    request<{ migration_id: string; task_id: string }>(`/api/migration/start/${migrationId}`, {
      method: "POST",
    }),

  getMigration: (migrationId: string) =>
    request<MigrationStatus>(`/api/migration/${migrationId}`),

  getLogs: (migrationId: string) =>
    request<{ migration_id: string; logs: MigrationLog[]; total: number }>(
      `/api/migration/${migrationId}/logs?limit=500`,
    ),

  cancelMigration: (migrationId: string) =>
    request<{ migration_id: string; status: string }>(`/api/migration/${migrationId}/cancel`, {
      method: "POST",
    }),
};
