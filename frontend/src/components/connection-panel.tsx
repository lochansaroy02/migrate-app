"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, LoaderCircle, PlugZap } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { api, type ConnectionCredentials, type DatabaseType } from "@/lib/api";
import { connectionSchema, type ConnectionFormValues } from "@/lib/validation";

const databases: { value: DatabaseType; label: string; description: string; port?: number }[] = [
  { value: "postgres", label: "PostgreSQL", description: "Public schema", port: 5432 },
  { value: "mysql", label: "MySQL", description: "MySQL databases", port: 3306 },
  { value: "sqlite", label: "SQLite", description: "Local database file" },
];

export function ConnectionPanel({
  title,
  description,
  actionLabel,
  icon,
  busy,
  onVerified,
  onBack,
}: {
  title: string;
  description: string;
  actionLabel: string;
  icon: React.ReactNode;
  busy: boolean;
  onVerified: (credentials: ConnectionCredentials) => void | Promise<void>;
  onBack?: () => void;
}) {
  const [testing, setTesting] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    message: string;
    latency_ms: number | null;
  } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      database_type: "postgres",
      connection_method: "credentials",
      port: 5432,
    },
  });

  const databaseType = useWatch({ control, name: "database_type" });
  const connectionMethod = useWatch({ control, name: "connection_method" });

  useEffect(() => {
    const database = databases.find((item) => item.value === databaseType);
    if (database?.port) setValue("port", database.port);
  }, [databaseType, setValue]);

  const submit = handleSubmit(async (values) => {
    setTesting(true);
    setConnectionResult(null);
    const credentials = cleanCredentials(values);
    try {
      const result = await api.testConnection(credentials);
      setConnectionResult(result);
      if (result.success) await onVerified(credentials);
    } catch (error) {
      setConnectionResult({
        success: false,
        message: error instanceof Error ? error.message : "Connection failed.",
        latency_ms: null,
      });
    } finally {
      setTesting(false);
    }
  });

  return (
    <div className="rounded-[24px] border border-[#dfe3dc] bg-white p-5 shadow-[0_18px_60px_rgba(36,54,42,0.06)] sm:p-8">
      <div className="flex gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e4eee7] text-[#1d6242]">
          {icon}
        </div>
        <div>
          <p className="eyebrow">Database connection</p>
          <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f7971]">{description}</p>
        </div>
      </div>

      <form className="mt-8" onSubmit={submit}>
        <fieldset>
          <legend className="label">Database engine</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {databases.map((database) => (
              <label
                key={database.value}
                className={`cursor-pointer rounded-xl border p-4 transition ${
                  databaseType === database.value
                    ? "border-[#608a6d] bg-[#f0f7f2] ring-1 ring-[#608a6d]"
                    : "border-[#e0e4de] hover:border-[#b7c0b9]"
                }`}
              >
                <input
                  type="radio"
                  value={database.value}
                  className="sr-only"
                  {...register("database_type")}
                />
                <span className="block text-sm font-semibold">{database.label}</span>
                <span className="mt-1 block text-xs text-[#7b857d]">{database.description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-7">
          <span className="label">Connection method</span>
          <div className="mt-2 inline-flex rounded-lg bg-[#f0f2ee] p-1">
            {(["credentials", "url"] as const).map((method) => (
              <label
                key={method}
                className={`cursor-pointer rounded-md px-4 py-2 text-sm font-medium capitalize transition ${
                  connectionMethod === method ? "bg-white text-[#173c2c] shadow-sm" : "text-[#778078]"
                }`}
              >
                <input type="radio" value={method} className="sr-only" {...register("connection_method")} />
                {method}
              </label>
            ))}
          </div>
        </div>

        {connectionMethod === "url" ? (
          <Field label="Database URL" error={errors.database_url?.message} className="mt-7">
            <input
              className="input font-mono"
              placeholder={urlPlaceholder(databaseType)}
              type="password"
              autoComplete="off"
              {...register("database_url")}
            />
          </Field>
        ) : databaseType === "sqlite" ? (
          <Field label="SQLite file path" error={errors.file_path?.message} className="mt-7">
            <input className="input font-mono" placeholder="/data/source.db" {...register("file_path")} />
          </Field>
        ) : (
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <Field label="Host" error={errors.host?.message}>
              <input className="input" placeholder="localhost" {...register("host")} />
            </Field>
            <Field label="Port" error={errors.port?.message}>
              <input
                className="input"
                type="number"
                min={1}
                max={65535}
                {...register("port", { valueAsNumber: true })}
              />
            </Field>
            <Field label="Database" error={errors.database?.message}>
              <input className="input" placeholder="my_database" {...register("database")} />
            </Field>
            <Field label="Username" error={errors.username?.message}>
              <input className="input" placeholder="database_user" {...register("username")} />
            </Field>
            <Field label="Password" error={errors.password?.message} className="sm:col-span-2">
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••••••"
                {...register("password")}
              />
            </Field>
          </div>
        )}

        {connectionResult && !connectionResult.success && (
          <div className="mt-5 rounded-xl border border-[#efc9c0] bg-[#fff3f0] p-4 text-sm text-[#9b3a28]">
            {connectionResult.message}
          </div>
        )}
        {connectionResult?.success && (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#b9d8c2] bg-[#f0f8f2] p-4 text-sm text-[#28623f]">
            <CheckCircle2 className="size-4" />
            {connectionResult.message}
            {connectionResult.latency_ms !== null && (
              <span className="ml-auto tabular-nums">{connectionResult.latency_ms} ms</span>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#e5e8e3] pt-6 sm:flex-row sm:justify-between">
          {onBack ? (
            <button className="button-secondary" type="button" onClick={onBack}>
              Back
            </button>
          ) : (
            <div />
          )}
          <button className="button-primary" type="submit" disabled={testing || busy}>
            {testing || busy ? <LoaderCircle className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
            {testing ? "Testing connection…" : busy ? "Discovering tables…" : actionLabel}
            {!testing && !busy && <ArrowRight className="size-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="label">{label}</span>
      <span className="mt-2 block">{children}</span>
      {error && <span className="mt-1.5 block text-xs text-[#a44a34]">{error}</span>}
    </label>
  );
}

function cleanCredentials(values: ConnectionFormValues): ConnectionCredentials {
  if (values.connection_method === "url") {
    return {
      database_type: values.database_type,
      connection_method: "url",
      database_url: values.database_url,
    };
  }
  if (values.database_type === "sqlite") {
    return {
      database_type: "sqlite",
      connection_method: "credentials",
      file_path: values.file_path,
    };
  }
  return {
    database_type: values.database_type,
    connection_method: "credentials",
    host: values.host,
    port: values.port,
    database: values.database,
    username: values.username,
    password: values.password,
  };
}

function urlPlaceholder(type: DatabaseType) {
  return {
    postgres: "postgresql://user:password@host:5432/database",
    mysql: "mysql://user:password@host:3306/database",
    sqlite: "sqlite:////data/source.db",
  }[type];
}
