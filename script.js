/* ═══════════════════════════════════════════════
   ESTÚDIO MONIZY SILVA — script.js
   Supabase vanilla JS + full app logic
═══════════════════════════════════════════════ */

const SUPABASE_URL = 'https://klihykdichgelwxljntr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsaWh5a2RpY2hnZWx3eGxqbnRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NTI2MjMsImV4cCI6MjA5NDQyODYyM30.HB15l6rfItzkql7MFFIHO6XOe9rAfmIiXONbxJV423I';

/* ── SUPABASE CLIENT ── */
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ══════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════ */
function showApp(){ document.getElementById('appLayout').style.display=''; document.getElementById('loginScreen').style.display='none'; }
function showLogin(){ document.getElementById('loginScreen').style.display=''; document.getElementById('appLayout').style.display='none'; }

function domReady(fn){
  if(document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn);
}

// Load studio name onto login screen brand
(async()=>{
  const { data } = await db.from('config_studio').select('nome_studio').maybeSingle();
  if(data&&data.nome_studio){
    domReady(()=>{
      const el = document.getElementById('loginBrandName');
      if(el) el.textContent = data.nome_studio;
    });
  }
})();

db.auth.onAuthStateChange((event, session) => {
  (async () => {
    if(session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')){
      domReady(() => { showApp(); initApp(); });
    } else if(!session && event === 'SIGNED_OUT'){
      domReady(() => showLogin());
    }
  })();
});

document.addEventListener('DOMContentLoaded', () => {
  /* ── LOGIN TABS ── */
  document.querySelectorAll('.login-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const which = tab.dataset.tab;
      document.getElementById('formLogin').classList.toggle('hidden', which !== 'login');
      document.getElementById('formRegister').classList.toggle('hidden', which !== 'register');
      document.getElementById('loginError').textContent = '';
      document.getElementById('registerError').textContent = '';
      document.getElementById('loginCardTitle').textContent = which === 'login' ? 'Login' : 'Criar Conta';
    });
  });

  /* ── TOGGLE PASSWORD VISIBILITY ── */
  function makeEyeToggle(eyeId, inputId, svgId){
    document.getElementById(eyeId).addEventListener('click', () => {
      const inp = document.getElementById(inputId);
      const showing = inp.type === 'text';
      inp.type = showing ? 'password' : 'text';
      document.getElementById(svgId).innerHTML = showing
        ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
        : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    });
  }
  makeEyeToggle('loginEye', 'loginSenha', 'eyeIconLogin');
  makeEyeToggle('registerEye', 'registerSenha', 'eyeIconRegister');

  /* ── REMEMBER ME: restore saved username ── */
  const savedUsername = localStorage.getItem('monizy_username');
  if(savedUsername){
    document.getElementById('loginUsername').value = savedUsername;
    document.getElementById('loginLembrar').checked = true;
  }

  /* ── LOGIN FORM ── */
  document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');
    errEl.textContent = '';
    errEl.style.color = 'var(--red)';
    btn.disabled = true;
    btn.textContent = 'Entrando...';
    const username = document.getElementById('loginUsername').value.trim();
    const senha = document.getElementById('loginSenha').value;
    const lembrar = document.getElementById('loginLembrar').checked;

    // Resolve username → email via Edge Function
    const email = await _resolveEmail({ username });
    if(!email){
      errEl.textContent = 'Usuário não encontrado.';
      btn.disabled = false; btn.textContent = 'Entrar';
      return;
    }

    const { error } = await db.auth.signInWithPassword({ email, password: senha });
    btn.disabled = false;
    btn.textContent = 'Entrar';
    if(error){
      errEl.textContent = traduzirErroAuth(error.message);
    } else {
      if(lembrar) localStorage.setItem('monizy_username', username);
      else localStorage.removeItem('monizy_username');
    }
  });

  /* ── ESQUECEU A SENHA ── */
  document.getElementById('btnEsqueceuSenha').addEventListener('click', async () => {
    const errEl = document.getElementById('loginError');
    errEl.style.color = 'var(--red)';
    errEl.textContent = '';

    const phone = prompt('Digite o número de celular cadastrado na sua conta:');
    if(!phone || !phone.trim()){ return; }

    const email = await _resolveEmail({ phone: phone.trim() });
    if(!email){
      errEl.textContent = 'Nenhuma conta encontrada com esse celular.';
      return;
    }

    const { error } = await db.auth.resetPasswordForEmail(email);
    if(error){ errEl.textContent = traduzirErroAuth(error.message); }
    else { errEl.style.color='var(--green)'; errEl.textContent = 'E-mail de redefinição enviado!'; }
  });

  /* ── REGISTER FORM ── */
  document.getElementById('formRegister').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('registerError');
    const btn = document.getElementById('registerBtn');
    errEl.style.color = 'var(--red)';
    errEl.textContent = '';
    const nome = document.getElementById('registerNome').value.trim();
    const username = document.getElementById('registerUsername').value.trim();
    const telefone = document.getElementById('registerTelefone').value.trim();
    const senha = document.getElementById('registerSenha').value;
    const confirma = document.getElementById('registerConfirm').value;
    if(!nome){ errEl.textContent = 'Informe seu nome completo.'; return; }
    if(!username){ errEl.textContent = 'Informe um nome de usuário.'; return; }
    if(!/^[a-zA-Z0-9_]+$/.test(username)){ errEl.textContent = 'Usuário: use apenas letras, números e _.'; return; }
    if(!telefone){ errEl.textContent = 'Informe seu celular (necessário para recuperar a senha).'; return; }
    if(senha !== confirma){ errEl.textContent = 'As senhas não coincidem.'; return; }
    if(senha.length < 6){ errEl.textContent = 'A senha deve ter pelo menos 6 caracteres.'; return; }

    // Check username availability
    const existing = await _resolveEmail({ username });
    if(existing){ errEl.textContent = 'Este nome de usuário já está em uso.'; return; }

    // Generate internal email from username — user never sees this
    const email = `${username.toLowerCase()}@monizy.internal`;

    btn.disabled = true;
    btn.textContent = 'Criando conta...';
    const { error } = await db.auth.signUp({
      email,
      password: senha,
      options: { data: { full_name: nome, username, phone: telefone } }
    });
    btn.disabled = false;
    btn.textContent = 'Criar Conta';
    if(error) errEl.textContent = traduzirErroAuth(error.message);
    else { errEl.style.color = 'var(--green)'; errEl.textContent = 'Conta criada! Fazendo login...'; }
  });
});

