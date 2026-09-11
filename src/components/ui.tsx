"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowUpRight, Plus, Watch as WatchIcon } from "lucide-react";
import { db } from "@/lib/db";
import { money } from "@/lib/catalog";
import type { Watch, PriceSnapshot } from "@/lib/types";
export function WatchPhoto({
  watch,
  hero = false,
}: {
  watch: Watch;
  hero?: boolean;
}) {
  const photo = useLiveQuery(
    () => (watch.photoIds[0] ? db.photos.get(watch.photoIds[0]) : undefined),
    [watch.photoIds[0]],
  );
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (!photo) {
      setUrl("");
      return;
    }
    const u = URL.createObjectURL(photo.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo, watch.image]);
  return (
    <div className={`watch-photo ${hero ? "large" : ""}`}>
      {!failed && (url || watch.image) ? (
        <Image
          src={url || watch.image}
          alt={`${watch.brand} ${watch.model}`}
          fill
          sizes={
            hero
              ? "(max-width: 760px) 100vw, 50vw"
              : "(max-width: 760px) 50vw, 25vw"
          }
          onError={() => setFailed(true)}
          unoptimized
        />
      ) : (
        <div className="photo-fallback">
          <WatchIcon size={52} strokeWidth={0.7} />
          <span>Photo à ajouter</span>
        </div>
      )}
    </div>
  );
}
export function WatchCard({
  watch,
  value,
  index = 0,
}: {
  watch: Watch;
  value?: number;
  index?: number;
}) {
  return (
    <Link href={`/watch/?id=${watch.id}`} className="watch-card">
      <div className="watch-card-image">
        <WatchPhoto watch={watch} />
        <span className="image-number">0{index + 1}</span>
        {watch.demo && <span className="image-badge">DÉMO</span>}
        <span className="image-arrow">
          <ArrowUpRight size={20} />
        </span>
      </div>
      <div className="watch-card-caption">
        <div className="eyebrow">{watch.brand}</div>
        <h3>{watch.model}</h3>
        <div className="watch-card-meta">
          <span>{watch.reference}</span>
          <strong>{value ? money(value) : "À estimer"}</strong>
        </div>
      </div>
    </Link>
  );
}
export function PageHeading({
  number,
  title,
  subtitle,
  action,
}: {
  number: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{number} / VOTRE ATELIER HORLOGER</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  href = "/scanner/",
  label = "Scanner une montre",
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty-state">
      <WatchIcon size={40} strokeWidth={0.8} />
      <h2>{title}</h2>
      <p>{description}</p>
      <Link href={href} className="button">
        <Plus size={18} />
        {label}
      </Link>
    </div>
  );
}
export function Sparkline({
  values,
  className = "",
}: {
  values: number[];
  className?: string;
}) {
  if (values.length < 2)
    return (
      <span className="muted">Un second relevé dessinera la tendance.</span>
    );
  const min = Math.min(...values) * 0.985,
    max = Math.max(...values) * 1.015;
  const points = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1)) * 400},${92 - ((v - min) / (max - min || 1)) * 74}`,
    )
    .join(" ");
  return (
    <svg
      className={`sparkline ${className}`}
      viewBox="0 0 400 100"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Évolution de ${money(values[0])} à ${money(values.at(-1))}`}
    >
      <path
        d="M0 25H400M0 55H400M0 85H400"
        stroke="currentColor"
        strokeOpacity=".12"
        fill="none"
      />
      <polyline
        points={points}
        stroke="currentColor"
        fill="none"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
export function PriceChart({ snapshots }: { snapshots: PriceSnapshot[] }) {
  const sorted = [...snapshots].sort((a, b) => a.at - b.at);
  return (
    <div className="price-chart">
      <Sparkline values={sorted.map((x) => x.mid)} />
      <div className="chart-axis">
        <span>
          {sorted[0]
            ? new Date(sorted[0].at).toLocaleDateString("fr-FR", {
                month: "short",
                year: "numeric",
              })
            : "Premier relevé"}
        </span>
        <span>
          {sorted.at(-1)
            ? new Date(sorted.at(-1)!.at).toLocaleDateString("fr-FR", {
                month: "short",
                year: "numeric",
              })
            : "Aujourd’hui"}
        </span>
      </div>
      {sorted.some((s) => s.demo) && (
        <p className="micro">
          Courbe de démonstration · valeurs fictives enregistrées localement.
        </p>
      )}
    </div>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <div className="error-notice" role="alert">
      {message}
    </div>
  ) : null;
}
