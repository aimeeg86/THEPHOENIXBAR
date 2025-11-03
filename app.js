// app.js — Supabase sync + offline fallback + uploads
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Your Supabase project (from Settings → API)
const SUPABASE_URL = 'https://rhbouqwhbztqxrwefrea.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoYm91cXdoYnp0cXhyd2VmcmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNzU3OTUsImV4cCI6MjA3Nzc1MTc5NX0.61hB6oAMfRIXgOAo-8b1GQfDfqoxG1lPpX9n1kbJGXs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

const TABLE  = 'phoenix_content'; // run the SQL I gave you to create this
const BUCKET = 'media';            // create a public bucket named "media"

// ---------- utilities ----------
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>[...document.querySelectorAll(s)];
const lsKey = 'phoenix-content';

// offline-friendly save/load for text
function saveLocal(map){
  const existing = JSON.parse(localStorage.getItem(lsKey) || '{}');
  localStorage.setItem(lsKey, JSON.stringify({ ...existing, ...map }));
}
function loadLocal(){
  return JSON.parse(localStorage.getItem(lsKey) || '{}');
}

// apply map to DOM (for elements with data-key)
function applyToDOM(map){
  $$('.editable').forEach(el=>{
    const k = el.dataset.key || el.id || el.dataset.editKey;
    if(k && map[k] != null) el.innerHTML = map[k];
  });
  // posters
  for(let i=0;i<4;i++){
    const url = map[`live.${i}.poster`];
    if(url) {
      const img = document.getElementById(`live${i}Poster`);
      if(img) img.src = url;
    }
  }
  // gallery
  renderListFromMap('galleryGrid','gallery.list','img');
  // videos
  renderListFromMap('videoGrid','videos.list','video');
}

function renderListFromMap(containerId, key, type){
  const wrap = document.getElementById(containerId);
  if(!wrap) return;
  wrap.innerHTML = '';
  const list = JSON.parse((loadLocal()[key] || '[]'));
  list.forEach(url=>{
    if(type==='img'){
      const img = document.createElement('img');
      img.src = url; img.style.width='100%';
      img.style.border='2px solid #b49361'; img.style.borderRadius='10px';
      wrap.appendChild(img);
    } else {
      const v = document.createElement('video');
      v.src = url; v.controls = true; v.style.width='100%';
      wrap.appendChild(v);
    }
  });
}

// ---------- Supabase DB (text) ----------
async function upsertMap(map){
  const rows = Object.entries(map).map(([key,value])=>({key, value: String(value)}));
  const { error } = await supabase.from(TABLE).upsert(rows);
  if(error) console.warn('Supabase upsert error:', error.message);
}
async function fetchAll(){
  const { data, error } = await supabase.from(TABLE).select('*');
  if(error){ console.warn('Supabase fetch error:', error.message); return {}; }
  const map = {};
  (data || []).forEach(r => map[r.key] = r.value);
  // persist gallery/videos lists locally too
  if(map['gallery.list']) saveLocal({ 'gallery.list': map['gallery.list'] });
  if(map['videos.list'])  saveLocal({ 'videos.list' : map['videos.list']  });
  return map;
}

// ---------- Supabase Storage (media) ----------
function publicURL(path){
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(path)}`;
}

async function uploadToBucket(path, file){
  // upsert upload
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || undefined
  });
  if(error) throw error;
  return publicURL(path);
}

// ---------- Editor & persistence ----------
let editMode=false, tapCount=0, tapTimer=null;

function toggleEdit(on){
  editMode = on;
  $$('.editable').forEach(el => el.contentEditable = on);
  $('#editorBar')?.classList.toggle('hidden', !on);
  if(on) alert('Edit mode ON'); else alert('Edit mode OFF');
}

function debounce(fn, ms=400){
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
}

// Save text to local + supabase
const saveText = debounce(async ()=>{
  const map = {};
  $$('.editable').forEach(el=>{
    const k = el.dataset.key || el.id || el.dataset.editKey;
    if(k) map[k] = el.innerHTML;
  });
  saveLocal(map);
  try{ await upsertMap(map); }catch(e){ /* offline ok */ }
}, 300);

// ---------- Upload handlers ----------
async function handleUpload(input){
  const target = input.dataset.upload;
  if(!target) return;

  try{
    if(target.startsWith('live.') && target.endsWith('.poster')){
      const idx = target.split('.')[1];
      const file = input.files[0]; if(!file) return;
      const url = await uploadToBucket(`live/poster-${idx}-${Date.now()}-${file.name}`, file);
      saveLocal({[`live.${idx}.poster`]: url});
      await upsertMap({[`live.${idx}.poster`]: url});
      const img = document.getElementById(`live${idx}Poster`);
      if(img) img.src = url;
    } else if (target === 'gallery'){
      const urls = JSON.parse(loadLocal()['gallery.list'] || '[]');
      for(const f of input.files){
        const url = await uploadToBucket(`gallery/${Date.now()}-${f.name}`, f);
        urls.push(url);
      }
      const map = {'gallery.list': JSON.stringify(urls)};
      saveLocal(map); await upsertMap(map);
      renderListFromMap('galleryGrid','gallery.list','img');
    } else if (target === 'videos'){
      const urls = JSON.parse(loadLocal()['videos.list'] || '[]');
      for(const f of input.files){
        const url = await uploadToBucket(`videos/${Date.now()}-${f.name}`, f);
        urls.push(url);
      }
      const map = {'videos.list': JSON.stringify(urls)};
      saveLocal(map); await upsertMap(map);
      renderListFromMap('videoGrid','videos.list','video');
    } else if (target === 'restore'){
      const file = input.files[0]; if(!file) return;
      const text = await file.text();
      const data = JSON.parse(text || '{}');
      saveLocal(data);
      await upsertMap(data);
      applyToDOM(loadLocal());
    }
  }catch(e){
    alert('Upload failed: ' + (e?.message || e));
  } finally {
    input.value = '';
  }
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', async () => {
  // footer 5x to open editor
  $('.footer')?.addEventListener('click', ()=>{
    tapCount++; clearTimeout(tapTimer);
    tapTimer = setTimeout(()=>tapCount=0, 800);
    if(tapCount>=5){ toggleEdit(true); tapCount=0; }
  });

  // text listeners
  $$('.editable').forEach(el => el.addEventListener('input', saveText));

  // editor bar controls
  $('#editorBar [data-action="toggle"]')?.addEventListener('click', ()=>toggleEdit(!editMode));
  $('#editorBar [data-action="backup"]')?.addEventListener('click', ()=>{
    const data = loadLocal();
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='phoenix-backup.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  });
  $$('#editorBar input[type="file"]').forEach(inp=>{
    inp.addEventListener('change', ()=>handleUpload(inp));
  });

  // 1) apply whatever is cached locally (instant)
  applyToDOM(loadLocal());

  // 2) then fetch latest from Supabase and merge (live sync)
  try{
    const remote = await fetchAll();
    saveLocal(remote);          // merge remote into local
    applyToDOM(loadLocal());    // reapply merged
  }catch(e){
    console.warn('Initial sync skipped (likely offline):', e?.message || e);
  }
});
