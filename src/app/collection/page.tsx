"use client";
import Link from "next/link";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Search, RefreshCw, ArrowUpRight, Bell } from "lucide-react";
import { db, refreshPrices, seedDemo } from "@/lib/db";
import { money } from "@/lib/catalog";
import { collectionMetrics, collectionTimeline } from "@/lib/collection";
import {
  PageHeading,
  WatchCard,
  EmptyState,
  PriceChart,
  ErrorNotice,
} from "@/components/ui";
export default function Collection() {
  const items =
    useLiveQuery(
      () => db.collection.orderBy("addedAt").reverse().toArray(),
      [],
    ) ?? [];
  const watches = useLiveQuery(() => db.watches.toArray(), []) ?? [];
  const snapshots =
    useLiveQuery(() => db.priceSnapshots.orderBy("at").toArray(), []) ?? [];
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const { value, invested, change, unpriced, unestimated, latest } =
    collectionMetrics(items, snapshots, watches);
  const visible = items
    .flatMap((c) => {
      const w = watches.find((w) => w.id === c.watchId);
      return w ? [w] : [];
    })
    .filter((w) =>
      `${w.brand} ${w.model} ${w.reference}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "value"
        ? (latest(b.id) ?? 0) - (latest(a.id) ?? 0)
        : sort === "brand"
          ? a.brand.localeCompare(b.brand)
          : 0,
    );
  const alerts = items.filter((i) => i.alertTriggeredAt);
  return (
    <div className="page">
      <PageHeading
        number="03"
        title="Votre rapport au temps."
        subtitle="Les pièces que vous avez choisies. Leur histoire, leur valeur, leur place dans votre collection."
        action={
          <Link href="/scanner/" className="button">
            <Plus size={16} />
            Ajouter une pièce
          </Link>
        }
      />
      {items.length > 0 ? (
        <>
          <div className="collection-dashboard">
            <div className="collection-total">
              <span className="eyebrow">VALEUR ESTIMÉE DE LA COLLECTION</span>
              <div>{money(value)}</div>
              <p>
                {items.length} pièce{items.length > 1 ? "s" : ""} ·{" "}
                {snapshots.some((s) => s.demo)
                  ? "estimations de démonstration"
                  : "estimations indicatives"}
              </p>
            </div>
            <div className="collection-secondary">
              <span className="eyebrow">MONTANT INVESTI RENSEIGNÉ</span>
              <strong>{money(invested)}</strong>
              <span className="eyebrow mt-6">ÉVOLUTION / PRIX D’ACHAT</span>
              <strong className="green-text">
                {change === undefined
                  ? "—"
                  : `${change >= 0 ? "+" : ""}${change.toFixed(1).replace(".", ",")} %`}{" "}
                <ArrowUpRight size={23} />
              </strong>
              {(unpriced > 0 || unestimated > 0) && (
                <p className="micro">
                  {unpriced} prix d’achat absent(s) · {unestimated} valeur(s)
                  inconnue(s). Évolution calculée uniquement sur les pièces
                  renseignées et estimées.
                </p>
              )}
            </div>
            <div className="collection-chart">
              <span className="eyebrow">LA COLLECTION AU FIL DES RELEVÉS</span>
              <PriceChart
                snapshots={collectionTimeline(items, snapshots, watches)}
              />
            </div>
          </div>
          {alerts.length > 0 && (
            <div className="local-alerts">
              {alerts.map((a) => (
                <Link key={a.id} href={`/watch/?id=${a.watchId}`}>
                  <Bell size={17} />
                  <span>
                    {watches.find((w) => w.id === a.watchId)?.model} · seuil de{" "}
                    {money(a.alertBelow)} atteint sur les données disponibles
                  </span>
                  <ArrowUpRight size={17} />
                </Link>
              ))}
            </div>
          )}
          <div className="collection-controls">
            <div className="search-bar">
              <Search size={18} />
              <input
                aria-label="Rechercher dans la collection"
                placeholder="Marque, modèle, référence…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Trier la collection"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recent">Derniers ajouts</option>
              <option value="value">Valeur décroissante</option>
              <option value="brand">Marque A–Z</option>
            </select>
            <button
              className="icon-button"
              disabled={busy}
              aria-label="Actualiser les valeurs et vérifier les seuils"
              onClick={async () => {
                setBusy(true);
                try {
                  await refreshPrices();
                  setMessage(
                    "Catalogue local actualisé. Les seuils ont été vérifiés.",
                  );
                } catch {
                  setError("Actualisation impossible.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw size={18} className={busy ? "spin" : ""} />
            </button>
          </div>
          <ErrorNotice message={error} />
          {message && (
            <p className="success-note" role="status">
              {message}
            </p>
          )}
          {visible.length ? (
            <div className="watch-grid collection-grid">
              {visible.map((w, i) => (
                <WatchCard
                  key={w.id}
                  watch={w}
                  index={i}
                  value={latest(w.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Aucune pièce ne correspond."
              description="Essayez une autre marque, un autre modèle ou une référence plus courte."
              href="/collection/"
              label="Votre collection"
            />
          )}
          <div className="info-box mt-8">
            La courbe représente les estimations enregistrées, y compris les
            entrées et sorties de collection. Elle ne mesure pas un rendement de
            marché. Les données de démonstration sont fictives.
          </div>
        </>
      ) : (
        <>
          <EmptyState
            title="Un écrin encore ouvert."
            description="Ajoutez une montre depuis sa fiche d’analyse. Vos pièces et leur histoire seront conservées uniquement sur cet appareil."
          />
          <div className="empty-demo">
            <button
              className="text-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await seedDemo();
                } catch {
                  setError("Chargement de la démonstration impossible.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Explorer une collection de démonstration
              <ArrowUpRight size={16} />
            </button>
            <ErrorNotice message={error} />
          </div>
        </>
      )}
    </div>
  );
}
