# Génère database.rules.json : shotlist, Détente, et une section protégée par app (ddc, up).
import json
ADMIN_EMAIL = "h.ramilijaonina@gmail.com"
V = "auth != null && auth.token.email_verified == true"
KEY = "auth.token.email.toLowerCase().replace('.', ',')"
ADM = f"auth.token.email.toLowerCase() == '{ADMIN_EMAIL}'"

def section(root):
    T = f"root.child('{root}/team').child({KEY})"
    member = f"{V} && ({ADM} || {T}.exists())"
    editor = f"{V} && ({ADM} || ({T}.exists() && (!{T}.child('role').exists() || {T}.child('role').val() == 'editor')))"
    commenter = f"{V} && {T}.child('role').val() == 'commenter'"
    admin = f"{V} && {ADM}"
    own_comment = "(newData.exists() ? (newData.child('by').val() == auth.uid && (!data.exists() || data.child('by').val() == auth.uid)) : data.child('by').val() == auth.uid)"
    return {
        "team": {".read": admin, ".write": admin,
                 "$key": {".read": f"{V} && {KEY} == $key",
                          "role": {".validate": "newData.val() == 'viewer' || newData.val() == 'commenter' || newData.val() == 'editor'"}}},
        "data": {".read": member,
                 "$col": {"$doc": {".write": f"({editor} && ($col != 'projects' || newData.exists() || {ADM})) || ({commenter} && $col.endsWith('~comments') && {own_comment})"}}},
        "users": {".read": member, "$uid": {".write": f"{member} && auth.uid == $uid"}},
        "presence": {".read": member, ".write": member},
        "locks": {".read": member, ".write": editor},
        "secrets": {".read": editor, ".write": admin},
        "requests": {".read": admin, ".write": admin,
                     "$key": {".read": f"{V} && {KEY} == $key",
                              ".write": f"{V} && {KEY} == $key && (!newData.exists() || newData.child('email').val() == auth.token.email.toLowerCase())"}},
    }

rules = {"rules": {"shots": {".read": True, ".write": True}, "notes": {".read": True, ".write": True},
                   "detente": {".read": True, ".write": True}, "ddc": section("ddc"), "up": section("up")}}
open("database.rules.json", "w").write(json.dumps(rules, indent=2, ensure_ascii=False) + "\n")
print("rules written")
