const API = window.APP_CONFIG.API_BASE_URL;
const staff = JSON.parse(localStorage.getItem('staff') || 'null');
if (!staff) window.location.href = 'index.html';

const dateInput = document.getElementById('dateInput');
dateInput.value = new Date().toISOString().slice(0, 10);

document.getElementById('submitBtn').addEventListener('click', submit);

loadRooms();

async function loadRooms() {
  const res = await fetch(`${API}/api/rooms?branch_id=${staff.branch_id}`);
  const rooms = await res.json();
  const select = document.getElementById('roomSelect');
  select.innerHTML = rooms.map((r) => `<option value="${r.id}">${r.room_number}${r.is_large ? '（大房）' : ''}</option>`).join('');
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function submit() {
  const description = document.getElementById('descInput').value.trim();
  if (!description) { alert('請填寫客訴內容'); return; }

  const fileInput = document.getElementById('photoInput');
  let photoDataUrl = null;
  if (fileInput.files[0]) photoDataUrl = await fileToDataUrl(fileInput.files[0]);

  const btn = document.getElementById('submitBtn');
  btn.textContent = '送出中…';
  btn.disabled = true;
  const statusMsg = document.getElementById('statusMsg');
  statusMsg.textContent = '';

  try {
    const res = await fetch(`${API}/api/room-cleanings/register-complaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: staff.branch_id,
        room_id: document.getElementById('roomSelect').value,
        work_date: dateInput.value,
        description,
        reported_by: staff.id,
        photo_url: photoDataUrl,
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error || '送出失敗');
    statusMsg.style.color = 'var(--accent)';
    statusMsg.textContent = '已登記，會計入該房當日缺失紀錄';
    document.getElementById('descInput').value = '';
    document.getElementById('photoInput').value = '';
  } catch (err) {
    statusMsg.style.color = 'var(--danger)';
    statusMsg.textContent = err.message;
  } finally {
    btn.textContent = '送出登記';
    btn.disabled = false;
  }
}
