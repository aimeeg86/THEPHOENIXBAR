// Simple content save (text) + basic media persistence using IndexedDB
let editMode = false, tapCount = 0, tapTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  // text restore
  restoreText();

  // footer 5x tap to show editor
  document.querySelector('.footer').addEventListener('click', () => {
    tapCount++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => (tapCount = 0), 800);
    if (tapCount >= 5) {
      document.getElementById('editorBar').classList.toggle('hidden', false);
      toggleEdit(true);
      tapCount = 0;
    }
  });

  // text save
  document.querySelectorAll('.editable').forEach(el => {
    el.addEventListener('input', saveText);
  });

  // editor bar buttons
  document.querySelector('#editorBar [data-action="toggle"]').addEventListener('click', () => {
    toggleEdit(!editMode);
  });
  document.querySelector('#editorBar [data-action="backup"]').addEventListener('click', backupText);
  document.querySelectorAll('#editorBar input[type="file"]').forEach(inp => {
    inp.addEventListener('change', () => handleUpload(inp));
  });

  await initDB();
  await restoreMedia();
});

// ---------- TEXT (localStorage) ----------
function saveText(){
  const data = {};
  document.querySelectorAll('.editable').forEach(el => {
    const k = el.dataset.key || el.id || el.dataset.editKey;
    if (k) data[k] = el.innerHTML;
  });
  localStorage.setItem('phoenix-content', JSON.stringify(data));
}
function restoreText(){
  const data = JSON.parse(localStorage.getItem('phoenix-content') || '{}');
  document.querySelectorAll('.editable').forEach(el => {
    const k = el.dataset.key || el.id || el.dataset.editKey;
    if (k && data[k]) el.innerHTML = data[k];
  });
}
function backupText(){
  const data = localStorage.getItem('phoenix-content') || '{}';
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'phoenix-backup.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}

// ---------- EDIT MODE ----------
function toggleEdit(on){
  editMode = on;
  document.querySelectorAll('.editable').forEach(el => el.contentEditable = on);
  document.getElementById('editorBar').classList.toggle('hidden', !on);
}

// ---------- MEDIA (IndexedDB) ----------
let db;
function initDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('phoenix-media', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
    };
    req.onsuccess = () => { db = req.result; resolve(); };
    req.onerror = () => reject(req.error);
  });
}
function idbSet(key, file){
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media','readwrite');
    tx.objectStore('media').put(file, key);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}
function idbGet(key){
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media','readonly');
    const r = tx.objectStore('media').get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function handleUpload(inp){
  const target = inp.dataset.upload;
  if (!target) return;
  if (target.startsWith('live.') && target.endsWith('.poster')){
    const idx = target.split('.')[1];
    const file = inp.files[0]; if (!file) return;
    await idbSet(`live.${idx}.poster`, file);
    await renderPoster(idx);
  } else if (target === 'gallery'){
    for (const f of inp.files){ await idbSet(`gallery.${Date.now()}-${Math.random()}`, f); }
    await renderGallery();
  } else if (target === 'videos'){
    for (const f of inp.files){ await idbSet(`video.${Date.now()}-${Math.random()}`, f); }
    await renderVideos();
  } else if (target === 'restore'){
    const file = inp.files[0]; if (!file) return;
    const text = await file.text();
    localStorage.setItem('phoenix-content', text);
    restoreText();
  }
  inp.value = '';
}
async function blobURL(key){
  const b = await idbGet(key);
  return b ? URL.createObjectURL(b) : null;
}
async function renderPoster(i){
  const url = await blobURL(`live.${i}.poster`);
  if (url) document.getElementById(`live${i}Poster`).src = url;
}
async function renderGallery(){
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = '';
  // list all keys
  const tx = db.transaction('media','readonly');
  const s = tx.objectStore('media');
  const req = s.getAllKeys();
  await new Promise(res => req.onsuccess = () => res());
  const keys = req.result.filter(k => typeof k === 'string' && k.startsWith('gallery.'));
  for (const k of keys){
    const b = await idbGet(k); if (!b) continue;
    const u = URL.createObjectURL(b);
    const img = document.createElement('img');
    img.src = u; img.alt = '';
    img.style.width='100%'; img.style.border='2px solid #b49361'; img.style.borderRadius='10px';
    grid.appendChild(img);
  }
}
async function renderVideos(){
  const grid = document.getElementById('videoGrid');
  grid.innerHTML = '';
  const tx = db.transaction('media','readonly');
  const s = tx.objectStore('media');
  const req = s.getAllKeys();
  await new Promise(res => req.onsuccess = () => res());
  const keys = req.result.filter(k => typeof k === 'string' && k.startsWith('video.'));
  for (const k of keys){
    const b = await idbGet(k); if (!b) continue;
    const u = URL.createObjectURL(b);
    const v = document.createElement('video');
    v.src = u; v.controls = true; v.style.width='100%';
    grid.appendChild(v);
  }
}
async function restoreMedia(){
  for (let i=0;i<4;i++) await renderPoster(i);
  await renderGallery();
  await renderVideos();
}
