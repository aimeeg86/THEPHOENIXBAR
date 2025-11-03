// sync.js — force a one-time full refresh of your content from Supabase
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// your existing project settings
const SUPABASE_URL  = 'https://rhbouqwhbztqxrwefrea.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoYm91cXdoYnp0cXhyd2VmcmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNzU3OTUsImV4cCI6MjA3Nzc1MTc5NX0.61hB6oAMfRIXgOAo-8b1GQfDfqoxG1lPpX9n1kbJGXs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TABLE = 'phoenix_content';
const lsKey = 'phoenix-content';

function saveLocal(map) {
  const existing = JSON.parse(localStorage.getItem(lsKey) || '{}');
  localStorage.setItem(lsKey, JSON.stringify({ ...existing, ...map }));
}

function applyToDOM(map) {
  document.querySelectorAll('.editable').forEach(el => {
    const k = el.dataset.key || el.id || el.dataset.editKey;
    if (k && map[k] != null) el.innerHTML = map[k];
  });
}

async function forceResync() {
  console.log('🔄 Fetching latest content from Supabase...');
  const { data, error } = await supabase.from(TABLE).select('*');
  if (error) {
    alert('Error fetching data: ' + error.message);
    return;
  }
  const map = {};
  (data || []).forEach(r => map[r.key] = r.value);

  saveLocal(map);
  applyToDOM(map);

  alert('✅ Content reloaded from Supabase.\nAll latest edits restored.');
  console.log('✅ Sync complete.');
}

document.addEventListener('DOMContentLoaded', forceResync);
