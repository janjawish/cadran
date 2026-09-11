"use client";
import Dexie, { type EntityTable } from "dexie";
import { CATALOG } from "./catalog";
import { estimateWatch } from "./market";
import type {
  Watch,
  Scan,
  Listing,
  CollectionItem,
  PriceSnapshot,
  AISettings,
  Preferences,
  Photo,
} from "./types";
class CadranDB extends Dexie {
  watches!: EntityTable<Watch, "id">;
  scans!: EntityTable<Scan, "id">;
  listings!: EntityTable<Listing, "id">;
  collection!: EntityTable<CollectionItem, "id">;
  priceSnapshots!: EntityTable<PriceSnapshot, "id">;
  aiSettings!: EntityTable<AISettings, "id">;
  preferences!: EntityTable<Preferences, "id">;
  photos!: EntityTable<Photo, "id">;
  constructor() {
    super("cadran-local");
    this.version(1).stores({
      watches: "id,brand,model,reference,createdAt",
      scans: "id,watchId,createdAt",
      listings: "id,watchId,createdAt",
      collection: "id,&watchId,addedAt",
      priceSnapshots: "id,watchId,at",
      aiSettings: "id",
      preferences: "id",
      photos: "id,createdAt",
    });
  }
}
export const db = new CadranDB();
export const uid = () => {
  const runtimeCrypto = globalThis.crypto;

  if (typeof runtimeCrypto?.randomUUID === "function") {
    return runtimeCrypto.randomUUID();
  }

  if (typeof runtimeCrypto?.getRandomValues === "function") {
    const bytes = runtimeCrypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};
export const DEFAULT_AI: AISettings = {
  id: "main",
  provider: "demo",
  model: "",
  apiKey: "",
  endpoint: "",
};
export async function initialize() {
  await db.transaction("rw", [db.preferences, db.aiSettings], async () => {
    if (!(await db.preferences.get("main")))
      await db.preferences.put({
        id: "main",
        initialized: true,
        mode: "expert",
        onboardingDismissed: false,
      });
    if (!(await db.aiSettings.get("main"))) await db.aiSettings.put(DEFAULT_AI);
  });
}
export async function seedDemo() {
  const now = Date.now();
  const watches: Watch[] = CATALOG.filter((x) => x.id !== "rolex-116610ln").map(
    (c, i) => ({
      ...c,
      id: `demo-${c.id}`,
      createdAt: now - i * 3600000,
      updatedAt: now,
      photoIds: [],
      identification: {
        source: "demo",
        summary:
          "Exemple pédagogique pré-identifié. Aucune photo n’a été analysée automatiquement.",
        candidates: [
          {
            catalogId: c.id,
            brand: c.brand,
            model: c.model,
            reference: c.reference,
            confidence: i === 0 ? 78 : 92,
            reasons: ["Fiche de démonstration issue du catalogue local."],
          },
          ...(i === 0
            ? [
                {
                  catalogId: "rolex-116610ln",
                  brand: "Rolex",
                  model: "Submariner Date",
                  reference: "116610LN",
                  confidence: 22,
                  reasons: ["Génération visuellement proche."],
                },
              ]
            : []),
        ],
        features: [
          { area: "Cadran", observation: c.dial, status: "observed" },
          {
            area: "Fond",
            observation: "Non photographié",
            status: "not-visible",
          },
        ],
        anomalies: [],
        missing: ["Photo du fond", "Date de dernière révision"],
      },
      condition: "good",
      box: "yes",
      papers: "yes",
      year: 2022,
      favorite: i === 0,
      demo: true,
    }),
  );
  const snapshots: PriceSnapshot[] = [];
  for (const w of watches) {
    const e = await estimateWatch(w);
    for (let m = 0; m < 6; m++)
      snapshots.push({
        id: `${w.id}-snapshot-${m}`,
        watchId: w.id,
        reference: w.reference,
        at: now - (5 - m) * 30 * 86400000,
        low: Math.round(e.low * (0.95 + m * 0.01)),
        mid: Math.round(e.mid * (0.95 + m * 0.01)),
        high: Math.round(e.high * (0.95 + m * 0.01)),
        source: e.source,
        demo: true,
      });
  }
  await db.transaction(
    "rw",
    [db.watches, db.scans, db.listings, db.collection, db.priceSnapshots],
    async () => {
      for (const [i, w] of watches.entries()) {
        if (await db.watches.get(w.id)) continue;
        await db.watches.add(w);
        if (i === 1)
          await db.listings.put({
            id: `listing-${w.id}`,
            watchId: w.id,
            createdAt: w.createdAt,
            type: "listing",
            title: "Omega Seamaster Diver 300M · full set",
            text: "Exemple fictif : montre de 2022, bon état, boîte et papiers présents. Prix demandé : 3 900 €. Révision déclarée en 2025, facture à vérifier.",
            url: "",
            price: 3900,
            year: 2022,
            condition: "good",
            box: "yes",
            papers: "yes",
            service: "Révision déclarée en 2025, justificatif à vérifier.",
            seller: "Vendeur de démonstration, profil fictif.",
            positives: [
              "Prix demandé sous la médiane de démonstration",
              "Boîte et papiers déclarés présents",
            ],
            inconsistencies: [],
            missing: ["Photo du fond"],
            questions: [
              "Pouvez-vous fournir une photo nette du fond ?",
              "Pouvez-vous présenter la carte de garantie et la facture de révision ?",
            ],
          });
        else
          await db.scans.put({
            id: `scan-${w.id}`,
            watchId: w.id,
            createdAt: w.createdAt,
            type: "scan",
          });
        if (i > 0 && i < 4)
          await db.collection.put({
            id: `collection-${w.id}`,
            watchId: w.id,
            purchasePrice: [0, 3800, 2600, 5600][i],
            purchaseDate: "2024-06-15",
            serial: "",
            notes:
              "Pièce de démonstration. À remplacer par votre propre montre.",
            serviceHistory: [],
            addedAt: now - 150 * 86400000,
          });
        await db.priceSnapshots.bulkPut(
          snapshots.filter((s) => s.watchId === w.id),
        );
      }
    },
  );
}
export async function saveWatch(
  watch: Watch,
  type: "scan" | "listing",
  listing?: Omit<Listing, "id" | "watchId" | "createdAt" | "type">,
  photos: Photo[] = [],
) {
  const estimate = await estimateWatch(watch);
  await db.transaction(
    "rw",
    [db.watches, db.scans, db.listings, db.photos, db.priceSnapshots],
    async () => {
      await db.watches.put(watch);
      await db.photos.bulkPut(photos);
      if (type === "scan")
        await db.scans.put({
          id: uid(),
          watchId: watch.id,
          createdAt: Date.now(),
          type,
        });
      if (listing)
        await db.listings.put({
          ...listing,
          id: uid(),
          watchId: watch.id,
          createdAt: Date.now(),
          type: "listing",
        });
      if (estimate.available)
        await db.priceSnapshots.put({
          id: uid(),
          watchId: watch.id,
          at: Date.now(),
          reference: watch.reference,
          low: estimate.low,
          mid: estimate.mid,
          high: estimate.high,
          source: estimate.source,
          demo: estimate.demo,
        });
    },
  );
}
export async function deleteWatch(id: string) {
  await db.transaction(
    "rw",
    [
      db.watches,
      db.scans,
      db.listings,
      db.collection,
      db.priceSnapshots,
      db.photos,
    ],
    async () => {
      const w = await db.watches.get(id);
      if (w) await db.photos.bulkDelete(w.photoIds);
      await db.watches.delete(id);
      for (const t of [db.scans, db.listings, db.collection, db.priceSnapshots])
        await t.where("watchId").equals(id).delete();
    },
  );
}
export async function refreshPrices() {
  const watches = await db.watches.toArray();
  for (const w of watches) {
    const e = await estimateWatch(w);
    await db.transaction(
      "rw",
      [db.watches, db.priceSnapshots, db.collection],
      async () => {
        const current = await db.watches.get(w.id);
        // A concurrent deletion, import or correction must not resurrect stale data.
        if (
          !current ||
          current.updatedAt !== w.updatedAt ||
          current.reference !== w.reference
        )
          return;
        if (!e.available) {
          const item = await db.collection
            .where("watchId")
            .equals(w.id)
            .first();
          if (item?.alertTriggeredAt)
            await db.collection.update(item.id, {
              alertTriggeredAt: undefined,
            });
          return;
        }
        const latest = (
          await db.priceSnapshots
            .where("watchId")
            .equals(w.id)
            .filter((s) => !s.reference || s.reference === w.reference)
            .sortBy("at")
        ).at(-1);
        if (
          !latest ||
          latest.mid !== e.mid ||
          Date.now() - latest.at > 86400000
        ) {
          await db.priceSnapshots.put({
            id: uid(),
            watchId: w.id,
            reference: w.reference,
            at: Date.now(),
            low: e.low,
            mid: e.mid,
            high: e.high,
            source: e.source,
            demo: e.demo,
          });
        }
        const item = await db.collection.where("watchId").equals(w.id).first();
        if (
          item?.alertBelow &&
          e.mid < item.alertBelow &&
          !item.alertTriggeredAt
        )
          await db.collection.update(item.id, { alertTriggeredAt: Date.now() });
        else if (
          item?.alertTriggeredAt &&
          item.alertBelow &&
          e.mid >= item.alertBelow
        )
          await db.collection.update(item.id, { alertTriggeredAt: undefined });
      },
    );
  }
}