async function _resolveEmail({ username, phone } = {}){
  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/auth-lookup`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify(username ? { username } : { phone })
      }
    );
    if(!res.ok) return null;
    const json = await res.json();
    return json.email || null;
  } catch { return null; }
}

function traduzirErroAuth(msg){
  if(!msg) return 'Erro desconhecido.';
  if(msg.includes('Invalid login credentials')) return 'Usuário ou senha incorretos.';
  if(msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if(msg.includes('User already registered')) return 'Este nome de usuário já está em uso.';
  if(msg.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres.';
  if(msg.includes('Unable to validate email')) return 'E-mail inválido.';
  if(msg.includes('rate limit')) return 'Muitas tentativas. Aguarde um momento.';
  return msg;
}

/* ── HELPERS ── */
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function pad(n){ return n < 10 ? '0'+n : ''+n; }

function hojeStr(){
  const d = new Date();
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}

function formatBR(s){
  if(!s) return '';
  const p = s.split('-');
  if(p.length < 3) return s;
  return p[2]+'/'+p[1]+'/'+p[0];
}

function formatCur(v){
  const n = parseFloat(String(v||0).replace(',','.')) || 0;
  return n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function parseCur(s){
  if(!s) return 0;
  return parseFloat(String(s).replace(/\./g,'').replace(',','.')) || 0;
}

function esc(s){
  if(!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function timeSlots(){
  const s = [];
  for(let h=7;h<=21;h++){ s.push(pad(h)+':00'); s.push(pad(h)+':30'); }
  return s;
}

function nextStatus(s){
  return {pendente:'confirmado',confirmado:'finalizado',finalizado:'cancelado',cancelado:'pendente'}[s]||'pendente';
}

function statusLabel(s){
  return {pendente:'Pendente',confirmado:'Confirmado',finalizado:'Finalizado',cancelado:'Cancelado'}[s]||s;
}

function getWeekStart(ref){
  const d = new Date(ref.getFullYear(),ref.getMonth(),ref.getDate());
  d.setDate(d.getDate()-d.getDay());
  return d;
}

function dateStr(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }

function groupLabel(ds){
  const hoje = hojeStr();
  const t = new Date(); t.setDate(t.getDate()+1);
  const tom = dateStr(t);
  if(ds===hoje) return 'Hoje';
  if(ds===tom) return 'Amanhã';
  return formatBR(ds);
}

function svgIcon(name){
  const icons = {
    menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    edit: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
    eye: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    chevL: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>',
    chevR: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    x: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  };
  return icons[name]||'';
}

/* ── NAVIGATION ── */
let currentPage = 'home';

function navigateTo(page){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));

  const pel = document.getElementById('page-'+page);
  if(pel) pel.classList.add('active');
  const nel = document.querySelector('[data-page="'+page+'"]');
  if(nel) nel.classList.add('active');

  const titles = {home:'Início',agenda:'Agenda',clientes:'Clientes',servicos:'Serviços',configuracao:'Configuração'};
  document.getElementById('pageTitle').textContent = titles[page]||'';

  currentPage = page;
  refreshCurrent();

  if(window.innerWidth <= 900) closeSidebar();
}

function refreshCurrent(){
  if(currentPage==='home') renderHome();
  else if(currentPage==='agenda') renderAgenda();
  else if(currentPage==='clientes') renderClientes();
  else if(currentPage==='servicos') renderServicos();
  else if(currentPage==='configuracao') renderConfig();
}

/* ── SIDEBAR ── */
let sidebarCollapsed = false;

function toggleSidebar(){
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  if(window.innerWidth <= 900){
    sb.classList.toggle('open');
    ov.classList.toggle('active');
  } else {
    sidebarCollapsed = !sidebarCollapsed;
    sb.classList.toggle('collapsed', sidebarCollapsed);
  }
}

function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

/* ── MODAL HELPERS ── */
let _deleteCb = null;

function openModal(id){
  document.getElementById(id).classList.add('active');
  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal(id){
  document.getElementById(id).classList.remove('active');
  if(!document.querySelector('.modal.active'))
    document.getElementById('modalOverlay').classList.remove('active');
}

function closeAllModals(){
  document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
  document.getElementById('modalOverlay').classList.remove('active');
}

function confirmDelete(type, id){
  const msgs = {
    agendamento:'Deseja excluir este agendamento?',
    cliente:'Deseja excluir este cliente?',
    servico:'Deseja excluir este serviço?',
    pacote:'Deseja excluir este pacote?'
  };
  document.getElementById('confirmMessage').textContent = msgs[type]||'Deseja excluir este item?';
  _deleteCb = async function(){
    if(type==='agendamento') await db.from('agendamentos').delete().eq('id',id);
    else if(type==='cliente') await db.from('clientes').delete().eq('id',id);
    else if(type==='servico') await db.from('servicos').delete().eq('id',id);
    else if(type==='pacote') await db.from('pacotes').delete().eq('id',id);
    closeModal('modalConfirm');
    refreshCurrent();
  };
  openModal('modalConfirm');
}

/* ══════════════════════════════════════════════
   HOME
══════════════════════════════════════════════ */
async function renderHome(){
  const hoje = hojeStr();
  const [agRes, clRes] = await Promise.all([
    db.from('agendamentos').select('*').eq('data',hoje).order('horario'),
    db.from('clientes').select('*')
  ]);
  const ags = agRes.data||[];
  const clientes = clRes.data||[];

  const finalizados = ags.filter(a=>a.status==='finalizado');
  const fat = finalizados.reduce((s,a)=>s+Number(a.valor||0),0);

  document.getElementById('cardAgendamentosHoje').textContent = ags.length;
  document.getElementById('cardFaturamentoDia').textContent = 'R$ '+formatCur(fat);
  document.getElementById('cardClientesAtendidos').textContent = finalizados.length;

  // Próximos
  const c = document.getElementById('proximosAgendamentos');
  c.innerHTML = '';
  if(!ags.length){
    c.innerHTML = '<p class="empty-msg">Nenhum agendamento para hoje.</p>';
  } else {
    ags.forEach(ag => {
      const div = document.createElement('div');
      div.className = 'agend-item';
      div.innerHTML =
        '<span class="agend-time">'+esc(ag.horario)+'</span>'+
        '<div class="agend-info">'+
          '<div class="agend-name">'+esc(ag.cliente_nome)+'</div>'+
          '<div class="agend-service">'+esc(ag.servico_nome)+'</div>'+
        '</div>'+
        '<span class="agend-value">R$ '+formatCur(ag.valor)+'</span>'+
        '<div class="agend-actions">'+
          '<button class="status-badge status-'+ag.status+'" data-action="status" data-id="'+ag.id+'">'+statusLabel(ag.status)+'</button>'+
          '<button class="btn-icon btn-edit" data-action="edit" data-id="'+ag.id+'" title="Editar">'+svgIcon('edit')+'</button>'+
          '<button class="btn-icon btn-delete" data-action="delete" data-id="'+ag.id+'" title="Excluir">'+svgIcon('trash')+'</button>'+
        '</div>';
      c.appendChild(div);
    });
  }

  // Aniversariantes
  const mesAtual = new Date().getMonth()+1;
  const aniv = clientes
    .filter(c2=>c2.nascimento && parseInt(c2.nascimento.split('-')[1])===mesAtual)
    .sort((a,b)=>parseInt((a.nascimento||'').split('-')[2])-parseInt((b.nascimento||'').split('-')[2]));

  const ac = document.getElementById('aniversariantesList');
  ac.innerHTML = '';
  if(!aniv.length){
    ac.innerHTML = '<p class="empty-msg">Nenhum aniversário este mês.</p>';
  } else {
    aniv.forEach(cl=>{
      const parts = (cl.nascimento||'').split('-');
      const div = document.createElement('div');
      div.className = 'aniv-item';
      div.innerHTML =
        '<div class="aniv-name">'+esc(cl.nome)+'</div>'+
        '<div class="aniv-date-col">'+
          '<div class="aniv-label">aniversário</div>'+
          '<div class="aniv-date">'+parts[2]+'/'+parts[1]+'/'+parts[0]+'</div>'+
        '</div>';
      ac.appendChild(div);
    });
  }
}

/* ══════════════════════════════════════════════
   AGENDA
══════════════════════════════════════════════ */
let calWeek = getWeekStart(new Date());
let calFilter = null;
let _lembretesMensagens = []; // pre-loaded messages for send button

function renderCalendar(){
  const ws = calWeek;
  const monthKeys = {};
  const weekDays = [];
  for(let i=0;i<7;i++){
    const d = new Date(ws.getFullYear(),ws.getMonth(),ws.getDate()+i);
    monthKeys[d.getMonth()] = d.getFullYear();
    weekDays.push(d);
  }
  const mk = Object.keys(monthKeys);
  const ml = mk.length===1
    ? MESES[+mk[0]]+' de '+monthKeys[+mk[0]]
    : MESES[+mk[0]]+'/'+MESES[+mk[1]]+' de '+ws.getFullYear();
  document.getElementById('calMonth').textContent = ml;

  const hoje = hojeStr();
  const cd = document.getElementById('calDays');
  cd.innerHTML = '';
  weekDays.forEach(d=>{
    const dstr = dateStr(d);
    const btn = document.createElement('button');
    btn.className = 'cal-day';
    if(dstr===hoje) btn.classList.add('today');
    if(calFilter && dstr===calFilter) btn.classList.add('selected');
    btn.innerHTML =
      '<span class="cal-day-name">'+DIAS[d.getDay()]+'</span>'+
      '<span class="cal-day-num">'+d.getDate()+'</span>';
    btn.addEventListener('click',()=>{ calFilter=dstr; document.getElementById('filterDateLabel').textContent='Filtro: '+formatBR(dstr); renderCalendar(); renderAgendaList(); });
    cd.appendChild(btn);
  });
}

async function _buildLembretes(){
  const dataAlvo = calFilter || hojeStr();
  const [agRes, cfgRes, clRes] = await Promise.all([
    db.from('agendamentos').select('*').eq('data', dataAlvo).order('horario'),
    db.from('config_studio').select('*').maybeSingle(),
    db.from('clientes').select('nome,telefone')
  ]);
  const ativos = (agRes.data||[]).filter(a=>a.status!=='cancelado'&&a.status!=='finalizado');
  const template = (cfgRes.data&&cfgRes.data.mensagem_lembrete)||'Olá {nome}, lembrando que você tem {servico} agendado para {data} às {horario}. Te esperamos!';
  const clMap = {};
  (clRes.data||[]).forEach(c=>{ clMap[c.nome]=c.telefone||''; });

  _lembretesMensagens = [];
  ativos.forEach(ag=>{
    const tel = (clMap[ag.cliente_nome]||'').replace(/\D/g,'');
    if(!tel) return;
    const dataFmt = ag.data ? ag.data.split('-').reverse().join('/') : '';
    const msg = template
      .replace(/{nome}/g,ag.cliente_nome)
      .replace(/{servico}/g,ag.servico_nome||'')
      .replace(/{horario}/g,ag.horario||'')
      .replace(/{data}/g,dataFmt);
    const numero = tel.startsWith('55')?tel:'55'+tel;
    _lembretesMensagens.push({ nome:ag.cliente_nome, horario:ag.horario, servico:ag.servico_nome||'', url:'https://wa.me/'+numero+'?text='+encodeURIComponent(msg) });
  });

  // Update button label
  const btn = document.getElementById('btnEnviarLembrete');
  if(btn) btn.textContent = _lembretesMensagens.length
    ? 'Enviar Lembrete ('+_lembretesMensagens.length+')'
    : 'Enviar Lembrete';
}

async function renderAgendaList(){
  let query = db.from('agendamentos').select('*').order('data').order('horario');
  const { data } = await query;
  const all = data||[];
  const lista = calFilter ? all.filter(a=>a.data===calFilter) : all;

  const c = document.getElementById('agendaList');
  c.innerHTML = '';
  if(!lista.length){ c.innerHTML='<p class="empty-msg">Nenhum agendamento encontrado.</p>'; }
  else {
    const groups = {}; const order = [];
    lista.forEach(ag=>{
      if(!groups[ag.data]){ groups[ag.data]=[]; order.push(ag.data); }
      groups[ag.data].push(ag);
    });

    order.forEach(dstr=>{
      const sec = document.createElement('div');
      sec.className = 'agenda-group';
      const title = document.createElement('h3');
      title.className = 'agenda-group-title';
      title.textContent = groupLabel(dstr);
      sec.appendChild(title);

      groups[dstr].forEach(ag=>{
        const card = document.createElement('div');
        card.className = 'agenda-card';
        card.innerHTML =
          '<div class="agenda-card-col">'+
            '<span class="agenda-card-date">'+formatBR(ag.data)+'</span>'+
            '<span class="agenda-card-time">'+esc(ag.horario)+'</span>'+
          '</div>'+
          '<div class="agenda-card-info">'+
            '<div class="agenda-card-name">'+esc(ag.cliente_nome)+'</div>'+
            '<div class="agenda-card-service">'+esc(ag.servico_nome)+'</div>'+
            '<div class="agenda-card-value">R$ '+formatCur(ag.valor)+'</div>'+
          '</div>'+
          '<div class="agenda-card-actions">'+
            '<button class="status-badge status-'+ag.status+'" data-action="status" data-id="'+ag.id+'">'+statusLabel(ag.status)+'</button>'+
            '<button class="btn-icon btn-edit" data-action="edit" data-id="'+ag.id+'" title="Editar">'+svgIcon('edit')+'</button>'+
            '<button class="btn-icon btn-delete" data-action="delete" data-id="'+ag.id+'" title="Excluir">'+svgIcon('trash')+'</button>'+
          '</div>';
        sec.appendChild(card);
      });
      c.appendChild(sec);
    });
  }

  // Pre-load lembrete messages after list renders
  await _buildLembretes();
}

async function renderAgenda(){
  renderCalendar();
  await renderAgendaList();
}

// Opens the lembrete modal — each client gets their own WhatsApp button (user gesture per click)
function enviarLembrete(){
  const dataAlvo = calFilter || hojeStr();
  const dateLabel = calFilter ? formatBR(calFilter) : 'hoje ('+formatBR(hojeStr())+')';
  document.getElementById('lembreteDateLabel').textContent =
    'Agendamentos do dia ' + dateLabel + ':';

  const lista = document.getElementById('lembretesListaModal');
  lista.innerHTML = '';

  if(!_lembretesMensagens.length){
    lista.innerHTML = '<p class="empty-msg">Nenhum agendamento ativo com telefone cadastrado para este dia.</p>';
  } else {
    _lembretesMensagens.forEach(m => {
      const item = document.createElement('div');
      item.className = 'lembrete-item';
      item.innerHTML =
        '<div class="lembrete-item-info">'+
          '<span class="lembrete-item-name">'+esc(m.nome)+'</span>'+
          '<span class="lembrete-item-sub">'+esc(m.horario)+' &mdash; '+esc(m.servico)+'</span>'+
        '</div>'+
        '<a href="'+m.url+'" target="_blank" rel="noopener" class="btn-whatsapp">'+
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.117 1.523 5.846L.057 23.886a.5.5 0 0 0 .606.625l6.198-1.449A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.692-.511-5.224-1.402l-.374-.219-3.878.907.95-3.762-.243-.388A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>'+
          ' WhatsApp'+
        '</a>';
      lista.appendChild(item);
    });
  }

  openModal('modalLembretes');
}

/* ══════════════════════════════════════════════
   CLIENTES
══════════════════════════════════════════════ */
async function renderClientes(){
  const { data } = await db.from('clientes').select('*').order('nome');
  const lista = data||[];
  const c = document.getElementById('clientesList');
  c.innerHTML = '';
  if(!lista.length){ c.innerHTML='<p class="empty-msg">Nenhum cliente cadastrado.</p>'; return; }
  lista.forEach(cl=>{
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML =
      '<span class="list-item-name">'+esc(cl.nome)+'</span>'+
      '<div class="list-item-actions">'+
        '<button class="btn-ver" data-action="ver" data-id="'+cl.id+'">'+svgIcon('eye')+' Ver</button>'+
        '<button class="btn-editar" data-action="edit" data-id="'+cl.id+'">'+svgIcon('edit')+' Editar</button>'+
        '<button class="btn-excluir" data-action="delete" data-id="'+cl.id+'">'+svgIcon('trash')+'</button>'+
      '</div>';
    c.appendChild(div);
  });
}

function openNewCliente(){
  document.getElementById('clienteId').value='';
  document.getElementById('clienteNome').value='';
  document.getElementById('clienteNascimento').value='';
  document.getElementById('clienteTelefone').value='';
  document.getElementById('modalClienteTitle').textContent='Novo Cliente';
  openModal('modalCliente');
}

async function openEditCliente(id){
  const { data: cl } = await db.from('clientes').select('*').eq('id',id).maybeSingle();
  if(!cl) return;
  document.getElementById('clienteId').value=cl.id;
  document.getElementById('clienteNome').value=cl.nome||'';
  document.getElementById('clienteNascimento').value=cl.nascimento||'';
  document.getElementById('clienteTelefone').value=cl.telefone||'';
  document.getElementById('modalClienteTitle').textContent='Editar Cliente';
  openModal('modalCliente');
}

async function openVerCliente(id){
  const [clRes, crRes, agRes] = await Promise.all([
    db.from('clientes').select('*').eq('id',id).maybeSingle(),
    db.from('creditos_pacote').select('*').eq('cliente_nome',(await db.from('clientes').select('nome').eq('id',id).maybeSingle()).data?.nome||''),
    db.from('agendamentos').select('*').order('data',{ascending:false}).order('horario',{ascending:false})
  ]);
  const cl = clRes.data;
  if(!cl) return;
  const creditos = crRes.data||[];
  const agendamentos = (agRes.data||[]).filter(a=>a.cliente_nome===cl.nome);

  const ativos = creditos.filter(cr=>!cr.concluido);
  const concluidos = creditos.filter(cr=>cr.concluido);

  let html =
    '<div class="ver-section-title">Informações</div>'+
    '<div class="ver-fields-row">'+
      '<div class="ver-field"><span class="ver-field-label">Nome</span><span class="ver-field-value">'+esc(cl.nome)+'</span></div>'+
      '<div class="ver-field"><span class="ver-field-label">Data de Nascimento</span><span class="ver-field-value">'+(cl.nascimento?formatBR(cl.nascimento):'—')+'</span></div>'+
      '<div class="ver-field"><span class="ver-field-label">Telefone</span><span class="ver-field-value">'+(esc(cl.telefone)||'—')+'</span></div>'+
    '</div>';

  if(ativos.length){
    html += '<div class="ver-section-title" style="margin-top:18px;">Pacotes Ativos</div>';
    ativos.forEach(cr=>{
      const itens = (cr.servicos||[]).map(s=>{
        const restante = s.qtd_total-(s.qtd_usada||0);
        return '<span class="ver-pacote-item'+(restante===0?' esgotado':'')+'">'+esc(s.servico_nome)+': '+restante+' restante'+(restante!==1?'s':'')+'</span>';
      }).join('');
      html +=
        '<div class="ver-pacote-card">'+
          '<div class="ver-pacote-nome">'+esc(cr.pacote_nome)+'</div>'+
          '<div class="ver-pacote-itens">'+itens+'</div>'+
        '</div>';
    });
  }

  if(concluidos.length){
    html += '<div class="ver-section-title" style="margin-top:18px;">Pacotes Concluídos</div>';
    concluidos.forEach(cr=>{
      const itens = (cr.servicos||[]).map(s=>'<span class="ver-pacote-item esgotado">'+esc(s.servico_nome)+': '+s.qtd_total+' usados</span>').join('');
      html +=
        '<div class="ver-pacote-card concluido">'+
          '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">'+
            '<div class="ver-pacote-nome" style="margin-bottom:0;">'+esc(cr.pacote_nome)+'</div>'+
            (cr.data_conclusao?'<div class="ver-pacote-concluido-meta">Concluído em '+formatBR(cr.data_conclusao.slice(0,10))+'</div>':'')+
          '</div>'+
          '<div class="ver-pacote-itens" style="margin-top:8px;">'+itens+'</div>'+
        '</div>';
    });
  }

  html += '<div class="ver-section-title" style="margin-top:18px;">Histórico de Serviços</div>';
  if(!agendamentos.length){
    html += '<p class="empty-msg" style="padding:12px 0;">Nenhum serviço realizado.</p>';
  } else {
    html += '<div class="ver-historico">';
    agendamentos.forEach(ag=>{
      html +=
        '<div class="ver-hist-item">'+
          '<div class="ver-hist-left">'+
            '<div class="ver-hist-data">'+formatBR(ag.data)+' '+esc(ag.horario)+'</div>'+
            '<div class="ver-hist-servico">'+esc(ag.servico_nome)+'</div>'+
          '</div>'+
          '<div class="ver-hist-right">'+
            '<span class="ver-hist-valor">R$ '+formatCur(ag.valor)+'</span>'+
            '<span class="status-badge status-'+ag.status+'" style="cursor:default;font-size:10px;">'+statusLabel(ag.status)+'</span>'+
          '</div>'+
        '</div>';
    });
    html += '</div>';
  }

  document.getElementById('verClienteContent').innerHTML = html;
  openModal('modalVerCliente');
}

/* ══════════════════════════════════════════════
   SERVIÇOS + PACOTES
══════════════════════════════════════════════ */
async function renderServicos(){
  const [svRes, pkRes] = await Promise.all([
    db.from('servicos').select('*').order('nome'),
    db.from('pacotes').select('*').order('nome')
  ]);
  const servicos = svRes.data||[];
  const pacotes = pkRes.data||[];
  const c = document.getElementById('servicosList');
  c.innerHTML = '';

  if(!servicos.length && !pacotes.length){
    c.innerHTML='<p class="empty-msg">Nenhum serviço cadastrado.</p>';
    return;
  }

  if(servicos.length){
    const ts = document.createElement('div');
    ts.className = 'servicos-section-title';
    ts.textContent = 'Serviços';
    c.appendChild(ts);

    servicos.forEach(sv=>{
      const div = document.createElement('div');
      div.className = 'service-item';
      div.innerHTML =
        '<div class="service-item-info">'+
          '<div class="service-item-name">'+esc(sv.nome)+'</div>'+
          '<div class="service-item-meta">Valor: R$ '+formatCur(sv.valor)+'&nbsp;&nbsp;·&nbsp;&nbsp;Tempo: '+esc(sv.tempo||'—')+'</div>'+
        '</div>'+
        '<div class="service-item-actions">'+
          '<button class="btn-editar" data-action="edit-servico" data-id="'+sv.id+'">'+svgIcon('edit')+' Editar</button>'+
          '<button class="btn-excluir" data-action="delete-servico" data-id="'+sv.id+'">'+svgIcon('trash')+'</button>'+
        '</div>';
      c.appendChild(div);
    });
  }

  if(pacotes.length){
    const tp = document.createElement('div');
    tp.className = 'servicos-section-title';
    tp.textContent = 'Pacotes';
    c.appendChild(tp);

    pacotes.forEach(pk=>{
      const itens = (pk.servicos||[]).map(s=>s.qtd+'x '+esc(s.servico_nome)).join(' · ');
      const div = document.createElement('div');
      div.className = 'pacote-item';
      div.innerHTML =
        '<div class="pacote-item-info">'+
          '<div class="pacote-item-name"><span class="pacote-item-tag">PACOTE</span>'+esc(pk.nome)+'</div>'+
          '<div class="pacote-item-meta">Valor: R$ '+formatCur(pk.valor)+'</div>'+
          '<div class="pacote-item-meta" style="margin-top:3px;">'+itens+'</div>'+
        '</div>'+
        '<div class="pacote-item-actions">'+
          '<button class="btn-editar" data-action="edit-pacote" data-id="'+pk.id+'">'+svgIcon('edit')+' Editar</button>'+
          '<button class="btn-excluir" data-action="delete-pacote" data-id="'+pk.id+'">'+svgIcon('trash')+'</button>'+
        '</div>';
      c.appendChild(div);
    });
  }
}

function openNewServico(){
  document.getElementById('servicoId').value='';
  document.getElementById('servicoNome').value='';
  document.getElementById('servicoValor').value='';
  document.getElementById('servicoTempo').value='';
  document.getElementById('modalServicoTitle').textContent='Novo Serviço';
  openModal('modalServico');
}

async function openEditServico(id){
  const { data: sv } = await db.from('servicos').select('*').eq('id',id).maybeSingle();
  if(!sv) return;
  document.getElementById('servicoId').value=sv.id;
  document.getElementById('servicoNome').value=sv.nome||'';
  document.getElementById('servicoValor').value=sv.valor||'';
  document.getElementById('servicoTempo').value=sv.tempo||'';
  document.getElementById('modalServicoTitle').textContent='Editar Serviço';
  openModal('modalServico');
}

/* ── PACOTE MODAL ── */
let pacoteServicosTemp = [];
let _allServicos = [];

async function openNewPacote(){
  const { data } = await db.from('servicos').select('*').order('nome');
  _allServicos = data||[];
  if(!_allServicos.length){ alert('Cadastre serviços antes de criar um pacote.'); return; }
  pacoteServicosTemp = [];
  document.getElementById('pacoteId').value='';
  document.getElementById('pacoteNome').value='';
  document.getElementById('pacoteValor').value='';
  document.getElementById('modalPacoteTitle').textContent='Novo Pacote';
  refreshPacoteLinhas();
  openModal('modalPacote');
}

async function openEditPacote(id){
  const [pkRes, svRes] = await Promise.all([
    db.from('pacotes').select('*').eq('id',id).maybeSingle(),
    db.from('servicos').select('*').order('nome')
  ]);
  const pk = pkRes.data; if(!pk) return;
  _allServicos = svRes.data||[];
  pacoteServicosTemp = (pk.servicos||[]).map(s=>({servico_nome:s.servico_nome,qtd:s.qtd}));
  document.getElementById('pacoteId').value=pk.id;
  document.getElementById('pacoteNome').value=pk.nome||'';
  document.getElementById('pacoteValor').value=pk.valor||'';
  document.getElementById('modalPacoteTitle').textContent='Editar Pacote';
  refreshPacoteLinhas();
  openModal('modalPacote');
}

function refreshPacoteLinhas(){
  const lista = document.getElementById('pacoteServicosLista');
  lista.innerHTML = '';
  if(!_allServicos.length){ lista.innerHTML='<p style="font-size:12px;color:#888;padding:4px 0;">Cadastre serviços primeiro.</p>'; return; }

  pacoteServicosTemp.forEach((item,idx)=>{
    const wrapper = document.createElement('div');
    wrapper.style.cssText='display:flex;gap:8px;align-items:center;margin-bottom:8px;';

    const sel = document.createElement('select');
    sel.className='form-input form-select';
    sel.style.flex='1';
    _allServicos.forEach(s=>{
      const o = document.createElement('option');
      o.value=s.nome; o.textContent=s.nome;
      if(item.servico_nome===s.nome) o.selected=true;
      sel.appendChild(o);
    });
    sel.addEventListener('change',()=>{ pacoteServicosTemp[idx].servico_nome=sel.value; });

    const inp = document.createElement('input');
    inp.type='number'; inp.min='1'; inp.value=item.qtd||1;
    inp.className='form-input'; inp.style.width='70px';
    inp.placeholder='Qtd';
    inp.addEventListener('change',()=>{ pacoteServicosTemp[idx].qtd=Math.max(1,parseInt(inp.value)||1); });

    const btn = document.createElement('button');
    btn.type='button'; btn.className='btn-icon btn-delete'; btn.innerHTML=svgIcon('x'); btn.title='Remover';
    btn.addEventListener('click',()=>{ pacoteServicosTemp.splice(idx,1); refreshPacoteLinhas(); });

    wrapper.appendChild(sel); wrapper.appendChild(inp); wrapper.appendChild(btn);
    lista.appendChild(wrapper);
  });
}

/* ══════════════════════════════════════════════
   AGENDAMENTO MODAL
══════════════════════════════════════════════ */
let _agServicos = [];   // all servicos
let _agPacotes = [];    // all pacotes
let _agClientes = [];   // all clientes
let _agCreditos = [];   // active creditos for selected client
let _agLinhas = [];     // service lines [{servico_id, servico_nome, valor, is_pacote, pacote_id, credito_id}]
let _agEditId = null;

async function openNewAgendamento(prefDate){
  _agEditId = null;
  await _loadAgData();
  _agLinhas = [{ servico_id:'', servico_nome:'', valor:'', is_pacote:false }];
  document.getElementById('agendamentoId').value='';
  document.getElementById('agendamentoCliente').value='';
  document.getElementById('agendamentoData').value=prefDate||hojeStr();
  document.getElementById('agendamentoHorario').value='';
  document.getElementById('modalAgendamentoTitle').textContent='Novo Agendamento';
  _agCreditos=[];
  renderAgLinhas();
  _populateHorarios('');
  openModal('modalAgendamento');
}

async function openEditAgendamento(id){
  const { data: ag } = await db.from('agendamentos').select('*').eq('id',id).maybeSingle();
  if(!ag) return;
  _agEditId = id;
  await _loadAgData();
  _agCreditos = await _loadCreditos(ag.cliente_nome);
  _agLinhas = [{
    servico_id: ag.servico_id||'',
    servico_nome: ag.servico_nome||'',
    valor: ag.valor ? String(ag.valor) : '',
    is_pacote: !!ag.pacote_id,
    pacote_id: ag.pacote_id||null,
    credito_id: ag.credito_id||null
  }];
  document.getElementById('agendamentoId').value=ag.id;
  document.getElementById('agendamentoCliente').value=ag.cliente_nome||'';
  document.getElementById('agendamentoData').value=ag.data||'';
  document.getElementById('modalAgendamentoTitle').textContent='Editar Agendamento';
  renderAgLinhas();
  _populateHorarios(ag.horario||'');
  openModal('modalAgendamento');
}

async function _loadAgData(){
  const [sv,pk,cl] = await Promise.all([
    db.from('servicos').select('*').order('nome'),
    db.from('pacotes').select('*').order('nome'),
    db.from('clientes').select('*').order('nome')
  ]);
  _agServicos=sv.data||[];
  _agPacotes=pk.data||[];
  _agClientes=cl.data||[];
}

async function _loadCreditos(clienteNome){
  if(!clienteNome) return [];
  const { data } = await db.from('creditos_pacote').select('*').eq('cliente_nome',clienteNome).eq('concluido',false);
  return data||[];
}

function _populateHorarios(sel){
  const s = document.getElementById('agendamentoHorario');
  s.innerHTML='<option value="">Selecione o horário</option>';
  timeSlots().forEach(t=>{
    const o=document.createElement('option');
    o.value=t; o.textContent=t;
    if(t===sel) o.selected=true;
    s.appendChild(o);
  });
}

function _buildCreditoOptions(){
  const opts = [];
  _agCreditos.forEach(cr=>{
    (cr.servicos||[]).forEach(sv=>{
      const restante = sv.qtd_total-(sv.qtd_usada||0);
      if(restante>0){
        opts.push({
          value: 'credito::'+cr.id+'::'+sv.servico_nome,
          label: sv.servico_nome+' — '+cr.pacote_nome+' ('+restante+' restante'+(restante!==1?'s':'')+')',
          valor: 0,
          is_pacote: true,
          pacote_id: cr.pacote_id,
          credito_id: cr.id,
          servico_nome_real: sv.servico_nome
        });
      }
    });
  });
  return opts;
}

function renderAgLinhas(){
  const container = document.getElementById('agLinhasContainer');
  container.innerHTML='';
  const creditoOpts = _buildCreditoOptions();

  _agLinhas.forEach((linha,idx)=>{
    const div = document.createElement('div');
    div.className='servico-row';

    // SELECT
    const selWrapper = document.createElement('div');
    selWrapper.className='servico-row-header';

    const sel = document.createElement('select');
    sel.className='form-input form-select';
    sel.innerHTML='<option value="">Selecione um serviço</option>';

    if(creditoOpts.length){
      const grpC = document.createElement('optgroup');
      grpC.label='— Usar Crédito de Pacote —';
      creditoOpts.forEach(opt=>{
        const o=document.createElement('option');
        o.value=opt.value; o.textContent=opt.label;
        if(linha.servico_id===opt.value) o.selected=true;
        grpC.appendChild(o);
      });
      sel.appendChild(grpC);
    }

    if(_agServicos.length){
      const grpS = document.createElement('optgroup');
      grpS.label='Serviços';
      _agServicos.forEach(s=>{
        const o=document.createElement('option');
        o.value=s.id; o.textContent=s.nome;
        o.dataset.valor=s.valor; o.dataset.tipo='servico';
        if(linha.servico_id===s.id) o.selected=true;
        grpS.appendChild(o);
      });
      sel.appendChild(grpS);
    }

    if(_agPacotes.length){
      const grpP = document.createElement('optgroup');
      grpP.label='Pacotes';
      _agPacotes.forEach(p=>{
        const o=document.createElement('option');
        o.value='pacote::'+p.id; o.textContent=p.nome;
        o.dataset.valor=p.valor; o.dataset.tipo='pacote';
        if(linha.servico_id==='pacote::'+p.id) o.selected=true;
        grpP.appendChild(o);
      });
      sel.appendChild(grpP);
    }

    sel.addEventListener('change',()=>{
      const val = sel.value;
      if(val.startsWith('credito::')){
        const opt = creditoOpts.find(c=>c.value===val);
        if(opt){ _agLinhas[idx]={ servico_id:val, servico_nome:opt.label, valor:'0', is_pacote:true, pacote_id:opt.pacote_id, credito_id:opt.credito_id, pacote_servicos_selecionados:[] }; }
      } else if(val.startsWith('pacote::')){
        const pkId = val.replace('pacote::','');
        const pk = _agPacotes.find(p=>p.id===pkId);
        if(pk){ _agLinhas[idx]={ servico_id:val, servico_nome:pk.nome, valor:String(pk.valor), is_pacote:false, pacote_id:pkId, credito_id:null, pacote_servicos:(pk.servicos||[]), pacote_servicos_selecionados:[] }; }
      } else {
        const sv = _agServicos.find(s=>s.id===val);
        _agLinhas[idx]={ servico_id:val, servico_nome:sv?sv.nome:'', valor:sv?String(sv.valor):'', is_pacote:false, pacote_id:null, credito_id:null, pacote_servicos:[], pacote_servicos_selecionados:[] };
      }
      renderAgLinhas();
    });

    selWrapper.appendChild(sel);

    if(_agLinhas.length>1){
      const rmBtn=document.createElement('button');
      rmBtn.type='button'; rmBtn.className='btn-icon btn-delete'; rmBtn.innerHTML=svgIcon('trash');
      rmBtn.style.cssText='width:34px;height:34px;flex-shrink:0;';
      rmBtn.addEventListener('click',()=>{ _agLinhas.splice(idx,1); renderAgLinhas(); });
      selWrapper.appendChild(rmBtn);
    }

    div.appendChild(selWrapper);

    // VALOR
    const valorWrapper = document.createElement('div');
    valorWrapper.className='servico-row-valor';
    const valorLabel = document.createElement('label');
    valorLabel.className='form-label'; valorLabel.textContent='Valor (R$)';
    const valorInp = document.createElement('input');
    valorInp.type='text'; valorInp.className='form-input'; valorInp.placeholder='0,00';
    valorInp.value=linha.valor||'';
    valorInp.addEventListener('input',()=>{ _agLinhas[idx].valor=valorInp.value; });
    valorWrapper.appendChild(valorLabel);
    valorWrapper.appendChild(valorInp);
    div.appendChild(valorWrapper);

    // PAINEL DE CRÉDITOS DO PACOTE (só para pacotes novos)
    if(linha.servico_id && linha.servico_id.startsWith('pacote::') && Array.isArray(linha.pacote_servicos) && linha.pacote_servicos.length){
      const creditPanel = document.createElement('div');
      creditPanel.className='ag-pacote-creditos';

      const creditTitle = document.createElement('p');
      creditTitle.className='ag-pacote-creditos-title';
      creditTitle.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> Selecione o que será usado neste agendamento';
      creditPanel.appendChild(creditTitle);

      const grid = document.createElement('div');
      grid.className='ag-pacote-servicos-grid';

      linha.pacote_servicos.forEach((sv,svIdx)=>{
        const label = document.createElement('label');
        label.className='ag-pacote-sv-item';

        const cb = document.createElement('input');
        cb.type='checkbox';
        cb.className='ag-pacote-sv-cb';
        // conta quantos já foram selecionados para este serviço
        const jaUsados = (linha.pacote_servicos_selecionados||[]).filter(s=>s===sv.servico_nome).length;
        const total = sv.qtd||1;
        // renderiza uma checkbox por unidade disponível
        for(let i=0;i<total;i++){
          const cbI = document.createElement('input');
          cbI.type='checkbox';
          cbI.className='ag-pacote-sv-cb';
          cbI.checked = i < jaUsados;
          cbI.addEventListener('change',()=>{
            // reconstrói lista de selecionados
            const sels = _agLinhas[idx].pacote_servicos_selecionados.filter(s=>s!==sv.servico_nome);
            let cnt = 0;
            label.closest('.ag-pacote-sv-item') && null; // noop
            // conta todas as checkboxes deste serviço dentro do grid
            const allCbs = grid.querySelectorAll(`.ag-pacote-sv-cb[data-sv="${svIdx}"]`);
            allCbs.forEach(c=>{ if(c.checked) cnt++; });
            for(let k=0;k<cnt;k++) sels.push(sv.servico_nome);
            _agLinhas[idx].pacote_servicos_selecionados = sels;
          });
          cbI.dataset.sv = String(svIdx);
          label.appendChild(cbI);
        }

        const svInfo = document.createElement('span');
        svInfo.className='ag-pacote-sv-info';
        svInfo.innerHTML=`<span class="ag-pacote-sv-nome">${sv.servico_nome}</span><span class="ag-pacote-sv-qtd">${total}x</span>`;
        label.appendChild(svInfo);

        grid.appendChild(label);
      });

      creditPanel.appendChild(grid);
      div.appendChild(creditPanel);
    }

    container.appendChild(div);
  });
}

/* ══════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════ */
async function renderConfig(){
  const { data } = await db.from('config_studio').select('*').maybeSingle();
  document.getElementById('configNomeStudio').value=(data&&data.nome_studio)||'Estúdio Monizy Silva';
  const msgEl = document.getElementById('configMensagemLembrete');
  if(msgEl) msgEl.value=(data&&data.mensagem_lembrete)||'';
  window._configId = data&&data.id;

  // Preenche dados da conta no modo visualização
  const { data: { user } } = await db.auth.getUser();
  const meta = (user&&user.user_metadata)||{};
  const nome = meta.full_name||meta.name||'';
  const telefone = meta.phone||'';
  const username = meta.username||'';

  document.getElementById('contaViewNome').textContent = nome||'—';
  document.getElementById('contaViewTelefone').textContent = telefone||'—';
  document.getElementById('contaViewUsuario').textContent = username||'—';

  // Preenche campos de edição
  document.getElementById('configNome').value = nome;
  document.getElementById('configTelefone').value = telefone;
  document.getElementById('configUsername').value = username;

  // Garante modo view
  document.getElementById('contaViewMode').style.display='';
  document.getElementById('contaEditMode').style.display='none';

  // Limpa campos de senha e mensagens
  document.getElementById('configNovaSenha').value='';
  document.getElementById('configConfirmaSenha').value='';
  const configLoginMsgEl = document.getElementById('configLoginMsg');
  if(configLoginMsgEl){ configLoginMsgEl.textContent=''; configLoginMsgEl.style.color=''; }

  // Fecha accordion de senha
  const acc = document.getElementById('accordionSenha');
  const tog = document.getElementById('btnToggleSenha');
  if(acc) acc.classList.remove('open');
  if(tog) tog.classList.remove('open');
}

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
let _appInited = false;
let _agSubmitting = false;
async function initApp(){
  if(_appInited) return;
  _appInited = true;

  // Load studio name
  const { data: cfg } = await db.from('config_studio').select('nome_studio').maybeSingle();
  if(cfg&&cfg.nome_studio){
    document.getElementById('sidebarLogo').textContent=cfg.nome_studio;
    document.title=cfg.nome_studio;
  }

  /* ── SIDEBAR ── */
  document.getElementById('menuToggle').addEventListener('click',toggleSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click',closeSidebar);

  /* ── NAV ── */
  document.querySelectorAll('.nav-link').forEach(link=>{
    link.addEventListener('click',function(e){
      e.preventDefault();
      navigateTo(this.dataset.page);
    });
  });

  /* ── MODAL OVERLAY ── */
  document.getElementById('modalOverlay').addEventListener('click',function(){
    closeAllModals();
    _deleteCb=null;
  });

  /* ── HOME ── */
  document.getElementById('btnNovoAgendamentoHome').addEventListener('click',()=>openNewAgendamento());

  document.getElementById('proximosAgendamentos').addEventListener('click',async function(e){
    const btn=e.target.closest('[data-action]'); if(!btn) return;
    const id=btn.dataset.id, action=btn.dataset.action;
    if(action==='status'){
      const { data: ag } = await db.from('agendamentos').select('status').eq('id',id).maybeSingle();
      if(!ag) return;
      await db.from('agendamentos').update({status:nextStatus(ag.status)}).eq('id',id);
      renderHome();
    } else if(action==='edit') openEditAgendamento(id);
    else if(action==='delete') confirmDelete('agendamento',id);
  });

  /* ── AGENDA ── */
  document.getElementById('calPrev').addEventListener('click',()=>{
    calWeek=new Date(calWeek.getFullYear(),calWeek.getMonth(),calWeek.getDate()-7);
    renderCalendar();
  });
  document.getElementById('calNext').addEventListener('click',()=>{
    calWeek=new Date(calWeek.getFullYear(),calWeek.getMonth(),calWeek.getDate()+7);
    renderCalendar();
  });
  document.getElementById('btnMostrarTodos').addEventListener('click',()=>{
    calFilter=null;
    document.getElementById('filterDateLabel').textContent='';
    renderCalendar(); renderAgendaList();
  });
  document.getElementById('btnNovoAgendamentoAgenda').addEventListener('click',()=>openNewAgendamento(calFilter||hojeStr()));
  document.getElementById('btnEnviarLembrete').addEventListener('click',enviarLembrete);

  document.getElementById('agendaList').addEventListener('click',async function(e){
    const btn=e.target.closest('[data-action]'); if(!btn) return;
    const id=btn.dataset.id, action=btn.dataset.action;
    if(action==='status'){
      const { data: ag } = await db.from('agendamentos').select('status').eq('id',id).maybeSingle();
      if(!ag) return;
      await db.from('agendamentos').update({status:nextStatus(ag.status)}).eq('id',id);
      renderAgendaList();
    } else if(action==='edit') openEditAgendamento(id);
    else if(action==='delete') confirmDelete('agendamento',id);
  });

  /* ── AGENDAMENTO MODAL ── */
  document.getElementById('btnAddServicoLinha').addEventListener('click',()=>{
    _agLinhas.push({servico_id:'',servico_nome:'',valor:'',is_pacote:false});
    renderAgLinhas();
  });

  // Autocomplete cliente
  const acInput = document.getElementById('agendamentoCliente');
  const acList = document.getElementById('clienteSuggestions');

  acInput.addEventListener('input',function(){
    const q=this.value.trim().toLowerCase();
    acList.innerHTML=''; acList.classList.remove('show');
    if(!q) return;
    const matches=_agClientes.filter(c=>c.nome.toLowerCase().includes(q)).slice(0,8);
    if(!matches.length) return;
    matches.forEach(c=>{
      const li=document.createElement('li'); li.textContent=c.nome;
      li.addEventListener('mousedown',async function(e){
        e.preventDefault();
        acInput.value=c.nome;
        acList.classList.remove('show'); acList.innerHTML='';
        _agCreditos=await _loadCreditos(c.nome);
        renderAgLinhas();
      });
      acList.appendChild(li);
    });
    acList.classList.add('show');
  });
  acInput.addEventListener('blur',()=>{ setTimeout(()=>{ acList.classList.remove('show'); acList.innerHTML=''; },150); });

  document.getElementById('formAgendamento').addEventListener('submit',async function(e){
    e.preventDefault();
    if(_agSubmitting) return;
    const clienteNome=document.getElementById('agendamentoCliente').value.trim();
    const data=document.getElementById('agendamentoData').value;
    const horario=document.getElementById('agendamentoHorario').value;
    if(!clienteNome){ alert('Informe o nome do cliente.'); return; }
    if(!data){ alert('Informe a data.'); return; }
    if(!horario){ alert('Selecione o horário.'); return; }
    const validLinhas=_agLinhas.filter(l=>l.servico_id);
    if(!validLinhas.length){ alert('Selecione pelo menos um serviço.'); return; }
    _agSubmitting = true;

    if(_agEditId){
      // Edit: update first line only
      const sv=validLinhas[0];
      await db.from('agendamentos').update({
        cliente_nome:clienteNome,
        servico_id:sv.servico_id,
        servico_nome:sv.servico_nome,
        valor:parseFloat(String(sv.valor).replace(',','.'))||0,
        data, horario,
        pacote_id:sv.pacote_id||null,
        credito_id:sv.credito_id||null
      }).eq('id',_agEditId);
    } else {
      for(const sv of validLinhas){
        const payload={
          cliente_nome:clienteNome,
          servico_id:sv.servico_id,
          servico_nome:sv.servico_nome,
          valor:parseFloat(String(sv.valor).replace(',','.'))||0,
          data, horario, status:'pendente',
          pacote_id:sv.pacote_id||null,
          credito_id:sv.credito_id||null
        };
        const { data: agData } = await db.from('agendamentos').insert(payload).select().single();

        // If using a package credit, decrement usage
        if(sv.is_pacote && sv.credito_id){
          const cr=_agCreditos.find(c=>c.id===sv.credito_id);
          if(cr){
            const svNomeReal = sv.servico_nome.split(' — ')[0];
            const updatedServicos=(cr.servicos||[]).map(s=>{
              if(s.servico_nome===svNomeReal && (s.qtd_total-(s.qtd_usada||0))>0)
                return {...s, qtd_usada:(s.qtd_usada||0)+1};
              return s;
            });
            const allUsed=updatedServicos.every(s=>(s.qtd_usada||0)>=s.qtd_total);
            await db.from('creditos_pacote').update({
              servicos:updatedServicos,
              concluido:allUsed,
              data_conclusao:allUsed?new Date().toISOString():null
            }).eq('id',sv.credito_id);
            if(agData&&agData.id)
              await db.from('agendamentos').update({credito_id:sv.credito_id}).eq('id',agData.id);
          }
        }

        // If scheduling new package (not credit), create credit entry with usage from this appointment
        if(!sv.is_pacote && sv.pacote_id && !sv.credito_id){
          const pk=_agPacotes.find(p=>p.id===sv.pacote_id);
          if(pk){
            const selecionados = sv.pacote_servicos_selecionados||[];
            // conta quantas vezes cada serviço foi marcado
            const usadosMap = {};
            selecionados.forEach(nome=>{ usadosMap[nome]=(usadosMap[nome]||0)+1; });
            const servicosComUso = (pk.servicos||[]).map(s=>({
              servico_nome: s.servico_nome,
              qtd_total: s.qtd||1,
              qtd_usada: usadosMap[s.servico_nome]||0
            }));
            const allUsed = servicosComUso.every(s=>s.qtd_usada>=s.qtd_total);
            const { data: crData } = await db.from('creditos_pacote').insert({
              cliente_nome: clienteNome,
              pacote_id: pk.id,
              pacote_nome: pk.nome,
              servicos: servicosComUso,
              concluido: allUsed,
              data_conclusao: allUsed ? new Date().toISOString() : null
            }).select().single();
            // vincula o agendamento ao crédito criado se houve uso
            if(crData && agData && agData.id && selecionados.length){
              await db.from('agendamentos').update({ credito_id: crData.id }).eq('id', agData.id);
            }
          }
        }
      }
    }

    _agSubmitting = false;
    closeModal('modalAgendamento');
    refreshCurrent();
  });
  document.getElementById('btnCancelAgendamento').addEventListener('click',()=>{ _agSubmitting=false; closeModal('modalAgendamento'); });

  /* ── CLIENTES ── */
  document.getElementById('btnNovoCliente').addEventListener('click',openNewCliente);
  document.getElementById('clientesList').addEventListener('click',function(e){
    const btn=e.target.closest('[data-action]'); if(!btn) return;
    const id=btn.dataset.id;
    if(btn.dataset.action==='ver') openVerCliente(id);
    else if(btn.dataset.action==='edit') openEditCliente(id);
    else if(btn.dataset.action==='delete') confirmDelete('cliente',id);
  });
  document.getElementById('formCliente').addEventListener('submit',async function(e){
    e.preventDefault();
    const id=document.getElementById('clienteId').value;
    const data={
      nome:document.getElementById('clienteNome').value.trim(),
      nascimento:document.getElementById('clienteNascimento').value||null,
      telefone:document.getElementById('clienteTelefone').value.trim()
    };
    if(!data.nome){ alert('Informe o nome do cliente.'); return; }
    if(id) await db.from('clientes').update(data).eq('id',id);
    else await db.from('clientes').insert(data);
    closeModal('modalCliente');
    renderClientes();
  });
  document.getElementById('btnCancelCliente').addEventListener('click',()=>closeModal('modalCliente'));
  document.getElementById('btnFecharVerCliente').addEventListener('click',()=>closeModal('modalVerCliente'));

  /* ── SERVIÇOS ── */
  document.getElementById('btnNovoServico').addEventListener('click',openNewServico);
  document.getElementById('btnNovoPacote').addEventListener('click',openNewPacote);

  document.getElementById('servicosList').addEventListener('click',function(e){
    const btn=e.target.closest('[data-action]'); if(!btn) return;
    if(btn.dataset.action==='edit-servico') openEditServico(btn.dataset.id);
    else if(btn.dataset.action==='edit-pacote') openEditPacote(btn.dataset.id);
    else if(btn.dataset.action==='delete-servico') confirmDelete('servico',btn.dataset.id);
    else if(btn.dataset.action==='delete-pacote') confirmDelete('pacote',btn.dataset.id);
  });

  document.getElementById('formServico').addEventListener('submit',async function(e){
    e.preventDefault();
    const id=document.getElementById('servicoId').value;
    const data={
      nome:document.getElementById('servicoNome').value.trim(),
      valor:parseFloat(String(document.getElementById('servicoValor').value).replace(',','.'))||0,
      tempo:document.getElementById('servicoTempo').value.trim()
    };
    if(!data.nome){ alert('Informe o nome do serviço.'); return; }
    if(id) await db.from('servicos').update(data).eq('id',id);
    else await db.from('servicos').insert(data);
    closeModal('modalServico');
    renderServicos();
  });
  document.getElementById('btnCancelServico').addEventListener('click',()=>closeModal('modalServico'));

  /* ── PACOTE ── */
  document.getElementById('btnAddServicoAoPacote').addEventListener('click',()=>{
    if(!_allServicos.length){ alert('Cadastre serviços primeiro.'); return; }
    pacoteServicosTemp.push({servico_nome:_allServicos[0].nome,qtd:1});
    refreshPacoteLinhas();
  });
  document.getElementById('formPacote').addEventListener('submit',async function(e){
    e.preventDefault();
    const id=document.getElementById('pacoteId').value;
    const nome=document.getElementById('pacoteNome').value.trim();
    const valor=document.getElementById('pacoteValor').value.trim();
    if(!nome){ alert('Informe o nome do pacote.'); return; }
    if(!pacoteServicosTemp.length){ alert('Adicione pelo menos um serviço ao pacote.'); return; }
    const data={ nome, valor:parseFloat(String(valor).replace(',','.'))||0, servicos:pacoteServicosTemp.map(s=>({servico_nome:s.servico_nome,qtd:s.qtd})) };
    if(id) await db.from('pacotes').update(data).eq('id',id);
    else await db.from('pacotes').insert(data);
    closeModal('modalPacote');
    renderServicos();
  });
  document.getElementById('btnCancelPacote').addEventListener('click',()=>closeModal('modalPacote'));

  /* ── CONFIRM DELETE ── */
  document.getElementById('btnConfirmDelete').addEventListener('click',function(){
    if(_deleteCb){ _deleteCb(); _deleteCb=null; }
  });
  document.getElementById('btnCancelDelete').addEventListener('click',()=>{ _deleteCb=null; closeModal('modalConfirm'); });
  document.getElementById('btnFecharLembretes').addEventListener('click',()=>closeModal('modalLembretes'));

  /* ── CONFIG ── */
  document.getElementById('btnSalvarConfig').addEventListener('click',async function(){
    const nome=document.getElementById('configNomeStudio').value.trim();
    if(!nome) return;
    if(window._configId) await db.from('config_studio').update({nome_studio:nome}).eq('id',window._configId);
    else {
      const { data } = await db.from('config_studio').insert({nome_studio:nome}).select().single();
      window._configId=data&&data.id;
    }
    document.getElementById('sidebarLogo').textContent=nome;
    document.title=nome;
    alert('Configuração salva!');
  });
  document.getElementById('btnSalvarLembrete').addEventListener('click',async function(){
    const msg=document.getElementById('configMensagemLembrete').value;
    if(window._configId) await db.from('config_studio').update({mensagem_lembrete:msg}).eq('id',window._configId);
    alert('Mensagem de lembrete salva!');
  });

  /* ── TOGGLE SENHA CONFIG ── */
  function makeConfigEye(eyeId, inputId, svgId){
    document.getElementById(eyeId).addEventListener('click',()=>{
      const inp = document.getElementById(inputId);
      const showing = inp.type === 'text';
      inp.type = showing ? 'password' : 'text';
      document.getElementById(svgId).innerHTML = showing
        ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
        : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    });
  }
  makeConfigEye('configEyeSenha','configNovaSenha','configEyeSenhaIcon');
  makeConfigEye('configEyeConfirma','configConfirmaSenha','configEyeConfirmaIcon');

  /* ── CONFIG TABS ── */
  document.querySelectorAll('.cfg-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cfg-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.cfg-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('cfg-panel-' + tab.dataset.cfgTab).classList.add('active');
    });
  });

  /* ── ACCORDION SENHA ── */
  document.getElementById('btnToggleSenha').addEventListener('click', function(){
    const body = document.getElementById('accordionSenha');
    const isOpen = body.classList.toggle('open');
    this.classList.toggle('open', isOpen);
    if(!isOpen){
      document.getElementById('configNovaSenha').value='';
      document.getElementById('configConfirmaSenha').value='';
      const m=document.getElementById('configLoginMsg'); m.textContent=''; m.style.color='';
    }
  });

  /* ── EDITAR CONTA (alterna modos) ── */
  document.getElementById('btnEditarConta').addEventListener('click', ()=>{
    document.getElementById('contaViewMode').style.display='none';
    document.getElementById('contaEditMode').style.display='';
  });

  document.getElementById('btnCancelarEditConta').addEventListener('click', ()=>{
    document.getElementById('contaViewMode').style.display='';
    document.getElementById('contaEditMode').style.display='none';
  });

  /* ── SALVAR DADOS DA CONTA ── */
  document.getElementById('btnSalvarConta').addEventListener('click', async function(){
    const msgEl = document.getElementById('configContaMsg');
    msgEl.textContent = ''; msgEl.style.color = '';
    const nome = document.getElementById('configNome').value.trim();
    const telefone = document.getElementById('configTelefone').value.trim();
    const novoUsername = document.getElementById('configUsername').value.trim();
    if(!nome){ msgEl.style.color='var(--red)'; msgEl.textContent='Informe o nome completo.'; return; }
    if(!novoUsername){ msgEl.style.color='var(--red)'; msgEl.textContent='Informe o nome de usuário.'; return; }
    if(!/^[a-zA-Z0-9_]+$/.test(novoUsername)){ msgEl.style.color='var(--red)'; msgEl.textContent='Usuário: use apenas letras, números e _.'; return; }

    this.disabled = true; this.textContent = 'Salvando...';

    // Verifica se o username mudou e se já está em uso
    const { data: { user: currentUser } } = await db.auth.getUser();
    const usernameAtual = (currentUser&&currentUser.user_metadata?.username)||'';
    if(novoUsername.toLowerCase() !== usernameAtual.toLowerCase()){
      const existente = await _resolveEmail({ username: novoUsername });
      if(existente){
        this.disabled = false; this.textContent = 'Salvar Alterações';
        msgEl.style.color='var(--red)'; msgEl.textContent='Este nome de usuário já está em uso por outra conta.';
        return;
      }
    }

    // Atualiza metadados e email interno (username@monizy.internal)
    const novoEmail = `${novoUsername.toLowerCase()}@monizy.internal`;
    const usernameChanged = novoUsername.toLowerCase() !== usernameAtual.toLowerCase();

    let error = null;
    if(usernameChanged){
      // Precisa atualizar email + metadata via admin (edge function)
      const res = await fetch(`${SUPABASE_URL}/functions/v1/update-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ novoUsername, novoEmail, nome, telefone })
      });
      if(!res.ok){ const j = await res.json(); error = { message: j.error||'Erro ao atualizar usuário.' }; }
    } else {
      const result = await db.auth.updateUser({ data: { full_name: nome, phone: telefone } });
      error = result.error;
    }

    this.disabled = false; this.textContent = 'Salvar Alterações';
    if(error){ msgEl.style.color='var(--red)'; msgEl.textContent=traduzirErroAuth(error.message); }
    else {
      document.getElementById('contaViewNome').textContent = nome||'—';
      document.getElementById('contaViewTelefone').textContent = telefone||'—';
      document.getElementById('contaViewUsuario').textContent = novoUsername||'—';
      document.getElementById('contaViewMode').style.display='';
      document.getElementById('contaEditMode').style.display='none';
      msgEl.textContent=''; msgEl.style.color='';
    }
  });

  /* ── SALVAR SENHA ── */
  document.getElementById('btnSalvarLogin').addEventListener('click', async function(){
    const msgEl = document.getElementById('configLoginMsg');
    msgEl.textContent = '';
    const novaSenha = document.getElementById('configNovaSenha').value;
    const confirmaSenha = document.getElementById('configConfirmaSenha').value;
    if(!novaSenha){ msgEl.style.color='var(--red)'; msgEl.textContent='Informe a nova senha.'; return; }
    if(novaSenha !== confirmaSenha){ msgEl.style.color='var(--red)'; msgEl.textContent='As senhas não coincidem.'; return; }
    if(novaSenha.length < 6){ msgEl.style.color='var(--red)'; msgEl.textContent='A senha deve ter pelo menos 6 caracteres.'; return; }
    this.disabled = true; this.textContent = 'Salvando...';
    const { error } = await db.auth.updateUser({ password: novaSenha });
    this.disabled = false; this.textContent = 'Salvar Nova Senha';
    if(error){ msgEl.style.color='var(--red)'; msgEl.textContent=traduzirErroAuth(error.message); }
    else {
      msgEl.style.color='var(--green)'; msgEl.textContent='Senha alterada com sucesso!';
      document.getElementById('configNovaSenha').value='';
      document.getElementById('configConfirmaSenha').value='';
    }
  });

  /* ── INITIAL RENDER ── */
  navigateTo('home');

  /* ── LOGOUT ── */
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await db.auth.signOut();
  });
}
