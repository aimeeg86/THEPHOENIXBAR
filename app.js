let editMode = false;
let tapCount = 0;
let tapTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  restore();
  document.querySelectorAll('.editable').forEach(el => {
    el.addEventListener('input', save);
  });
  const footer = document.querySelector('.footer');
  footer.addEventListener('click', handleFooterTap);
});

function handleFooterTap() {
  tapCount++;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => (tapCount = 0), 800);
  if (tapCount >= 5) {
    toggleEdit();
    tapCount = 0;
  }
}

function toggleEdit() {
  editMode = !editMode;
  document.querySelectorAll('.editable').forEach(el => {
    el.contentEditable = editMode;
  });
  alert(editMode ? 'Edit mode ON' : 'Edit mode OFF');
}

function save() {
  const data = {};
  document.querySelectorAll('.editable').forEach((el, i) => {
    data[i] = el.innerHTML;
  });
  localStorage.setItem('phoenix-content', JSON.stringify(data));
}

function restore() {
  const data = JSON.parse(localStorage.getItem('phoenix-content') || '{}');
  document.querySelectorAll('.editable').forEach((el, i) => {
    if (data[i]) el.innerHTML = data[i];
  });
}

