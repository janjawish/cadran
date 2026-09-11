"use client";
import { z } from "zod";
import { db } from "./db";
interface ToolContext {
  registerTool(
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => Promise<unknown>;
    },
    options: { signal: AbortSignal },
  ): void | Promise<void>;
}
export function registerLocalCatalogTool() {
  const context = (document as Document & { modelContext?: ToolContext })
    .modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  try {
    void Promise.resolve(
      context.registerTool(
        {
          name: "search_local_watch_records",
          description:
            "Search watch analyses stored on this device. Returns basic watch identifiers only, without photos, notes, serial numbers or API settings.",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string", maxLength: 100 } },
            required: ["query"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          async execute(input) {
            const { query } = z
              .object({ query: z.string().max(100) })
              .strict()
              .parse(input);
            const matches = await db.watches
              .filter((w) =>
                `${w.brand} ${w.model} ${w.reference}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .limit(20)
              .toArray();
            return {
              watches: matches.map((w) => ({
                id: w.id,
                brand: w.brand,
                model: w.model,
                reference: w.reference,
                demo: w.demo,
              })),
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
  } catch {
    /* Experimental browser API: ignore unsupported implementations. */
  }
  return () => lifecycle.abort();
}
