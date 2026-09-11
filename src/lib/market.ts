import { DEMO_MARKET } from "./catalog";
import type {
  Watch,
  MarketComparable,
  Estimate,
  Listing,
  DealScore,
} from "./types";
export interface MarketDataProvider {
  readonly id: string;
  getComparables(reference: string): Promise<MarketComparable[]>;
}
export class LocalDemoMarketProvider implements MarketDataProvider {
  readonly id = "local-demo";
  async getComparables(reference: string) {
    return DEMO_MARKET.filter((x) => x.reference === reference);
  }
}
export const marketProvider: MarketDataProvider = new LocalDemoMarketProvider();
export async function estimateWatch(
  watch: Watch,
  provider: MarketDataProvider = marketProvider,
): Promise<Estimate> {
  const points = (await provider.getComparables(watch.reference)).filter(
    (x) => Number.isFinite(x.price) && x.price > 0 && x.currency === "EUR",
  );
  if (!points.length)
    return {
      available: false,
      low: 0,
      mid: 0,
      high: 0,
      approximate: true,
      demo: false,
      source: provider.id,
      sampleSize: 0,
      factors: [],
      caveats: [
        "Aucun comparable disponible pour cette référence. Aucune valeur ne peut être calculée.",
      ],
    };
  const sorted = points.map((x) => x.price).sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  const base =
    sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
  const factor = (label: string, rate: number) => ({
    label,
    amount: Math.round((base * rate) / 25) * 25,
  });
  const factors = [
    factor(
      watch.condition === "excellent"
        ? "Excellent état"
        : watch.condition === "fair"
          ? "Traces d’usage"
          : watch.condition === "poor"
            ? "Usure / révision nécessaire"
            : watch.condition === "unknown"
              ? "État non confirmé"
              : "Bon état · base de comparaison",
      { excellent: 0.035, good: 0, fair: -0.06, poor: -0.15, unknown: 0 }[
        watch.condition
      ],
    ),
  ];
  if (watch.box === "no") factors.push(factor("Boîte absente", -0.02));
  if (watch.papers === "no") factors.push(factor("Papiers absents", -0.06));
  const adjustment = factors.reduce((s, f) => s + f.amount, 0);
  const mid = Math.max(0, base + adjustment);
  const unknown = [
    watch.condition === "unknown",
    watch.box === "unknown",
    watch.papers === "unknown",
  ].filter(Boolean).length;
  const margin = base * unknown * 0.025;
  const demo = points.some((x) => x.kind === "demo");
  return {
    available: true,
    mid: Math.round(mid / 25) * 25,
    low: Math.max(0, Math.round((sorted[0] + adjustment - margin) / 25) * 25),
    high: Math.round((sorted.at(-1)! + adjustment + margin) / 25) * 25,
    approximate: demo || points.length < 5 || unknown > 0,
    demo,
    source: points[0].source,
    observedAt: points
      .map((x) => x.observedAt)
      .sort()
      .at(-1),
    sampleSize: points.length,
    factors,
    caveats: [
      ...(demo
        ? [
            "Prix fictifs de démonstration : ce résultat ne constitue pas une cote actuelle.",
          ]
        : []),
      ...(unknown
        ? ["Fourchette élargie : état ou complétude non confirmés."]
        : []),
      "Année et configuration : aucun ajustement sans comparables spécifiques.",
      "Frais, révision et inspection physique non inclus.",
    ],
  };
}
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
export function calculateDeal(w: Watch, l: Listing, e: Estimate): DealScore {
  const confidence = w.identification.candidates[0]?.confidence ?? 0;
  const price =
    l.price && e.available ? clamp(70 + ((e.mid - l.price) / e.mid) * 150) : 0;
  const parts = [
    {
      label: "Prix demandé",
      score: price,
      weight: 35,
      explanation:
        l.price && e.available
          ? "Écart à la médiane ajustée des comparables."
          : "Prix ou comparables absents : évaluation indisponible.",
    },
    {
      label: "État",
      score: { excellent: 95, good: 80, fair: 55, poor: 25, unknown: 35 }[
        w.condition
      ],
      weight: 15,
      explanation: "État déclaré, à confirmer par inspection.",
    },
    {
      label: "Complétude",
      score: Math.round(
        [w.box, w.papers].reduce(
          (s, v) => s + (v === "yes" ? 100 : v === "no" ? 20 : 40),
          0,
        ) / 2,
      ),
      weight: 10,
      explanation: "Présence de la boîte et des papiers.",
    },
    {
      label: "Identification",
      score: confidence,
      weight: 20,
      explanation: "Confiance indicative du candidat retenu, non calibrée.",
    },
    {
      label: "Cohérence",
      score: clamp(100 - l.inconsistencies.length * 20 - l.missing.length * 7),
      weight: 10,
      explanation: "Incohérences et informations manquantes.",
    },
    {
      label: "Risques",
      score: clamp(
        100 -
          w.identification.anomalies.length * 20 -
          (l.seller ? 0 : 15) -
          (l.service ? 0 : 10),
      ),
      weight: 10,
      explanation: "Anomalies visuelles, vendeur et entretien documentés.",
    },
  ];
  const total = clamp(
    parts.reduce((s, p) => s + (p.score * p.weight) / 100, 0),
  );
  const risky =
    confidence < 55 ||
    w.identification.anomalies.length > 1 ||
    !l.price ||
    !e.available ||
    l.inconsistencies.length > 1 ||
    !!(l.price && e.available && l.price < e.low * 0.65);
  return {
    total,
    parts,
    conclusion: risky
      ? "Prudence recommandée"
      : l.price! > e.high * 1.08
        ? "Prix élevé"
        : total >= 85
          ? "Excellente opportunité"
          : total >= 75
            ? "Prix intéressant"
            : total >= 60
              ? "Prix cohérent"
              : "Prudence recommandée",
  };
}
