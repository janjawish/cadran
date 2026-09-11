"use client";
import { z } from "zod";
import { db, initialize } from "./db";
import { blobToDataURL } from "./photos";
import { observationSchema, candidatesSchema } from "./ai/schema";
const str = z.string().max(30000),
  id = z.string().min(1).max(100),
  timestamp = z.number().finite().nonnegative(),
  positive = z.number().finite().nonnegative().max(1000000000);
const condition = z.enum(["excellent", "good", "fair", "poor", "unknown"]),
  presence = z.enum(["yes", "no", "unknown"]);
const watchSchema = z.object({
  id,
  brand: str,
  collection: str,
  model: str,
  reference: str,
  variant: str,
  diameter: z.number().min(0).max(100),
  material: str,
  dial: str,
  movement: str,
  complications: z.array(str).max(30),
  bracelet: str,
  period: str,
  image: z.string().regex(/^(|\/images\/[\w.-]+)$/),
  createdAt: timestamp,
  updatedAt: timestamp,
  photoIds: z.array(id).max(8),
  identification: z.object({
    candidates: candidatesSchema.shape.candidates,
    features: observationSchema.shape.features,
    anomalies: observationSchema.shape.anomalies,
    missing: observationSchema.shape.missing,
    source: z.enum(["demo", "manual", "ai"]),
    summary: str,
  }),
  condition,
  box: presence,
  papers: presence,
  year: z.number().int().min(1800).max(2200).optional(),
  favorite: z.boolean(),
  demo: z.boolean(),
});
const listingSchema = z.object({
  id,
  watchId: id,
  createdAt: timestamp,
  type: z.literal("listing"),
  title: str,
  text: str,
  url: z
    .string()
    .max(2000)
    .refine((v) => !v || /^https?:\/\//i.test(v)),
  price: positive.optional(),
  year: z.number().min(1800).max(2200).optional(),
  condition,
  box: presence,
  papers: presence,
  service: str,
  seller: str,
  positives: z.array(str).max(50),
  inconsistencies: z.array(str).max(50),
  missing: z.array(str).max(50),
  questions: z.array(str).max(50),
});
const collectionSchema = z.object({
  id,
  watchId: id,
  purchasePrice: positive.optional(),
  purchaseDate: z.string().regex(/^(|\d{4}-\d{2}-\d{2})$/),
  serial: str,
  notes: str,
  serviceHistory: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        description: str,
        cost: positive.optional(),
      }),
    )
    .max(500),
  addedAt: timestamp,
  alertBelow: positive.optional(),
  alertTriggeredAt: timestamp.optional(),
});
const aiSchema = z.object({
  id: z.literal("main"),
  provider: z.enum([
    "demo",
    "gemini",
    "openai",
    "anthropic",
    "custom",
    "bridge",
  ]),
  model: z.string().max(200),
  apiKey: z.string().max(2000),
  endpoint: z.string().max(2000),
});
const backupSchema = z.object({
  format: z.literal("cadran-backup"),
  version: z.literal(1),
  exportedAt: str,
  includesSecrets: z.boolean(),
  watches: z.array(watchSchema).max(10000),
  scans: z
    .array(
      z.object({
        id,
        watchId: id,
        createdAt: timestamp,
        type: z.literal("scan"),
      }),
    )
    .max(50000),
  listings: z.array(listingSchema).max(10000),
  collection: z.array(collectionSchema).max(10000),
  priceSnapshots: z
    .array(
      z
        .object({
          id,
          watchId: id,
          at: timestamp,
          reference: str.optional(),
          low: positive,
          mid: positive,
          high: positive,
          source: str,
          demo: z.boolean(),
        })
        .refine((v) => v.low <= v.mid && v.mid <= v.high),
    )
    .max(100000),
  aiSettings: z.array(aiSchema).max(1),
  preferences: z
    .array(
      z.object({
        id: z.literal("main"),
        mode: z.enum(["simple", "expert"]),
        initialized: z.boolean(),
        onboardingDismissed: z.boolean(),
      }),
    )
    .max(1),
  photos: z
    .array(
      z.object({
        id,
        angle: str,
        createdAt: timestamp,
        data: z
          .string()
          .max(8000000)
          .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/),
      }),
    )
    .max(80000),
});
export type Backup = z.infer<typeof backupSchema>;
export async function exportBackup(includeSecrets = false) {
  const data = await db.transaction("r", db.tables, async () => ({
    watches: await db.watches.toArray(),
    scans: await db.scans.toArray(),
    listings: await db.listings.toArray(),
    collection: await db.collection.toArray(),
    priceSnapshots: await db.priceSnapshots.toArray(),
    aiSettings: await db.aiSettings.toArray(),
    preferences: await db.preferences.toArray(),
    photos: await db.photos.toArray(),
  }));
  const photos = await Promise.all(
    data.photos.map(async ({ blob, ...p }) => ({
      ...p,
      data: await blobToDataURL(blob),
    })),
  );
  const backup = {
    ...data,
    format: "cadran-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    includesSecrets: includeSecrets,
    photos,
    aiSettings: includeSecrets
      ? data.aiSettings
      : data.aiSettings.map((s) => ({ ...s, apiKey: "" })),
  };
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cadran-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return blob.size;
}
export async function readBackup(file: File): Promise<Backup> {
  if (file.size > 150 * 1024 * 1024)
    throw new Error("Cette sauvegarde dépasse la limite d’import de 150 Mo.");
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new Error("Ce fichier n’est pas un JSON valide.");
  }
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success)
    throw new Error(
      `Sauvegarde incompatible ou invalide (format CADRAN v1 attendu). ${parsed.error.issues[0]?.path.join(".")} à vérifier.`,
    );
  const data = parsed.data;
  const watchIds = new Set(data.watches.map((w) => w.id)),
    photoIds = new Set(data.photos.map((p) => p.id));
  for (const [name, rows] of Object.entries(data)) {
    if (Array.isArray(rows)) {
      const ids = rows.map((r) => r.id);
      if (new Set(ids).size !== ids.length)
        throw new Error(`Identifiants dupliqués dans ${name}.`);
    }
  }
  if (
    new Set(data.collection.map((c) => c.watchId)).size !==
    data.collection.length
  )
    throw new Error("Une montre apparaît plusieurs fois dans la collection.");
  for (const row of [
    ...data.scans,
    ...data.listings,
    ...data.collection,
    ...data.priceSnapshots,
  ])
    if (!watchIds.has(row.watchId))
      throw new Error(
        "Sauvegarde incomplète : une montre référencée est absente.",
      );
  const ownedPhotos = new Set<string>();
  for (const w of data.watches)
    for (const p of w.photoIds)
      if (ownedPhotos.has(p)) {
        throw new Error("Une photo ne peut appartenir à plusieurs dossiers.");
      } else if (!photoIds.has(p))
        throw new Error(
          "Sauvegarde incomplète : une photo référencée est absente.",
        );
      else ownedPhotos.add(p);
  return data;
}
export async function importBackup(data: Backup) {
  const photos = await Promise.all(
    data.photos.map(async ({ data: encoded, ...p }) => {
      const [header, base64] = encoded.split(",");
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: header.slice(5, -7) });
      try {
        const bitmap = await createImageBitmap(blob);
        bitmap.close();
      } catch {
        throw new Error(
          "Une photo de la sauvegarde est endommagée. Import annulé.",
        );
      }
      return { ...p, blob };
    }),
  );
  await db.transaction("rw", db.tables, async () => {
    for (const table of [
      db.watches,
      db.scans,
      db.listings,
      db.collection,
      db.priceSnapshots,
      db.preferences,
      db.photos,
    ])
      await table.clear();
    await db.watches.bulkPut(data.watches);
    await db.scans.bulkPut(data.scans);
    await db.listings.bulkPut(data.listings);
    await db.collection.bulkPut(data.collection);
    await db.priceSnapshots.bulkPut(data.priceSnapshots);
    await db.preferences.bulkPut(data.preferences);
    await db.photos.bulkPut(photos);
    if (data.includesSecrets) {
      await db.aiSettings.clear();
      await db.aiSettings.bulkPut(data.aiSettings);
    }
  });
  await initialize();
}
export async function deleteAllData() {
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
  await initialize();
}
export async function storageUsage() {
  const estimate = await navigator.storage?.estimate();
  const photos = await db.photos.toArray();
  return {
    usage: estimate?.usage ?? 0,
    quota: estimate?.quota ?? 0,
    photos: photos.reduce((s, p) => s + p.blob.size, 0),
    persistent: (await navigator.storage?.persisted?.()) ?? false,
  };
}
