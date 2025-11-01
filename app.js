
const KEY = 'phoenix-data';

const DEFAULT_DATA = {
  about: `Welcome to The Phoenix Bar, your friendly local on Royal Wootton Bassett High Street. Dog friendly, locally run, and always lively — there’s always something going on! Come enjoy live music, sports, cocktails, and great company.`,
  offers: ["Happy Hour Mon–Fri 4–6pm","2‑for‑£10 cocktails every Friday","Local ales on rotation","Seasonal specials"],
  whats: { Mon:"Open Mic", Tue:"Pub Quiz", Wed:"", Thu:"", Fri:"Live Band", Sat:"DJ / Events", Sun:"Chilled Classics" },
  hours: { Mon:"12:00–23:00", Tue:"12:00–23:00", Wed:"12:00–23:00", Thu:"12:00–23:00", Fri:"12:00–01:00", Sat:"12:00–01:00", Sun:"12:00–23:00" },
  music: [
    { title:"", notes:"", image:"" },
    { title:"", notes:"", image:"" },
    { title:"", notes:"", image:"" },
    { title:"", notes:"", image:"" }
  ],
  fixtures:[
    { home:"Spurs", away:"Chelsea", dt:"Sat 1st Nov 5:30 PM", chan:"Sky Sports" },
    { home:"Liverpool", away:"Villa", dt:"Sat 1st Nov 8:00 PM", chan:"TNT Sports" }
  ],
  videos: [] // dataURLs; keep small
};

function loadData(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return structuredClone(DEFAULT_DATA);
    const obj = JSON.parse(raw);
    return Object.assign(structuredClone(DEFAULT_DATA), obj);
  }catch(e){
    return structuredClone(DEFAULT_DATA);
  }
}
function saveData(){ localStorage.setItem(KEY, JSON.stringify(data)); }

let data = loadData();

/* ---------- RENDER ---------- */
function $(sel){ return document.querySelector(sel); }

function renderAbout(){
  $('#aboutText').textContent = data.about || '';
}
function renderOffers(){
  const box = $('#offersGrid');
  box.innerHTML = '';
  (data.offers||[]).slice(0,4).forEach(t=>{
    const p = document.createElement('div');
    p.className='panel';
    p.textContent = t || '';
    box.appendChild(p);
  });
}
function renderWhats(){
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const wrap = $('#whatsGrid');
  wrap.innerHTML='';
  days.forEach(d=>{
    const row = document.createElement('div');
    row.className='row';
    row.innerHTML = `<div class="k">${d}</div><div>${(data.whats?.[d]||'')}</div>`;
    wrap.appendChild(row);
  });
}
function renderHours(){
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const wrap = $('#hoursGrid');
  wrap.innerHTML='';
  days.forEach(d=>{
    const row = document.createElement('div');
    row.className='row';
    row.innerHTML = `<div class="k">${d}</div><div>${(data.hours?.[d]||'')}</div>`;
    wrap.appendChild(row);
  });
}
function renderMusic(){
  const grid = $('#musicGrid');
  grid.innerHTML='';
  data.music.forEach((p,i)=>{
    if (!p.title && !p.notes && !p.image) return;
    const card = document.createElement('div');
    card.className='music-card';
    const img = document.createElement('img');
    img.src = p.image || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 4"></svg>';
    img.alt = p.title || `Live poster ${i+1}`;
    const body = document.createElement('div'); body.className='mc-body';
    const t = document.createElement('div'); t.className='mc-title'; t.textContent = p.title || '';
    const notes = document.createElement('div'); notes.className='mc-notes'; notes.textContent = p.notes || '';
    body.appendChild(t); body.appendChild(notes);
    card.appendChild(img); card.appendChild(body);
    grid.appendChild(card);
  });
}
function renderFixtures(){
  const g = $('#sportsGrid'); g.innerHTML='';
  (data.fixtures||[]).slice(0,4).forEach(f=>{
    const row = document.createElement('div'); row.className='row';
    const a = document.createElement('div');
    a.innerHTML = `<strong>${f.home||''}</strong> vs <strong>${f.away||''}</strong>`;
    const b = document.createElement('div');
    b.innerHTML = `${f.dt||''}<br>${f.chan||''}`;
    row.appendChild(a); row.appendChild(b);
    g.appendChild(row);
  });
}
function renderVideos(){
  const v = $('#videoList');
  if(!data.videos || data.videos.length===0){ v.textContent='No videos yet.'; return; }
  v.innerHTML='';
  data.videos.forEach(src=>{
    const vid = document.createElement('video');
    vid.controls = true; vid.src = src; vid.style.width='100%'; vid.style.maxHeight='420px'; vid.style.margin='8px 0';
    v.appendChild(vid);
  });
}

