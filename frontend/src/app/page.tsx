"use client";

import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  Database,
  LoaderCircle,
  Play,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Square,
  Table2,
  Terminal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ConnectionPanel } from "@/components/connection-panel";
import {
  api,
  type ConnectionCredentials,
  type MigrationLog,
  type MigrationSettings,
  type MigrationStatus,
  type TableInfo,
} from "@/lib/api";

const defaultSettings: MigrationSettings = {
  include_schema: true,
  include_data: true,
  batch_size: 1000,
  truncate_destination: false,
  continue_on_error: false,
  max_retries: 3,
};

type Step = "source" | "tables" | "destination" | "review" | "running";

const steps: { id: Step; label: string }[] = [
  { id: "source", label: "Source" },
  { id: "tables", label: "Tables" },
  { id: "destination", label: "Destination" },
  { id: "review", label: "Review" },
];

export default function Home() {
  const [step, setStep] = useState<Step>("source");
  const [source, setSource] = useState<ConnectionCredentials | null>(null);
  const [destination, setDestination] = useState<ConnectionCredentials | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [tableSearch, setTableSearch] = useState("");
  const [settings, setSettings] = useState(defaultSettings);
  const [migrationId, setMigrationId] = useState<string | null>(null);
  const [migration, setMigration] = useState<MigrationStatus | null>(null);
  const [logs, setLogs] = useState<MigrationLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceRows = useMemo(
    () =>
      tables
        .filter((table) => selectedTables.includes(table.name))
        .reduce((total, table) => total + Math.max(table.rows, 0), 0),
    [selectedTables, tables],
  );

  const filteredTables = useMemo(
    () =>
      tables.filter((table) =>
        table.name.toLowerCase().includes(tableSearch.toLowerCase()),
      ),
    [tableSearch, tables],
  );

  const loadTables = useCallback(async (credentials: ConnectionCredentials) => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.discoverTables(credentials);
      setSource(credentials);
      setTables(result.tables);
      setSelectedTables(result.tables.map((table) => table.name));
      setStep("tables");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }, []);

  const createAndStart = useCallback(async () => {
    if (!source || !destination || selectedTables.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createMigration({
        source,
        destination,
        tables: selectedTables,
        settings,
      });
      await api.startMigration(created.migration_id);
      setMigrationId(created.migration_id);
      setStep("running");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }, [destination, selectedTables, settings, source]);

  const refreshMigration = useCallback(async () => {
    if (!migrationId) return;
    try {
      const [status, logResult] = await Promise.all([
        api.getMigration(migrationId),
        api.getLogs(migrationId),
      ]);
      setMigration(status);
      setLogs(logResult.logs);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }, [migrationId]);

  useEffect(() => {
    if (!migrationId) return;
    const initial = window.setTimeout(() => void refreshMigration(), 0);
    const interval = window.setInterval(() => void refreshMigration(), 1800);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [migrationId, refreshMigration]);

  const cancelMigration = async () => {
    if (!migrationId) return;
    setBusy(true);
    try {
      await api.cancelMigration(migrationId);
      await refreshMigration();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep("source");
    setSource(null);
    setDestination(null);
    setTables([]);
    setSelectedTables([]);
    setMigrationId(null);
    setMigration(null);
    setLogs([]);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-[#f5f6f2] text-[#17221b]">
      <header className="border-b border-[#dfe3dc] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-[#173c2c] text-white">
              <ArrowRight className="size-5" />
            </div>
            <div>
              <div className="font-display text-xl font-semibold tracking-tight">
                DataBridge
              </div>
              <div className="text-xs text-[#6f7a72]">Migration workspace</div>
            </div>
          </div>
          <a
            className="hidden items-center gap-2 rounded-full border border-[#dfe3dc] px-4 py-2 text-sm font-medium text-[#4f5d53] transition hover:border-[#aab5ac] hover:bg-[#f7f8f5] sm:flex"
            href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/docs`}
            target="_blank"
          >
            API documentation
            <ChevronRight className="size-4" />
          </a>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-8 lg:grid-cols-[250px_1fr] lg:px-10 lg:py-12">
        <aside className="space-y-6">
          <div>
            <p className="eyebrow">New migration</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
              Move data with confidence.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#69756c]">
              Validate both databases, choose exactly what moves, then monitor
              every batch.
            </p>
          </div>

          <nav className="grid grid-cols-4 gap-2 lg:grid-cols-1">
            {steps.map((item, index) => {
              const active = item.id === step;
              const completed = isStepComplete(item.id, step);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                    active
                      ? "bg-[#173c2c] text-white"
                      : completed
                        ? "bg-[#e4eee7] text-[#173c2c]"
                        : "text-[#8a938c]"
                  }`}
                  onClick={() => completed && setStep(item.id)}
                  disabled={!completed && !active}
                >
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-full text-xs ${
                      active ? "bg-white/15" : "bg-white"
                    }`}
                  >
                    {completed ? <Check className="size-3.5" /> : index + 1}
                  </span>
                  <span className="hidden font-medium lg:block">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="hidden rounded-2xl border border-[#dfe3dc] bg-white p-4 lg:block">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-[#268254]" />
              Credentials stay private
            </div>
            <p className="mt-2 text-xs leading-5 text-[#778179]">
              Credentials are sent directly to your API and encrypted before
              migration records are stored.
            </p>
          </div>
        </aside>

        <section>
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#efc9c0] bg-[#fff3f0] px-4 py-3 text-sm text-[#9b3a28]">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => setError(null)}>
                Dismiss
              </button>
            </div>
          )}

          {step === "source" && (
            <ConnectionPanel
              title="Connect your source"
              description="The source is read-only during migration. We will validate access before discovering its tables."
              actionLabel="Test & discover tables"
              icon={<Database className="size-5" />}
              busy={busy}
              onVerified={loadTables}
            />
          )}

          {step === "tables" && (
            <TableSelection
              tables={filteredTables}
              allTables={tables}
              selected={selectedTables}
              search={tableSearch}
              onSearch={setTableSearch}
              onSelected={setSelectedTables}
              onBack={() => setStep("source")}
              onContinue={() => setStep("destination")}
            />
          )}

          {step === "destination" && (
            <ConnectionPanel
              title="Connect your destination"
              description="We will validate write access and compare existing destination schemas while creating the migration plan."
              actionLabel="Test destination"
              icon={<Server className="size-5" />}
              busy={busy}
              onVerified={(credentials) => {
                setDestination(credentials);
                setStep("review");
              }}
              onBack={() => setStep("tables")}
            />
          )}

          {step === "review" && source && destination && (
            <ReviewPanel
              source={source}
              destination={destination}
              selectedTables={selectedTables}
              totalRows={sourceRows}
              settings={settings}
              busy={busy}
              onSettings={setSettings}
              onBack={() => setStep("destination")}
              onStart={createAndStart}
            />
          )}

          {step === "running" && migrationId && (
            <MigrationMonitor
              migrationId={migrationId}
              migration={migration}
              logs={logs}
              busy={busy}
              onCancel={cancelMigration}
              onRefresh={refreshMigration}
              onReset={reset}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function TableSelection({
  tables,
  allTables,
  selected,
  search,
  onSearch,
  onSelected,
  onBack,
  onContinue,
}: {
  tables: TableInfo[];
  allTables: TableInfo[];
  selected: string[];
  search: string;
  onSearch: (value: string) => void;
  onSelected: (value: string[]) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const allSelected = allTables.length > 0 && selected.length === allTables.length;
  const totalRows = allTables
    .filter((table) => selected.includes(table.name))
    .reduce((total, table) => total + Math.max(table.rows, 0), 0);

  const toggleTable = (name: string) => {
    onSelected(
      selected.includes(name)
        ? selected.filter((item) => item !== name)
        : [...selected, name],
    );
  };

  return (
    <Panel>
      <PanelHeading
        eyebrow="Source schema"
        title="Choose tables to migrate"
        description="Row counts are reported by the source database and help estimate the migration size."
        icon={<Table2 className="size-5" />}
      />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Metric label="Available tables" value={allTables.length.toLocaleString()} />
        <Metric label="Selected tables" value={selected.length.toLocaleString()} />
        <Metric label="Selected rows" value={totalRows.toLocaleString()} />
      </div>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-3 size-4 text-[#89938b]" />
          <input
            className="input pl-10"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search tables"
          />
        </label>
        <button
          className="button-secondary"
          type="button"
          onClick={() =>
            onSelected(allSelected ? [] : allTables.map((table) => table.name))
          }
        >
          {allSelected ? "Clear all" : "Select all"}
        </button>
      </div>
      <div className="mt-4 max-h-[430px] overflow-auto rounded-xl border border-[#e0e4de]">
        {tables.map((table) => (
          <label
            key={table.name}
            className="flex cursor-pointer items-center gap-4 border-b border-[#e8ebe6] px-4 py-3.5 last:border-0 hover:bg-[#f7f8f5]"
          >
            <input
              type="checkbox"
              checked={selected.includes(table.name)}
              onChange={() => toggleTable(table.name)}
              className="checkbox"
            />
            <Table2 className="size-4 text-[#6f7b72]" />
            <span className="flex-1 font-mono text-sm font-medium">{table.name}</span>
            <span className="text-sm tabular-nums text-[#748078]">
              {table.rows < 0 ? "Unknown" : `${table.rows.toLocaleString()} rows`}
            </span>
          </label>
        ))}
        {tables.length === 0 && (
          <div className="px-4 py-14 text-center text-sm text-[#7c867e]">
            No tables match your search.
          </div>
        )}
      </div>
      {selected.length === 0 && (
        <p className="mt-3 text-sm text-[#a44a34]">
          Select at least one table to continue.
        </p>
      )}
      <Actions
        onBack={onBack}
        onContinue={onContinue}
        continueLabel="Configure destination"
        disabled={selected.length === 0}
      />
    </Panel>
  );
}

function ReviewPanel({
  source,
  destination,
  selectedTables,
  totalRows,
  settings,
  busy,
  onSettings,
  onBack,
  onStart,
}: {
  source: ConnectionCredentials;
  destination: ConnectionCredentials;
  selectedTables: string[];
  totalRows: number;
  settings: MigrationSettings;
  busy: boolean;
  onSettings: (value: MigrationSettings) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const settingsValid =
    settings.batch_size >= 100 &&
    settings.batch_size <= 50000 &&
    settings.max_retries >= 0 &&
    settings.max_retries <= 10 &&
    (settings.include_schema || settings.include_data);

  return (
    <Panel>
      <PanelHeading
        eyebrow="Final review"
        title="Ready to build the migration plan"
        description="The backend will compare schemas before execution and skip incompatible tables."
        icon={<Play className="size-5" />}
      />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <ConnectionSummary label="Source" connection={source} />
        <ConnectionSummary label="Destination" connection={destination} />
      </div>
      <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_1.35fr]">
        <div className="rounded-2xl bg-[#f1f4ef] p-5">
          <p className="eyebrow">Migration scope</p>
          <div className="mt-5 space-y-4">
            <SummaryRow label="Tables" value={selectedTables.length.toLocaleString()} />
            <SummaryRow label="Estimated rows" value={totalRows.toLocaleString()} />
            <SummaryRow
              label="Direction"
              value={`${databaseLabel(source.database_type)} → ${databaseLabel(destination.database_type)}`}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-[#e0e4de] p-5">
          <p className="eyebrow">Execution settings</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <NumberSetting
              label="Batch size"
              value={settings.batch_size}
              min={100}
              max={50000}
              onChange={(batch_size) => onSettings({ ...settings, batch_size })}
              hint="100–50,000 rows"
            />
            <NumberSetting
              label="Retry attempts"
              value={settings.max_retries}
              min={0}
              max={10}
              onChange={(max_retries) => onSettings({ ...settings, max_retries })}
              hint="0–10 retries"
            />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ToggleSetting
              label="Include schema"
              description="Create missing tables"
              checked={settings.include_schema}
              onChange={(include_schema) => onSettings({ ...settings, include_schema })}
            />
            <ToggleSetting
              label="Include data"
              description="Copy selected rows"
              checked={settings.include_data}
              onChange={(include_data) => onSettings({ ...settings, include_data })}
            />
            <ToggleSetting
              label="Truncate destination"
              description="Clear tables before copy"
              checked={settings.truncate_destination}
              danger
              onChange={(truncate_destination) =>
                onSettings({ ...settings, truncate_destination })
              }
            />
            <ToggleSetting
              label="Continue on error"
              description="Try remaining tables"
              checked={settings.continue_on_error}
              onChange={(continue_on_error) =>
                onSettings({ ...settings, continue_on_error })
              }
            />
          </div>
          {!settings.include_schema && !settings.include_data && (
            <p className="mt-3 text-sm text-[#a44a34]">
              Include schema, data, or both.
            </p>
          )}
        </div>
      </div>
      <Actions
        onBack={onBack}
        onContinue={onStart}
        continueLabel={busy ? "Creating migration…" : "Create & start migration"}
        disabled={!settingsValid || busy}
        busy={busy}
      />
    </Panel>
  );
}

function MigrationMonitor({
  migrationId,
  migration,
  logs,
  busy,
  onCancel,
  onRefresh,
  onReset,
}: {
  migrationId: string;
  migration: MigrationStatus | null;
  logs: MigrationLog[];
  busy: boolean;
  onCancel: () => void;
  onRefresh: () => void;
  onReset: () => void;
}) {
  const terminal = ["completed", "failed", "cancelled"].includes(migration?.status ?? "");
  const progress = migration?.progress ?? 0;

  return (
    <Panel>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <PanelHeading
          eyebrow="Live migration"
          title={migration ? statusTitle(migration.status) : "Starting migration…"}
          description={`Migration ID · ${migrationId}`}
          icon={
            terminal ? (
              <Check className="size-5" />
            ) : (
              <LoaderCircle className="size-5 animate-spin" />
            )
          }
        />
        <button className="button-secondary" type="button" onClick={onRefresh}>
          <RefreshCw className="size-4" />
          Refresh
        </button>
      </div>
      <div className="mt-8 rounded-2xl bg-[#173c2c] p-6 text-white">
        <div className="flex items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              Overall progress
            </p>
            <p className="mt-2 font-display text-5xl font-semibold tabular-nums">
              {progress}%
            </p>
          </div>
          <p className="max-w-xs text-right text-sm text-white/65">
            {migration?.current_table
              ? `Migrating ${migration.current_table}`
              : migration?.status ?? "Waiting for worker"}
          </p>
        </div>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-[#d7f279] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Metric
          label="Processed rows"
          value={(migration?.processed_rows ?? 0).toLocaleString()}
        />
        <Metric
          label="Rows / second"
          value={(migration?.speed ?? 0).toLocaleString()}
        />
        <Metric
          label="Estimated time"
          value={formatDuration(migration?.estimated_time_remaining ?? 0)}
        />
      </div>
      {migration?.error_message && (
        <div className="mt-5 rounded-xl border border-[#efc9c0] bg-[#fff3f0] p-4 text-sm text-[#9b3a28]">
          {migration.error_message}
        </div>
      )}
      <div className="mt-7 overflow-hidden rounded-2xl border border-[#dfe3dc] bg-[#18201b] text-[#d8dfd9]">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-sm font-medium">
          <Terminal className="size-4" />
          Migration logs
        </div>
        <div className="max-h-[330px] overflow-auto p-4 font-mono text-xs leading-6">
          {logs.map((log) => (
            <div key={log.id} className="grid grid-cols-[72px_56px_1fr] gap-3">
              <span className="text-white/35">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={logLevelColor(log.level)}>{log.level}</span>
              <span>
                {log.table_name && <span className="text-[#d7f279]">[{log.table_name}] </span>}
                {log.message}
              </span>
            </div>
          ))}
          {logs.length === 0 && <p className="text-white/40">Waiting for worker logs…</p>}
        </div>
      </div>
      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button className="button-secondary" type="button" onClick={onReset}>
          New migration
        </button>
        {!terminal && (
          <button
            className="button-danger"
            type="button"
            onClick={onCancel}
            disabled={busy || migration?.status !== "running"}
          >
            <Square className="size-3.5 fill-current" />
            Cancel migration
          </button>
        )}
      </div>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[24px] border border-[#dfe3dc] bg-white p-5 shadow-[0_18px_60px_rgba(36,54,42,0.06)] sm:p-8">{children}</div>;
}

function PanelHeading({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e4eee7] text-[#1d6242]">
        {icon}
      </div>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f7971]">{description}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e3e7e1] bg-[#fafbf8] p-4">
      <p className="text-xs font-medium text-[#778179]">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Actions({
  onBack,
  onContinue,
  continueLabel,
  disabled,
  busy,
}: {
  onBack: () => void;
  onContinue: () => void;
  continueLabel: string;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#e5e8e3] pt-6 sm:flex-row sm:justify-between">
      <button className="button-secondary" type="button" onClick={onBack}>
        Back
      </button>
      <button className="button-primary" type="button" onClick={onContinue} disabled={disabled}>
        {busy && <LoaderCircle className="size-4 animate-spin" />}
        {continueLabel}
        {!busy && <ArrowRight className="size-4" />}
      </button>
    </div>
  );
}

function ConnectionSummary({
  label,
  connection,
}: {
  label: string;
  connection: ConnectionCredentials;
}) {
  return (
    <div className="rounded-2xl border border-[#dfe3dc] p-5">
      <p className="eyebrow">{label}</p>
      <div className="mt-3 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-[#eef2ec]">
          <Database className="size-4 text-[#37624a]" />
        </div>
        <div>
          <p className="font-semibold">{databaseLabel(connection.database_type)}</p>
          <p className="mt-0.5 text-xs text-[#778179]">
            {connection.connection_method === "url"
              ? redactUrl(connection.database_url ?? "")
              : connection.database_type === "sqlite"
                ? connection.file_path
                : `${connection.username}@${connection.host}:${connection.port}`}
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#dce3dc] pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-[#6e7971]">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function NumberSetting({
  label,
  value,
  min,
  max,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  hint: string;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <input
        className="input mt-2"
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="mt-1 block text-xs text-[#899189]">{hint}</span>
    </label>
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  danger,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  danger?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
        checked ? (danger ? "border-[#d89585] bg-[#fff5f2]" : "border-[#94b6a0] bg-[#f0f7f2]") : "border-[#e0e4de]"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="checkbox"
      />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-[#7b857d]">{description}</span>
      </span>
    </label>
  );
}

function isStepComplete(item: Step, current: Step) {
  const order = ["source", "tables", "destination", "review", "running"];
  return order.indexOf(item) < order.indexOf(current);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function databaseLabel(type: ConnectionCredentials["database_type"]) {
  return { postgres: "PostgreSQL", mysql: "MySQL", sqlite: "SQLite" }[type];
}

function redactUrl(url: string) {
  return url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:••••@");
}

function statusTitle(status: string) {
  return {
    pending: "Migration queued",
    planning: "Building migration plan",
    running: "Migration in progress",
    paused: "Migration paused",
    completed: "Migration completed",
    failed: "Migration failed",
    cancelled: "Migration cancelled",
  }[status] ?? status;
}

function formatDuration(seconds: number) {
  if (!seconds) return "Calculating";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function logLevelColor(level: string) {
  if (level === "ERROR" || level === "CRITICAL") return "text-[#ff9c86]";
  if (level === "WARNING") return "text-[#f7cf73]";
  return "text-[#8fc9a5]";
}
