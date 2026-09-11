# CADRAN

Application horlogère personnelle, mobile-first, sans compte et sans base de données serveur. Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4, Motion, Lucide et IndexedDB/Dexie.

## Lancer

Node.js 22 recommandé.

```sh
npm install
npm run dev
```

Développement : http://localhost:3000.

```sh
npm run typecheck
npm run build
npm start
```

Version de production installable : http://localhost:3001. `npm start` sert l’export statique du dossier `out/`, sans backend métier. `PORT` peut modifier le port. Les deux ports correspondent à deux origines : leur IndexedDB est distincte. Utilisez l’export/import pour transférer une collection.

Les fichiers de `out/` peuvent être servis par un hébergeur statique HTTPS. Conserver les répertoires et les fichiers `.txt` de Next.js, servir `/route/` avec `/route/index.html`, le manifeste avec son type MIME, et `/sw.js` sans cache immuable. HTTPS est nécessaire sur mobile pour la caméra et l’installation ; une simple adresse IP HTTP du PC n’offre pas ces garanties. Le service worker est activé uniquement en production.

## Prise en main

1. Depuis l’accueil, **Explorer la démo** ajoute cinq références et une collection fictive. Elles restent marquées DÉMO et peuvent être supprimées dans l’historique.
2. Le **Scanner** guide cadran, dos, bracelet/boucle et papiers. Chaque vue est facultative. Il propose une caméra avec aperçu, le capture natif du téléphone et l’import multiple. Limite : huit photos, JPEG compressé à 1 600 pixels maximum.
3. Sans API, choisir une référence dans le catalogue permet de créer une fiche manuelle. Il n’y a **aucune reconnaissance visuelle simulée**.
4. Pour une vraie analyse multimodale, configurer un moteur dans **Paramètres → Intelligence**, enregistrer et tester la connexion. Les photos et textes choisis sont envoyés directement au fournisseur, puis les résultats sont stockés localement.
5. Une fiche peut être corrigée, enrichie de photos, ajoutée aux favoris et à la collection. Saisir achat, notes, numéro de série, entretien et seuil de prix. Une annonce de vente peut être rédigée et copiée depuis une pièce de collection.
6. **Analyser une annonce** accepte captures, texte, URL et informations déclarées. Les URL seules ne sont pas aspirées : sans extracteur compatible, l’interface demande texte ou captures et conserve la source.
7. **Paramètres → Données** permet export JSON autonome avec les photos en base64, import validé et suppression. Les clés API sont exclues par défaut de l’export. La restauration remplace les données atomiquement ; une sauvegarde sans secrets conserve les clés actuelles. Limite d’import : 150 Mo.

## Architecture

```text
src/app/                    App Router : accueil, scanner, annonce,
                            watch/?id=…, collection, historique, paramètres
src/components/             Navigation, capture caméra, analyse, fiche et UI
src/lib/brand.ts             Nom, slogan et métadonnées modifiables
src/lib/types.ts             Modèle métier strict
src/lib/db.ts                Dexie, transactions, démo, historique, seuils
src/lib/catalog.ts           Références et comparables FICTIFS, clairement séparés
src/lib/market.ts            MarketDataProvider, estimation, Deal Score
src/lib/ai/providers.ts      AIProvider + Gemini, OpenAI, Anthropic, compatible,
                            mode manuel et LocalBridgeProvider
src/lib/ai/schema.ts         Validation Zod des réponses IA
src/lib/photos.ts            Compression et conversion locale
src/lib/backup.ts            Sauvegarde et validation de l’intégrité des imports
src/lib/collection.ts        Agrégation des valeurs et du suivi local
scripts/build-sw.mjs         Précache des pages, RSC, polices et assets de production
scripts/serve.mjs            Serveur de prévisualisation statique
bridge/                     Service Node localhost optionnel + contrat documenté
public/images/sources.json  Provenance des photographies de référence
```

Tables IndexedDB : `watches`, `scans`, `listings`, `collection`, `priceSnapshots`, `aiSettings`, `preferences`, `photos`. Les images utilisateur sont des Blobs, jamais des URLs externes. L’export embarque les fichiers nécessaires dans son JSON. Les images du catalogue, polices et icônes sont livrées avec l’application et mises en cache pour le mode hors ligne.

## Identification et modèles

`AIProvider` expose `analyzeWatch`, `analyzeListing`, `generateListing`, `testConnection`. Le protocole d’identification fait deux requêtes :

1. Extraction structurée des inscriptions et des zones visibles, manquantes ou incertaines. Le contexte vendeur reste une déclaration, pas une preuve.
2. Marque → collection → modèles → références → comparaison au catalogue → candidats ordonnés, raisons et confiance indicative. Aucun rapprochement forcé lorsqu’une référence est hors catalogue. Les réponses sont validées avec Zod et les liens catalogue contrôlés localement.

