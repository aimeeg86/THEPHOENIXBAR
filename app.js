// app.js — Phoenix Bar (final)
//
// Features:
// - Live text sync via Supabase (phoenix_content table)
// - Media uploads to Supabase Storage bucket "media" (gallery, videos, live posters)
// - LocalStorage cache + backup/restore
// - Edit Mode (footer 5× tap) + triple guard on uploads
// - Hours labels auto-added if missing
// - Mobile-friendly and offline-safe (service worker registered here)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------- Supabase config ----------
const SUPABASE_URL  = 'https://rhbouqwhbztqxrwefrea.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoYm91cXdoYnp0cXhyd2VmcmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNzU3OTUsImV4cCI6MjA3Nzc1MTc5NX0.61hB6oAMfRIXgOAo-8b1GQfDfqoxG1lPpX9n1kbJGXs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });
const TABLE  = 'phoenix_content';
const BUCKET = 'media';
const LS_KEY = 'phoenix-content';

// ---------- Helpers ----------
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}
function saveLocal(map) {
  const cur = loadLocal();
  localStorage.setItem(LS_KEY, JSON.stringify({ ...cur, ...map }));
}
function replaceLocal(map) {
  localStorage.setItem(LS_KEY, JSON.stringify(map || {}));
}

function debounce(fn, ms=400) { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

// ---------- Supabase table I/O ----------
async function upsertMap(map){
  const rows = Object.entries(map).map(([key, value]) => ({ key, value: String(value) }));
  const { error } = await supabase.from(TABLE).upsert(rows);
  if (error) console.warn('Supabase upsert error:', error.message);
}
async function fetchAll(){
  const { data, error } = await supabase.from(TABLE).select('*');
  if (error) { console.warn('Supabase fetch error:', error.message); return {}; }
  const map = {};
  (data || []).forEach(r => map[r.key] = r.value);
  return map;
}

// ---------- Supabase Storage ----------
function publicURL(path){
  // bucket is public; construct public URL
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(path)}`;
}
async function uploadToBucket(path, file){
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600', upsert: true, contentType: file.type || undefined
  });
  if (error) throw error;
  return publicURL(path);
}

// ---------- Renderers ----------
function renderList(containerId, json, kind){
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = '';
  let arr = [];
  try { arr = JSON.parse(json || '[]'); } catch { arr = []; }
  (arr || []).forEach(u => {
    if (kind === 'img') {
      const img = document.createElement('img');
      img.src = u; img.style.width = '100%';
      img.style.border = '2px solid #b49361';
      img.style.borderRadius = '10px';
      img.style.objectFit = 'cover';
      wrap.appendChild(img);
    } else {
      const v = document.createElement('video');
      v.src = u; v.controls = true; v.style.width = '100%';
      wrap.appendChild(v);
    }
  });
}

// Auto add day label for hours.*
const HOURS_LABEL = {
  'hours.mon': 'Monday',
  'hours.tue': 'Tuesday',
  'hours.wed': 'Wednesday',
  'hours.thu': 'Thursday',
  'hours.fri': 'Friday',
  'hours.sat': 'Saturday',
  'hours.sun': 'Sunday'
};

function applyToDOM(map){
  $$('.editable').forEach(el => {
    const key = el.dataset.key || el.id || el.dataset.editKey;
    if (!key) return;

    if (map[key] == null) return; // keep default if nothing remote yet

    let val = String(map[key]).trim();

    // Ensure hours lines include the day label
    if (key.startsWith('hours.')) {
      const day = HOURS_LABEL[key] || '';
      const hasLabel = /^[A-Za-z]+:\s*/.test(val);
      if (!hasLabel && day) val = `${day}: ${val}`;
    }

    el.innerHTML = val;
  });

  // Posters
  for (let i=0; i<4; i++){
    const url = map[`live.${i}.poster`];
    if (url) {
      const img = document.getElementById(`live${i}Poster`);
      if (img) img.src = url;
    }
  }

  // Gallery & Videos
  renderList('galleryGrid', map['gallery.list'], 'img');
  renderList('videoGrid',   map['videos.list'],  'video');
}

// ---------- Save text (debounced) ----------
const saveText = debounce(async ()=>{
  const map = {};
  $$('.editable').forEach(el => {
    const k = el.dataset.key || el.id || el.dataset.editKey;
    if (k) map[k] = el.innerHTML;
  });
  saveLocal(map);
  try { await upsertMap(map); } catch(e) { console.warn('Save failed:', e?.message || e); }
}, 300);

// ---------- Uploads (triple-locked) ----------
async function handleUpload(input){
  // HARD GUARD: never upload unless in edit mode
  if (!document.body.classList.contains('edit-mode')) {
    alert('Editing is locked. Tap the footer 5× to enable Edit mode.');
    input.value = '';
    return;
  }

  const target = input.dataset.upload;
  if (!target) return;

  try {
    if (target.startsWith('live.') && target.endsWith('.poster')) {
      // Poster upload
      const idx = target.split('.')[1]; // e.g., '0'
      const file = input.files[0]; if (!file) return;
      const url  = await uploadToBucket(`live/poster-${idx}-${Date.now()}-${file.name}`, file);
      const key  = `live.${idx}.poster`;
      saveLocal({ [key]: url });
      await upsertMap({ [key]: url });
      const img = document.getElementById(`live${idx}Poster`);
      if (img) img.src = url;

    } else if (target === 'gallery') {
      // Multi image upload
      const current = JSON.parse(loadLocal()['gallery.list'] || '[]');
      for (const f of input.files) {
        const url = await uploadToBucket(`gallery/${Date.now()}-${f.name}`, f);
        current.push(url);
      }
      const map = { 'gallery.list': JSON.stringify(current) };
      saveLocal(map); await upsertMap(map);
      renderList('galleryGrid', map['gallery.list'], 'img');

    } else if (target === 'videos') {
      // Multi video upload
      const current = JSON.parse(loadLocal()['videos.list'] || '[]');
      for (const f of input.files) {
        const url = await uploadToBucket(`videos/${Date.now()}-${f.name}`, f);
        current.push(url);
      }
      const map = { 'videos.list': JSON.stringify(current) };
      saveLocal(map); await upsertMap(map);
      renderList('videoGrid', map['videos.list'], 'video');

    } else if (target === 'restore') {
      // Restore from backup JSON
      const file = input.files[0]; if (!file) return;
      const text = await file.text();
      const data = JSON.parse(text || '{}');
      replaceLocal(data);
      await upsertMap(data);
      applyToDOM(data);
      alert('Backup restored.');
    }
  } catch (e) {
    alert('Upload failed: ' + (e?.message || e));
  } finally {
    input.value = '';
  }
}

// ---------- Edit Mode toggling ----------
function setEditState(on) {
  const isOn = !!on;
  document.body.classList.toggle('edit-mode', isOn);

  // Make text content editable / read-only
  $$('.editable').forEach(el => { el.contentEditable = isOn; });

  // Enable/disable all upload inputs
  $$('[data-upload]').forEach(el => {
    el.disabled = !isOn;
    el.tabIndex = isOn ? 0 : -1;
    if (!isOn) el.value = '';
  });

  // Editor bar visibility
  const bar = $('#editorBar');
  if (bar) bar.classList.toggle('hidden', !isOn);
}

// Footer 5× tap toggles edit mode
(function initEditToggle(){
  const footer = $('.footer');
  if (!footer) return;
  let taps = 0, timer;
  footer.addEventListener('click', () => {
    taps++; clearTimeout(timer);
    timer = setTimeout(()=>taps=0, 800);
    if (taps >= 5) {
      const nowOn = !document.body.classList.contains('edit-mode');
      setEditState(nowOn);
      alert(nowOn ? 'Edit mode ON' : 'Edit mode OFF');
      taps = 0;
    }
  });
})();

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', async () => {
  // Start locked (view-only)
  setEditState(false);

  // Bind editor bar actions
  $('#editorBar [data-action="toggle"]')?.addEventListener('click', () => {
    const nowOn = !document.body.classList.contains('edit-mode');
    setEditState(nowOn);
  });
  $('#editorBar [data-action="backup"]')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(loadLocal(), null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'phoenix-backup.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  });

  // Bind uploads
  $$('#editorBar input[type="file"], [data-upload]').forEach(inp => {
    inp.addEventListener('change', () => handleUpload(inp));
  });

  // Local first
  const local = loadLocal();
  applyToDOM(local);

  // Remote then merge
  try {
    const remote = await fetchAll();
    const merged = { ...local, ...remote };
    replaceLocal(merged);
    applyToDOM(merged);
  } catch (e) {
    console.warn('Initial sync skipped:', e?.message || e);
  }

  // Text save listeners
  $$('.editable').forEach(el => el.addEventListener('input', saveText));

  // Register service worker
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('./service-worker.js'); } catch {}
  }
});
