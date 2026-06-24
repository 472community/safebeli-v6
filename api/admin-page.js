module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SafeBeli Admin</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0a;color:#fff;font-family:-apple-system,sans-serif;min-height:100vh}
.ls{display:flex;align-items:center;justify-content:center;min-height:100vh}
.lb{background:#1a1a1a;border:1px solid #333;border-radius:16px;padding:40px;width:90%;max-width:360px}
.lb h1{font-size:24px;margin-bottom:8px}
.lb p{color:#888;margin-bottom:24px;font-size:14px}
.db{max-width:900px;margin:0 auto;padding:32px 16px}
.hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px}
.hd h1{font-size:24px}
.st{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px}
.sc{background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:20px}
.sc .n{font-size:32px;font-weight:700;color:#4ade80}
.sc .l{color:#888;font-size:13px;margin-top:4px}
.sec{background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:24px;margin-bottom:24px}
.sec h2{font-size:16px;margin-bottom:20px;color:#ccc}
.fr{display:flex;gap:12px;flex-wrap:wrap}
input,select{background:#0a0a0a;border:1px solid #333;color:#fff;padding:10px 14px;border-radius:8px;font-size:14px;outline:none}
input:focus,select:focus{border-color:#4ade80}
.f1{flex:1;min-width:200px}
.btn{padding:10px 20px;border-radius:8px;border:none;cursor:pointer;font-size:14px;font-weight:600}
.btn-g{background:#4ade80;color:#000}
.btn-gr{background:#333;color:#fff}
.btn-f{width:100%;padding:12px;font-size:15px;margin-top:8px}
.msg{padding:12px 16px;border-radius:8px;margin-top:12px;font-size:14px;display:none}
.ok{background:#052e16;border:1px solid #4ade80;color:#4ade80;display:block}
.er{background:#2d0a0a;border:1px solid #ef4444;color:#ef4444;display:block}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:10px 12px;color:#888;font-size:12px;border-bottom:1px solid #333}
td{padding:12px;font-size:13px;border-bottom:1px solid #1f1f1f}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600}
.bp{background:#052e16;color:#4ade80}
.bf{background:#1f1f1f;color:#888}
.lo{background:none;border:1px solid #333;color:#888;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:13px}
.ab{background:none;border:1px solid #333;color:#ccc;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px}
.ab:hover{border-color:#4ade80;color:#4ade80}
</style>
</head>
<body>
<div class="ls" id="loginDiv">
  <div class="lb">
    <h1>🛡️ SafeBeli Admin</h1>
    <p>Masukkan admin key untuk akses</p>
    <input type="password" id="keyInput" placeholder="Admin Key" style="width:100%;margin-bottom:12px;">
    <button class="btn btn-g btn-f" onclick="doLogin()">Masuk</button>
    <div class="msg" id="loginMsg"></div>
  </div>
</div>

<div class="db" id="dashDiv" style="display:none">
  <div class="hd">
    <h1>🛡️ SafeBeli Admin</h1>
    <button class="lo" onclick="doLogout()">Logout</button>
  </div>
  <div class="st">
    <div class="sc"><div class="n" id="sTotal">-</div><div class="l">Total User</div></div>
    <div class="sc"><div class="n" id="sPrem" style="color:#fbbf24">-</div><div class="l">Premium</div></div>
    <div class="sc"><div class="n" id="sFree" style="color:#60a5fa">-</div><div class="l">Gratis</div></div>
  </div>
  <div class="sec">
    <h2>⭐ Aktivasi Premium</h2>
    <div class="fr">
      <input type="email" id="actEmail" placeholder="Email user yang sudah bayar..." class="f1">
      <select id="actMonths">
        <option value="1">1 Bulan</option>
        <option value="3">3 Bulan</option>
        <option value="6">6 Bulan</option>
        <option value="12">12 Bulan</option>
      </select>
      <button class="btn btn-g" onclick="doActivate()">Aktifkan</button>
    </div>
    <div class="msg" id="actMsg"></div>
  </div>
  <div class="sec">
    <h2>👥 Daftar User <button class="btn btn-gr" style="font-size:12px;padding:4px 12px;margin-left:8px" onclick="loadUsers()">Refresh</button></h2>
    <div id="userTable"><p style="color:#888;padding:20px 0">Memuat...</p></div>
  </div>
</div>

<script>
let KEY = '';

function showMsg(id, txt, ok) {
  const el = document.getElementById(id);
  el.textContent = txt;
  el.className = 'msg ' + (ok ? 'ok' : 'er');
}

function doLogin() {
  KEY = document.getElementById('keyInput').value.trim();
  if (!KEY) return;
  fetch('/api/admin', { headers: { 'x-admin-key': KEY } })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        document.getElementById('loginDiv').style.display = 'none';
        document.getElementById('dashDiv').style.display = 'block';
        loadUsers();
      } else {
        showMsg('loginMsg', 'Admin key salah!', false);
      }
    })
    .catch(() => showMsg('loginMsg', 'Koneksi gagal', false));
}

function doLogout() {
  KEY = '';
  document.getElementById('loginDiv').style.display = 'flex';
  document.getElementById('dashDiv').style.display = 'none';
  document.getElementById('keyInput').value = '';
}

function doActivate() {
  const email = document.getElementById('actEmail').value.trim();
  const months = parseInt(document.getElementById('actMonths').value);
  if (!email) return showMsg('actMsg', 'Masukkan email', false);
  fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': KEY },
    body: JSON.stringify({ email, months })
  }).then(r => r.json()).then(d => {
    if (d.success) {
      showMsg('actMsg', '✅ ' + d.message, true);
      document.getElementById('actEmail').value = '';
      loadUsers();
    } else {
      showMsg('actMsg', '❌ ' + d.error, false);
    }
  });
}

function loadUsers() {
  fetch('/api/admin', { headers: { 'x-admin-key': KEY } })
    .then(r => r.json())
    .then(d => {
      if (!d.success) return;
      const users = d.users;
      const prem = users.filter(u => u.is_premium && new Date(u.premium_expires_at) > new Date());
      document.getElementById('sTotal').textContent = users.length;
      document.getElementById('sPrem').textContent = prem.length;
      document.getElementById('sFree').textContent = users.length - prem.length;
      const rows = users.map(u => {
        const ip = u.is_premium && u.premium_expires_at && new Date(u.premium_expires_at) > new Date();
        const exp = ip ? new Date(u.premium_expires_at).toLocaleDateString('id-ID') : '-';
        return '<tr><td>' + u.email + '</td><td><span class="badge ' + (ip ? 'bp' : 'bf') + '">' + (ip ? '⭐ Premium' : 'Gratis') + '</span></td><td>' + exp + '</td><td><button class="ab" onclick="fillEmail(this)" data-email="' + u.email + '">Aktifkan</button></td></tr>';
      }).join('');
      document.getElementById('userTable').innerHTML = '<table><thead><tr><th>Email</th><th>Status</th><th>Expires</th><th>Aksi</th></tr></thead><tbody>' + (rows || '<tr><td colspan="4" style="color:#888;text-align:center;padding:20px">Belum ada user</td></tr>') + '</tbody></table>';
    });
}

function fillEmail(btn) {
  document.getElementById('actEmail').value = btn.getAttribute('data-email');
  document.getElementById('actEmail').scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('keyInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') doLogin();
});
</script>
</body>
</html>`);
};