function renderAll(){
  renderAbout(); renderOffers(); renderWhats(); renderHours(); renderMusic(); renderFixtures(); renderVideos();
}

/* ---------- ADMIN ---------- */
const dlg = $('#adminDlg');
let taps = 0;
$('#footerOak').addEventListener('click', ()=>{
  taps++;
  if(taps>=5){ taps=0; openAdmin(); }
  clearTimeout(window._tapReset);
  window._tapReset = setTimeout(()=>{taps=0},900);
});

function openAdmin(){
  // Prefill
  $('#aboutInput').value = data.about || '';
  ['offer1','offer2','offer3','offer4'].forEach((id,idx)=>{
    $('#'+id).value = data.offers[idx] || '';
  });
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d=>{
    $('#what'+d).value = data.whats?.[d] || '';
    $('#open'+d).value = data.hours?.[d] || '';
  });
  // Music
  for(let i=1;i<=4;i++){
    $('#music'+i+'Title').value = data.music[i-1]?.title || '';
    $('#music'+i+'Notes').value = data.music[i-1]?.notes || '';
  }
  dlg.showModal();
}

$('#closeAdmin').addEventListener('click', ()=> dlg.close() );

$('#saveBtn').addEventListener('click', ()=>{
  data.about = $('#aboutInput').value.trim();
  data.offers = [$('#offer1').value, $('#offer2').value, $('#offer3').value, $('#offer4').value];
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d=>{
    data.whats[d] = $('#what'+d).value;
    data.hours[d] = $('#open'+d).value;
  });
  // fixtures
  data.fixtures = [
    {home:$('#f1Home').value, away:$('#f1Away').value, dt:$('#f1DT').value, chan:$('#f1Chan').value},
    {home:$('#f2Home').value, away:$('#f2Away').value, dt:$('#f2DT').value, chan:$('#f2Chan').value}
  ];
  saveData(); renderAll(); dlg.close();
});

function fileToBase64(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload=()=>res(r.result);
    r.onerror=rej;
    r.readAsDataURL(file);
  });
}

// Music uploads + clears
for(let i=1;i<=4;i++){
  const f = document.getElementById('music'+i+'File');
  const c = document.getElementById('music'+i+'Clear');
  if(f){ f.addEventListener('change', async (e)=>{
      const file = e.target.files?.[0]; if(!file) return;
      const dataUrl = await fileToBase64(file);
      data.music[i-1].image = dataUrl;
      saveData(); renderMusic(); e.target.value='';
  });}
  if(c){ c.addEventListener('click', ()=>{ data.music[i-1]={title:'',notes:'',image:''}; saveData(); renderMusic(); }); }
  const t = document.getElementById('music'+i+'Title');
  const n = document.getElementById('music'+i+'Notes');
  if(t) t.addEventListener('input', e=>{ data.music[i-1].title = e.target.value; saveData(); renderMusic(); });
  if(n) n.addEventListener('input', e=>{ data.music[i-1].notes = e.target.value; saveData(); renderMusic(); });
}

// Videos
const videoInput = document.getElementById('videoFile');
if(videoInput){
  videoInput.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0]; if(!file) return;
    if(file.size > 6*1024*1024){ alert('Video is large; try to keep under ~6MB.'); }
    const url = await fileToBase64(file);
    data.videos.push(url);
    saveData(); renderVideos(); e.target.value='';
  });
}
const clearV = document.getElementById('clearVideos');
if(clearV){ clearV.addEventListener('click', ()=>{ data.videos = []; saveData(); renderVideos(); }); }

// Backup
document.getElementById('exportBtn').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(data)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='phoenix-backup.json'; a.click();
  URL.revokeObjectURL(url);
});
document.getElementById('importBtn').addEventListener('click', async ()=>{
  const file = document.getElementById('importFile').files?.[0];
  if(!file){ alert('Choose a file first'); return; }
  const text = await file.text();
  try{
    const obj = JSON.parse(text);
    data = Object.assign(structuredClone(DEFAULT_DATA), obj);
    saveData(); renderAll(); alert('Imported.');
  }catch(e){ alert('Bad JSON'); }
});
document.getElementById('clearAll').addEventListener('click', ()=>{
  if(confirm('Clear all saved data on this device?')){
    localStorage.removeItem(KEY); data = loadData(); renderAll();
  }
});

// Boot
renderAll();
