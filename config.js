/* Configuration DDC Breakdown.
   apiKey et appId : console Firebase → Paramètres du projet → Vos applications → Application Web.
   Ces valeurs ne sont pas secrètes : l'accès aux données est protégé par la connexion Google
   et par les règles de la base (database.rules.json). */
window.DDC_CONFIG = {
  firebase: {
    apiKey: "AIzaSyBf-2K6Uv94ONOsb4PWHM3fnXlsFbxW__o",
    authDomain: "shotlist-298e2.firebaseapp.com",
    databaseURL: "https://shotlist-298e2-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "shotlist-298e2",
    storageBucket: "shotlist-298e2.firebasestorage.app",
    messagingSenderId: "1088442361800",
    appId: "1:1088442361800:web:4777ed2efa7fa74929c2fd"
  },
  /* Compte Google administrateur : il gère la liste de l'équipe. */
  adminEmail: "h.ramilijaonina@gmail.com",
  /* Modèle Claude utilisé pour le dépouillement. */
  model: "claude-sonnet-5-5"
};
