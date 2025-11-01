// app.js — content management + offline video storage
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const DEFAULT_HOURS = [
  ["Monday","12:00 – 23:00"],
  ["Tuesday","12:00 – 23:00"],
  ["Wednesday","12:00 – 23:00"],
  ["Thursday","12:00 – 23:00"],
  ["Friday","12:00 – 01:00"],
  ["Saturday","12:00 – 01:00"],
  ["Sunday","12:00 – 23:00"],
];

const DEFAULT_WHATS = [
  ["Mon","Open Mic"],["Tue","Pub Quiz"],["Wed","Karaoke"],
  ["Thu","Acoustic Night"],["Fri","Live Band"],["Sat","DJ"],
  ["Sun","Chilled Classics"]
];

// ---------- IndexedDB helpers for videos ----------
const DB_NAME = 'phoenix-media';
const DB_STORE = 'videos';

function idbOpen(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains(DB_STORE)){
        db.createObjectStore(DB_STORE, {keyPath:'id', autoIncrement:true});
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}
async function idbAddVideo(blob){
  const db = await idbOpen();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(DB_STORE,'readwrite');
    tx.objectStore(DB_STORE).add({blob, ts:Date.now()});
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e.target.error);
  });
}
async function idbListVideos(){
  const db = await idbOpen();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(DB_STORE,'readonly');
    const req = tx.objectStore(DB_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = e => reject(e.target.error);
  });
}
async function idbClear(){
  const db = await idbOpen();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(DB_STORE,'readwrite');
    tx.objectStore(DB_STORE).clear();
    tx.oncomplete = ()=>resolve();
    tx.onerror = e=>reject(e.target.error);
  });
}

// ---------- Data load/render ----------
function loadData(){
  const data = JSON.parse(localStorage.getItem('phoenix-data')||'{}');
  // About
  $('#aboutText').textContent = data.about || $('#aboutText').textContent;
  // Deals
  for(let i=1;i<=4;i++){
    const key = 'deal'+i;
    if(data[key]) $('#'+key).textContent = data[key];
  }
  // Hours + Whats On
  renderHours(data.hours || DEFAULT_HOURS);
  renderWhatsOn(data.whats || DEFAULT_WHATS);
  // Live text
  if(data.liveText) $('#liveText').textContent = data.liveText;
  // Live image (base64)
  if(data.liveImage){
    $('#liveImage').src = data.liveImage;
  } else {
    // hide image placeholder until one is set
    $('#liveImage').style.display = 'none';
  }
  // Fixtures
  renderFixtures(data.fixtures || []);
}
function renderHours(items){
  const ul = $('#hoursList');
  ul.innerHTML='';
  items.forEach(([day, hours]) => {
    const li = document.createElement('li');
    li.textContent = `${day}: ${hours}`;
    ul.appendChild(li);
  });
}
function renderWhatsOn(items){
  const ul = $('#whatsOnList');
  ul.innerHTML='';
  items.forEach(([day, txt]) => {
    const li = document.createElement('li');
    li.textContent = `${day}: ${txt}`;
    ul.appendChild(li);
  });
}
function renderFixtures(list){
  const box = $('#fixtures');
  box.innerHTML='';
  list.forEach(f => {
    const el = document.createElement('div');
    el.className = 'fixture';
    el.innerHTML = `
      <div class="home">${f.home||''}</div>
      <div class="vs">vs</div>
      <div class="away">${f.away||''}</div>
      <div class="meta">${f.date||''} &nbsp; ${f.time||''} &nbsp; ${f.channel||''}</div>
    `;
    box.appendChild(el);
  });
}

// ---------- Admin modal ----------
const adminDlg = $('#adminDlg');

