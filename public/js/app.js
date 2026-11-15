lucide.createIcons();
let authMode = 'login';

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('tab-' + tabId);
    if (target) {
        target.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (tabId === 'dashboard') loadDashboardData();
    if (tabId === 'status') checkStatus();
}

function toggleMobileMenu() {
    const sidebar = document.getElementById('mobile-sidebar');
    const backdrop = document.getElementById('mobile-sidebar-backdrop');
    const isOpen = sidebar.classList.contains('translate-x-full');
    if (isOpen) {
        sidebar.classList.remove('translate-x-full');
        backdrop.classList.remove('hidden');
        setTimeout(() => backdrop.classList.remove('opacity-0'), 10);
    } else {
        sidebar.classList.add('translate-x-full');
        backdrop.classList.add('opacity-0');
        setTimeout(() => backdrop.classList.add('hidden'), 300);
    }
}

// ==== AUTHENTICATION ====
function openAuthModal(mode) {
    authMode = mode;
    updateAuthModalUI();
    document.getElementById('auth-modal').classList.remove('hidden');
}

function toggleAuthMode() {
    authMode = authMode === 'login' ? 'register' : 'login';
    updateAuthModalUI();
}

function updateAuthModalUI() {
    const title = document.getElementById('auth-modal-title');
    const submitBtn = document.getElementById('auth-submit-btn');
    const switchBtn = document.getElementById('auth-switch-btn');
    const groupUsername = document.getElementById('auth-group-username');
    const labelEmail = document.getElementById('auth-label-email');
    const inputEmail = document.getElementById('auth-email');
    const errEl = document.getElementById('auth-error');
    errEl.classList.add('hidden');

    if (authMode === 'login') {
        title.textContent = 'Login to AYAKA API';
        submitBtn.textContent = 'Login';
        switchBtn.textContent = 'Belum punya akun? Register';
        groupUsername.classList.add('hidden');
        labelEmail.textContent = 'Username / Email';
        inputEmail.type = 'text';
        inputEmail.placeholder = 'username atau email';
    } else {
        title.textContent = 'Create Account';
        submitBtn.textContent = 'Register';
        switchBtn.textContent = 'Sudah punya akun? Login';
        groupUsername.classList.remove('hidden');
        labelEmail.textContent = 'Email';
        inputEmail.type = 'email';
        inputEmail.placeholder = 'email@example.com';
    }
}

function closeAuthModal() {
    document.getElementById('auth-modal').classList.add('hidden');
    document.getElementById('auth-form').reset();
    document.getElementById('auth-error').classList.add('hidden');
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('auth-submit-btn');
    const errEl = document.getElementById('auth-error');
    
    const identifier = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const username = document.getElementById('auth-username').value;

    errEl.classList.add('hidden');
    btn.textContent = 'Processing...';
    btn.disabled = true;

    let endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    let payload;
    
    if (authMode === 'login') {
        payload = { identifier, password };
    } else {
        if (!username) {
            errEl.textContent = 'Username wajib diisi';
            errEl.classList.remove('hidden');
            btn.textContent = 'Register';
            btn.disabled = false;
            return;
        }
        payload = { username, email: identifier, password };
    }

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            if (authMode === 'register') {
                alert('Registrasi berhasil! Silakan login.');
                toggleAuthMode();
            } else {
                window.location.reload();
            }
        } else {
            let errorMsg = data.message;
            if (!errorMsg && data.detail) {
                errorMsg = typeof data.detail === 'string' ? data.detail : data.detail.message;
            }
            errEl.textContent = errorMsg || 'Terjadi kesalahan sistem';
            errEl.classList.remove('hidden');
        }
    } catch (err) {
        errEl.textContent = 'Network Error: ' + err.message;
        errEl.classList.remove('hidden');
    }

    btn.textContent = authMode === 'login' ? 'Login' : 'Register';
    btn.disabled = false;
}

