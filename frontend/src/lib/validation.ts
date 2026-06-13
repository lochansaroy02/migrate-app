import { z } from "zod";

const supportedDatabases = ["postgres", "mysql", "sqlite"] as const;

export const connectionSchema = z
  .object({
    database_type: z.enum(supportedDatabases),
    connection_method: z.enum(["url", "credentials"]),
    database_url: z.string().trim().optional(),
    host: z.string().trim().optional(),
    port: z.number().int().min(1).max(65535).optional(),
    database: z.string().trim().optional(),
    username: z.string().trim().optional(),
    password: z.string().optional(),
    file_path: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
    if (value.connection_method === "url") {
      if (!value.database_url) {
        context.addIssue({
          code: "custom",
          path: ["database_url"],
          message: "A database URL is required.",
        });
        return;
      }
      const prefixes = {
        postgres: ["postgres://", "postgresql://"],
        mysql: ["mysql://"],
        sqlite: ["sqlite://"],
      }[value.database_type];
      if (!prefixes.some((prefix) => value.database_url?.startsWith(prefix))) {
        context.addIssue({
          code: "custom",
          path: ["database_url"],
          message: `Use a valid ${value.database_type} connection URL.`,
        });
      }
      return;
    }

    if (value.database_type === "sqlite") {
      if (!value.file_path) {
        context.addIssue({
          code: "custom",
          path: ["file_path"],
          message: "A SQLite file path is required.",
        });
      }
      return;
    }

    (["host", "database", "username", "password"] as const).forEach((field) => {
      if (!value[field]) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `${field[0].toUpperCase()}${field.slice(1)} is required.`,
        });
      }
    });
  });

export type ConnectionFormValues = z.infer<typeof connectionSchema>;
