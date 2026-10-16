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
let sharedKey="";let IS_ADMIN=false;let RTDB=null;
const activeKey=()=>LS.get("ddc.apikey")||sharedKey;
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
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const colRef=p=>rtdb.ref(ROOT+"/data/"+enc(p));
  const withTimeout=(p,ms)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej({code:"timeout"}),ms))]);

  /* ---- réseau ---- */
  let connected=false;
  rtdb.ref(".info/connected").on("value",s=>{connected=!!s.val();notifyNet();});

  /* ---- copie locale (IndexedDB) ---- */
  const idb=(()=>{let dbp=null;
    const open=()=>dbp||(dbp=new Promise((res,rej)=>{const r=indexedDB.open("ddc-breakdown",1);r.onupgradeneeded=()=>r.result.createObjectStore("kv");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}));
    const tx=(mode,fn)=>open().then(d=>new Promise((res,rej)=>{const t=d.transaction("kv",mode);const out=fn(t.objectStore("kv"));t.oncomplete=()=>res(out&&out.result);t.onerror=()=>rej(t.error);}));
    return{get:k=>tx("readonly",st=>st.get(k)).catch(()=>undefined),set:(k,v)=>tx("readwrite",st=>{st.put(v,k);}).catch(()=>{})};})();
  const PFX="u:"+u.uid+":";

  /* ---- file d'attente des modifications ---- */
  let outbox=[];
  const obReady=idb.get(PFX+"outbox").then(v=>{outbox=Array.isArray(v)?v:[];});
  const saveOutbox=()=>idb.set(PFX+"outbox",outbox);
  function dropEntry(k){const i=outbox.findIndex(e=>e.k===k);if(i>-1){outbox.splice(i,1);saveOutbox();notifyNet();}}
  function send(e){const r=colRef(e.col).child(e.id);
    const p=e.op==="set"?r.set(e.payload):e.op==="update"?r.update(e.payload):r.remove();
    return p.then(()=>dropEntry(e.k),err=>{const me=mapErr(err);
      if(me.code==="permission_denied"){dropEntry(e.k);resync(e.col);flash("Une modification a été refusée par la base : ton accès a peut-être été retiré.");}
      throw me;});}
  async function write(col,id,op,payload){
    await obReady;
    const e={k:Date.now().toString(36)+Math.random().toString(36).slice(2,8),col,id,op,payload:payload==null?null:clean(payload),ts:Date.now()};
    outbox.push(e);saveOutbox();notifyNet();
    const m=mirrors.get(col);
    if(m){if(!m.data&&!connected)m.data={};if(m.data){applyOne(m.data,e);emitM(m);persistSoon(col,m);}}
    const p=send(e);
    if(!connected){p.catch(()=>{});return;}   /* hors ligne : enregistré localement, envoyé au retour du réseau */
    return p;
  }
  obReady.then(()=>{for(const e of outbox.slice())send(e).catch(()=>{});notifyNet();});

  /* ---- collections synchronisées, servies depuis la copie locale ---- */
  const mirrors=new Map();const timers=new Map();
  function applyOne(data,e){
    if(e.op==="set")data[e.id]=clone(e.payload);
    else if(e.op==="update"){const cur=data[e.id]?{...data[e.id]}:{};for(const[k,v]of Object.entries(e.payload||{})){if(v===null)delete cur[k];else cur[k]=clone(v);}data[e.id]=cur;}
    else delete data[e.id];
  }
  function applyPending(m,col){for(const e of outbox)if(e.col===col)applyOne(m.data,e);}
  function emitM(m){const v=m.data||{};const meta={fromCache:!m.server,hasPendingWrites:false};
    const docs=Object.keys(v).map(id=>({id,exists:true,data:()=>v[id],metadata:meta}));
    const snap={docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:meta};
    m.subs.forEach(f=>{try{f(snap);}catch(err){console.error(err);}});}
  function persistSoon(col,m){clearTimeout(timers.get(col));timers.set(col,setTimeout(()=>idb.set(PFX+"col:"+col,m.data),700));}
  function resync(col){const m=mirrors.get(col);if(!m||!m.server)return;m.data=clone(m.server);applyPending(m,col);emitM(m);persistSoon(col,m);}
  function getMirror(col){
    let m=mirrors.get(col);if(m)return m;
    m={data:null,server:null,subs:new Set(),errs:new Set(),ref:colRef(col)};mirrors.set(col,m);
    Promise.all([idb.get(PFX+"col:"+col),obReady]).then(([v])=>{
      if(m.server!==null||mirrors.get(col)!==m)return;
      if(v&&typeof v==="object"){m.data=v;applyPending(m,col);emitM(m);}
      else if(!connected){m.data={};applyPending(m,col);emitM(m);}
    });
    m.h=s=>{const val=s.val()||{};obReady.then(()=>{m.server=val;m.data=clone(val);applyPending(m,col);emitM(m);persistSoon(col,m);});};
    m.ref.on("value",m.h,err=>{const me=mapErr(err);m.errs.forEach(f=>f(me));});
    return m;
  }

  function docRef(col,id){return{id,path:col+"/"+id,
    async get(){const m=mirrors.get(col);
      if(m&&m.data)return{id,exists:!!m.data[id],data:()=>m.data[id]};
      if(!connected){const v=await idb.get(PFX+"col:"+col);const d=v&&v[id];return{id,exists:!!d,data:()=>d};}
      try{const s=await withTimeout(colRef(col).child(id).get(),8000);return{id,exists:s.exists(),data:()=>s.exists()?s.val():undefined};}catch(e){throw mapErr(e);}},
    set:d=>write(col,id,"set",d),
    update:d=>write(col,id,"update",d),
    delete:()=>write(col,id,"delete",null),
    async acquire({holder,ttlMs=30000}){
      if(!connected)return{acquired:true};
      try{const res=await withTimeout(rtdb.ref(ROOT+"/locks/"+enc(col)+"~"+id).transaction(cur=>{if(cur&&cur.exp>Date.now()&&cur.holder!==holder)return;return{holder,exp:Date.now()+ttlMs};}),5000);
        return{acquired:res.committed};}catch{return{acquired:true};}},
    onSnapshot(next,err){return db.collection(col).onSnapshot(snap=>{const d=snap.docs.find(x=>x.id===id);next({id,exists:!!d,data:()=>d?d.data():undefined,metadata:snap.metadata});},err);}};}

  const db={
    doc(path){const i=path.lastIndexOf("/");return docRef(path.slice(0,i),path.slice(i+1));},
    collection(path){return{path,
      doc(id){return docRef(path,id||colRef(path).push().key);},
      async add(d){const ref=docRef(path,colRef(path).push().key);await ref.set(d);return ref;},
      onSnapshot(next,err){const m=getMirror(path);m.subs.add(next);if(err)m.errs.add(err);
        if(m.data)queueMicrotask(()=>{if(m.subs.has(next))emitM({...m,subs:new Set([next])});});
        return()=>{m.subs.delete(next);if(err)m.errs.delete(err);
          if(!m.subs.size){m.ref.off("value",m.h);mirrors.delete(path);}};}};}
  };

  /* ---- indicateur réseau ---- */
  function notifyNet(){const el=document.getElementById("ddc-net");if(!el)return;const n=outbox.length;
    if(connected&&!n){el.hidden=true;return;}
    el.hidden=false;el.className="ddc-net "+(connected?"sync":"off");
    el.textContent=connected?"Synchronisation… "+n:"Hors ligne"+(n?" · "+n+" modif. en attente":"");
    el.title=connected?"Envoi des modifications faites hors ligne":"Tes modifications sont gardées sur cet appareil et seront envoyées au retour du réseau.";}
  function flash(msg){const t=document.createElement("div");t.className="toast";t.setAttribute("role","status");t.textContent=msg;document.body.append(t);setTimeout(()=>t.remove(),5000);}
  window.addEventListener("online",notifyNet);window.addEventListener("offline",notifyNet);

  /* people */
  const users={};let usersReady;const usersP=new Promise(r=>usersReady=r);
  idb.get(PFX+"users").then(v=>{if(v&&typeof v==="object")for(const k in v)if(!users[k])users[k]=v[k];usersReady();});
  setTimeout(()=>usersReady(),2500);
  rtdb.ref(ROOT+"/users").on("value",s=>{Object.assign(users,s.val()||{});idb.set(PFX+"users",users);usersReady();},()=>usersReady());
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
    if(!navigator.onLine)throw{code:"offline",message:"hors ligne"};
    const key=activeKey();if(!key)throw{code:"no_key",message:"clé API absente"};
    let r;
    try{r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",signal:opts.signal,
      headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:CFG.model||"claude-sonnet-5-5",max_tokens:4096,messages:[{role:"user",content:String(prompt)}]})});}
    catch(e){if(e&&e.name==="AbortError")throw{code:"cancelled"};throw{code:navigator.onLine?"upstream_error":"offline",message:String(e)};}
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

  IS_ADMIN=isAdmin;RTDB=rtdb;
  rtdb.ref(ROOT+"/secrets/anthropicKey").on("value",s=>{sharedKey=s.val()||"";},()=>{});
  mountAccount(u,isAdmin,rtdb);whenBody(()=>setTimeout(notifyNet,0));
  return{db,user,room,sample,downloads};
}

