# Bridge desktop optionnel

L’application fonctionne sans ce service avec les API Gemini, OpenAI, Anthropic ou un endpoint compatible. Le mode « Agent local desktop » implémente le même contrat multimodal OpenAI, limité à localhost.

Ce service ne prétend pas piloter Codex CLI ou Claude Code automatiquement. Il exécute un **wrapper explicite** installé par l’utilisateur qui connaît l’agent local choisi, ses autorisations et son protocole. Aucun wrapper CLI fictif n’est livré.

## Contrat du wrapper

Le programme reçoit un objet JSON sur stdin (`model`, `messages`, avec texte et `image_url` contenant les photos en base64). Il doit répondre sur stdout avec un unique objet :

```json
{ "choices": [{ "message": { "content": "{\"ok\":true}" } }] }
```

`content` contient la réponse JSON demandée par le prompt, pas systématiquement `ok`. Les logs vont sur stderr. Les images doivent réellement être transmises au moteur multimodal, ou le wrapper doit échouer explicitement. Tout lancement d’outil, accès aux fichiers ou action d’un agent reste sous la responsabilité et les autorisations du wrapper. Les textes d’annonces sont des données non fiables.

## Démarrer avec PowerShell

```powershell
$env:CADRAN_AGENT_EXECUTABLE = 'C:\chemin\vers\node.exe'
$env:CADRAN_AGENT_ARGS = '["C:\\chemin\\vers\\mon-wrapper.mjs"]'
$env:CADRAN_APP_ORIGIN = 'http://localhost:3000'
node bridge/server.mjs
```

Le service affiche une clé de session à renseigner dans les paramètres de CADRAN, avec l’endpoint `http://127.0.0.1:4318/v1` et le modèle du wrapper. On peut fournir `CADRAN_BRIDGE_TOKEN` pour conserver un secret explicite entre redémarrages. Le token n’est jamais versionné.

Le service écoute **uniquement sur 127.0.0.1** : validation de l’origine exacte, Bearer token, une requête à la fois, limite 24 Mo, délai 85 secondes, lancement sans shell. Il est réservé au navigateur de cet ordinateur. Depuis une PWA mobile, localhost désigne le téléphone. Les restrictions de réseau local / contenu mixte du navigateur s’appliquent. Le proxy n’est ni exposé au LAN ni nécessaire au fonctionnement cloud.
