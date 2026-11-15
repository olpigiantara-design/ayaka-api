(async function () {
  const { data: me } = await API.get('/api/auth/me');
  if (!me.success) { location.href = '/login.html'; return; }
  const logout = async () => { await API.post('/api/auth/logout'); location.href = '/'; };
  document.getElementById('logoutBtn')?.addEventListener('click', (e) => { e.preventDefault(); logout(); });
  document.getElementById('logoutBtn2')?.addEventListener('click', (e) => { e.preventDefault(); logout(); });

  document.querySelectorAll('.dash-side a[data-tab]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.dash-side a').forEach(x => x.classList.remove('active'));
      a.classList.add('active');
      document.querySelectorAll('[id^="tab-"]').forEach(t => t.classList.add('hidden'));
      document.getElementById('tab-' + a.dataset.tab).classList.remove('hidden');
      if (a.dataset.tab === 'keys') loadKeys();
      if (a.dataset.tab === 'usage') loadUsage();
    });
  });

  async function loadStats() {
    const { data } = await API.get('/api/stats');
    if (!data.success) return;
    const s = data.data;
    document.getElementById('s-total').textContent = s.total_requests;
    document.getElementById('s-success').textContent = s.successful_requests;
    document.getElementById('s-failed').textContent = s.failed_requests;
    document.getElementById('s-quota').textContent = s.remaining_quota;
    document.getElementById('s-avg').textContent = s.avg_response_time + 'ms';
    document.getElementById('s-keys').textContent = s.keys_active;
    const chart = document.getElementById('chart');
    chart.innerHTML = '';
    const maxCount = Math.max(1, ...(s.chart.map(c => c.count)));
    if (!s.chart.length) { chart.innerHTML = '<p style="color:#6B7280;">No usage yet.</p>'; return; }
    s.chart.forEach(c => {
      const bar = document.createElement('div');
      const h = Math.max(8, (c.count / maxCount) * 160);
      bar.style.cssText = `flex:0 0 30px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;`;
      bar.innerHTML = `<div style="width:100%;background:var(--primary);border:2px solid var(--border);height:${h}px;" title="${c.count} req"></div><div style="font-size:10px;margin-top:4px;font-weight:700;">${c.hour}</div>`;
      chart.appendChild(bar);
    });
  }

  async function loadKeys() {
    const body = document.getElementById('keysBody');
    body.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
    const { data } = await API.get('/api/keys');
    if (!data.success) { body.innerHTML = '<tr><td colspan="5">Error</td></tr>'; return; }
    if (!data.data.keys.length) { body.innerHTML = '<tr><td colspan="5" style="text-align:center;">No keys yet.</td></tr>'; return; }
    body.innerHTML = data.data.keys.map(k => `
      <tr><td class="mono">${k.key_prefix}...</td><td><span class="method-badge ${k.status === 'active' ? 'badge-post' : 'badge-delete'}">${k.status}</span></td><td>${k.requests_used}/${k.quota_limit}</td><td>${new Date(k.created_at).toLocaleDateString()}</td>
      <td>${k.status === 'active' ? `<button class="btn btn-sm" data-revoke="${k.id}">Revoke</button>` : '—'}</td></tr>
    `).join('');
    body.querySelectorAll('[data-revoke]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Revoke?')) return; await API.post(`/api/keys/${b.dataset.revoke}/revoke`); loadKeys();
    }));
  }

  document.getElementById('newKeyBtn').addEventListener('click', async () => {
    const { data } = await API.post('/api/keys', {});
    const alertEl = document.getElementById('newKeyAlert');
    if (data.success && data.data.api_key) {
      alertEl.innerHTML = `<strong>SAVE THIS KEY:</strong><br><code class="mono" style="font-size:14px;display:block;margin-top:8px;background:#fff;padding:8px;border:1px solid #ccc;">${data.data.api_key}</code><button class="btn btn-sm mt-2" onclick="navigator.clipboard.writeText('${data.data.api_key}');showToast('Copied!','success')">Copy</button>`;
      alertEl.classList.remove('hidden'); loadKeys();
    }
  });

  async function loadUsage() {
    const body = document.getElementById('usageBody');
    body.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
    const { data } = await API.get('/api/usage');
    if (!data.success) { body.innerHTML = '<tr><td colspan="5">Error</td></tr>'; return; }
    if (!data.data.usage.length) { body.innerHTML = '<tr><td colspan="5" style="text-align:center;">No usage.</td></tr>'; return; }
    body.innerHTML = data.data.usage.map(u => `<tr><td class="mono" style="font-size:11px;">${u.endpoint}</td><td><span class="method-badge badge-${u.method.toLowerCase()}">${u.method}</span></td><td>${u.status_code}</td><td>${u.response_time}ms</td><td>${new Date(u.created_at).toLocaleTimeString()}</td></tr>`).join('');
  }
  loadStats();
})();
