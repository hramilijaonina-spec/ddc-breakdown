/* DDC Breakdown — couche autonome.
   Fournit à l'app les mêmes services que l'artefact Claude (db, user, room, sample, downloads)
   en s'appuyant sur Firebase (Realtime Database + connexion Google) et sur l'API Anthropic. */
(function(){
"use strict";
const CFG=window.DDC_CONFIG||{};
const ROOT="ddc";
const LS={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}},del(k){try{localStorage.removeItem(k)}catch{}}};
const emailKey=e=>String(e||"").trim().toLowerCase().replace(/\./g,",");
const enc=p=>String(p).split("/").join("~");
const escH=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const PALETTE=["#d64545","#2f9e5a","#e07a1f","#7c4dd6","#1f8fa3","#d14f9a","#2f66d6","#8a6a2a","#0f9c8c","#6f8f1f"];
const colorOf=id=>{let h=0;for(const c of String(id))h=(h*31+c.charCodeAt(0))>>>0;return PALETTE[h%PALETTE.length];};
const initials=(name,id)=>{const t=(String(name||"?").trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2)||"?").toUpperCase();
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="32" fill="${colorOf(id)}"/><text x="32" y="41" font-family="Arial" font-size="26" font-weight="700" fill="#fff" text-anchor="middle">${escH(t)}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);};

function fbConfig(){
  let c={...(CFG.firebase||{})};
  if(!c.apiKey){try{const o=JSON.parse(LS.get("ddc.fbconfig")||"null");if(o&&o.apiKey)c={...c,...o};}catch{}}
  return c;
}
const isAdminEmail=e=>!!(CFG.adminEmail&&e&&e.toLowerCase()===CFG.adminEmail.toLowerCase());

/* ---------- gate (setup / login / access denied) ---------- */
function gate(html){
  let g=document.getElementById("ddc-gate");
  if(!g){g=document.createElement("div");g.id="ddc-gate";document.body.append(g);}
  g.innerHTML=`<div class="welcome-card">${html}</div>`;return g;
}
function hideGate(){const g=document.getElementById("ddc-gate");if(g)g.remove();}
function whenBody(fn){if(document.body)fn();else document.addEventListener("DOMContentLoaded",fn);}

function showSetup(){
  whenBody(()=>{const g=gate(`<span class="label">DDC Breakdown · installation</span>
    <h1>Relier l'app à Firebase</h1>
    <p>Il manque la configuration web Firebase. Dans la console Firebase du projet, ouvre <b>Paramètres du projet → Vos applications → Application Web</b> et copie le bloc <code>firebaseConfig</code>, puis colle-le ici.</p>
    <textarea id="ddc-cfg" rows="8" placeholder="const firebaseConfig = { apiKey: &quot;…&quot;, authDomain: &quot;…&quot;, … };"></textarea>
    <div><button class="btn primary" id="ddc-cfg-ok">Enregistrer et continuer</button></div>
    <p class="empty" id="ddc-cfg-err"></p>`);
    g.querySelector("#ddc-cfg-ok").onclick=()=>{const t=g.querySelector("#ddc-cfg").value;const o={};
      for(const k of["apiKey","authDomain","databaseURL","projectId","storageBucket","messagingSenderId","appId"]){const m=t.match(new RegExp(k+"\\s*[:=]\\s*[\"']([^\"']+)[\"']"));if(m)o[k]=m[1];}
      if(!o.apiKey){g.querySelector("#ddc-cfg-err").textContent="Je ne trouve pas apiKey dans ce texte.";return;}
      LS.set("ddc.fbconfig",JSON.stringify(o));location.reload();};});
}
function showLogin(err){
  whenBody(()=>{const g=gate(`<span class="label">DDC Breakdown</span>
    <h1>Dépouillement et plan de travail</h1>
    <p>Connecte-toi avec le compte Google que la production a ajouté à l'équipe.</p>
    <div><button class="btn primary" id="ddc-login">Se connecter avec Google</button></div>
    ${err?`<p class="ddc-err">${escH(err)}</p>`:""}`);
    g.querySelector("#ddc-login").onclick=async()=>{
      try{await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());}
      catch(e){const c=e&&e.code||"";
        if(c==="auth/popup-closed-by-user"||c==="auth/cancelled-popup-request")return;
        if(c==="auth/popup-blocked"){firebase.auth().signInWithRedirect(new firebase.auth.GoogleAuthProvider());return;}
        showLogin(c==="auth/unauthorized-domain"?"Ce site n'est pas autorisé dans Firebase. Ajoute "+location.hostname+" dans Authentication → Paramètres → Domaines autorisés.":
          c==="auth/operation-not-allowed"?"La connexion Google n'est pas activée dans Firebase (Authentication → Méthode de connexion → Google).":
          "Connexion impossible ("+(c||"erreur")+").");}};});
}
function showDenied(u){
  whenBody(()=>{const g=gate(`<span class="label">DDC Breakdown</span>
    <h1>Accès en attente</h1>
    <p>Le compte <b>${escH(u.email)}</b> ne fait pas encore partie de l'équipe. Demande à la production de l'ajouter dans <b>Équipe</b>, puis recharge la page.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="ddc-retry">Réessayer</button><button class="btn" id="ddc-out">Changer de compte</button></div>`);
    g.querySelector("#ddc-retry").onclick=()=>location.reload();
    g.querySelector("#ddc-out").onclick=()=>firebase.auth().signOut().then(()=>location.reload());});
}