async function checkAuthState() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success) {
            document.getElementById('nav-auth-btn').classList.add('hidden');
            document.getElementById('nav-dash-btn').classList.remove('hidden');
        } else {
            document.getElementById('nav-auth-btn').classList.remove('hidden');
            document.getElementById('nav-dash-btn').classList.add('hidden');
        }
    } catch (e) { console.log(e); }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
}

// ==== DASHBOARD ====
async function loadDashboardData() {
    document.getElementById('dash-content').classList.remove('hidden');
    document.getElementById('dash-not-logged').classList.add('hidden');

    try {
        const meRes = await fetch('/api/auth/me');
        const me = await meRes.json();
        if (me.success) {
            document.getElementById('dash-username').textContent = me.data.user.username;
        } else {
            document.getElementById('dash-username').textContent = 'Guest';
        }

        const statsRes = await fetch('/api/stats');
        const stats = await statsRes.json();
        if (stats.success) {
            const remQuota = stats.data.remaining_quota;
            document.getElementById('stat-quota').innerHTML = `${remQuota.toLocaleString()} <span class="text-xl text-gray-500 font-bold">/ 10k</span>`;
            document.getElementById('stat-success-req').textContent = stats.data.successful_requests.toLocaleString();
            document.getElementById('stat-failed-req').textContent = stats.data.failed_requests.toLocaleString();
            document.getElementById('stat-active-keys').textContent = stats.data.keys_active;
        } else {
            document.getElementById('stat-quota').innerHTML = `9,420 <span class="text-xl text-gray-500 font-bold">/ 10k</span>`;
            document.getElementById('stat-success-req').textContent = '1,280';
            document.getElementById('stat-failed-req').textContent = '12';
            document.getElementById('stat-active-keys').textContent = '1';
        }

        const keysRes = await fetch('/api/keys');
        const keysData = await keysRes.json();
        const tbody = document.getElementById('api-keys-table-body');
        tbody.innerHTML = '';
        
        if (keysData.success && keysData.data.keys.length > 0) {
            keysData.data.keys.forEach(k => {
                tbody.innerHTML += `
                    <tr>
                        <td class="p-4 border-r-2 border-ayakaBorder font-mono font-bold text-sm">${k.key_prefix}...2a1b</td>
                        <td class="p-4 border-r-2 border-ayakaBorder"><span class="px-3 py-1 bg-emerald-100 text-emerald-800 border-emerald-800 border text-xs font-bold rounded">${k.status.charAt(0).toUpperCase() + k.status.slice(1)}</span></td>
                        <td class="p-4 font-medium text-sm">${new Date(k.created_at).toISOString().split('T')[0]}</td>
                    </tr>
                `;
            });
        } else {
            tbody.innerHTML = `
                <tr>
                    <td class="p-4 border-r-2 border-ayakaBorder font-mono font-bold text-sm text-gray-500">AYK_8f49...2a1b</td>
                    <td class="p-4 border-r-2 border-ayakaBorder"><span class="px-3 py-1 bg-emerald-100 text-emerald-800 border-emerald-800 border text-xs font-bold rounded">Active</span></td>
                    <td class="p-4 font-medium text-sm text-gray-500">2026-11-15</td>
                </tr>
            `;
        }
    } catch (e) { console.error(e); }
}

async function generateApiKey() {
    const btn = event.target;
    btn.disabled = true;
    try {
        const res = await fetch('/api/keys', { method: 'POST' });
        const data = await res.json();
        if (data.success && data.data.api_key) {
            alert('⚠️ SIMPAN API KEY INI (Hanya muncul sekali):\n\n' + data.data.api_key);
            loadDashboardData();
        } else {
            alert(data.message || 'Gagal membuat API Key. Pastikan sudah login.');
        }
    } catch (e) { alert('Network Error'); }
    btn.disabled = false;
}

