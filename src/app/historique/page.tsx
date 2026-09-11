"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Search,
  Heart,
  Trash2,
  ArrowUpRight,
  ScanLine,
  FileText,
} from "lucide-react";
import { db, deleteWatch } from "@/lib/db";
import { money, dateLabel } from "@/lib/catalog";
import {
  PageHeading,
  EmptyState,
  WatchPhoto,
  ErrorNotice,
} from "@/components/ui";
const filters = [
  ["all", "Tous"],
  ["scan", "Scans"],
  ["listing", "Annonces"],
  ["collection", "Collection"],
  ["favorite", "Favoris"],
];
export default function History() {
  const watches =
    useLiveQuery(
      () => db.watches.orderBy("createdAt").reverse().toArray(),
      [],
    ) ?? [];
  const listings = useLiveQuery(() => db.listings.toArray(), []) ?? [];
  const items = useLiveQuery(() => db.collection.toArray(), []) ?? [];
  const snapshots =
    useLiveQuery(() => db.priceSnapshots.orderBy("at").toArray(), []) ?? [];
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState("");
  const visible = useMemo(
    () =>
      watches.filter((w) => {
        const isListing = listings.some((l) => l.watchId === w.id);
        return (
          `${w.brand} ${w.model} ${w.reference}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (filter === "all" ||
            (filter === "favorite" && w.favorite) ||
            (filter === "listing" && isListing) ||
            (filter === "scan" && !isListing) ||
            (filter === "collection" && items.some((c) => c.watchId === w.id)))
        );
      }),
    [watches, listings, items, filter, search],
  );
  return (
    <div className="page">
      <PageHeading
        number="04"
        title="La mémoire du regard."
        subtitle="Chaque montre croisée, chaque annonce décryptée. Retrouvez le fil de vos explorations."
        action={
          <Link href="/scanner/" className="button">
            <ScanLine size={17} />
            Nouveau scan
          </Link>
        }
      />
      <div className="segmented" role="group" aria-label="Filtrer l’historique">
        {filters.map(([key, label]) => (
          <button
            key={key}
            className={filter === key ? "active" : ""}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="search-bar">
        <Search size={18} />
        <input
          placeholder="Rechercher une marque, un modèle, une référence…"
          aria-label="Rechercher dans l’historique"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span>
          {visible.length} résultat{visible.length > 1 ? "s" : ""}
        </span>
      </div>
      <ErrorNotice message={error} />
      {visible.length ? (
        <div className="history-list">
          {visible.map((w) => {
            const listing = listings.find((l) => l.watchId === w.id);
            const value = snapshots
              .filter(
                (s) =>
                  s.watchId === w.id &&
                  (!s.reference || s.reference === w.reference),
              )
              .at(-1)?.mid;
            return (
              <article className="history-row" key={w.id}>
                <Link href={`/watch/?id=${w.id}`} className="history-photo">
                  <WatchPhoto watch={w} />
                </Link>
                <Link className="history-main" href={`/watch/?id=${w.id}`}>
                  <span className="eyebrow">
                    {w.brand}
                    {w.demo && <span className="demo-inline">DÉMO</span>}
                  </span>
                  <h2>{w.model}</h2>
                  <p>{w.reference}</p>
                </Link>
                <div className="history-type">
                  {listing ? <FileText size={14} /> : <ScanLine size={14} />}
                  <span>
                    {listing ? "Annonce" : "Scan"}
                    <small>{dateLabel(w.createdAt)}</small>
                  </span>
                </div>
                <div className="history-value">
                  <strong>{value ? money(value) : "À estimer"}</strong>
                  <span>estimation indicative</span>
                </div>
                <div className="history-actions">
                  <button
                    className={`icon-button ${w.favorite ? "favorite" : ""}`}
                    aria-label={
                      w.favorite ? "Retirer des favoris" : "Ajouter aux favoris"
                    }
                    aria-pressed={w.favorite}
                    onClick={() =>
                      db.watches
                        .update(w.id, { favorite: !w.favorite })
                        .catch(() => setError("Modification impossible."))
                    }
                  >
                    <Heart
                      size={17}
                      fill={w.favorite ? "currentColor" : "none"}
                    />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Supprimer l’analyse ${w.brand} ${w.model}`}
                    disabled={deleting === w.id}
                    onClick={async () => {
                      if (
                        !confirm(
                          `Supprimer l’analyse ${w.brand} ${w.model}, ses photos et son éventuelle entrée dans la collection ?`,
                        )
                      )
                        return;
                      setDeleting(w.id);
                      try {
                        await deleteWatch(w.id);
                      } catch {
                        setError("Suppression impossible. Réessayez.");
                      } finally {
                        setDeleting("");
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                  <Link
                    className="icon-button"
                    href={`/watch/?id=${w.id}`}
                    aria-label={`Ouvrir ${w.model}`}
                  >
                    <ArrowUpRight size={18} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={
            watches.length
              ? "Aucune correspondance."
              : "Le premier regard vous appartient."
          }
          description={
            watches.length
              ? "Modifiez vos filtres ou recherchez un autre modèle."
              : "Vos scans et analyses d’annonces seront enregistrés ici automatiquement."
          }
        />
      )}
    </div>
  );
}