function fillAdminForm(){
  const data = JSON.parse(localStorage.getItem('phoenix-data')||'{}');
  $('#f_about').value = data.about || $('#aboutText').textContent;
  for(let i=1;i<=4;i++){
    const key='deal'+i;
    $('#f_'+key).value = data[key] || $('#'+key).textContent;
  }
  // Hours fields
  const hoursWrap = $('#hoursFields');
  hoursWrap.innerHTML = '';
  (data.hours || DEFAULT_HOURS).forEach(([day,hrs], idx) => {
    const row = document.createElement('div');
    row.innerHTML = `<label>${day}<input type="text" data-hours="${idx}" value="${hrs}"></label>`;
    hoursWrap.appendChild(row);
  });
  // Whats fields
  const whatsWrap = $('#whatsFields');
  whatsWrap.innerHTML='';
  (data.whats || DEFAULT_WHATS).forEach(([day,txt], idx) => {
    const row = document.createElement('div');
    row.innerHTML = `<label>${day}<input type="text" data-whats="${idx}" value="${txt}"></label>`;
    whatsWrap.appendChild(row);
  });
  // Live text
  $('#f_liveText').value = data.liveText || $('#liveText').textContent;
  // Fixtures
  const fxWrap = $('#fixturesFields');
  fxWrap.innerHTML='';
  (data.fixtures || []).forEach((f, i)=> fxWrap.appendChild(fixtureRow(f, i)));
}
function fixtureRow(fx={}, idx){
  const row = document.createElement('div');
  row.className='grid grid--2';
  row.style.marginBottom='8px';
  row.innerHTML = `
    <label>Home<input type="text" data-fix="${idx}" data-field="home" value="${fx.home||''}"></label>
    <label>Away<input type="text" data-fix="${idx}" data-field="away" value="${fx.away||''}"></label>
    <label>Date<input type="text" data-fix="${idx}" data-field="date" value="${fx.date||''}"></label>
    <label>Time<input type="text" data-fix="${idx}" data-field="time" value="${fx.time||''}"></label>
    <label>Channel<input type="text" data-fix="${idx}" data-field="channel" value="${fx.channel||''}"></label>
    <div></div>
  `;
  return row;
}
$('#addFixture').addEventListener('click',()=>{
  const fxWrap = $('#fixturesFields');
  const idx = fxWrap.querySelectorAll('[data-fix]').length/5; // 5 fields per fixture
  fxWrap.appendChild(fixtureRow({}, idx));
});

// Save handler
$('#saveBtn').addEventListener('click', async (e)=>{
  e.preventDefault();
  const data = JSON.parse(localStorage.getItem('phoenix-data')||'{}');
  data.about = $('#f_about').value.trim();
  for(let i=1;i<=4;i++){
    const key='deal'+i;
    data[key] = $('#f_'+key).value.trim();
  }
  // Hours
  const hours = [];
  $$('#hoursFields [data-hours]').forEach((inp,i) => {
    const day = (DEFAULT_HOURS[i]||[''])[0];
    hours.push([day, inp.value.trim()||'Closed']);
  });
  data.hours = hours;
  // Whats
  const whats = [];
  $$('#whatsFields [data-whats]').forEach((inp,i)=>{
    const day = (DEFAULT_WHATS[i]||[''])[0];
    whats.push([day, inp.value.trim()]);
  });
  data.whats = whats;
  // Live text
  data.liveText = $('#f_liveText').value.trim();
  // Live image -> base64
  const fileImg = $('#f_liveImage').files[0];
  if(fileImg){
    data.liveImage = await fileToDataURL(fileImg);
  }
  // Videos
  const vids = $('#f_videos').files;
  for(const v of vids){
    await idbAddVideo(v);
  }
  localStorage.setItem('phoenix-data', JSON.stringify(data));
  adminDlg.close();
  loadData();
  await renderVideos();
});
$('#clearAll').addEventListener('click', async ()=>{
  if(confirm('Clear ALL saved data on this device?')){
    localStorage.removeItem('phoenix-data');
    await idbClear();
    location.reload();
  }
});
$('#exportBtn').addEventListener('click', ()=>{
  const data = localStorage.getItem('phoenix-data')||'{}';
  const blob = new Blob([data], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'phoenix-data.json';
  a.click();
});
$('#importFile').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const text = await file.text();
  localStorage.setItem('phoenix-data', text);
  loadData();
});

async function fileToDataURL(file){
  return new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

async function renderVideos(){
  const wrap = $('#videoGallery');
  wrap.innerHTML='';
  const items = await idbListVideos();
  for(const it of items){
    const url = URL.createObjectURL(it.blob);
    const v = document.createElement('video');
    v.controls = true;
    v.src = url;
    wrap.appendChild(v);
  }
}

// ---------- Tap 5x on oak footer to open admin ----------
(function setupTapUnlock(){
  let taps = 0;
  let timer = null;
  $('#oakFooter').addEventListener('click', ()=>{
    taps++;
    if(timer) clearTimeout(timer);
    timer = setTimeout(()=>{ taps=0; }, 2000);
    if(taps>=5){
      taps=0; clearTimeout(timer);
      fillAdminForm();
      adminDlg.showModal();
    }
  });
})();

// Init
loadData();
renderVideos();
