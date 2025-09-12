  let token = null;
    const loginBtn = document.getElementById('login');
    const logoutBtn = document.getElementById('logout');
    const loginSection = document.getElementById('loginSection');
    const panel = document.getElementById('panel');
    const csvInput = document.getElementById('csvfile');
    const preview = document.getElementById('preview');
    const dbStatus = document.getElementById('dbStatus');

    // Helper to fetch DB status
    async function fetchDbStatus() {
      if(!token) return;
      try{
        const res = await fetch('/api/admin/status', { headers:{ Authorization: 'Bearer '+token } });
        const data = await res.json();
        dbStatus.innerText = data.count ? `DB has ${data.count} records` : 'DB is empty';
      } catch(e){ dbStatus.innerText = 'Error fetching DB status'; }
    }

    // Login
    loginBtn.onclick = async () => {
      const u = document.getElementById('user').value;
      const p = document.getElementById('pass').value;
      const r = await fetch('/api/auth/login',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ username:u, password:p })
      });
      const j = await r.json();
      if(j.token){
        token = j.token;
        loginSection.style.display = 'none';
        panel.style.display = 'block';
        fetchDbStatus();
      } else { alert('Login failed'); }
    };

    // Logout
    logoutBtn.onclick = () => {
      token = null;
      panel.style.display = 'none';
      loginSection.style.display = 'block';
    };

    // CSV Preview
    csvInput.onchange = () => {
      preview.innerText = csvInput.files[0]?.name || 'No file selected';
    };

    // Upload CSV
    document.getElementById('uploadd').onclick = async () => {
      if(!token) return alert('Login first');
      const f = csvInput.files[0];
      if(!f) return alert('Select a CSV file');
      const fd = new FormData();
      fd.append('csv', f);
      const r = await fetch('/api/admin/upload', {
        method:'POST',
        body: fd,
        headers: { Authorization: 'Bearer '+token }
      });
      const j = await r.json();
      alert(j.ok ? `Inserted ${j.inserted} records` : `Error: ${j.err||j.message}`);
      fetchDbStatus();
    };

    // Schedule
    document.getElementById('setSchedule').onclick = async () => {
      if(!token) return alert('Login first');
      const v = document.getElementById('releaseAt').value;
      if(!v) return alert('Select a date & time');
      const r = await fetch('/api/admin/schedule', {
        method:'POST',
        headers:{ 'content-type':'application/json', Authorization:'Bearer '+token },
        body: JSON.stringify({ releaseAt: v })
      });
      const j = await r.json();
      if(j.ok) alert('Schedule saved successfully');
    };

    // Clean DB
    document.getElementById('cleanDb').onclick = async () => {
      if(!token) return alert('Login first');
      if(!confirm('Are you sure? This will delete all results')) return;
      const r = await fetch('/api/admin/clean', {
        method:'POST',
        headers:{ Authorization: 'Bearer '+token }
      });
      const j = await r.json();
      alert(j.ok ? 'Database cleaned successfully' : 'Error cleaning DB');
      fetchDbStatus();
    };