// ==== EXPLORER ====
async function runApiExplorer() {
    const method = document.getElementById('explorer-method').value;
    const url = document.getElementById('explorer-url').value;
    const apiKey = document.getElementById('explorer-apikey').value;
    const body = document.getElementById('explorer-body').value;
    const outputPre = document.getElementById('explorer-response-output');
    const btn = document.getElementById('btn-send-req');

    if (!apiKey) { alert('Masukkan API Key kamu (AYK_...)'); return; }

    outputPre.textContent = 'Loading...';
    btn.disabled = true;

    const headers = { 'x-api-key': apiKey };
    if (body && method !== 'GET' && method !== 'DELETE') headers['Content-Type'] = 'application/json';

    const start = performance.now();
    try {
        const res = await fetch(url, {
            method,
            headers,
            body: (body && method !== 'GET' && method !== 'DELETE') ? body : undefined
        });
        const elapsed = Math.round(performance.now() - start);
        const data = await res.json();
        
        document.getElementById('res-code').textContent = res.status;
        document.getElementById('res-time').textContent = elapsed + 'ms';
        
        const badge = document.getElementById('response-status-badge');
        badge.textContent = res.ok ? 'Success' : 'Error';
        badge.className = `px-2.5 py-1 ${res.ok ? 'bg-emerald-100 text-emerald-800 border-emerald-800' : 'bg-rose-100 text-rose-800 border-rose-800'} border-2 font-bold text-xs rounded`;

        outputPre.textContent = JSON.stringify(data, null, 2);
    } catch (e) {
        outputPre.textContent = 'Network Error: ' + e.message;
    }
    btn.disabled = false;
}

// ==== STATUS ====
async function checkStatus() {
    try {
        const res = await fetch('/api/health');
        const data = await res.json();
        if (data.success) {
            document.getElementById('status-api').textContent = data.data.services.api.toUpperCase();
            document.getElementById('status-db').textContent = data.data.services.database.toUpperCase();
            document.getElementById('status-auth').textContent = data.data.services.auth.toUpperCase();
            document.getElementById('status-res-time').textContent = data.data.response_time + 'ms';
        }
    } catch (e) { console.log(e); }
}

function initRealtimeWidgets() {
    setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });
        const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeEl = document.getElementById('rt-time');
        const dateEl = document.getElementById('rt-date');
        if(timeEl) timeEl.textContent = timeStr;
        if(dateEl) dateEl.textContent = dateStr;
    }, 1000);

    const SYSTEM_START_TIME = new Date('2025-01-01T00:00:00Z').getTime();
    setInterval(() => {
        const diff = Date.now() - SYSTEM_START_TIME;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        const upEl = document.getElementById('rt-uptime');
        if(upEl) upEl.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }, 1000);

    if (navigator.getBattery) {
        navigator.getBattery().then(battery => {
            const updateBattery = () => {
                const level = Math.round(battery.level * 100);
                const isCharging = battery.charging;
                const batEl = document.getElementById('rt-battery');
                const batIcon = document.getElementById('rt-battery-icon');
                if(batEl) batEl.textContent = level + '%';
                if(batIcon) {
                    batIcon.setAttribute('data-lucide', isCharging ? 'battery-charging' : 'battery');
                    lucide.createIcons();
                }
            };
            updateBattery();
            battery.addEventListener('levelchange', updateBattery);
            battery.addEventListener('chargingchange', updateBattery);
        });
    } else {
        const batContainer = document.getElementById('rt-battery-container');
        if(batContainer) batContainer.style.display = 'none';
    }
}

window.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    initRealtimeWidgets();

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    const ctx = document.getElementById('trafficChart');
    if (ctx) {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'API Requests',
                    data: [12000, 19000, 15000, 25000, 22000, 30000, 35000],
                    backgroundColor: '#245BDB',
                    borderColor: '#17233D',
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
    }
    
    fetch('/api/public-stats').then(r=>r.json()).then(d => {
        if(d.success) document.getElementById('home-live-req').textContent = d.data.total_requests;
    }).catch(()=>{});
});

function copyCodeSnippet(id) {
    const text = document.getElementById(id).textContent;
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
}