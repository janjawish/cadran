"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  ScanLine,
  ShieldCheck,
  Link2,
  LoaderCircle,
  ChevronRight,
  X,
} from "lucide-react";
import { PhotoCapture } from "./photo-capture";
import { ErrorNotice, PageHeading } from "./ui";
import { CATALOG, conditionLabels } from "@/lib/catalog";
import { db, DEFAULT_AI, uid, saveWatch } from "@/lib/db";
import {
  createAIProvider,
  extractListingURL,
  messageOf,
} from "@/lib/ai/providers";
import type {
  Photo,
  ListingInput,
  Watch,
  Condition,
  Presence,
} from "@/lib/types";
const stages = [
  "Extraction des indices visuels",
  "Marque · collection · références",
  "Comparaison avec le catalogue",
  "Estimation indépendante · enregistrement",
];
export function AnalyzeWorkspace({ kind }: { kind: "scan" | "listing" }) {
  const isListing = kind === "listing";
  const router = useRouter();
  const settings =
    useLiveQuery(() => db.aiSettings.get("main"), []) ?? DEFAULT_AI;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [catalogId, setCatalogId] = useState("");
  const [context, setContext] = useState("");
  const [input, setInput] = useState<ListingInput>({
    title: "",
    text: "",
    url: "",
    condition: "unknown",
    box: "unknown",
    papers: "unknown",
    service: "",
    seller: "",
  });
  const [stage, setStage] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const cancel = useRef<AbortController | null>(null);
  const running = useRef(false);
  const local = settings.provider === "demo";
  useEffect(() => () => cancel.current?.abort(), []);
  const set = <K extends keyof ListingInput>(key: K, value: ListingInput[K]) =>
    setInput((v) => ({ ...v, [key]: value }));
  async function analyze() {
    if (running.current) return;
    setError("");
    setNotice("");
    if (local && !catalogId) {
      setError(
        "Choisissez un modèle dans le catalogue local, ou connectez un service de reconnaissance pour analyser vos photos.",
      );
      return;
    }
    if (!local && !photos.length && !input.text && !context) {
      setError(
        "Ajoutez au moins une photo ou un texte décrivant la montre. Une URL seule ne fournit pas le contenu de l’annonce.",
      );
      return;
    }
    if (
      input.year &&
      (input.year < 1800 || input.year > new Date().getFullYear() + 1)
    ) {
      setError("Renseignez une année plausible.");
      return;
    }
    if (input.url && !/^https?:\/\//i.test(input.url)) {
      setError("L’URL doit commencer par https:// ou http://.");
      return;
    }
    if (
      isListing &&
      !input.text &&
      !input.title &&
      !photos.length &&
      !catalogId
    ) {
      setError("Ajoutez du texte ou des captures de l’annonce.");
      return;
    }
    running.current = true;
    setBusy(true);
    setStage(0);
    const abort = new AbortController();
    cancel.current = abort;
    try {
      const provider = createAIProvider(settings);
      const listing = isListing
        ? await provider.analyzeListing({
            photos,
            listing: input,
            signal: abort.signal,
          })
        : undefined;
      const identification = await provider.analyzeWatch(
        {
          photos,
          context: [
            context,
            listing?.title,
            listing?.text,
            input.text,
            input.title,
          ]
            .filter(Boolean)
            .join("\n"),
          catalogId,
          signal: abort.signal,
        },
        setStage,
      );
      if (abort.signal.aborted) throw new Error("Analyse annulée.");
      setStage(3);
      const best = identification.candidates[0];
      const cat = CATALOG.find((c) => c.id === best?.catalogId);
      const now = Date.now();
      const watch: Watch = {
        ...(cat ?? {
          id: "",
          brand: best?.brand ?? "Non identifiée",
          collection: "À préciser",
          model: best?.model ?? "Modèle inconnu",
          reference: best?.reference ?? "Inconnue",
          variant: "À préciser",
          diameter: 0,
          material: "À préciser",
          dial: "À préciser",
          movement: "À préciser",
          complications: [],
          bracelet: "À préciser",
          period: "À préciser",
          image: "",
        }),
        id: uid(),
        createdAt: now,
        updatedAt: now,
        photoIds: photos.map((p) => p.id),
        identification,
        condition: listing?.condition ?? input.condition,
        box: listing?.box ?? input.box,
        papers: listing?.papers ?? input.papers,
        year: listing?.year ?? input.year,
        favorite: false,
        demo: false,
      };
      await saveWatch(watch, kind, listing, photos);
      router.push(`/watch/?id=${watch.id}`);
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
      setStage(-1);
    } finally {
      running.current = false;
    }
  }
  return (
    <div className="page">
      <PageHeading
        number={isListing ? "02" : "01"}
        title={isListing ? "Lisez entre les lignes." : "Un autre regard."}
        subtitle={
          isListing
            ? "Une annonce, des indices. Comparez le prix demandé et préparez les bonnes questions."
            : "Quelques photos pour identifier votre montre, comprendre ses détails et approcher sa valeur."
        }
        action={
          <Link
            href={isListing ? "/scanner/" : "/annonce/"}
            className="text-button"
          >
            {isListing ? "Scanner une montre" : "Analyser une annonce"}
            <ArrowUpRight size={17} />
          </Link>
        }
      />
      <div className="analyze-layout">
        <div>
          <PhotoCapture
            photos={photos}
            onChange={setPhotos}
            screenshots={isListing}
            disabled={busy}
          />
          {isListing && (
            <section className="form-section">
              <h2>L’annonce, telle qu’elle est.</h2>
              <div className="fields">
                <label className="field wide">
                  <span>URL de l’annonce (facultatif)</span>
                  <div className="input-action">
                    <input
                      type="url"
                      placeholder="https://…"
                      value={input.url}
                      onChange={(e) => set("url", e.target.value)}
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Extraire l’URL"
                      disabled={busy || extracting || !input.url}
                      onClick={async () => {
                        setError("");
                        setExtracting(true);
                        try {
                          const data = await extractListingURL(input.url);
                          setInput((v) => ({ ...v, ...data }));
                        } catch (e) {
                          setNotice(messageOf(e));
                        } finally {
                          setExtracting(false);
                        }
                      }}
                    >
                      <Link2 size={18} />
                    </button>
                  </div>
                  <small className="micro">
                    L’URL est conservée comme source. Ajoutez le texte ou des
                    captures pour l’analyse.
                  </small>
                </label>
                <label className="field wide">
                  <span>Titre</span>
                  <input
                    value={input.title}
                    onChange={(e) => set("title", e.target.value)}
                    placeholder="Omega Seamaster Diver 300M · full set"
                    disabled={busy}
                  />
                </label>
                <label className="field wide">
                  <span>Description de l’annonce</span>
                  <textarea
                    value={input.text}
                    onChange={(e) => set("text", e.target.value)}
                    rows={6}
                    placeholder="Collez ici le texte complet de l’annonce…"
                    disabled={busy}
                  />
                </label>
              </div>
              {notice && <div className="info-box">{notice}</div>}
            </section>
          )}
          <section className="form-section">
            <h2>
              {isListing ? "Ce que vous savez déjà." : "Quelques précisions."}
            </h2>
            <div className="fields">
              {isListing && (
                <label className="field">
                  <span>Prix demandé (€)</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="4 000"
                    value={input.price ?? ""}
                    onChange={(e) =>
                      set(
                        "price",
                        e.target.value
                          ? Math.max(1, Number(e.target.value))
                          : undefined,
                      )
                    }
                    disabled={busy}
                  />
                </label>
              )}
              <label className="field">
                <span>Année approximative</span>
                <input
                  type="number"
                  min="1800"
                  max={new Date().getFullYear() + 1}
                  placeholder="Non renseignée"
                  value={input.year ?? ""}
                  onChange={(e) =>
                    set(
                      "year",
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                  disabled={busy}
                />
              </label>
              <label className="field">
                <span>État déclaré</span>
                <select
                  value={input.condition}
                  onChange={(e) =>
                    set("condition", e.target.value as Condition)
                  }
                  disabled={busy}
                >
                  {Object.entries(conditionLabels).map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              {(["box", "papers"] as const).map((key) => (
                <label className="field" key={key}>
                  <span>{key === "box" ? "Boîte" : "Papiers"}</span>
                  <select
                    value={input[key]}
                    onChange={(e) => set(key, e.target.value as Presence)}
                    disabled={busy}
                  >
                    <option value="unknown">Non renseigné</option>
                    <option value="yes">Présents</option>
                    <option value="no">Absents</option>
                  </select>
                </label>
              ))}
              {isListing ? (
                <>
                  <label className="field wide">
                    <span>Entretien déclaré</span>
                    <input
                      value={input.service}
                      onChange={(e) => set("service", e.target.value)}
                      placeholder="Date de révision et justificatif disponible"
                      disabled={busy}
                    />
                  </label>
                  <label className="field wide">
                    <span>Informations vendeur</span>
                    <textarea
                      value={input.seller}
                      onChange={(e) => set("seller", e.target.value)}
                      placeholder="Professionnel ou particulier, avis, localisation…"
                      disabled={busy}
                    />
                  </label>
                </>
              ) : (
                <label className="field wide">
                  <span>Indices, inscriptions ou contexte (facultatif)</span>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Ce qui est écrit sur le cadran, la référence au dos…"
                    disabled={busy}
                  />
                </label>
              )}
            </div>
          </section>
        </div>
        <aside className="analysis-side">
          <div className="section-label">
            VOTRE MÉTHODE <span>01—04</span>
          </div>
          <div className="provider-status">
            <span className="pill">
              {local ? "MODE LOCAL" : "SERVICE CONNECTÉ"}
            </span>
            <Link className="text-button" href="/parametres/">
              Configurer
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <h2>
            {local ? (
              <>
                Votre œil.
                <br />
                <em>Notre catalogue.</em>
              </>
            ) : (
              <>
                Des indices.
                <br />
                <em>Une identification.</em>
              </>
            )}
          </h2>
          <p>
            {local
              ? "Sans clé API, sélectionnez une référence. Vos photos sont conservées, la valeur est calculée à partir du catalogue de démonstration."
              : "Les photos sélectionnées et les informations saisies seront analysées par le service que vous avez configuré."}
          </p>
          {local && (
            <label className="field">
              <span>Référence à identifier manuellement</span>
              <select
                value={catalogId}
                onChange={(e) => setCatalogId(e.target.value)}
                disabled={busy}
              >
                <option value="">Choisir une montre…</option>
                {CATALOG.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.brand} · {c.model} · {c.reference}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ol className="pipeline-list">
            {stages.map((s, i) => (
              <li
                key={s}
                className={stage === i ? "active" : stage > i ? "complete" : ""}
              >
                <span>0{i + 1}</span>
                {s}
                {busy && stage === i ? (
                  <LoaderCircle size={14} className="spin" />
                ) : (
                  <ChevronRight size={13} />
                )}
              </li>
            ))}
          </ol>
          <ErrorNotice message={error} />
          {busy ? (
            <div className="analysis-progress" role="status" aria-live="polite">
              <motion.div
                className="scan-beam"
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <ScanLine size={25} />
              <p>{stages[stage]}</p>
              <button
                type="button"
                className="text-button"
                onClick={() => cancel.current?.abort()}
              >
                <X size={14} />
                Annuler
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="button crimson full"
              onClick={() => void analyze()}
            >
              <ScanLine size={18} />
              {local
                ? "Créer la fiche"
                : isListing
                  ? "Analyser cette annonce"
                  : "Lancer l’analyse"}
              <ArrowUpRight size={17} />
            </button>
          )}
          <div className="privacy-note">
            <ShieldCheck size={16} />
            <span>
              Photos compressées et dossier enregistrés sur votre appareil.
              Aucune authentification d’une montre à distance.
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
