"use client";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Check,
  ArrowUpRight,
  KeyRound,
  Download,
  Upload,
  Trash2,
  Database,
  Monitor,
  Cloud,
  Eye,
  EyeOff,
  Cable,
  LoaderCircle,
  Shield,
  X,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { db, DEFAULT_AI, seedDemo } from "@/lib/db";
import {
  createAIProvider,
  validateEndpoint,
  messageOf,
} from "@/lib/ai/providers";
import {
  exportBackup,
  importBackup,
  readBackup,
  deleteAllData,
  storageUsage,
  type Backup,
} from "@/lib/backup";
import { ErrorNotice, PageHeading } from "@/components/ui";
import type { AISettings, ProviderId } from "@/lib/types";
const providers: {
  id: ProviderId;
  label: string;
  model: string;
  endpoint: string;
}[] = [
  { id: "demo", label: "Local · manuel", model: "", endpoint: "" },
  {
    id: "gemini",
    label: "Google Gemini",
    model: "gemini-2.5-flash",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
  },
  {
    id: "openai",
    label: "OpenAI",
    model: "gpt-4.1-mini",
    endpoint: "https://api.openai.com/v1",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    model: "claude-sonnet-4-6",
    endpoint: "https://api.anthropic.com/v1",
  },
  { id: "custom", label: "API compatible OpenAI", model: "", endpoint: "" },
  {
    id: "bridge",
    label: "Agent local desktop",
    model: "local-agent",
    endpoint: "http://127.0.0.1:4318/v1",
  },
];
const bytes = (n: number) =>
  `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
export default function Settings() {
  const settings = useLiveQuery(() => db.aiSettings.get("main"), []);
  const prefs = useLiveQuery(() => db.preferences.get("main"), []);
  const [draft, setDraft] = useState<AISettings>(DEFAULT_AI);
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [storage, setStorage] = useState({
    usage: 0,
    quota: 0,
    photos: 0,
    persistent: false,
  });
  const [pending, setPending] = useState<Backup>();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const lastLoaded = useRef("");
  useEffect(() => {
    if (settings) {
      const s = JSON.stringify(settings);
      if (s !== lastLoaded.current) {
        setDraft(settings);
        lastLoaded.current = s;
      }
    }
  }, [settings]);
  useEffect(() => {
    storageUsage()
      .then(setStorage)
      .catch(() => {});
  }, []);
  async function action(
    name: string,
    fn: () => Promise<unknown>,
    success: string,
  ) {
    setBusy(name);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(success);
      setStorage(await storageUsage());
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy("");
    }
  }
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(settings ?? DEFAULT_AI);
  return (
    <div className="page settings-page">
      <PageHeading
        number="05"
        title="À votre mesure."
        subtitle="Votre lecture, vos connexions, vos données. Un atelier qui vous ressemble."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Sections des paramètres">
          <a href="#lecture">
            01 <span>Lecture</span>
          </a>
          <a href="#intelligence">
            02 <span>Connexions</span>
          </a>
          <a href="#donnees">
            03 <span>Données</span>
          </a>
          <a href="#installation">
            04 <span>Installation</span>
          </a>
          <a href="#apropos">
            05 <span>À propos</span>
          </a>
        </nav>
        <div className="settings-content">
          <ErrorNotice message={error} />
          {message && (
            <div className="success-note" role="status">
              <Check size={15} />
              {message}
            </div>
          )}
          <section id="lecture" className="settings-section">
            <div className="section-label">01 / VOTRE LECTURE</div>
            <h2>Le bon niveau de détail.</h2>
            <div className="mode-options">
              {(["simple", "expert"] as const).map((mode) => (
                <button
                  key={mode}
                  aria-pressed={prefs?.mode === mode}
                  className={prefs?.mode === mode ? "selected" : ""}
                  onClick={() =>
                    void action(
                      "mode",
                      () => db.preferences.update("main", { mode }),
                      "Mode de lecture enregistré.",
                    )
                  }
                >
                  <span className="mode-radio">
                    {prefs?.mode === mode && <span />}
                  </span>
                  <span>
                    <strong>Mode {mode}</strong>
                    <small>
                      {mode === "simple"
                        ? "L’essentiel : modèle, valeur et recommandation."
                        : "Toutes les données, références, variantes et facteurs."}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </section>
          <section id="intelligence" className="settings-section">
            <div className="section-label">
              02 / CONNEXIONS
              <Cable size={15} />
            </div>
            <h2>Connectez votre service d’analyse.</h2>
            <p>
              Le catalogue, les estimations de démonstration et la collection
              fonctionnent sans service externe. Pour reconnaître vos photos,
              connectez le fournisseur de votre choix.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action(
                  "save",
                  async () => {
                    validateEndpoint(draft);
                    if (draft.provider !== "demo" && !draft.model.trim())
                      throw new Error("Renseignez un modèle.");
                    await db.aiSettings.put(draft);
                  },
                  "Configuration enregistrée sur cet appareil.",
                );
              }}
            >
              <div className="fields">
                <label className="field wide">
                  <span>Fournisseur</span>
                  <select
                    value={draft.provider}
                    onChange={(e) => {
                      const p = providers.find((p) => p.id === e.target.value)!;
                      setDraft({
                        ...DEFAULT_AI,
                        provider: p.id,
                        model: p.model,
                        endpoint: p.endpoint,
                      });
                    }}
                  >
                    {providers.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                {draft.provider !== "demo" && (
                  <>
                    <label className="field wide">
                      <span>Modèle</span>
                      <input
                        value={draft.model}
                        required
                        placeholder="Identifiant exact du modèle"
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, model: e.target.value }))
                        }
                      />
                      <small className="micro">
                        Modifiable selon les modèles disponibles sur votre
                        compte. Le modèle doit accepter des images.
                      </small>
                    </label>
                    <label className="field wide">
                      <span>
                        Clé API{" "}
                        {["custom", "bridge"].includes(draft.provider)
                          ? "(facultative)"
                          : ""}
                      </span>
                      <div className="input-action">
                        <input
                          type={showKey ? "text" : "password"}
                          autoComplete="off"
                          spellCheck={false}
                          value={draft.apiKey}
                          placeholder="Votre clé personnelle"
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, apiKey: e.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={
                            showKey ? "Masquer la clé" : "Afficher la clé"
                          }
                          onClick={() => setShowKey(!showKey)}
                        >
                          {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </label>
                    <label className="field wide">
                      <span>URL de base de l’endpoint</span>
                      <input
                        type="url"
                        value={draft.endpoint}
                        required
                        placeholder="https://votre-endpoint.example/v1"
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, endpoint: e.target.value }))
                        }
                      />
                      <small className="micro">
                        Renseignez l’URL de base, sans « /chat/completions ».
                        Les endpoints personnalisés doivent autoriser les
                        requêtes CORS depuis cette application.
                      </small>
                    </label>
                  </>
                )}
              </div>
              {draft.provider === "bridge" ? (
                <div className="bridge-info info-box mt-5">
                  <Monitor size={22} />
                  <div>
                    <strong>Agent local desktop · adaptateur optionnel</strong>
                    <p>
                      La PWA attend un service compatible OpenAI sur localhost.
                      Codex CLI et Claude Code ne sont pas des API cloud. Un
                      bridge doit être configuré et démarré séparément sur votre
                      ordinateur.
                    </p>
                    <p>
                      Sur téléphone, localhost désigne le téléphone. Ce mode ne
                      peut donc pas accéder directement au bridge de votre
                      ordinateur.
                    </p>
                    <code>PWA ↔ localhost:4318 ↔ agent local</code>
                  </div>
                </div>
              ) : (
                draft.provider !== "demo" && (
                  <div className="info-box mt-5">
                    <Cloud size={18} />
                    <p>
                      <strong>Envoi direct au service choisi.</strong> Les
                      images et le texte de chaque analyse sont transmis à cette
                      API. La collection complète n’est pas envoyée. La clé est
                      stockée dans IndexedDB, sans chiffrement applicatif. Elle
                      n’est jamais intégrée au code ni enregistrée sur un
                      serveur CADRAN.
                    </p>
                  </div>
                )
              )}
              <div className="action-row">
                <button className="button" disabled={!!busy}>
                  <Check size={16} />
                  Enregistrer{dirty ? " *" : ""}
                </button>
                <button
                  type="button"
                  className="button outline"
                  disabled={!!busy}
                  onClick={() =>
                    void action(
                      "test",
                      async () => {
                        const result =
                          await createAIProvider(draft).testConnection();
                        setMessage(result);
                      },
                      `Connexion réussie · ${draft.model || "mode local"}`,
                    )
                  }
                >
                  {busy === "test" ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <KeyRound size={16} />
                  )}
                  Tester la connexion
                </button>
              </div>
              {draft.provider !== "demo" && (
                <p className="micro mt-3">
                  Le test effectue une petite requête au modèle et peut être
                  facturé par votre fournisseur.
                </p>
              )}
            </form>
          </section>
          <section id="donnees" className="settings-section">
            <div className="section-label">
              03 / VOS DONNÉES
              <Database size={16} />
            </div>
            <h2>Tout est ici. Et à vous.</h2>
            <div className="storage-meter">
              <div>
                <span>Stockage de cette origine</span>
                <strong>{bytes(storage.usage)}</strong>
              </div>
              <div className="storage-track">
                <i
                  style={{
                    width: `${storage.quota ? Math.max(1, (storage.usage / storage.quota) * 100) : 0}%`,
                  }}
                />
              </div>
              <p>
                {bytes(storage.photos)} de photos ·{" "}
                {storage.quota
                  ? `${bytes(storage.quota)} de quota disponible pour l’origine`
                  : "Quota non communiqué par le navigateur"}
              </p>
            </div>
            <p className="micro">
              Le stockage peut être effacé par votre navigateur ou lors du
              nettoyage de l’appareil. Exportez régulièrement votre collection.
            </p>
            <button
              className="text-button"
              disabled={!!busy || storage.persistent}
              onClick={() =>
                void action(
                  "persist",
                  async () => {
                    const granted = await navigator.storage?.persist?.();
                    if (!granted)
                      throw new Error(
                        "Le navigateur n’a pas accordé le stockage persistant. Vos données restent locales : exportez une sauvegarde.",
                      );
                  },
                  "Stockage persistant accordé par le navigateur.",
                )
              }
            >
              <Shield size={15} />
              {storage.persistent
                ? "Stockage persistant activé"
                : "Demander le stockage persistant"}
            </button>
            <div className="data-action">
              <div>
                <h3>Exporter mes données</h3>
                <p>
                  Un fichier JSON autonome avec la collection, les analyses, les
                  paramètres et toutes les photos compressées.
                </p>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeSecrets}
                    onChange={(e) => setIncludeSecrets(e.target.checked)}
                  />
                  Inclure aussi les clés API dans le fichier (en clair)
                </label>
              </div>
              <button
                className="button outline"
                disabled={!!busy}
                onClick={() =>
                  void action(
                    "export",
                    () => exportBackup(includeSecrets),
                    "Sauvegarde préparée. Conservez le fichier téléchargé en lieu sûr.",
                  )
                }
              >
                <Download size={17} />
                Exporter
              </button>
            </div>
            <div className="data-action">
              <div>
                <h3>Importer mes données</h3>
                <p>
                  Restaurez une sauvegarde CADRAN. Le contenu est validé avant
                  de remplacer les données actuelles. Les clés sont conservées
                  sauf si la sauvegarde en contient.
                </p>
              </div>
              <input
                ref={importInput}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await action(
                    "read",
                    async () => {
                      const data = await readBackup(file);
                      setPending(data);
                      setDeleting(false);
                      setConfirmText("");
                      dialog.current?.showModal();
                    },
                    "Sauvegarde vérifiée. Confirmez la restauration.",
                  );
                  e.target.value = "";
                }}
              />
              <button
                className="button outline"
                disabled={!!busy}
                onClick={() => importInput.current?.click()}
              >
                <Upload size={17} />
                Importer
              </button>
            </div>
            <div className="data-action">
              <div>
                <h3>Explorer la démonstration</h3>
                <p>
                  Cinq montres, des historiques fictifs et une collection
                  exemple. Vos pièces actuelles sont conservées.
                </p>
              </div>
              <button
                className="text-button"
                disabled={!!busy}
                onClick={() =>
                  void action(
                    "demo",
                    () => seedDemo(),
                    "Démonstration ajoutée. Retrouvez les pièces dans l’historique.",
                  )
                }
              >
                <ArrowUpRight size={17} />
                Charger
              </button>
            </div>
            <div className="data-action destructive">
              <div>
                <h3>Supprimer toutes les données</h3>
                <p>
                  Efface les montres, photos, historiques et clés API de cet
                  appareil.
                </p>
              </div>
              <button
                className="text-button"
                disabled={!!busy}
                onClick={() => {
                  setPending(undefined);
                  setDeleting(true);
                  setConfirmText("");
                  dialog.current?.showModal();
                }}
              >
                <Trash2 size={16} />
                Tout supprimer
              </button>
            </div>
          </section>
          <section id="installation" className="settings-section">
            <div className="section-label">04 / TOUJOURS À PORTÉE DE MAIN</div>
            <h2>Votre atelier, dans votre poche.</h2>
            <p>
              Sur Android ou desktop, utilisez « Installer l’application » dans
              le menu du navigateur ou dans la navigation de CADRAN lorsque
              l’installation est disponible.
            </p>
            <p>
              Sur iPhone et iPad : ouvrez dans Safari, touchez Partager puis «
              Sur l’écran d’accueil ».
            </p>
            <div className="info-box">
              L’installation et la caméra nécessitent une connexion HTTPS, ou
              localhost sur votre ordinateur. Après un premier chargement en
              ligne de la version de production, le catalogue et les dossiers
              sont disponibles hors ligne. Les analyses cloud demandent une
              connexion.
            </div>
          </section>
          <section id="apropos" className="settings-section">
            <div className="section-label">05 / {BRAND.name} · ÉDITION 001</div>
            <h2>{BRAND.tagline}</h2>
            <p>
              Un outil personnel de lecture horlogère. Les comparables fournis
              sont des exemples fictifs, séparés de l’interface des futurs
              fournisseurs de marché. Les scores et estimations restent
              indicatifs.
            </p>
            <details>
              <summary>Photographies et crédits</summary>
              <p className="mt-4">
                Photographie d’accueil : Tony Litvyak,{" "}
                <a
                  href="https://unsplash.com/photos/ScLkumSYzQs"
                  target="_blank"
                  rel="noreferrer"
                >
                  Unsplash
                </a>
                . Photographies de référence : Rolex, Omega / Hvelplund, Cartier
                / Jewels by Love, Tudor / Montres & Bijoux et TAG Heuer. Marques
                et visuels appartiennent à leurs titulaires ; aucune
                affiliation.
              </p>
              <a
                href="/images/sources.json"
                className="text-button"
                target="_blank"
                rel="noreferrer"
              >
                Sources détaillées des images
                <ArrowUpRight size={14} />
              </a>
            </details>
          </section>
        </div>
      </div>
      <dialog
        ref={dialog}
        className="content-dialog"
        onCancel={() => {
          setPending(undefined);
          setDeleting(false);
        }}
      >
        <div className="dialog-header">
          <span className="eyebrow">VOS DONNÉES LOCALES</span>
          <button
            className="icon-button"
            aria-label="Fermer"
            onClick={() => dialog.current?.close()}
          >
            <X />
          </button>
        </div>
        <h2>{deleting ? "Repartir de zéro." : "Restaurer votre atelier."}</h2>
        <p className="section-description">
          {deleting
            ? "Toutes les données locales, photos et clés API seront effacées. Exportez une sauvegarde avant de continuer."
            : `${pending?.watches.length ?? 0} montres et ${pending?.photos.length ?? 0} photos remplaceront les données actuelles. ${pending?.includesSecrets ? "Cette sauvegarde inclut des clés API." : "Vos clés API actuelles seront conservées."}`}
        </p>
        <ErrorNotice message={error} />
        <label className="field mt-5">
          <span>
            Tapez {deleting ? "SUPPRIMER" : "IMPORTER"} pour confirmer
          </span>
          <input
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </label>
        <div className="action-row">
          <button
            className="button danger"
            disabled={
              !!busy || confirmText !== (deleting ? "SUPPRIMER" : "IMPORTER")
            }
            onClick={() =>
              void action(
                "restore",
                async () => {
                  if (deleting) {
                    await deleteAllData();
                    setDraft(DEFAULT_AI);
                  } else if (pending) await importBackup(pending);
                  dialog.current?.close();
                  setPending(undefined);
                },
                deleting
                  ? "Toutes les données ont été supprimées."
                  : "Sauvegarde restaurée avec ses photos.",
              )
            }
          >
            {busy === "restore"
              ? "Traitement…"
              : deleting
                ? "Supprimer définitivement"
                : "Restaurer la sauvegarde"}
          </button>
          <button
            className="text-button"
            onClick={() => dialog.current?.close()}
          >
            Annuler
          </button>
        </div>
      </dialog>
    </div>
  );
}
