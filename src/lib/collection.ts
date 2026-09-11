import type { CollectionItem, PriceSnapshot, Watch } from "./types";
export function collectionMetrics(
  items: CollectionItem[],
  snapshots: PriceSnapshot[],
  watches: Watch[],
) {
  const references = new Map(watches.map((w) => [w.id, w.reference]));
  const latest = (id: string) =>
    snapshots
      .filter(
        (s) =>
          s.watchId === id &&
          (!s.reference || s.reference === references.get(id)),
      )
      .sort((a, b) => a.at - b.at)
      .at(-1)?.mid;
  const value = items.reduce((s, c) => s + (latest(c.watchId) ?? 0), 0);
  const invested = items.reduce((s, c) => s + (c.purchasePrice ?? 0), 0);
  const priced = items.filter(
    (c) => c.purchasePrice !== undefined && latest(c.watchId) !== undefined,
  );
  const basis = priced.reduce((s, c) => s + c.purchasePrice!, 0);
  const comparableValue = priced.reduce((s, c) => s + latest(c.watchId)!, 0);
  return {
    value,
    invested,
    change: basis ? ((comparableValue - basis) / basis) * 100 : undefined,
    unpriced: items.filter((c) => c.purchasePrice === undefined).length,
    unestimated: items.filter((c) => latest(c.watchId) === undefined).length,
    latest,
  };
}
export function collectionTimeline(
  items: CollectionItem[],
  snapshots: PriceSnapshot[],
  watches: Watch[],
): PriceSnapshot[] {
  const references = new Map(watches.map((w) => [w.id, w.reference]));
  const selected = snapshots.filter(
    (p) =>
      items.some((c) => c.watchId === p.watchId) &&
      (!p.reference || p.reference === references.get(p.watchId)),
  );
  const days = [
    ...new Set(selected.map((s) => new Date(s.at).toISOString().slice(0, 10))),
  ]
    .sort()
    .slice(-12);
  return days.map((day) => {
    const end = new Date(`${day}T23:59:59.999Z`).getTime();
    const atDate = items
      .filter((c) => c.addedAt <= end)
      .flatMap((c) => {
        const s = selected
          .filter((p) => p.watchId === c.watchId && p.at <= end)
          .sort((a, b) => a.at - b.at)
          .at(-1);
        return s ? [s] : [];
      });
    return {
      id: day,
      watchId: "aggregate",
      at: end,
      low: atDate.reduce((s, p) => s + p.low, 0),
      mid: atDate.reduce((s, p) => s + p.mid, 0),
      high: atDate.reduce((s, p) => s + p.high, 0),
      source: "Historique agrégé local",
      demo: atDate.some((s) => s.demo),
    };
  });
}
