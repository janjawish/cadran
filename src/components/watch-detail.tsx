"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  ArrowUpRight,
  Heart,
  Plus,
  Check,
  Pencil,
  Copy,
  X,
  AlertTriangle,
  Bell,
  RefreshCw,
  FileText,
  ChevronDown,
  Shield,
  Trash2,
} from "lucide-react";
import { db, uid, DEFAULT_AI, refreshPrices } from "@/lib/db";
import { CATALOG, money, conditionLabels, presenceLabels } from "@/lib/catalog";
import { estimateWatch, calculateDeal } from "@/lib/market";
import { createAIProvider, messageOf } from "@/lib/ai/providers";
import { WatchPhoto, EmptyState, ErrorNotice, PriceChart } from "./ui";
import { PhotoCapture } from "./photo-capture";
import type {
  Watch,
  CollectionItem,
  Estimate,
  Condition,
  Presence,
  GeneratedListing,
  Photo,
} from "@/lib/types";
function WatchEditor({
  watch,
  onClose,
}: {
  watch: Watch;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(watch);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Watch>(key: K, value: Watch[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const changed =
            draft.reference !== watch.reference ||
            draft.model !== watch.model ||
            draft.brand !== watch.brand;
          const updated = {
            ...draft,
            updatedAt: Date.now(),
            identification: changed
              ? {
                  ...draft.identification,
                  source: "manual" as const,
                  summary: "Modèle corrigé manuellement par l’utilisateur.",
                  candidates: [
                    {
                      catalogId: CATALOG.find(
                        (c) => c.reference === draft.reference,
                      )?.id,
                      brand: draft.brand,
                      model: draft.model,
                      reference: draft.reference,
                      confidence: 0,
                      reasons: [
                        "Correction manuelle, non vérifiée automatiquement.",
                      ],
                    },
                    ...watch.identification.candidates.filter(
                      (c) => c.reference !== draft.reference,
                    ),
                  ],
                }
              : draft.identification,
          };
          const estimate = await estimateWatch(updated);
          await db.transaction(
            "rw",
            [db.watches, db.priceSnapshots],
            async () => {
              if (changed)
                await db.priceSnapshots
                  .where("watchId")
                  .equals(watch.id)
                  .filter((s) => !s.reference)
                  .modify({ reference: watch.reference });
              await db.watches.put(updated);
              if (estimate.available)
                await db.priceSnapshots.put({
                  id: uid(),
                  watchId: watch.id,
                  reference: updated.reference,
                  at: Date.now(),
                  low: estimate.low,
                  mid: estimate.mid,
                  high: estimate.high,
                  source: estimate.source,
                  demo: estimate.demo,
                });
            },
          );
          await refreshPrices();
          onClose();
        } catch (e) {
          setError(messageOf(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="section-label">
        CORRIGER LA FICHE
        <button
          type="button"
          className="icon-button"
          aria-label="Fermer la correction"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </div>
      <label className="field">
        <span>Choisir dans le catalogue</span>
        <select
          value={CATALOG.find((c) => c.reference === draft.reference)?.id ?? ""}
          onChange={(e) => {
            const c = CATALOG.find((c) => c.id === e.target.value);
            if (c) setDraft((d) => ({ ...d, ...c, id: watch.id }));
          }}
        >
          <option value="">Référence personnalisée</option>
          {CATALOG.map((c) => (
            <option key={c.id} value={c.id}>
              {c.brand} · {c.reference}
            </option>
          ))}
        </select>
      </label>
      <div className="fields mt-5">
        {(
          [
            "brand",
            "model",
            "reference",
            "variant",
            "material",
            "dial",
            "movement",
            "bracelet",
          ] as const
        ).map((key, i) => (
          <label className="field" key={key}>
            <span>
              {
                [
                  "Marque",
                  "Modèle",
                  "Référence",
                  "Variante",
                  "Matériau",
                  "Cadran",
                  "Mouvement",
                  "Bracelet",
                ][i]
              }
            </span>
            <input
              required={["brand", "model", "reference"].includes(key)}
              value={draft[key]}
              onChange={(e) => set(key, e.target.value)}
              maxLength={150}
            />
          </label>
        ))}
        <label className="field">
          <span>Diamètre (mm)</span>
          <input
            type="number"
            min="0"
            max="100"
            step=".1"
            value={draft.diameter || ""}
            onChange={(e) => set("diameter", Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Année</span>
          <input
            type="number"
            min="1800"
            max={new Date().getFullYear() + 1}
            value={draft.year ?? ""}
            onChange={(e) =>
              set("year", e.target.value ? Number(e.target.value) : undefined)
            }
          />
        </label>
        <label className="field">
          <span>État</span>
          <select
            value={draft.condition}
            onChange={(e) => set("condition", e.target.value as Condition)}
          >
            {Object.entries(conditionLabels).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {(["box", "papers"] as const).map((k) => (
          <label className="field" key={k}>
            <span>{k === "box" ? "Boîte" : "Papiers"}</span>
            <select
              value={draft[k]}
              onChange={(e) => set(k, e.target.value as Presence)}
            >
              {Object.entries(presenceLabels).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <ErrorNotice message={error} />
      <div className="action-row">
        <button className="button" disabled={busy}>
          Enregistrer la correction
        </button>
        <button type="button" className="text-button" onClick={onClose}>
          Annuler
        </button>
      </div>
    </form>
  );
}
function CollectionForm({
  watch,
  item,
  onClose,
}: {
  watch: Watch;
  item?: CollectionItem;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<CollectionItem>(
    item ?? {
      id: uid(),
      watchId: watch.id,
      purchaseDate: "",
      serial: "",
      notes: "",
      serviceHistory: [],
      addedAt: Date.now(),
    },
  );
  const [service, setService] = useState({
    date: "",
    description: "",
    cost: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const existing = await db.collection
            .where("watchId")
            .equals(watch.id)
            .first();
          await db.collection.put({ ...draft, id: existing?.id ?? draft.id });
          await refreshPrices();
          onClose();
        } catch (e) {
          setError(messageOf(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="section-label">
        {item ? "VOTRE PIÈCE" : "AJOUTER À VOTRE COLLECTION"}
        <button
          type="button"
          className="icon-button"
          aria-label="Fermer"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </div>
      <div className="fields">
        <label className="field">
          <span>Prix d’achat (€)</span>
          <input
            type="number"
            min="0"
            max="100000000"
            step=".01"
            placeholder="Facultatif"
            value={draft.purchasePrice ?? ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                purchasePrice: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              }))
            }
          />
        </label>
        <label className="field">
          <span>Date d’achat</span>
          <input
            type="date"
            value={draft.purchaseDate}
            onChange={(e) =>
              setDraft((d) => ({ ...d, purchaseDate: e.target.value }))
            }
          />
        </label>
        <label className="field wide">
          <span>Numéro de série (facultatif, reste local)</span>
          <input
            value={draft.serial}
            maxLength={100}
            onChange={(e) =>
              setDraft((d) => ({ ...d, serial: e.target.value }))
            }
          />
        </label>
        <label className="field wide">
          <span>Notes personnelles</span>
          <textarea
            value={draft.notes}
            maxLength={20000}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          />
        </label>
        <label className="field wide">
          <span>M’avertir si l’estimation passe sous (€)</span>
          <input
            type="number"
            min="1"
            placeholder="3 500"
            value={draft.alertBelow ?? ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                alertBelow: e.target.value ? Number(e.target.value) : undefined,
                alertTriggeredAt: undefined,
              }))
            }
          />
          <small className="micro">
            Vérifié à l’ouverture ou à l’actualisation. Avec le catalogue démo,
            le seuil porte sur des valeurs fictives. Aucune surveillance
            serveur.
          </small>
        </label>
      </div>
      <h3 className="subheading">Historique d’entretien</h3>
      {draft.serviceHistory.map((s, i) => (
        <div className="service-row" key={`${s.date}-${i}`}>
          <span>
            {s.date} · {s.description}{" "}
            {s.cost !== undefined && `· ${money(s.cost)}`}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="Supprimer cet entretien"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                serviceHistory: d.serviceHistory.filter((_, j) => i !== j),
              }))
            }
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <div className="fields mt-4">
        <label className="field">
          <span>Date de l’entretien</span>
          <input
            type="date"
            value={service.date}
            onChange={(e) =>
              setService((s) => ({ ...s, date: e.target.value }))
            }
          />
        </label>
        <label className="field">
          <span>Coût (€)</span>
          <input
            type="number"
            min="0"
            value={service.cost}
            onChange={(e) =>
              setService((s) => ({ ...s, cost: e.target.value }))
            }
          />
        </label>
        <label className="field wide">
          <span>Intervention / horloger</span>
          <input
            value={service.description}
            onChange={(e) =>
              setService((s) => ({ ...s, description: e.target.value }))
            }
          />
        </label>
      </div>
      <button
        type="button"
        className="text-button"
        disabled={!service.date || !service.description}
        onClick={() => {
          setDraft((d) => ({
            ...d,
            serviceHistory: [
              ...d.serviceHistory,
              {
                date: service.date,
                description: service.description,
                cost: service.cost ? Number(service.cost) : undefined,
              },
            ],
          }));
          setService({ date: "", description: "", cost: "" });
        }}
      >
        <Plus size={15} />
        Ajouter l’entretien
      </button>
      <ErrorNotice message={error} />
      <div className="action-row">
        <button className="button" disabled={busy}>
          {item ? "Enregistrer" : "Ajouter à ma collection"}
        </button>
        <button type="button" className="text-button" onClick={onClose}>
          Annuler
        </button>
      </div>
    </form>
  );
}
export function WatchDetail() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const watch = useLiveQuery(() => db.watches.get(id), [id]);
  const allLoaded = useLiveQuery(() => db.watches.count(), []);
  const listing = useLiveQuery(
    () => db.listings.where("watchId").equals(id).first(),
    [id],
  );
  const item = useLiveQuery(
    () => db.collection.where("watchId").equals(id).first(),
    [id],
  );
  const snapshots =
    useLiveQuery(
      () => db.priceSnapshots.where("watchId").equals(id).sortBy("at"),
      [id],
    ) ?? [];
  const prefs = useLiveQuery(() => db.preferences.get("main"), []);
  const ai = useLiveQuery(() => db.aiSettings.get("main"), []) ?? DEFAULT_AI;
  const [estimate, setEstimate] = useState<Estimate>();
  const [editor, setEditor] = useState<
    "watch" | "collection" | "photos" | null
  >(null);
  const [generated, setGenerated] = useState<GeneratedListing>();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [newPhotos, setNewPhotos] = useState<Photo[]>([]);
  const generatedDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let alive = true;
    if (watch)
      estimateWatch(watch)
        .then((e) => {
          if (alive) setEstimate(e);
        })
        .catch((e) => setError(messageOf(e)));
    return () => {
      alive = false;
    };
  }, [watch]);
  if (!watch)
    return (
      <div className="page">
        {allLoaded === undefined ? (
          <div className="loading-state">Ouverture du dossier…</div>
        ) : (
          <EmptyState
            title="Cette pièce n’est plus ici."
            description="Le dossier a été supprimé ou n’est pas enregistré sur cet appareil."
            href="/historique/"
            label="Revenir à l’historique"
          />
        )}
      </div>
    );
  const expert = prefs?.mode !== "simple";
  const best = watch.identification.candidates[0];
  const deal =
    listing && estimate ? calculateDeal(watch, listing, estimate) : undefined;
  const manual = watch.identification.source === "manual";
  const sourceLabel = watch.demo
    ? "DÉMONSTRATION"
    : manual
      ? "IDENTIFICATION MANUELLE"
      : "ANALYSE AUTOMATISÉE";
  const specs = [
    ["Collection", watch.collection],
    ["Référence", watch.reference],
    ["Variante", watch.variant],
    ["Diamètre", watch.diameter ? `${watch.diameter} mm` : "Non déterminé"],
    ["Matériau", watch.material],
    ["Cadran", watch.dial],
    ["Mouvement", watch.movement],
    ["Complications", watch.complications.join(" · ") || "Aucune renseignée"],
    ["Bracelet", watch.bracelet],
    ["Période", watch.period],
    ["Année déclarée", watch.year?.toString() ?? "Non renseignée"],
    ["État", conditionLabels[watch.condition]],
    ["Boîte", presenceLabels[watch.box]],
    ["Papiers", presenceLabels[watch.papers]],
  ];
  async function safe(action: () => Promise<unknown>, message = "") {
    try {
      setError("");
      await action();
      if (message) setSuccess(message);
    } catch (e) {
      setError(messageOf(e));
    }
  }
  const generatedText = generated
    ? [
        generated.title,
        generated.shortDescription,
        generated.description,
        generated.characteristics.join("\n"),
        generated.suggestedPrice
          ? `Prix indicatif${estimate?.demo ? " fictif de démonstration" : ""} : ${money(generated.suggestedPrice)}`
          : "Prix à définir",
        `À préciser :\n${generated.toSpecify.join("\n")}`,
      ].join("\n\n")
    : "";
  return (
    <div className="page watch-detail">
      <Link href="/historique/" className="back-link">
        <ArrowLeft size={14} />
        Les explorations
      </Link>
      <div className="detail-topline">
        <span className="eyebrow">
          DOSSIER / {id.slice(0, 8).toUpperCase()}
        </span>
        <div className="button-group">
          <span className="pill">{sourceLabel}</span>
          <button
            className={`icon-button ${watch.favorite ? "favorite" : ""}`}
            aria-label={
              watch.favorite ? "Retirer des favoris" : "Ajouter aux favoris"
            }
            aria-pressed={watch.favorite}
            onClick={() =>
              void safe(() =>
                db.watches.update(id, { favorite: !watch.favorite }),
              )
            }
          >
            <Heart size={19} fill={watch.favorite ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
      <ErrorNotice message={error} />
      {success && (
        <p className="success-note" role="status">
          {success}
        </p>
      )}
      <section className="detail-hero">
        <div className="detail-photo">
          <WatchPhoto
            watch={{
              ...watch,
              photoIds: watch.photoIds.length
                ? [watch.photoIds[photoIndex] ?? watch.photoIds[0]]
                : [],
            }}
            hero
          />
          <div className="detail-photo-label">
            <span>
              {watch.photoIds.length
                ? "VOTRE PHOTOGRAPHIE"
                : "ILLUSTRATION DU CATALOGUE"}
            </span>
            <span>
              {watch.photoIds.length
                ? `${photoIndex + 1} / ${watch.photoIds.length}`
                : "01 / 01"}
            </span>
          </div>
          {watch.photoIds.length > 1 && (
            <div className="photo-pager">
              {watch.photoIds.map((p, i) => (
                <button
                  className={i === photoIndex ? "active" : ""}
                  key={p}
                  onClick={() => setPhotoIndex(i)}
                  aria-label={`Photo ${i + 1}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="detail-summary">
          <div className="eyebrow">{watch.brand}</div>
          <h1>{watch.model}</h1>
          <div className="reference">
            RÉF. {watch.reference}
            <span>
              {watch.diameter ? `${watch.diameter} MM` : "DIAMÈTRE À PRÉCISER"}
            </span>
          </div>
          <div className="confidence">
            <div>
              <span>
                {manual
                  ? "Modèle renseigné manuellement"
                  : "Confiance d’identification indicative"}
              </span>
              <strong>
                {manual ? "À vérifier" : `${best?.confidence ?? 0} %`}
              </strong>
            </div>
            {!manual && (
              <div className="confidence-track">
                <i style={{ width: `${best?.confidence ?? 0}%` }} />
              </div>
            )}
          </div>
          {!manual && (best?.confidence ?? 0) < 70 && (
            <p className="uncertain-note">
              <AlertTriangle size={15} />
              Identification incertaine. Comparez les alternatives et ajoutez
              des vues.
            </p>
          )}
          <div className="valuation">
            <div className="eyebrow">
              VALEUR ESTIMÉE{" "}
              {estimate?.demo && <span className="demo-inline">DÉMO</span>}
            </div>
            <div className="valuation-number">
              {estimate?.available ? money(estimate.mid) : "À déterminer"}
            </div>
            <div className="valuation-range">
              <span>
                Fourchette {estimate?.approximate ? "indicative" : "de marché"}
              </span>
              <strong>
                {estimate?.available
                  ? `${money(estimate.low)} — ${money(estimate.high)}`
                  : "Aucune donnée disponible"}
              </strong>
            </div>
            <p>
              {estimate?.demo
                ? "Estimation approximative issue de comparables fictifs. Ce n’est pas une cote de marché actuelle."
                : estimate?.available
                  ? "Une estimation indicative, à confirmer selon la pièce et une inspection physique."
                  : "Cette référence ne dispose pas de comparables dans le catalogue local."}
            </p>
          </div>
          <div className="detail-actions">
            <button
              className={`button ${item ? "outline" : "crimson"} full`}
              onClick={() => setEditor("collection")}
            >
              {item ? <Check size={17} /> : <Plus size={17} />}{" "}
              {item
                ? "Dans votre collection · modifier"
                : "Ajouter à ma collection"}
              <ArrowUpRight size={17} />
            </button>
            <button className="text-button" onClick={() => setEditor("watch")}>
              <Pencil size={14} />
              Corriger le modèle ou l’état
            </button>
            <button className="text-button" onClick={() => setEditor("photos")}>
              <Plus size={14} />
              Ajouter des photos
            </button>
          </div>
        </div>
      </section>
      {editor && (
        <section className="inline-editor">
          {editor === "watch" ? (
            <WatchEditor watch={watch} onClose={() => setEditor(null)} />
          ) : editor === "collection" ? (
            <CollectionForm
              watch={watch}
              item={item}
              onClose={() => {
                setEditor(null);
                setSuccess("Collection enregistrée sur cet appareil.");
              }}
            />
          ) : (
            <>
              <div className="section-label">
                ENRICHIR LE DOSSIER
                <button
                  className="icon-button"
                  aria-label="Fermer l’ajout de photos"
                  onClick={() => {
                    setEditor(null);
                    setNewPhotos([]);
                  }}
                >
                  <X size={17} />
                </button>
              </div>
              <p className="muted mb-4">
                Les photos ajoutées sont conservées sans relancer l’analyse.
                Pour une nouvelle identification, lancez un nouveau scan.
              </p>
              <PhotoCapture photos={newPhotos} onChange={setNewPhotos} />
              <button
                className="button mt-5"
                disabled={!newPhotos.length}
                onClick={() =>
                  void safe(async () => {
                    if (watch.photoIds.length + newPhotos.length > 8)
                      throw new Error("Maximum 8 photos par montre.");
                    await db.transaction(
                      "rw",
                      [db.watches, db.photos],
                      async () => {
                        await db.photos.bulkPut(newPhotos);
                        await db.watches.update(id, {
                          photoIds: [
                            ...watch.photoIds,
                            ...newPhotos.map((p) => p.id),
                          ],
                          updatedAt: Date.now(),
                        });
                      },
                    );
                    setNewPhotos([]);
                    setEditor(null);
                  }, "Photos enregistrées.")
                }
              >
                Conserver les photos
              </button>
            </>
          )}
        </section>
      )}
      {listing && deal && (
        <section className="deal-panel">
          <div className="deal-overview">
            <span className="eyebrow">
              DEAL SCORE {estimate?.demo && "· DÉMO"}
            </span>
            <div className="deal-number">
              {deal.total}
              <small>/100</small>
            </div>
            <h2>{deal.conclusion}</h2>
            <div className="asking-price">
              <span>Prix demandé</span>
              <strong>{money(listing.price)}</strong>
            </div>
            <p>
              Score calculé à partir du prix, de l’état et des informations
              disponibles.{" "}
              {estimate?.demo ? "Comparaison fondée sur des prix fictifs." : ""}
            </p>
          </div>
          <div className="deal-subscores">
            {deal.parts.map((p) => (
              <div key={p.label} className="subscore">
                <div>
                  <span>
                    {p.label}
                    <small>{p.weight} % du score</small>
                  </span>
                  <strong>
                    {p.score}
                    <small>/100</small>
                  </strong>
                </div>
                <div className="subscore-track">
                  <i style={{ width: `${p.score}%` }} />
                </div>
                {expert && <p>{p.explanation}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="detail-columns">
        <div>
          {expert && (
            <section className="detail-section">
              <div className="section-label">
                01 / FICHE TECHNIQUE<span>{watch.brand.toUpperCase()}</span>
              </div>
              <dl className="spec-grid">
                {specs.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <section className="detail-section">
            <div className="section-label">
              {expert ? "02" : "01"} / LE REGARD DE L’ANALYSE
              <Shield size={15} />
            </div>
            <h2>
              {manual ? "Une référence à confirmer." : "Indice de cohérence"}
            </h2>
            <p className="section-description">
              {watch.identification.summary}
            </p>
            {!manual && (
              <div className="coherence-summary">
                {
                  watch.identification.features.filter(
                    (f) => f.status === "observed",
                  ).length
                }{" "}
                observations documentées ·{" "}
                {watch.identification.anomalies.length} élément(s) à vérifier
              </div>
            )}
            <div className="info-box mt-4">
              Les photos permettent de relever des indices de cohérence. Elles
              ne permettent pas de garantir l’authenticité d’une montre.
            </div>
            {expert && (
              <div className="features-list">
                {watch.identification.features.map((f, i) => (
                  <div key={i}>
                    <span>
                      {f.area}
                      <small>
                        {f.status === "observed"
                          ? "OBSERVÉ"
                          : f.status === "uncertain"
                            ? "À CONFIRMER"
                            : "NON VISIBLE"}
                      </small>
                    </span>
                    <p>{f.observation}</p>
                  </div>
                ))}
              </div>
            )}
            {watch.identification.anomalies.length > 0 && (
              <ul className="check-list mt-4">
                {watch.identification.anomalies.map((a, i) => (
                  <li key={i}>
                    <AlertTriangle size={15} />
                    {a}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {expert && (
            <section className="detail-section">
              <div className="section-label">
                03 / CANDIDATS & ALTERNATIVES
                <span>{watch.identification.candidates.length}</span>
              </div>
              {watch.identification.candidates.map((c, i) => (
                <div className="candidate" key={`${c.reference}-${i}`}>
                  <div>
                    <span className="eyebrow">
                      {i === 0 ? "CANDIDAT RETENU" : "ALTERNATIVE"}
                    </span>
                    <h3>
                      {c.brand} {c.model}
                    </h3>
                    <p>
                      {c.reference} ·{" "}
                      {c.confidence ? `${c.confidence} %` : "Non vérifié"}
                    </p>
                    <ul>
                      {c.reasons.map((r, j) => (
                        <li key={j}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  {i > 0 && (
                    <button
                      className="text-button"
                      onClick={() => {
                        setEditor("watch");
                        setSuccess(
                          `Sélectionnez ${c.reference} dans le catalogue ou saisissez cette référence dans le formulaire de correction.`,
                        );
                      }}
                    >
                      Choisir
                      <Pencil size={13} />
                    </button>
                  )}
                </div>
              ))}
              {watch.identification.candidates.length === 1 && (
                <p className="micro mt-4">
                  Un seul candidat disponible. Cela ne constitue pas une
                  identification certaine.
                </p>
              )}
            </section>
          )}
        </div>
        <div>
          <section className="detail-section">
            <div className="section-label">
              {expert ? "04" : "02"} / COMPRENDRE L’ESTIMATION
              <button
                className="icon-button"
                aria-label="Actualiser l’estimation"
                onClick={() =>
                  void safe(
                    () => refreshPrices(),
                    "Comparables locaux actualisés.",
                  )
                }
              >
                <RefreshCw size={14} />
              </button>
            </div>
            <h2>La valeur, en perspective.</h2>
            {estimate && (
              <>
                <p className="section-description">
                  {estimate.available
                    ? `${estimate.sampleSize} comparables · ${estimate.source}`
                    : "Aucun comparable pour cette référence."}
                </p>
                {expert &&
                  estimate.factors.map((f, i) => (
                    <div className="factor" key={i}>
                      <span>{f.label}</span>
                      <strong>
                        {f.amount > 0 ? "+" : ""}
                        {money(f.amount)}
                      </strong>
                    </div>
                  ))}
                {estimate.available && (
                  <div className="factor total">
                    <span>Estimation ajustée</span>
                    <strong>{money(estimate.mid)}</strong>
                  </div>
                )}
                <ul className="caveats">
                  {estimate.caveats.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                {estimate.observedAt && (
                  <p className="micro">
                    Date des comparables : {estimate.observedAt} · devise EUR
                  </p>
                )}
              </>
            )}
          </section>
          <section className="detail-section">
            <div className="section-label">
              {expert ? "05" : "03"} / HISTORIQUE DES ESTIMATIONS
            </div>
            {snapshots.length ? (
              <PriceChart
                snapshots={snapshots.filter(
                  (s) => !s.reference || s.reference === watch.reference,
                )}
              />
            ) : (
              <p className="muted">
                Un premier comparable permettra d’enregistrer la valeur de cette
                pièce.
              </p>
            )}
          </section>
          {listing && (
            <section className="detail-section">
              <div className="section-label">06 / À DEMANDER AU VENDEUR</div>
              <ul className="check-list">
                {listing.questions.map((q, i) => (
                  <li key={i}>
                    <ChevronDown size={15} />
                    {q}
                  </li>
                ))}
              </ul>
              <h3 className="subheading">Points positifs déclarés</h3>
              <ul className="check-list">
                {listing.positives.length ? (
                  listing.positives.map((p, i) => (
                    <li key={i}>
                      <Check size={15} />
                      {p}
                    </li>
                  ))
                ) : (
                  <li>Pas de point positif documenté à ce stade.</li>
                )}
              </ul>
              <h3 className="subheading">Informations manquantes</h3>
              <ul className="check-list">
                {listing.missing.map((p, i) => (
                  <li key={i}>
                    <Plus size={15} />
                    {p}
                  </li>
                ))}
              </ul>
              {listing.inconsistencies.length > 0 && (
                <>
                  <h3 className="subheading">Incohérences relevées</h3>
                  <ul className="check-list">
                    {listing.inconsistencies.map((p, i) => (
                      <li key={i}>
                        <AlertTriangle size={15} />
                        {p}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {listing.url && (
                <a
                  href={/^https?:\/\//i.test(listing.url) ? listing.url : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-button mt-4"
                >
                  Voir la source de l’annonce
                  <ArrowUpRight size={15} />
                </a>
              )}
              <details className="mt-4">
                <summary>Texte et informations conservés</summary>
                <p className="preserve-text mt-4">
                  {listing.title}
                  {"\n"}
                  {listing.text}
                  {"\n"}
                  {listing.service}
                  {"\n"}
                  {listing.seller}
                </p>
              </details>
            </section>
          )}
          {!listing && watch.identification.missing.length > 0 && (
            <section className="detail-section">
              <div className="section-label">POUR ALLER PLUS LOIN</div>
              <ul className="check-list">
                {watch.identification.missing.map((m, i) => (
                  <li key={i}>
                    <Plus size={15} />
                    {m}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {item && (
            <section className="detail-section">
              <div className="section-label">
                VOTRE COLLECTION <Check size={14} />
              </div>
              <div className="factor">
                <span>Prix d’achat</span>
                <strong>{money(item.purchasePrice)}</strong>
              </div>
              <div className="factor">
                <span>Date d’achat</span>
                <strong>{item.purchaseDate || "À renseigner"}</strong>
              </div>
              {item.serial && (
                <div className="factor">
                  <span>Numéro de série</span>
                  <strong>{item.serial}</strong>
                </div>
              )}
              {item.notes && (
                <p className="section-description preserve-text">
                  {item.notes}
                </p>
              )}
              {item.serviceHistory.map((s, i) => (
                <div className="service-row" key={i}>
                  {s.date} · {s.description}
                  {s.cost !== undefined && ` · ${money(s.cost)}`}
                </div>
              ))}
              {item.alertBelow && (
                <div
                  className={`info-box mt-4 ${item.alertTriggeredAt ? "alert-active" : ""}`}
                >
                  <Bell size={16} /> Seuil : {money(item.alertBelow)}{" "}
                  {item.alertTriggeredAt
                    ? "· seuil atteint sur les données disponibles"
                    : "· vérification à l’ouverture"}
                </div>
              )}
              <div className="action-row">
                <button
                  className="button outline"
                  disabled={generating}
                  onClick={() =>
                    void safe(async () => {
                      setGenerating(true);
                      try {
                        const g = await createAIProvider(ai).generateListing(
                          watch,
                          estimate ?? (await estimateWatch(watch)),
                          [
                            item.notes,
                            ...item.serviceHistory.map(
                              (s) =>
                                `Entretien déclaré : ${s.date} — ${s.description}`,
                            ),
                          ].join("\n"),
                        );
                        setGenerated(g);
                        generatedDialog.current?.showModal();
                      } finally {
                        setGenerating(false);
                      }
                    })
                  }
                >
                  <FileText size={16} />
                  {generating ? "Rédaction…" : "Créer une annonce"}
                </button>
                <button
                  className="text-button"
                  onClick={() => setEditor("collection")}
                >
                  <Pencil size={14} />
                  Modifier
                </button>
              </div>
              <button
                className="text-button muted"
                onClick={() => {
                  if (
                    confirm(
                      "Retirer cette montre de la collection ? Son analyse et ses photos seront conservées.",
                    )
                  )
                    void safe(
                      () => db.collection.delete(item.id),
                      "Pièce retirée de la collection.",
                    );
                }}
              >
                <Trash2 size={13} />
                Retirer de la collection
              </button>
            </section>
          )}
        </div>
      </div>
      <dialog ref={generatedDialog} className="content-dialog">
        <div className="dialog-header">
          <span className="eyebrow">VOTRE ANNONCE</span>
          <button
            className="icon-button"
            aria-label="Fermer l’annonce"
            onClick={() => generatedDialog.current?.close()}
          >
            <X />
          </button>
        </div>
        <h2>Passer le relais.</h2>
        {estimate?.demo && (
          <div className="info-box mt-4">
            Le prix suggéré provient du catalogue fictif. Définissez votre prix
            réel avant de publier.
          </div>
        )}
        <ErrorNotice message={error} />
        {success && (
          <p className="success-note" role="status">
            {success}
          </p>
        )}
        <textarea
          className="generated-text"
          aria-label="Texte de l’annonce à copier"
          readOnly
          value={generatedText}
        />
        <div className="action-row">
          <button
            className="button"
            onClick={() =>
              void safe(async () => {
                await navigator.clipboard.writeText(generatedText);
              }, "Annonce copiée.")
            }
          >
            <Copy size={16} />
            Copier le texte
          </button>
          <button
            className="text-button"
            onClick={() => generatedDialog.current?.close()}
          >
            Fermer
          </button>
        </div>
      </dialog>
    </div>
  );
}
