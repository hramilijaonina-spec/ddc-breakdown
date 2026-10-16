# DDC Breakdown

Dépouillement de scénario et plan de travail collaboratifs pour l'équipe DDC.

**App :** https://hramilijaonina-spec.github.io/ddc-breakdown/

- Import PDF, Final Draft (.fdx), Fountain ou texte ; découpage en scènes (INT/EXT, jour/nuit, huitièmes de page) ; retrait automatique des en-têtes et pieds de page répétés.
- Dépouillement par IA (Claude, via clé API Anthropic) dans 13 catégories, correction à la main, commentaires par scène.
- Plan de travail : lieux de tournage, journées en glisser-déposer, plan proposé automatiquement, alertes (journée chargée, déplacements, rôles éclatés).
- Exports : fiches de dépouillement et plan de travail (HTML imprimable, CSV).
- Temps réel pour toute l'équipe, avec connexion Google.

## Installation (une seule fois)

Le projet Firebase utilisé est `shotlist-298e2` (le même que l'app shotlist).

1. **Connexion Google** : console Firebase → Authentication → Méthode de connexion → activer **Google**.
2. **Domaine autorisé** : Authentication → Paramètres → Domaines autorisés → ajouter `hramilijaonina-spec.github.io`.
3. **Application Web** : Paramètres du projet → Vos applications → ajouter une application Web, puis copier `apiKey` et `appId` dans `config.js`.
4. **Règles de la base** : Realtime Database → Règles → coller le contenu de `database.rules.json` → Publier.
   Les chemins `shots` et `notes` de l'app shotlist restent ouverts comme avant ; tout ce qui concerne DDC (`ddc/…`) est réservé aux membres de l'équipe.

## Équipe

L'administrateur (`adminEmail` dans `config.js`) ajoute les adresses Google des membres depuis le menu du compte → **Équipe**.

## IA

L'administrateur enregistre une clé API Anthropic pour toute l'équipe : menu du compte → **Clé API de l'équipe**. Elle est stockée dans Firebase (`ddc/secrets`), lisible seulement par les membres connectés, et n'est jamais dans le code. Pour la changer, même menu. Le modèle est réglable dans `config.js`.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | l'application |
| `adapter.js` | branchement Firebase (données, comptes, présence), API Anthropic, écrans de connexion et d'équipe |
| `config.js` | configuration Firebase, administrateur, modèle |
| `database.rules.json` | règles de sécurité de la Realtime Database |
