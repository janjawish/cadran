"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="empty-state">
      <h1>Un instant suspendu.</h1>
      <p>
        Cette page n’a pas pu s’ouvrir. Vos données locales sont conservées.
        Réessayez ou revenez à l’accueil.
      </p>
      <button className="button" onClick={reset}>
        Réessayer
      </button>
      <a href="/" className="text-button">
        Revenir à l’accueil
      </a>
    </div>
  );
}
