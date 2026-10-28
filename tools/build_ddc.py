# Génère ddc-breakdown/index.html à partir de la source de l'artefact.
import re
src=open('/home/claude/depouillement.html').read()
def R(a,b):
    global src
    assert src.count(a)==1,a; src=src.replace(a,b)
R('''    if(code==="cancelled")return"cancelled";''','''    if(code==="cancelled")return"cancelled";
    if(code==="no_key"||code==="bad_key"){window.DDC_openKey&&window.DDC_openKey(code==="bad_key");return"stop";}
    if(code==="no_credit"){toast("Crédit API Anthropic épuisé. Recharge ton compte sur console.anthropic.com.",6000);return"stop";}
    if(code==="offline"){toast("L'analyse IA a besoin d'internet. Le reste fonctionne hors ligne.",5000);return"stop";}''')
R('''function writeErr(e){if(e&&e.code==="invalid_argument"&&!S.local)''','''function writeErr(e){if(e&&e.code==="permission_denied"){toast("Accès refusé par la base. Ton e-mail fait-il toujours partie de l'équipe ?",5000);return;}if(e&&e.code==="invalid_argument"&&!S.local)''')
cur=open('/home/claude/ddc-breakdown/index.html').read()
head=cur[:cur.index('<body>')+len('<body>\n')]
open('/home/claude/ddc-breakdown/index.html','w').write(head+src+'\n</body>\n</html>\n')
print("built")
