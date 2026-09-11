import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty-state">
      <span className="eyebrow">404 / HORS DU CADRE</span>
      <h1>Le temps d’un détour.</h1>
      <p>Cette page n’existe pas. Votre atelier vous attend à l’accueil.</p>
      <Link className="button" href="/">
        Retrouver l’accueil
      </Link>
    </div>
  );
}
