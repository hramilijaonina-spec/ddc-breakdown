# Construit Dydz Studio (ex-DDC Breakdown) à partir de UP Slatebook : même code, nom, couleurs et assistant Dydz.
# Usage : python3 build_from_up.py <index.html UP> <sortie> [gh|art]
#   gh  : site GitHub Pages (en-tête Firebase de UP, métadonnées DDC)
#   art : artefact Claude
import re, sys

SRC, OUT, MODE = sys.argv[1], sys.argv[2], (sys.argv[3] if len(sys.argv) > 3 else "gh")
DDC_VERSION, DDC_DATE = "2.8.0", "31 oct. 2026"
s = open(SRC, encoding="utf-8").read()

def R(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, (a[:90], c)
    s = s.replace(a, b)

# --- version et historique DDC ---
s, k = re.subn(r'/\* UP Slatebook — copie de DDC Breakdown[^\n]*\*/\nconst APP_VERSION="[^"]*";const APP_DATE="[^"]*";',
    "/* Version : 1.0 dépouillement · 1.1 plan de travail · 1.2 hors ligne et sauvegarde · 1.3 import .sbx · 1.4 éditeur de scénario · "
    "1.5 boutons de mise en forme · 1.6 couleurs des boutons · 1.7 suppression de projet réservée à l'administrateur · "
    "1.8 mise en page scénario dans le dépouillement · 1.9 connexion par lien e-mail · 1.10 demandes d'accès · "
    "1.11 rôles lecteur, commentateur, éditeur · 1.12 barre d'onglets · "
    "2.0 reprise de UP Slatebook : menu, onglets intercalaires, découpage technique, épisodes séparés, Dydz, export PDF et PowerPoint, "
    "annuler et rétablir, versions et sauvegarde automatique, clap numérique, recherche des éléments, thème gris sombre et jaune · "
    "2.1 DDC Breakdown devient Dydz Studio · 2.2 liste des scènes en menu déroulant sur téléphone · 2.2.1 scénario sur fond clair dans le dépouillement · 2.3 import des scénarios en prose, plans faits et scènes tournées · 2.4 plan de travail en journées repliables · 2.5 menu du plan de travail · 2.6 « Proposer un plan » garde ce qui est tourné · 2.6.1 numéros de scène à l export · 2.7 menu Accueil et Projet, page d accueil, boutons sobres, PDF du scénario · 2.8 revue : téléphone, recherche, écran Exporter, annuler partout, durée, avancement, photos dans l historique */\n"
    'const APP_VERSION="' + DDC_VERSION + '";const APP_DATE="' + DDC_DATE + '";', s)
assert k == 1

# --- nom, logo, assistant ---
R('<div class="brand up"><span class="logo" id="logo" aria-label="UP">UP</span>Slatebook',
  '<div class="brand ddc"><span class="logo" id="logo" aria-label="Dydz">Dydz</span>Studio')
R("l'assistant de préproduction de l'agence UP intégré à UP Slatebook", "l'assistant de préproduction intégré à Dydz Studio")
R("2.0 reprise de UP Slatebook", "2.0 reprise de UP_SLATEBOOK")
s = s.replace("UP Slatebook", "Dydz Studio").replace("UpCopilot", "Dydz").replace("UP_SLATEBOOK", "UP Slatebook")
s = s.replace("ressort en couleur UP", "ressort dans la couleur de l'app")
s = s.replace('"upsb.', '"dep.')
assert "upsb" not in s and s.count("Slatebook") == 1 and "UpCopilot" not in s and s.count("DDC Breakdown") == 1, "reste UP"

# --- couleurs DDC : gris sombre + jaune ---
DDC_TOKENS = ("--bg:#1c1d1f; --surface:#26272a; --sunk:#202123; --line:#37393d; --line-strong:#4b4e53;\n"
              "  --fg:#ecebe6; --muted:#a4a39c; --accent:#f2c94c; --accent-fg:#2a2100; --accent-soft:#3b3317;\n"
              "  --danger:#ff7b82; --ok:#5fd394; --warn:#f29a4a; --page:#2a2b2e;\n"
              "  --strip-intj:#d9dde0; --strip-extj:#e3bd45; --strip-intn:#5f8ce0; --strip-extn:#4db374; --strip-mix:#6b7680;")
m = re.search(r":root\{\n  --bg:#1b1e21.*?--strip-mix:[^;]*;", s, re.S)
assert m
s = s[:m.start()] + ":root{\n  " + DDC_TOKENS + s[m.end():]
R("[data-t=s]{--c:#1fc8e3}", "[data-t=s]{--c:#3cc4b8}")
R(".brand.up .logo{background:var(--accent);color:var(--accent-fg);letter-spacing:.04em}",
  ".brand.ddc .logo{background:var(--accent);color:var(--accent-fg);letter-spacing:.06em}")
R(".brand.up{color:var(--fg)}", ".brand.ddc{color:var(--fg)}")
# Dydz : bouton et panneau jaunes
R("background:linear-gradient(135deg,var(--t-dec),var(--t-scenes));color:#1f0d00",
  "background:linear-gradient(135deg,#ffe082,var(--accent));color:var(--accent-fg)")
s = re.sub(r"(?m)^(\.cop-[^\n]*)$", lambda mm: mm.group(1).replace("var(--t-dec)", "var(--accent)"), s)
# exports : en-têtes de tableau jaunes
R("headStyles:{fillColor:[240,160,48],textColor:[35,18,0]", "headStyles:{fillColor:[242,201,76],textColor:[42,33,0]")
R('fill:{color:"F0A030"},color:"231200"', 'fill:{color:"F2C94C"},color:"2A2100"')
assert "#1fc8e3" not in s and "#1b1e21" not in s.split("<style>", 1)[1], "reste du cyan UP"

if MODE == "gh":
    R('<meta name="theme-color" content="#1b1e21">', '<meta name="theme-color" content="#1c1d1f">')
    assert '<meta name="apple-mobile-web-app-title" content="Dydz Studio">' in s

open(OUT, "w", encoding="utf-8").write(s)
print("built", OUT, MODE, len(s))