Les confiances sont des indications du moteur, **pas des probabilités calibrées**. Une correction manuelle a une confiance non mesurée. Le mode manuel ne produit pas de constat visuel ni de certificat d’authenticité. Le Deal Score est un score d’analyse d’annonce ; il n’est jamais un score d’authenticité.

Les appels cloud sont directs depuis le navigateur ; les clés restent dans IndexedDB sans chiffrement applicatif. Aucun secret n’est inclus dans le code. Le fournisseur doit autoriser CORS, accepter le modèle et disposer de crédits. Les endpoints doivent être HTTPS, sauf localhost pour un service local. Timeout, erreur de clé, quota, réponse invalide et annulation sont gérés. La compatibilité réelle avec les comptes de l’utilisateur se vérifie via le bouton de connexion ; aucune clé n’est fournie avec le projet.

Le fournisseur Anthropic utilise son API Messages et son en-tête d’accès navigateur explicite. Les endpoints compatibles utilisent `/chat/completions` et le format JSON. Les modèles par défaut sont modifiables ; leur disponibilité dépend du compte et peut évoluer. Le bridge accepte uniquement localhost et ne simule aucune intégration Codex CLI / Claude Code : voir [bridge/README.md](bridge/README.md).

Références API utilisées : [Gemini GenerateContent](https://ai.google.dev/api/generate-content), [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create), [PWA avec Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps).

## Estimation et Deal Score

`MarketDataProvider.getComparables(reference)` constitue la frontière d’intégration des sources futures. `LocalDemoMarketProvider` retourne cinq comparables fictifs par référence, en EUR et datés. Il ne récupère aucun cours en direct. Aucune valeur de marché n’est demandée au LLM.

Le moteur calcule une médiane des comparables et des ajustements documentés : excellent état +3,5 %, état correct −6 %, usure importante −15 %, boîte absente −2 %, papiers absents −6 %. Les exemples ont comme base une pièce en bon état avec boîte et papiers ; il n’y a pas de bonus full set compté deux fois. Les montants sont arrondis à 25 €. Les informations inconnues élargissent la fourchette. Année et configuration restent sans coefficient arbitraire en l’absence de comparables spécifiques. Aucune donnée → aucune estimation chiffrée.

Poids du Deal Score : prix 35 %, état 15 %, complétude 10 %, confiance 20 %, cohérence 10 %, risques 10 %. Le sous-score prix est `clamp(70 + (médiane − prix demandé) / médiane × 150)`. Les autres grilles et pénalités sont lisibles dans `src/lib/market.ts`. Un prix absent, une référence peu sûre, plusieurs incohérences, des anomalies ou un prix anormalement bas imposent une conclusion prudente.

Le total de collection utilise les dernières estimations enregistrées. L’évolution par rapport aux achats n’utilise que les pièces possédant à la fois un prix d’achat et une estimation. La courbe représente l’historique agrégé des pièces ; elle ne prétend pas représenter un indice de marché ni une performance indépendante des ajouts.

Les alertes sont évaluées à l’ouverture, au retour dans l’onglet et à l’actualisation. Elles restent internes à l’application. Il n’y a pas de push serveur, de surveillance permanente ou de mise à jour fictive des cours.

## Design et fonctionnement

Ivoire, presque noir, cramoisi et gris ; Cormorant Garamond et DM Sans hébergées localement ; navigation basse sur mobile, rail compact sur tablette et sidebar sur desktop. Animations Motion et CSS avec respect de `prefers-reduced-motion`. Camera et formulaires tactiles, états vides, accès hors ligne, erreurs explicites, choix manuel des candidats, dialogues natifs avec confirmation des suppressions.

La référence [MARROW](https://www.behance.net/gallery/252499953/MARROW-Brand-Case-Study-Clothing-and-Fashion-Brand) a guidé le langage graphique ; aucun logo ni asset de ce projet n’est copié. Les photographies de catalogue sont documentées dans `public/images/sources.json` ; les visuels de marque servent d’illustrations de référence. Vérifier les droits nécessaires avant une exploitation publique ou commerciale.

## Vérification

Le projet ne contient aucune suite de tests automatisés, conformément au brief. `npm run typecheck` vérifie le TypeScript strict ; `npm run build` compile et exporte toutes les routes puis génère le service worker. Les scripts de build et de service statique ne sont pas des tests.

Les parcours caméra, installation PWA, effacement des données du navigateur, autorisations réseau local et APIs personnelles restent à valider sur les appareils et comptes cibles. Ils ne sont pas déclarés testés physiquement par la seule compilation.

Un outil de lecture WebMCP est enregistré seulement si le navigateur supporte cette API expérimentale. Il recherche les identifiants, marques, modèles et références locaux, sans exposer photos, notes, numéros de série ni paramètres API. Son absence n’affecte aucun parcours utilisateur.
