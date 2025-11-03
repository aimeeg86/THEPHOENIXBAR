// app.js — Supabase sync + offline-friendly + edit-mode-only uploads
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Your Supabase project
const SUPABASE_URL  = 'https://rhbouqwhbztqxrwefrea.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoYm91cXdoYnp0cXhyd2VmcmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNzU3OTUsImV4cCI6MjA3Nzc1MTc5NX0.61hB6oAMfRIXgOAo-8b1GQfDfqoxG1lPpX9n1kbJGXs';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });

const TABLE  = 'phoenix_content';
const BUCKET = 'media';
const lsKey  = 'phoenix-content';

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// ---------- local storage helpers ----------
function saveLocal(map){
  const cur = JSON.parse(localStorage.getItem(lsKey) || '{}');
  localStorage.setItem(lsKey, JSON.stringify({ ...cur, ...map }));
}
function loadLocal(){
  return JSON.parse(localStorage.getItem(lsKey) || '{}');
}
function replaceLocal(map){
  localStorage.setItem(lsKey, JSON.stringify(map || {}));
}

// ---------- apply content to DOM ----------
function applyToDOM(map){
  $$('.editable').forEach(el=>{
    const k = el.dataset.key || el.id || el.dataset.editKey;
    if (k && map[k] != null) el.innerHTML = map[k];
  });
  // posters
  for (let i=0;i<4;i++){
    const url = map[`live.${i}.poster`];
    if (url) { const img = $(`#live${i}Poster`); if (img) img.src = url; }
  }
  // gallery
  renderList('galleryGrid', map['gallery.list'], 'img');
  // videos
  renderList('videoGrid', map['videos.list'], 'video');
}
function renderList(containerId, json, kind){
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = '';
  let arr = [];
  try { arr = JSON.parse(json || '[]'); } catch {}
  arr.forEach(u=>{
    if (kind === 'img'){
      const img = document.createElement('img');
      img.src = u; img.style.width='100%';
      img.style.border='2px solid #b49361'; img.style.borderRadius='10px';
      wrap.appendChild(img);
    }else{
      const v = document.createElement('video');
      v.src = u; v.controls = true; v.style.width = '100%';
      wrap.appendChild(v);
    }
  });
}

// ---------- Supabase text sync ----------
async function upsertMap(map){
  const rows = Object.entries(map).map(([key,value])=>({ key, value: String(value) }));
  const { error } = await supabase.from(TABLE).upsert(rows);
  if (error) console.warn('Supabase upsert error:', error.message);
}
async function fetchAll(){
  const { data, error } = await supabase.from(TABLE).select('*');
  if (error){ console.warn('Supabase fetch error:', error.message); return {}; }
  const map = {}; (data||[]).forEach(r => map[r.key] = r.value);
  return map;
}

// ---------- Supabase Storage (public URLs) ----------
function publicURL(path){
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(path)}`;
}
async function uploadToBucket(path, file){
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600', upsert: true, contentType: file.type || undefined
  });
  if (error) throw error;
  return publicURL(path);
}

// ---------- Save text (debounced) ----------
function debounce(fn, ms=400){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }
const saveText = debounce(async ()=>{
  const map = {};
  $$('.editable').forEach(el=>{
    const k = el.dataset.key || el.id || el.dataset.editKey;
    if (k) map[k] = el.innerHTML;
  });
  saveLocal(map);
  try{ await upsertMap(map); }catch(e){}
}, 300);

// ---------- Upload handlers (only in edit mode) ----------
async function handleUpload(input){
  if (!document.body.classList.contains('edit-mode')) return; // locked unless edit-mode
  const target = input.dataset.upload;
  if (!target) return;

  try{
    if (target.startsWith('live.') && target.endsWith('.poster')){
      const idx  = target.split('.')[1];
      const file = input.files[0]; if (!file) return;
      const url  = await uploadToBucket(`live/poster-${idx}-${Date.now()}-${file.name}`, file);
      const key  = `live.${idx}.poster`;
      saveLocal({ [key]: url }); await upsertMap({ [key]: url });
      const img = document.getElementById(`live${idx}Poster`); if (img) img.src = url;
    } else if (target === 'gallery'){
      const cur = JSON.parse(loadLocal()['gallery.list'] || '[]');
      for (const f of input.files){
        const url = await uploadToBucket(`gallery/${Date.now()}-${f.name}`, f);
        cur.push(url);
      }
      const map = { 'gallery.list': JSON.stringify(cur) };
      saveLocal(map); await upsertMap(map); renderList('galleryGrid', map['gallery.list'], 'img');
    } else if (target === 'videos'){
      const cur = JSON.parse(loadLocal()['videos.list'] || '[]');
      for (const f of input.files){
        const url = await uploadToBucket(`videos/${Date.now()}-${f.name}`, f);
        cur.push(url);
      }
      const map = { 'videos.list': JSON.stringify(cur) };
      saveLocal(map); await upsertMap(map); renderList('videoGrid', map['videos.list'], 'video');
    } else if (target === 'restore'){
      const file = input.files[0]; if (!file) return;
      const text = await file.text(); const data = JSON.parse(text || '{}');
      replaceLocal(data); await upsertMap(data); applyToDOM(data);
    }
  }catch(e){
    alert('Upload failed: ' + (e?.message || e));
  } finally {
    input.value = '';
  }
}

// ---------- Edit mode UI (5 taps on footer) ----------
(function initEditToggle(){
  const footer = document.querySelector('.footer');
  let taps = 0, timer;
  footer.addEventListener('click', ()=>{
    taps++; clearTimeout(timer);
    timer = setTimeout(()=>taps=0, 800);
    if (taps >= 5){
      document.body.classList.toggle('edit-mode');
      $('#editorBar')?.classList.toggle('hidden', !document.body.classList.contains('edit-mode'));
      alert(document.body.classList.contains('edit-mode') ? 'Edit mode ON' : 'Edit mode OFF');
      taps = 0;
    }
  });
})();

// Editor bar controls
document.addEventListener('DOMContentLoaded', ()=>{
  $('#editorBar [data-action="toggle"]')?.addEventListener('click', ()=>{
    document.body.classList.toggle('edit-mode');
    $('#editorBar')?.classList.toggle('hidden', !document.body.classList.contains('edit-mode'));
  });
  $('#editorBar [data-action="backup"]')?.addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(loadLocal(), null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='phoenix-backup.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  });
  $$('#editorBar input[type="file"], [data-upload]').forEach(inp=>{
    inp.addEventListener('change', ()=>handleUpload(inp));
  });
});

// ---------- Init: load local first, then Supabase ----------
document.addEventListener('DOMContentLoaded', async ()=>{
  // local -> DOM
  applyToDOM(loadLocal());

  // remote -> merge -> DOM
  try{
    const remote = await fetchAll();
    const merged = { ...loadLocal(), ...remote };
    replaceLocal(merged);
    applyToDOM(merged);
  }catch(e){ console.warn('Initial sync skipped:', e?.message || e); }

  // text listeners
  $$('.editable').forEach(el=> el.addEventListener('input', saveText));

  // register service worker (cache-bust by versioning CSS/HTML in SW file)
  if ('serviceWorker' in navigator){
    try { await navigator.serviceWorker.register('./service-worker.js'); } catch {}
  }
});