/* ---------- compte, clé API, équipe ---------- */
function modal(html){const sc=document.createElement("div");sc.className="scrim";sc.innerHTML=`<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  sc.addEventListener("pointerdown",e=>{if(e.target===sc)sc.remove();});sc.addEventListener("keydown",e=>{if(e.key==="Escape")sc.remove();});document.body.append(sc);return sc;}
function openKey(bad){
  if(IS_ADMIN&&RTDB){openTeamKey(bad);return;}
  if(sharedKey&&!bad&&!LS.get("ddc.apikey")){const m=modal(`<h3>Analyse IA</h3><p>L'équipe utilise la clé API enregistrée par l'administrateur. Tu n'as rien à configurer.</p><div class="mfoot"><button class="btn primary" id="ddc-k-ok">OK</button></div>`);m.querySelector("#ddc-k-ok").onclick=()=>m.remove();return;}
  const m=modal(`<h3>Analyse IA</h3>
    <p>${bad?"La clé API de l'équipe a été refusée par Anthropic.":"Aucune clé API n'est encore enregistrée pour l'équipe."} Préviens l'administrateur ${escH(CFG.adminEmail||"")} pour qu'il l'enregistre ou la remplace.</p>
    <div class="mfoot"><button class="btn primary" id="ddc-k-ok">OK</button></div>`);
  m.querySelector("#ddc-k-ok").onclick=()=>m.remove();
}
function openTeamKey(bad){
  const masked=sharedKey?"•••• "+sharedKey.slice(-4):"aucune";
  const m=modal(`<h3>Clé API de l'équipe</h3>
    ${bad?`<p class="ddc-err">La clé actuelle a été refusée par Anthropic. Remplace-la.</p>`:""}
    <p class="empty">Cette clé Anthropic sert à l'analyse IA pour tous les membres. Elle est stockée dans Firebase, lisible seulement par l'équipe connectée, et n'apparaît jamais dans le code GitHub. Clé actuelle : <b>${escH(masked)}</b></p>
    <input type="password" id="ddc-key" placeholder="sk-ant-… (nouvelle clé)" autocomplete="off" aria-label="Nouvelle clé API">
    <div class="mfoot">${sharedKey?`<button class="btn danger" id="ddc-key-del">Supprimer la clé</button>`:""}<button class="btn" id="ddc-key-c">Annuler</button><button class="btn primary" id="ddc-key-ok">Enregistrer pour l'équipe</button></div>`);
  const i=m.querySelector("#ddc-key");i.focus();const ref=RTDB.ref(ROOT+"/secrets/anthropicKey");
  const fail=e=>alert("Enregistrement refusé : "+(e.code||e.message)+". Vérifie que les règles de la base sont à jour.");
  m.querySelector("#ddc-key-c").onclick=()=>m.remove();
  const del=m.querySelector("#ddc-key-del");if(del)del.onclick=()=>ref.remove().then(()=>m.remove(),fail);
  m.querySelector("#ddc-key-ok").onclick=()=>{const v=i.value.trim();if(!v)return;
    if(!/^sk-ant-/.test(v)&&!confirm("Cette clé ne commence pas par sk-ant-. L'enregistrer quand même ?"))return;
    LS.del("ddc.apikey");ref.set(v).then(()=>m.remove(),fail);};
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
    const net=document.createElement("span");net.id="ddc-net";net.className="ddc-net";net.hidden=true;net.setAttribute("role","status");top.insertBefore(net,b);
    b.onclick=()=>{const old=document.getElementById("ddc-menu");if(old){old.remove();return;}
      const d=document.createElement("div");d.id="ddc-menu";d.className="pop";
      d.innerHTML=`<div class="ptitle">${escH(u.email||"")}</div>
        <button data-a="key"><span>${isAdmin?"Clé API de l'équipe":"Analyse IA"}${activeKey()?" ✓":""}</span></button>
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
  if("serviceWorker" in navigator&&window.isSecureContext&&!CFG.noServiceWorker){
    const hadController=!!navigator.serviceWorker.controller;let reloaded=false;
    /* nouvelle version installée : on recharge une fois pour l'afficher */
    navigator.serviceWorker.addEventListener("controllerchange",()=>{if(hadController&&!reloaded){reloaded=true;location.reload();}});
    navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(r=>{
      const check=()=>r.update().catch(()=>{});setInterval(check,5*60*1000);document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")check();});
    }).catch(()=>{});}
  const c=fbConfig();
  if(!window.firebase||!c.apiKey||!c.databaseURL){showSetup();return;}
  firebase.initializeApp(c);
  let done=false;
  firebase.auth().onAuthStateChanged(async u=>{
    if(done){location.reload();return;}
    if(!u){showLogin();return;}
    const admin=isAdminEmail(u.email);let member=admin;
    const MK="ddc.member."+u.uid;
    if(!member){try{member=(await Promise.race([firebase.database().ref(ROOT+"/team/"+emailKey(u.email)).get(),new Promise((_,r)=>setTimeout(()=>r("timeout"),6000))])).exists();if(member)LS.set(MK,"1");else LS.del(MK);}
      catch{member=LS.get(MK)==="1";}}
    if(!member){showDenied(u);return;}
    firebase.database().ref(ROOT+"/users/"+u.uid).update({name:u.displayName||u.email||"",photo:u.photoURL||"",email:(u.email||"").toLowerCase()}).catch(()=>{});
    done=true;hideGate();resolveSvc(build(u,admin));
  });
  firebase.auth().getRedirectResult().catch(e=>{if(!done&&navigator.onLine)showLogin("Connexion impossible ("+(e.code||"erreur")+").");});
}
start();
})();