/* ---------- services ---------- */
function build(u,isAdmin){
  const rtdb=firebase.database();
  const mapErr=e=>{const m=String(e&&(e.code||e.message)||"");return{code:/permission|denied/i.test(m)?"permission_denied":"unavailable",message:m};};
  const clean=d=>JSON.parse(JSON.stringify(d,(k,v)=>v===undefined?null:v));
  const colRef=p=>rtdb.ref(ROOT+"/data/"+enc(p));

  function docRef(col,id){const r=colRef(col).child(id);return{id,path:col+"/"+id,
    async get(){try{const s=await r.get();return{id,exists:s.exists(),data:()=>s.exists()?s.val():undefined};}catch(e){throw mapErr(e);}},
    set:d=>r.set(clean(d)).catch(e=>{throw mapErr(e);}),
    update:d=>r.update(clean(d)).catch(e=>{throw mapErr(e);}),
    delete:()=>r.remove().catch(e=>{throw mapErr(e);}),
    async acquire({holder,ttlMs=30000}){
      try{const res=await rtdb.ref(ROOT+"/locks/"+enc(col)+"~"+id).transaction(cur=>{if(cur&&cur.exp>Date.now()&&cur.holder!==holder)return;return{holder,exp:Date.now()+ttlMs};});
        return{acquired:res.committed};}catch{return{acquired:true};}},
    onSnapshot(next,err){const h=s=>next({id,exists:s.exists(),data:()=>s.val()||undefined,metadata:{fromCache:false,hasPendingWrites:false}});
      r.on("value",h,e=>err&&err(mapErr(e)));return()=>r.off("value",h);}};}

  const db={
    doc(path){const i=path.lastIndexOf("/");return docRef(path.slice(0,i),path.slice(i+1));},
    collection(path){return{path,
      doc(id){return docRef(path,id||colRef(path).push().key);},
      async add(d){const ref=docRef(path,colRef(path).push().key);await ref.set(d);return ref;},
      onSnapshot(next,err){const r=colRef(path);
        const h=s=>{const v=s.val()||{};const docs=Object.keys(v).map(id=>({id,exists:true,data:()=>v[id],metadata:{fromCache:false,hasPendingWrites:false}}));
          next({docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:{fromCache:false,hasPendingWrites:false}});};
        r.on("value",h,e=>err&&err(mapErr(e)));return()=>r.off("value",h);}};}
  };

  /* people */
  const users={};let usersReady;const usersP=new Promise(r=>usersReady=r);
  rtdb.ref(ROOT+"/users").on("value",s=>{Object.assign(users,s.val()||{});usersReady();},()=>usersReady());
  const profileOf=id=>{const p=users[id]||{};return{id,name:p.name||"",avatarUrl:p.photo||initials(p.name,id),color:colorOf(id),email:p.email||null,isMe:id===u.uid,guest:false};};
  const user={
    async me(){return{id:u.uid,name:u.displayName||u.email||"",avatarUrl:u.photoURL||initials(u.displayName,u.uid),color:colorOf(u.uid),email:u.email||null,isOwner:isAdmin,canEdit:true};},
    async id(){return u.uid;},async isOwner(){return isAdmin;},async canEdit(){return true;},async can(){return true;},
    async name(){return u.displayName||"";},async email(){return u.email||null;},
    async profiles(ids){await usersP;const o={};for(const id of[].concat(ids||[]))o[id]=profileOf(id);return o;},
    async search(){await usersP;return Object.keys(users).map(profileOf);}
  };

  /* presence */
  const presRef=rtdb.ref(ROOT+"/presence");const mine=presRef.push();let state={uid:u.uid};
  rtdb.ref(".info/connected").on("value",s=>{if(s.val()){mine.onDisconnect().remove();mine.set({...state,at:Date.now()}).catch(()=>{});}});
  const room={
    async presence(patch){for(const[k,v]of Object.entries(patch||{})){if(v===null)delete state[k];else state[k]=v;}state.uid=u.uid;try{await mine.set({...state,at:Date.now()});}catch{}},
    onPeers(handler){const h=s=>{const v=s.val()||{};const peers=Object.keys(v).map(k=>({peer:k,by:v[k].uid||null,isMe:v[k].uid===u.uid,sameTab:k===mine.key,kind:"viewer",guest:false,presence:v[k],updatedAt:Date.now()}));
      handler({peers,joined:peers,left:[],updated:[]});};presRef.on("value",h);return()=>presRef.off("value",h);},
    peers(){return[];},async emit(){},on(){return()=>{};}
  };

  /* Claude via clé API */
  function parseJSON(t){
    const tries=[t,(t.match(/```(?:json)?\s*([\s\S]*?)```/)||[])[1],(()=>{const a=t.search(/[{[]/);const b=Math.max(t.lastIndexOf("}"),t.lastIndexOf("]"));return a>-1&&b>a?t.slice(a,b+1):null;})()];
    for(const x of tries){if(!x)continue;try{return JSON.parse(x);}catch{}}
    throw{code:"invalid_json",message:"réponse illisible",text:t};
  }
  async function ask(prompt,opts={}){
    const key=LS.get("ddc.apikey");if(!key)throw{code:"no_key",message:"clé API absente"};
    let r;
    try{r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",signal:opts.signal,
      headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:CFG.model||"claude-sonnet-5-5",max_tokens:4096,messages:[{role:"user",content:String(prompt)}]})});}
    catch(e){if(e&&e.name==="AbortError")throw{code:"cancelled"};throw{code:"upstream_error",message:String(e)};}
    if(r.status===401||r.status===403)throw{code:"bad_key",message:"clé refusée"};
    if(r.status===429)throw{code:"rate_limited"};
    if(r.status===400){let m="";try{m=(await r.json()).error?.message||"";}catch{}throw{code:/credit|balance|billing/i.test(m)?"no_credit":"upstream_error",message:m};}
    if(!r.ok)throw{code:"upstream_error",message:"HTTP "+r.status};
    const j=await r.json();return(j.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
  }
  const sample=async(input,opts)=>({text:await ask(input,opts),truncated:false});
  sample.json=async(input,opts)=>parseJSON(await ask(input,opts));
  sample.limits=async()=>({maxPromptBytes:200000});

  const downloads={async save({filename,data}){
    const blob=data instanceof Blob?data:new Blob([data],{type:/\.csv$/i.test(filename)?"text/csv;charset=utf-8":/\.html?$/i.test(filename)?"text/html;charset=utf-8":"application/octet-stream"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
    return{status:"saved"};}};

  mountAccount(u,isAdmin,rtdb);
  return{db,user,room,sample,downloads};
}

/* ---------- compte, clé API, équipe ---------- */
function modal(html){const sc=document.createElement("div");sc.className="scrim";sc.innerHTML=`<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  sc.addEventListener("pointerdown",e=>{if(e.target===sc)sc.remove();});sc.addEventListener("keydown",e=>{if(e.key==="Escape")sc.remove();});document.body.append(sc);return sc;}
function openKey(bad){
  const m=modal(`<h3>Clé API Anthropic</h3>
    ${bad?`<p class="ddc-err">La clé enregistrée a été refusée. Vérifie-la ou crée-en une nouvelle.</p>`:""}
    <p class="empty">L'analyse IA utilise ta clé API Anthropic, facturée à l'usage (quelques centimes par scénario). Crée une clé sur <b>console.anthropic.com → API Keys</b>. Elle reste enregistrée dans ce navigateur uniquement.</p>
    <input type="password" id="ddc-key" placeholder="sk-ant-…" autocomplete="off" aria-label="Clé API" value="${escH(LS.get("ddc.apikey")||"")}">
    <div class="mfoot"><button class="btn danger" id="ddc-key-del">Effacer</button><button class="btn" id="ddc-key-c">Annuler</button><button class="btn primary" id="ddc-key-ok">Enregistrer</button></div>`);
  const i=m.querySelector("#ddc-key");i.focus();
  m.querySelector("#ddc-key-c").onclick=()=>m.remove();
  m.querySelector("#ddc-key-del").onclick=()=>{LS.del("ddc.apikey");m.remove();};
  m.querySelector("#ddc-key-ok").onclick=()=>{const v=i.value.trim();if(v)LS.set("ddc.apikey",v);m.remove();};
}
window.DDC_openKey=openKey;
function openTeam(rtdb){
  const m=modal(`<h3>Équipe</h3><p class="empty">Seules les adresses Google listées ici peuvent ouvrir les projets.</p>
    <form class="addrow" id="ddc-tf"><input type="text" id="ddc-te" placeholder="prenom.nom@gmail.com" aria-label="E-mail" autocomplete="off"><button class="btn" type="submit">Ajouter</button></form>
    <div id="ddc-tl" class="ddc-team"></div><div class="mfoot"><button class="btn primary" id="ddc-tok">Terminé</button></div>`);
  const ref=rtdb.ref(ROOT+"/team");const list=m.querySelector("#ddc-tl");
  const h=s=>{const v=s.val()||{};const rows=Object.keys(v).map(k=>v[k].email||k.replace(/,/g,".")).sort();
    list.innerHTML=(CFG.adminEmail?`<div><span>${escH(CFG.adminEmail)}</span><small>administrateur</small></div>`:"")+
      rows.map(e=>`<div><span>${escH(e)}</span><button class="btn ghost small danger" data-k="${escH(emailKey(e))}">Retirer</button></div>`).join("");
    list.querySelectorAll("button[data-k]").forEach(b=>b.onclick=()=>ref.child(b.dataset.k).remove());};
  ref.on("value",h,()=>{list.innerHTML=`<p class="ddc-err">Lecture de l'équipe refusée. Vérifie les règles de la base.</p>`;});
  const close=()=>{ref.off("value",h);m.remove();};
  m.querySelector("#ddc-tok").onclick=close;
  m.querySelector("#ddc-tf").onsubmit=ev=>{ev.preventDefault();const e=m.querySelector("#ddc-te").value.trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))return;m.querySelector("#ddc-te").value="";
    ref.child(emailKey(e)).set({email:e,at:Date.now()}).catch(err=>alert("Ajout refusé : "+(err.code||err.message)));};
}
function mountAccount(u,isAdmin,rtdb){
  whenBody(()=>{
    const top=document.getElementById("top");if(!top||document.getElementById("ddc-acct"))return;
    const b=document.createElement("button");b.id="ddc-acct";b.className="ddc-acct";b.setAttribute("aria-label","Mon compte");
    b.innerHTML=`<img alt="" src="${escH(u.photoURL||initials(u.displayName,u.uid))}" referrerpolicy="no-referrer">`;
    const act=document.getElementById("actions");if(act)top.insertBefore(b,act);else top.append(b);
    b.onclick=()=>{const old=document.getElementById("ddc-menu");if(old){old.remove();return;}
      const d=document.createElement("div");d.id="ddc-menu";d.className="pop";
      d.innerHTML=`<div class="ptitle">${escH(u.email||"")}</div>
        <button data-a="key"><span>Clé API Anthropic${LS.get("ddc.apikey")?" ✓":""}</span></button>
        ${isAdmin&&rtdb?`<button data-a="team"><span>Équipe</span></button>`:""}
        <button data-a="out"><span>Se déconnecter</span></button>`;
      document.body.append(d);const r=b.getBoundingClientRect();d.style.top=(r.bottom+6)+"px";d.style.left=Math.max(8,r.right-d.offsetWidth)+"px";
      const off=e=>{if(!d.contains(e.target)&&e.target!==b){d.remove();document.removeEventListener("pointerdown",off,true);}};
      document.addEventListener("pointerdown",off,true);
      d.querySelectorAll("button").forEach(x=>x.onclick=()=>{d.remove();const a=x.dataset.a;
        if(a==="key")openKey(false);if(a==="team")openTeam(rtdb);if(a==="out")firebase.auth().signOut().then(()=>location.reload());});};
  });
}

/* ---------- démarrage ---------- */
let resolveSvc;const svcP=new Promise(r=>resolveSvc=r);
window.claude={use:async name=>{const s=await svcP;return s[name]||null;}};
function start(){
  const c=fbConfig();
  if(!window.firebase||!c.apiKey||!c.databaseURL){showSetup();return;}
  firebase.initializeApp(c);
  let done=false;
  firebase.auth().onAuthStateChanged(async u=>{
    if(done){location.reload();return;}
    if(!u){showLogin();return;}
    const admin=isAdminEmail(u.email);let member=admin;
    if(!member){try{member=(await firebase.database().ref(ROOT+"/team/"+emailKey(u.email)).get()).exists();}catch{member=false;}}
    if(!member){showDenied(u);return;}
    firebase.database().ref(ROOT+"/users/"+u.uid).update({name:u.displayName||u.email||"",photo:u.photoURL||"",email:(u.email||"").toLowerCase()}).catch(()=>{});
    done=true;hideGate();resolveSvc(build(u,admin));
  });
  firebase.auth().getRedirectResult().catch(e=>showLogin("Connexion impossible ("+(e.code||"erreur")+")."));
}
start();
})();
