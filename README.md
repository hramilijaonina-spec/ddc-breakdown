# Dydz Studio

Scénario, découpage, dépouillement et plan de travail collaboratifs pour l'équipe DDC (anciennement « DDC Breakdown »).

**App :** https://hramilijaonina-spec.github.io/dydz-studio/

Depuis la version 2.0, l'app reprend toutes les fonctions de UP Slatebook, avec ses propres données (`ddc/…`), le thème gris sombre et jaune de DDC et l'assistant **Dydz**.

- **Scénario** : import PDF, Final Draft (.fdx), .sbx, Fountain ou texte ; découpage en scènes (INT/EXT, jour/nuit, huitièmes de page) ; un scénario à plusieurs épisodes devient un projet par épisode. Éditeur à la mise en page standard, export Final Draft et Fountain, impression PDF.
- Scénarios « en prose » (Word, Google Docs, PDF) : « Lieu - Moment » et « Nom (indication) : réplique » sont reconnus à l'import et mis automatiquement au format scénario.
- **Découpage** : tableau plan par plan (séquence, plan, description, audio, caméra, vignette, notes), cellules modifiables avec menus (valeur de plan, mouvement, angle), photo ou image par plan, plans optionnels à 0 s (grisés, masquables), découpage par l'IA, mise à jour du scénario d'après le découpage, aperçu et export PDF, PowerPoint ou CSV en paysage.
- **Dydz** : assistant flottant (administrateur et éditeurs) qui redécoupe une scène, fait tenir l'épisode dans une durée ou répond aux questions ; il montre ses propositions avant de les appliquer, et elles s'annulent.
- **Dépouillement** par IA dans 13 catégories, correction à la main, commentaires par scène ; clic sur un élément de la fiche → défilement jusqu'à ses passages dans la scène (barre de recherche 1 / N, ↑ ↓, Entrée, Échap).
- Sur téléphone, dans le Dépouillement : la scène en cours tient sur une case ; la flèche ▾ déroule la liste verticale de toutes les scènes (recherche, défilement), un appui ouvre la scène.
- **Plan de travail** : lieux de tournage, journées en glisser-déposer, plan proposé automatiquement, alertes, rapports (fiches de dépouillement, HTML imprimable, CSV).
- Suivi du tournage : case à cocher sur chaque plan du découpage (plan fait) et sur chaque scène du plan de travail (scène tournée) ; la ligne passe en vert clair, le compteur « scènes tournées » est dans le plan de travail.
- Plan de travail en journées repliables (J1, J2…) : date, scènes tournées (ex. 3/5), pages, lieux, alertes ; une journée dépliée montre ses scènes, « + Ajouter des scènes » et × pour en retirer ; case de la journée liée aux cases des scènes (tout coché = journée cochée, et inversement) ; « Tout déplier / Tout replier ». Les compteurs, pages par jour, Rapports, Lieux de tournage et Proposer un plan sont dans le menu ☰ du plan de travail ; « + Journée » est sous la dernière journée. « Proposer un plan » propose trois choix : garder ce qui est tourné (scènes tournées et leurs journées intactes, le reste replanifié à la suite), seulement les scènes à placer, ou tout refaire (avec confirmation).
- **Annuler / rétablir** (⌘Z, ⇧⌘Z) dans le découpage.
- Menu ☰ (à gauche, après la version) : ACCUEIL (derniers projets, Nouveau projet, Restaurer une sauvegarde ; un clic ouvre le projet) et PROJET (nouveau projet, analyse IA, export, versions, options). Export du scénario en PDF (mise en page standard, numéros de scène des deux côtés, nom de l'app en pied de page, sans adresse web).
- **Versions** : badge v1, v2… ; « Nouvelle version » avec une note ; sauvegarde automatique après chaque série de modifications ; retour à une version en un clic (l'état d'avant reste dans la liste) ; suppression d'une version.
- **Clap numérique** pour le tournage sur téléphone.
- Temps réel pour toute l'équipe ; connexion avec Google ou par lien e-mail ; hors ligne ; sauvegarde du projet en fichier.

## Installation (une seule fois)

Le projet Firebase utilisé est `shotlist-298e2` (le même que l'app shotlist).

1. **Connexion** : console Firebase → Authentication → Méthode de connexion → activer **Google**, puis **E-mail/Mot de passe** avec l'option **Lien envoyé par e-mail (connexion sans mot de passe)**.
2. **Domaine autorisé** : Authentication → Paramètres → Domaines autorisés → ajouter `hramilijaonina-spec.github.io`.
3. **Application Web** : Paramètres du projet → Vos applications → ajouter une application Web, puis copier `apiKey` et `appId` dans `config.js`.
4. **Règles de la base** : Realtime Database → Règles → coller le contenu de `database.rules.json` → Publier.
   Les chemins `shots`, `notes` (app shotlist) et `detente` (app Détente) restent ouverts comme avant ; tout ce qui concerne DDC (`ddc/…`) est réservé aux membres de l'équipe.

## Équipe

L'administrateur (`adminEmail` dans `config.js`) ajoute les adresses e-mail des membres (Gmail ou autre) depuis le menu du compte → **Équipe**. Une personne non autorisée qui se connecte envoie automatiquement une demande d'accès : badge rouge sur l'avatar de l'administrateur, à accepter ou refuser dans **Équipe**.

Chaque membre a un rôle : **Lecteur** (consulte et exporte), **Commentateur** (consulte et commente), **Éditeur** (modifie tout). Seul l'administrateur supprime un projet. Les rôles sont appliqués par l'app et par les règles de la base (`tools/rules.py` génère `database.rules.json`).

## IA

L'administrateur enregistre une clé API Anthropic pour toute l'équipe : menu du compte → **Clé API de l'équipe**. Elle est stockée dans Firebase (`ddc/secrets`), lisible seulement par les membres connectés, et n'est jamais dans le code. Pour la changer, même menu. Le modèle est réglable dans `config.js`.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | l'application |
| `adapter.js` | branchement Firebase (données, comptes, présence), API Anthropic, écrans de connexion et d'équipe |
| `sw.js` | service worker : ouverture de l'app sans réseau |
| `config.js` | configuration Firebase, administrateur, modèle |
| `vendor/` | outils d'export PDF et PowerPoint (fonctionnent hors ligne) |
| `tools/build_from_up.py` | reconstruit Dydz Studio à partir de UP Slatebook (nom, couleurs, assistant Dydz) |
| `database.rules.json` | règles de sécurité de la Realtime Database |
