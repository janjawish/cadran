"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowUpRight,
  ScanLine,
  ArrowRight,
  Plus,
  MoveUpRight,
  X,
} from "lucide-react";
import { db, seedDemo } from "@/lib/db";
import { money } from "@/lib/catalog";
import { collectionMetrics, collectionTimeline } from "@/lib/collection";
import { WatchCard, Sparkline, ErrorNotice } from "@/components/ui";
export default function Home() {
  const watches =
    useLiveQuery(
      () => db.watches.orderBy("createdAt").reverse().toArray(),
      [],
    ) ?? [];
  const collection = useLiveQuery(() => db.collection.toArray(), []) ?? [];
  const snapshots =
    useLiveQuery(() => db.priceSnapshots.orderBy("at").toArray(), []) ?? [];
  const prefs = useLiveQuery(() => db.preferences.get("main"), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { latest, value, invested, change, unpriced } = collectionMetrics(
    collection,
    snapshots,
    watches,
  );
  return (
    <div className="home-page">
      <section className="editorial-hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="tiny-cross">+</span> LE REGARD JUSTE, SUR CHAQUE
            MONTRE.
          </div>
          <h1>
            Identifiez.
            <br />
            Analysez.
            <br />
            <em>Estimez.</em>
            <span className="hero-period">↗</span>
          </h1>
          <p>
            De la première impression à la juste valeur.
            <br className="desktop-only" /> Révélez ce que votre montre a à vous
            dire.
          </p>
          <div className="hero-actions">
            <Link href="/scanner/" className="button crimson">
              <ScanLine size={19} />
              Scanner une montre
              <ArrowUpRight size={18} />
            </Link>
            <Link href="/annonce/" className="text-button">
              Analyser une annonce
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="hero-bottom">
            <span>01 — OBSERVER. COMPRENDRE. DÉCIDER.</span>
            <span>↓</span>
          </div>
        </div>
        <div className="hero-image">
          <Image
            src="/images/hero.webp"
            alt="Détail d’une montre mécanique, acier et cadran sombre"
            fill
            priority
            sizes="(max-width: 760px) 100vw, 50vw"
          />
          <div className="hero-image-top">
            <span>L’ESSENTIEL EST DANS LE DÉTAIL.</span>
            <span>+ 01</span>
          </div>
          <div className="photo-crosshair" />
          <div className="hero-image-bottom">
            <span>
              LA MÉCANIQUE
              <br />
              <em>du regard.</em>
            </span>
            <div className="coordinate">
              HORLOGERIE
              <br />
              48°51′24″N
              <br />
              02°21′08″E
            </div>
          </div>
        </div>
      </section>
      <section className="home-metrics">
        <div className="metric-primary">
          <div className="eyebrow">
            VOTRE COLLECTION <span>↗</span>
          </div>
          <div className="metric-value">
            {money(value)}
            <small>EUR</small>
          </div>
          <p>
            {collection.length} pièce{collection.length !== 1 ? "s" : ""} dans
            votre écrin{" "}
            {collection.some((c) => c.watchId.startsWith("demo-")) && (
              <span className="demo-inline">DÉMO</span>
            )}
          </p>
        </div>
        <div className="metric-trend">
          <div className="eyebrow">ÉVOLUTION / PRIX D’ACHAT</div>
          <div className="trend-value">
            {change === undefined
              ? "—"
              : `${change >= 0 ? "+" : ""}${change.toFixed(1).replace(".", ",")} %`}{" "}
            {change !== undefined && <MoveUpRight size={23} />}
          </div>
          <p>
            {invested
              ? `${money(invested)} investis${unpriced ? " · prix incomplets" : ""}`
              : "Ajoutez vos prix d’achat"}
          </p>
        </div>
        <div className="metric-chart">
          <Sparkline
            values={collectionTimeline(collection, snapshots, watches).map(
              (p) => p.mid,
            )}
          />
          <span className="micro">
            RELEVÉS LOCAUX{" "}
            {snapshots.some((s) => s.demo) ? "· DÉMONSTRATION" : ""}
          </span>
        </div>
      </section>
      {prefs && !prefs.onboardingDismissed && (
        <section className="welcome-strip">
          <div>
            <span className="eyebrow">VOTRE PREMIÈRE EXPLORATION</span>
            <p>
              {watches.length
                ? "Les exemples restent identifiés « démo ». Créez votre première analyse."
                : "Votre atelier est prêt. Découvrez cinq références, ou commencez avec votre montre."}
            </p>
          </div>
          <button
            className="text-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await seedDemo();
              } catch {
                setError(
                  "Impossible de charger les exemples. Vérifiez le stockage disponible.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Chargement…" : "Explorer la démo"}
            <ArrowRight size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Masquer le message de bienvenue"
            onClick={() =>
              db.preferences.update("main", { onboardingDismissed: true })
            }
          >
            <X size={17} />
          </button>
        </section>
      )}
      <ErrorNotice message={error} />
      <section className="recent-section">
        <div className="section-title">
          <div>
            <span className="eyebrow">02 / VOTRE REGARD S’AFFINE</span>
            <h2>
              Dernières explorations
              <span>({String(watches.length).padStart(2, "0")})</span>
            </h2>
          </div>
          <Link href="/historique/" className="text-button">
            Tout l’historique
            <ArrowUpRight size={18} />
          </Link>
        </div>
        {watches.length ? (
          <div className="watch-grid">
            {watches.slice(0, 4).map((w, i) => (
              <WatchCard key={w.id} watch={w} index={i} value={latest(w.id)} />
            ))}
          </div>
        ) : (
          <div className="first-scan">
            <div>
              <Plus size={30} strokeWidth={1} />
              <h3>
                Chaque collection commence
                <br />
                par une rencontre.
              </h3>
              <p>
                Photographiez une montre ou explorez le catalogue de
                démonstration.
              </p>
            </div>
            <Link className="button outline" href="/scanner/">
              Votre premier scan
              <ArrowUpRight size={18} />
            </Link>
          </div>
        )}
      </section>
      <div className="editorial-note">
        <span>UN OUTIL DE DISCERNEMENT.</span>
        <p>
          L’œil s’éduque.
          <br />
          <em>La passion reste.</em>
        </p>
        <span>
          Les estimations éclairent votre décision.
          <br />
          L’inspection d’un horloger la confirme.
        </span>
      </div>
    </div>
  );
}
