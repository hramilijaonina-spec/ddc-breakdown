# Construit UP Slatebook à partir de la source DDC Breakdown (/home/claude/depouillement.html).
# Sorties : /home/claude/up-slatebook.html (artefact) et /home/claude/up-slatebook/ (site GitHub Pages).
import json, os, re, shutil

SRC = "/home/claude/depouillement.html"
DDC = "/home/claude/ddc-breakdown"
OUT_ART = "/home/claude/up-slatebook.html"
OUT = "/home/claude/up-slatebook"
UP_VERSION = "1.1"

s = open(SRC).read()

def R(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, (a[:80], c)
    s = s.replace(a, b)

# --- nom et logo ---
R("<title>DDC Breakdown</title>", "<title>UP Slatebook</title>")
R('<span class="logo" id="logo" aria-label="DDC">DDC</span>Breakdown', '<span class="logo" id="logo" aria-label="UP">UP</span>Slatebook')
s = s.replace("DDC Breakdown", "UP Slatebook")
R('<div class="brand">', '<div class="brand up">')

# --- version propre à UP ---
s = re.sub(r'/\* Version : [^\n]*\*/\nconst APP_VERSION="[^"]*";const APP_DATE="[^"]*";',
           '/* UP Slatebook — copie de DDC Breakdown 1.10.3 · 1.0 première version UP · 1.1 rôles lecteur, commentateur, éditeur */\n'
           'const APP_VERSION="' + UP_VERSION + '";const APP_DATE="28 oct. 2026";', s)
assert 'APP_VERSION="' + UP_VERSION + '"' in s

# --- stockage local séparé ---
s = s.replace('"dep.pid"', '"upsb.pid"').replace('"dep.sid."', '"upsb.sid."')

# --- couleurs UP : gris sombre + cyan, un seul thème sombre ---
UP_TOKENS = ("--bg:#1b1e21; --surface:#24282c; --sunk:#1f2326; --line:#343a40; --line-strong:#48505a;\n"
             "  --fg:#e9edf0; --muted:#9aa5ad; --accent:#1fc8e3; --accent-fg:#04252c; --accent-soft:#143a43;\n"
             "  --danger:#ff7b82; --ok:#5fd394; --warn:#f2b350; --page:#272b30;\n"
             "  --strip-intj:#d9dde0; --strip-extj:#e3bd45; --strip-intn:#5f8ce0; --strip-extn:#4db374; --strip-mix:#6b7680;")
m = re.search(r":root\{\n  --bg:.*?--strip-mix:[^;]*;", s, re.S)
s = s[:m.start()] + ":root{\n  " + UP_TOKENS + s[m.end():]
s = s.replace("  --r:6px;\n}", "  --r:6px;\n  color-scheme:dark;\n}", 1)
s = re.sub(r"@media \(prefers-color-scheme: dark\)\{:root:not\(\[data-theme=\"light\"\]\)\{\n  --bg:.*?color-scheme:dark\}\}\n", "", s, count=1, flags=re.S)
s = re.sub(r":root\[data-theme=\"dark\"\]\{\n  --bg:.*?color-scheme:dark\}\n", "", s, count=1, flags=re.S)
# couleurs des types de blocs : variantes sombres partout
s = s.replace("[data-t=h]{--c:#b7791f}[data-t=a]{--c:#3f6fc4}[data-t=c]{--c:#d14343}[data-t=p]{--c:#8259d0}[data-t=d]{--c:#23905a}[data-t=t]{--c:#d9691a}[data-t=s]{--c:#0d8f86}",
              "[data-t=h]{--c:#e0a84a}[data-t=a]{--c:#6d9bf0}[data-t=c]{--c:#f07070}[data-t=p]{--c:#ab8cf0}[data-t=d]{--c:#4cc684}[data-t=t]{--c:#f2934a}[data-t=s]{--c:#1fc8e3}")
s = s.replace(".ed-tb[aria-pressed=true] .ed-ic{color:#fff}", ".ed-tb[aria-pressed=true] .ed-ic{color:#0d1517}\n.ed-tb[aria-pressed=true]{color:#0d1517}")
# logo UP : pastille cyan
s = s.replace("/* empty state */", ".brand.up .logo{background:var(--accent);color:var(--accent-fg);letter-spacing:.04em}\n.brand.up{color:var(--fg)}\n/* empty state */", 1)
assert "#eef0ee" not in s

open(OUT_ART, "w").write(s)

# --- site GitHub Pages ---
os.makedirs(OUT, exist_ok=True)
for f in ["adapter.js", "sw.js", "database.rules.json", ".nojekyll"]:
    shutil.copy(os.path.join(DDC, f), os.path.join(OUT, f))

head = open(os.path.join(DDC, "index.html")).read()
head = head[:head.index("<body>") + len("<body>\n")]
head = head.replace('content="#0d6b70"', 'content="#1b1e21"').replace('content="DDC Breakdown"', 'content="UP Slatebook"')
page = s
for a, b in [('''    if(code==="cancelled")return"cancelled";''', '''    if(code==="cancelled")return"cancelled";
    if(code==="no_key"||code==="bad_key"){window.DDC_openKey&&window.DDC_openKey(code==="bad_key");return"stop";}
    if(code==="no_credit"){toast("Crédit API Anthropic épuisé. Recharge ton compte sur console.anthropic.com.",6000);return"stop";}
    if(code==="offline"){toast("L'analyse IA a besoin d'internet. Le reste fonctionne hors ligne.",5000);return"stop";}'''),
             ('''function writeErr(e){if(e&&e.code==="invalid_argument"&&!S.local)''', '''function writeErr(e){if(e&&e.code==="permission_denied"){toast("Accès refusé par la base. Ton e-mail fait-il toujours partie de l'équipe ?",5000);return;}if(e&&e.code==="invalid_argument"&&!S.local)''')]:
    assert page.count(a) == 1, a[:60]
    page = page.replace(a, b)
open(os.path.join(OUT, "index.html"), "w").write(head + page + "\n</body>\n</html>\n")

cfg = open(os.path.join(DDC, "config.js")).read()
cfg = cfg.replace("/* Configuration DDC Breakdown.", "/* Configuration UP Slatebook.")
cfg = cfg.replace('  model: "claude-sonnet-5-5"\n', '  model: "claude-sonnet-5-5",\n'
                  '  /* Séparation d\'avec DDC Breakdown (même projet Firebase, même site) */\n'
                  '  appName: "UP Slatebook",\n  root: "up",\n  storageKey: "up",\n  idbName: "up-slatebook"\n')
assert 'root: "up"' in cfg
open(os.path.join(OUT, "config.js"), "w").write(cfg)

sw = open(os.path.join(OUT, "sw.js")).read()
sw = sw.replace("/* DDC Breakdown —", "/* UP Slatebook —").replace('const APP = "ddc";', 'const APP = "up";')
sw = re.sub(r'const VERSION = APP \+ "-v[^"]*";', 'const VERSION = APP + "-v' + UP_VERSION + '";', sw)
assert 'APP = "up"' in sw
open(os.path.join(OUT, "sw.js"), "w").write(sw)

man = {"name": "UP Slatebook", "short_name": "Slatebook", "description": "Scénario, dépouillement et plan de travail collaboratifs — UP",
       "start_url": "./", "scope": "./", "display": "standalone", "background_color": "#1b1e21", "theme_color": "#1b1e21", "lang": "fr",
       "icons": [{"src": "icon.svg", "sizes": "any", "type": "image/svg+xml"},
                 {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
                 {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"}]}
open(os.path.join(OUT, "manifest.webmanifest"), "w").write(json.dumps(man, indent=2, ensure_ascii=False) + "\n")

open(os.path.join(OUT, "icon.svg"), "w").write(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#1b1e21"/>'
    '<g transform="rotate(-12 112 150)"><rect x="72" y="104" width="368" height="64" rx="10" fill="#1fc8e3"/>'
    '<path d="M120 104h44l-28 64H92zM220 104h44l-28 64h-44zM320 104h44l-28 64h-44z" fill="#1b1e21"/></g>'
    '<rect x="72" y="196" width="368" height="232" rx="14" fill="#24282c" stroke="#1fc8e3" stroke-width="10"/>'
    '<text x="256" y="366" font-family="Arial,sans-serif" font-size="150" font-weight="700" fill="#1fc8e3" text-anchor="middle">UP</text></svg>\n')
from PIL import Image, ImageDraw, ImageFont
font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
for n in (180, 192, 512):
    k = n / 512
    im = Image.new("RGBA", (n, n), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, n - 1, n - 1], radius=int(96 * k), fill="#1b1e21")
    clap = Image.new("RGBA", (n, n), (0, 0, 0, 0)); c = ImageDraw.Draw(clap)
    c.rounded_rectangle([int(72 * k), int(104 * k), int(440 * k), int(168 * k)], radius=max(1, int(10 * k)), fill="#1fc8e3")
    for x in (120, 220, 320):
        c.polygon([(int(x * k), int(104 * k)), (int((x + 44) * k), int(104 * k)), (int((x + 16) * k), int(168 * k)), (int((x - 28) * k), int(168 * k))], fill="#1b1e21")
    clap = clap.rotate(12, center=(int(112 * k), int(150 * k)), resample=Image.BICUBIC)
    im.alpha_composite(clap)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([int(72 * k), int(196 * k), int(440 * k), int(428 * k)], radius=max(1, int(14 * k)), fill="#24282c", outline="#1fc8e3", width=max(2, int(10 * k)))
    d.text((n / 2, int(316 * k)), "UP", font=ImageFont.truetype(font, int(140 * k)), fill="#1fc8e3", anchor="mm")
    im.save(os.path.join(OUT, f"icon-{n}.png"))

readme = open(os.path.join(DDC, "README.md")).read()
readme = readme.replace("# DDC Breakdown", "# UP Slatebook").replace("pour l'équipe DDC.", "pour l'équipe UP. Copie de DDC Breakdown aux couleurs UP, avec ses propres données.")
readme = readme.replace("https://hramilijaonina-spec.github.io/ddc-breakdown/", "https://hramilijaonina-spec.github.io/UP-Slatebook/")
readme = readme.replace("tout ce qui concerne DDC (`ddc/…`) est réservé aux membres de l'équipe.", "les données DDC Breakdown sont sous `ddc/…` et celles de UP Slatebook sous `up/…`, chacune réservée à sa propre équipe.")
readme = readme.replace("(`ddc/secrets`)", "(`up/secrets`)")
open(os.path.join(OUT, "README.md"), "w").write(readme)
print("UP built")
