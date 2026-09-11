"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, MotionConfig } from "motion/react";
import {
  Aperture,
  ArrowUpRight,
  ScanLine,
  LayoutGrid,
  History,
  Settings2,
  Watch,
  WifiOff,
  Download,
  X,
  Bell,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { db, initialize, refreshPrices } from "@/lib/db";
import { registerLocalCatalogTool } from "@/lib/webmcp";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
const nav = [
  { href: "/", label: "Accueil", icon: LayoutGrid },
  { href: "/scanner/", label: "Scanner", icon: ScanLine },
  { href: "/collection/", label: "Collection", icon: Watch },
  { href: "/historique/", label: "Historique", icon: History },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [online, setOnline] = useState(true);
  const [install, setInstall] = useState<InstallEvent>();
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const alerts = useLiveQuery(
    () => db.collection.filter((x) => !!x.alertTriggeredAt).toArray(),
    [],
  );
  useEffect(() => {
    const unregister = registerLocalCatalogTool();
    initialize()
      .then(() => {
        setReady(true);
        return refreshPrices();
      })
      .catch(() =>
        setError(
          "Le stockage local est indisponible. Autorisez le stockage du site puis rechargez la page.",
        ),
      );
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    const onInstall = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    const update = () => {
      if (document.visibilityState === "visible")
        refreshPrices().catch(() => {});
    };
    document.addEventListener("visibilitychange", update);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker
        .register("/sw.js")
        .catch(() =>
          setNotice(
            "Le mode hors ligne n’a pas pu être activé. Rechargez une fois en ligne.",
          ),
        );
    return () => {
      unregister();
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("beforeinstallprompt", onInstall);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <Aperture size={29} strokeWidth={1.1} />
          {BRAND.name}
          <span>®</span>
        </Link>
        <div className="sidebar-caption">LE TEMPS A DE LA VALEUR.</div>
        <nav aria-label="Navigation principale">
          {nav.map((n, i) => (
            <Link
              key={n.href}
              href={n.href}
              className={`nav-item ${path === n.href ? "active" : ""}`}
              aria-current={path === n.href ? "page" : undefined}
            >
              <n.icon size={19} strokeWidth={1.5} />
              <span>{n.label}</span>
              <small>0{i + 1}</small>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-mark">
            <span />
            VOTRE COLLECTION. VOS DONNÉES.
          </div>
          <p>
            Sur votre appareil.
            <br />À votre rythme.
          </p>
          {install && (
            <button
              className="text-button"
              onClick={async () => {
                await install.prompt();
                setInstall(undefined);
              }}
            >
              <Download size={16} /> Installer l’application
            </button>
          )}
          <Link href="/parametres/" className="nav-item">
            <Settings2 size={18} />
            Paramètres
            <ArrowUpRight size={16} />
          </Link>
          <div className="edition">
            ATELIER NUMÉRIQUE <span>ÉD. 001</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <Link href="/" className="mobile-brand">
            {BRAND.name}
            <span>®</span>
          </Link>
          <div className="breadcrumb">
            ESPACE PERSONNEL <span>/</span>{" "}
            {path === "/watch/"
              ? "ANALYSE"
              : path === "/annonce/"
                ? "ANNONCE"
                : path === "/parametres/"
                  ? "PARAMÈTRES"
                  : (nav.find((n) => n.href === path)?.label.toUpperCase() ??
                    "CADRAN")}
          </div>
          <div className="topbar-right">
            <span className="device-status">
              <span className={online ? "status-dot" : "status-dot offline"} />
              {online ? "DONNÉES LOCALES" : "HORS LIGNE"}
            </span>
            <Link
              className="icon-button"
              href="/collection/"
              aria-label={`${alerts?.length ?? 0} alertes de prix`}
            >
              <Bell size={18} />
              {!!alerts?.length && (
                <i className="notification-count">{alerts.length}</i>
              )}
            </Link>
            <Link
              className="icon-button"
              href="/parametres/"
              aria-label="Paramètres"
            >
              <Settings2 size={19} />
            </Link>
          </div>
        </header>
        {!online && (
          <div className="offline-banner">
            <WifiOff size={15} /> Hors ligne · votre collection et le catalogue
            local restent accessibles.
          </div>
        )}
        {notice && (
          <div className="notice">
            {notice}
            <button aria-label="Fermer" onClick={() => setNotice("")}>
              <X size={16} />
            </button>
          </div>
        )}
        <main id="main">
          {error ? (
            <div className="empty-state">
              <h1>Un accès à rétablir.</h1>
              <p role="alert">{error}</p>
              <button className="button" onClick={() => location.reload()}>
                Réessayer
              </button>
            </div>
          ) : !ready ? (
            <div className="loading-state">
              <Aperture className="spin" />
              <p>Ouverture de votre atelier…</p>
            </div>
          ) : (
            <motion.div
              key={path}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          )}
        </main>
        <footer className="site-footer">
          <span>
            {BRAND.name} — {BRAND.tagline}
          </span>
          <span>La précision commence par le regard.</span>
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="Navigation mobile">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={path === n.href ? "active" : ""}
            aria-current={path === n.href ? "page" : undefined}
          >
            <n.icon size={21} strokeWidth={1.6} />
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>
    </MotionConfig>
  );
}
