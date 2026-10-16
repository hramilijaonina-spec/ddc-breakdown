/* Configuration DDC Breakdown.
   apiKey et appId : console Firebase → Paramètres du projet → Vos applications → Application Web.
   Ces valeurs ne sont pas secrètes : l'accès aux données est protégé par la connexion Google
   et par les règles de la base (database.rules.json). */
window.DDC_CONFIG = {
  firebase: {
    apiKey: "",
    authDomain: "shotlist-298e2.firebaseapp.com",
    databaseURL: "https://shotlist-298e2-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "shotlist-298e2",
    appId: ""
  },
  /* Compte Google administrateur : il gère la liste de l'équipe. */
  adminEmail: "h.ramilijaonina@gmail.com",
  /* Modèle Claude utilisé pour le dépouillement. */
  model: "claude-sonnet-5-5"
};
