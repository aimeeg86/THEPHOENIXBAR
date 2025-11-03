document.addEventListener('DOMContentLoaded', () => {
  // enable simple inline editing
  document.querySelectorAll('.editable').forEach(el => {
    el.addEventListener('input', save);
  });
  load();
});

function save() {
  const data = {};
  document.querySelectorAll('.editable').forEach((el, i) => {
    data[i] = el.innerHTML;
  });
  localStorage.setItem('phoenix-content', JSON.stringify(data));
}

function load() {
  const data = JSON.parse(localStorage.getItem('phoenix-content') || '{}');
  document.querySelectorAll('.editable').forEach((el, i) => {
    if (data[i]) el.innerHTML = data[i];
  });
}
