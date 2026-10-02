// ============================================================================
// NÚCLEO CENTRAL BLINDADO (CORE) - COTADOR v5.9 ENTERPRISE
// ============================================================================
const _origWarn = console.warn;
console.warn = function(...args) {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('cdn.tailwindcss.com should not be used in production')) return;
  _origWarn.apply(console, args);
};

window.Cotador = { core: {}, tables: {}, app: {} };

window.Cotador.core = {
  VERSION: '5.9.0',
  SUPABASE_URL: "https://rftvbxlbltmiwamjhgzl.supabase.co/rest/v1",
  SUPABASE_KEY: "sb_publishable_fN_BXmhXXod2gpeyJ8u38Q_rvgDPl7N",
  ADMIN_MASTER_EMAIL: "jose.garrett@solonetwork.com.br",


  // MOTOR DE CLASSIFICAÇÃO E NORMALIZAÇÃO
  classificarProdutoMicrosoft(nomeRaw) {
    const nomeLimpo = String(nomeRaw || '').toLowerCase().replace(/\s+/g, ' ').trim();
    let produto_base = 'desconhecido';
    let familia_produto = 'outros';
    let tipo_produto = 'principal';

    // 1. Identificar Produto Base via Aliases
    for (const [base, aliases] of Object.entries(this.MS_ALIASES)) {
      if (aliases.some(alias => nomeLimpo.includes(alias))) {
        produto_base = base;
        break;
      }
    }

    // 2. Identificar Família
    if (produto_base.includes('business')) familia_produto = 'business';
    else if (['e1', 'e3', 'e5', 'f1', 'f3', 'apps-for-enterprise'].includes(produto_base)) familia_produto = 'enterprise';
    else if (produto_base.includes('exchange')) familia_produto = 'exchange';
    else if (produto_base.includes('power-bi')) familia_produto = 'powerbi';
    else if (produto_base.includes('copilot')) familia_produto = 'copilot';
    else if (produto_base.includes('defender')) familia_produto = 'security';
    else if (produto_base.includes('teams')) familia_produto = 'teams';
    else if (produto_base.includes('windows-server') || produto_base.includes('sql-server')) familia_produto = 'infrastructure';
    else if (produto_base.includes('visual-studio')) familia_produto = 'developer';

    // 3. Identificar Tipo de Produto (Filtros Secundários)
    if (/\b(no teams|sem teams|without teams|w\/o teams)\b/.test(nomeLimpo)) tipo_produto = 'sem_teams';
    else if (/\b(with copilot|\+ copilot)\b/.test(nomeLimpo)) tipo_produto = 'copilot_bundle';
    else if (/\b(add-on|addon|attach)\b/.test(nomeLimpo)) tipo_produto = 'addon';
    else if (/\b(trial|promo|gratuito|free)\b/.test(nomeLimpo)) tipo_produto = 'trial';
    else if (/\b(faculty|student|academic)\b/.test(nomeLimpo)) tipo_produto = 'education';

    return { produto_base, familia_produto, tipo_produto };
  },

  _dragInitialized: false,
  _draggedRow: null,
  _lastMouseDownTarget: null,
  _searchAbortController: null,
  _rbacInitialized: false,

  modoCliente: false,
  markupPercent: 0,
  markupEnabled: false,
  calcMode: 'margin',
  
  setCalcMode(mode) {
    const novoModo = mode === 'markup' ? 'markup' : 'margin';
    this.calcMode = novoModo;
    document.body.setAttribute('data-calc-mode', novoModo);
    
    document.getElementById('btn-mode-margin')?.classList.toggle('active', novoModo === 'margin');
    document.getElementById('btn-mode-markup')?.classList.toggle('active', novoModo === 'markup');
    
    const formulaBadge = document.getElementById('calc-mode-formula-hint');
    if (formulaBadge) {
      formulaBadge.textContent = novoModo === 'margin' ? 'Custo ÷ (1 - %)' : 'Custo × (1 + %)';
      formulaBadge.className = novoModo === 'margin'
        ? 'calc-formula-pill is-margin hidden sm:inline-block'
        : 'calc-formula-pill is-markup hidden sm:inline-block';
    }
    
    if (novoModo === 'margin' && this.markupPercent >= 100) {
      this.markupPercent = 99.9;
      const input = document.getElementById('input-markup-pct');
      if (input) input.value = '99.9';
      this.mostrarToast('Na Margem Real (por dentro), o limite máximo é 99,9%.');
    }
    
    this.atualizarTitulosColunasModoCliente();
    this.recalcularSubtotais();
    if (window.Cotador.app?.salvarPreferencias) window.Cotador.app.salvarPreferencias();
  },
  
  toggleCalcMode() {
    this.setCalcMode(this.calcMode === 'margin' ? 'markup' : 'margin');
  },

  currentUser: null,
  currentProfile: null,
  isAdmin: false,
  adminViewAtiva: false,
  adminActiveTab: 'solicitacoes',
  _adminPendingCount: 0,

  // ==========================================================================
  // LÓGICA DO MODAL DE ALTERAÇÃO DE SENHA
  // ==========================================================================
  abrirModalAlterarSenha() {
    const modal = document.getElementById('modal-alterar-senha');
    if (modal) modal.classList.remove('hidden');
  },

  fecharModalAlterarSenha() {
    const modal = document.getElementById('modal-alterar-senha');
    if (modal) modal.classList.add('hidden');
    const input1 = document.getElementById('nova-senha');
    const input2 = document.getElementById('confirma-senha');
    if (input1) input1.value = '';
    if (input2) input2.value = '';
  },

  async salvarNovaSenha() {
    const s1 = document.getElementById('nova-senha').value;
    const s2 = document.getElementById('confirma-senha').value;
    const btn = document.getElementById('btn-salvar-senha');

    if (s1.length < 6) return alert('A senha deve ter no mínimo 6 caracteres para segurança.');
    if (s1 !== s2) return alert('As senhas não coincidem. Digite novamente.');

    if (btn) { btn.innerText = 'Salvando...'; btn.disabled = true; }
    try {
      await window.CotadorAuth.alterarSenhaUsuario(s1);
      this.mostrarToast('Senha alterada com sucesso!');
      this.fecharModalAlterarSenha();
    } catch (err) {
      alert('Erro ao alterar senha: ' + (err.message || 'Falha na comunicação.'));
    } finally {
      if (btn) { btn.innerHTML = 'Salvar Nova Senha'; btn.disabled = false; }
    }
  },

  // ==========================================================================
  // 1. SEGURANÇA, RBAC E PAINEL ADMINISTRATIVO (TELA DEDICADA)
  // ==========================================================================
  async inicializarSegurancaERBAC() {
    if (this._rbacInitialized) return;
    this._rbacInitialized = true;

    try {
      if (!window.CotadorAuth) return;
      if (!window.CotadorAuth.supabase && typeof window.CotadorAuth.init === 'function') {
        await window.CotadorAuth.init();
      }
      if (!window.CotadorAuth.supabase) return;

      const session = await window.CotadorAuth.getSession();
      if (!session || !session.user) return;

      this.currentUser = session.user;
      const emailLogado = String(session.user.email || '').trim().toLowerCase();

      let profile = null;
      try {
        const { data, error } = await window.CotadorAuth.supabase
          .from('user_profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        if (!error && data) profile = data;
      } catch (_) {}

      if (profile && profile.status === 'revoked') {
        alert('Seu acesso a esta ferramenta foi revogado pelo Administrador.');
        await window.CotadorAuth.logout();
        return;
      }

      this.currentProfile = profile;
      const roleBanco = String(profile?.role || '').toLowerCase();
      const roleJwt = String(session.user?.app_metadata?.role || '').toLowerCase();

      this.isAdmin = (
        roleBanco === 'admin' ||
        roleJwt === 'admin' ||
        emailLogado === this.ADMIN_MASTER_EMAIL.toLowerCase()
      );

      if (this.isAdmin) {
        this.injetarBotaoAdminHeader();
        this.atualizarContadorPendenciasAdmin();
      }
    } catch (err) {
      console.error('Erro ao inicializar RBAC:', err);
    }
  },

  injetarBotaoAdminHeader() {
    if (!this.isAdmin) return;
    if (document.getElementById('btn-painel-admin')) return;

    const ptaxPanel = document.getElementById('header-ptax-panel');
    if (!ptaxPanel || !ptaxPanel.parentElement) return;

    const btnAdmin = document.createElement('button');
    btnAdmin.type = 'button';
    btnAdmin.id = 'btn-painel-admin';
    btnAdmin.title = 'Acessar Painel Administrativo (Gestão de Usuários, Acessos e Tabelas)';
    btnAdmin.className = 'topbar-pill text-[11px] px-2.5 py-1 rounded font-semibold flex items-center gap-1.5 select-none cursor-pointer bg-amber-500/20 hover:bg-amber-500/35 border border-amber-300/40 text-white transition';
    btnAdmin.onclick = (e) => {
      e.stopPropagation();
      this.alternarTelaAdmin();
    };
    btnAdmin.innerHTML = `
      <svg class="w-3.5 h-3.5 shrink-0 text-amber-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
      </svg>
      <span id="btn-painel-admin-label">Painel Admin</span>
      <span id="badge-admin-pending" class="hidden px-1.5 py-0.2 rounded-full bg-amber-400 text-[#323130] text-[10px] font-bold tabular-nums">0</span>
    `;

    ptaxPanel.parentElement.insertBefore(btnAdmin, ptaxPanel);
  },

  async atualizarContadorPendenciasAdmin() {
    if (!this.isAdmin || !window.CotadorAuth?.supabase) return;
    try {
      const { count, error } = await window.CotadorAuth.supabase
        .from('access_requests')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'pendente']);

      if (!error && typeof count === 'number') {
        this._adminPendingCount = count;
        const badge = document.getElementById('badge-admin-pending');
        if (badge) {
          badge.textContent = String(count);
          badge.classList.toggle('hidden', count <= 0);
        }
      }
    } catch (_) {}
  },

  alternarTelaAdmin(forcarEstado) {
    if (!this.isAdmin) {
      this.mostrarToast('Acesso restrito ao Administrador Global.');
      return;
    }

    this.adminViewAtiva = typeof forcarEstado === 'boolean' ? forcarEstado : !this.adminViewAtiva;

    const mainCotadorContainer = document.querySelector('body > div.max-w-\\[1600px\\]');
    let adminView = document.getElementById('admin-dedicated-view');

    if (!adminView) {
      adminView = document.createElement('div');
      adminView.id = 'admin-dedicated-view';
      adminView.className = 'hidden max-w-[1600px] mx-auto p-3 md:p-5 lg:px-6 lg:py-4 space-y-4';
      if (mainCotadorContainer && mainCotadorContainer.parentElement) {
        mainCotadorContainer.parentElement.insertBefore(adminView, mainCotadorContainer.nextSibling);
      } else {
        document.body.appendChild(adminView);
      }
      this.renderizarEstruturaPainelAdmin(adminView);
    }

    if (mainCotadorContainer) {
      mainCotadorContainer.classList.toggle('hidden', this.adminViewAtiva);
    }
    adminView.classList.toggle('hidden', !this.adminViewAtiva);

    const btnLabel = document.getElementById('btn-painel-admin-label');
    if (btnLabel) {
      btnLabel.textContent = this.adminViewAtiva ? 'Voltar ao Cotador' : 'Painel Admin';
    }

    if (this.adminViewAtiva) {
      this.selecionarAbaAdmin(this.adminActiveTab || 'solicitacoes');
    }
  },

  renderizarEstruturaPainelAdmin(container) {
    container.innerHTML = `
      <!-- CABEÇALHO DO PAINEL ADMIN -->
      <div class="card card-accent-top p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold uppercase tracking-wider">RBAC Admin Global</span>
            <h2 class="text-base font-semibold text-[#323130]">Painel Administrativo &bull; Governança de Acessos e Dados</h2>
          </div>
          <p class="text-xs text-[#605e5c] mt-1">
            Sessão administrativa ativa: <strong class="text-[#323130]">${this.escapeHTML(this.currentUser?.email || this.ADMIN_MASTER_EMAIL)}</strong>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" onclick="Cotador.core.recarregarModuloAdminAtual()" class="px-3 py-1.5 rounded text-xs font-semibold bg-[#f3f2f1] hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] transition flex items-center gap-1.5">
            <span>&#8635;</span> Atualizar Dados
          </button>
          <button type="button" onclick="Cotador.core.alternarTelaAdmin(false)" class="btn-theme-primary px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5">
            <span>&larr; Voltar ao Cotador</span>
          </button>
        </div>
      </div>

      <!-- NAVEGAÇÃO DOS 3 MÓDULOS -->
      <div class="flex flex-wrap items-center gap-2 border-b border-[#edebe9] pb-2">
        <button type="button" id="tab-btn-solicitacoes" onclick="Cotador.core.selecionarAbaAdmin('solicitacoes')" class="vendor-btn active flex items-center gap-2 !px-4 !py-2">
          <span>1. Solicitações de Acesso</span>
          <span id="tab-badge-pending" class="px-1.5 py-0.2 rounded-full bg-white/25 text-[10px] font-bold">0</span>
        </button>
        <button type="button" id="tab-btn-usuarios" onclick="Cotador.core.selecionarAbaAdmin('usuarios')" class="vendor-btn flex items-center gap-2 !px-4 !py-2">
          <span>2. Gestão de Usuários</span>
        </button>
        <button type="button" id="tab-btn-upload" onclick="Cotador.core.selecionarAbaAdmin('upload')" class="vendor-btn flex items-center gap-2 !px-4 !py-2">
          <span>3. Gestão de Dados (Upload CSV)</span>
        </button>
      </div>

      <!-- MÓDULO 1: SOLICITAÇÕES DE ACESSO -->
      <div id="admin-mod-solicitacoes" class="card p-4 md:p-5 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#edebe9] pb-3">
          <div>
            <h3 class="text-sm font-semibold text-[#323130]">Fila de Solicitações de Acesso</h3>
            <p class="text-[11px] text-[#605e5c]">Aprove ou recuse pedidos enviados pela tela de login. Ao aprovar, o perfil de Visualizador é autorizado e você pode definir a senha inicial.</p>
          </div>
          <div class="flex items-center gap-2">
            <select id="admin-filter-req-status" onchange="Cotador.core.carregarSolicitacoesAdmin()" class="select-input !w-auto text-xs">
              <option value="pending">Apenas Pendentes</option>
              <option value="approved">Aprovadas</option>
              <option value="rejected">Recusadas</option>
              <option value="all">Todas</option>
            </select>
          </div>
        </div>
        <div id="admin-solicitacoes-container" class="overflow-x-auto">
          <div class="text-center py-12 text-xs text-gray-400">Carregando solicitações...</div>
        </div>
      </div>

      <!-- MÓDULO 2: GESTÃO DE USUÁRIOS -->
      <div id="admin-mod-usuarios" class="hidden card p-4 md:p-5 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#edebe9] pb-3">
          <div>
            <h3 class="text-sm font-semibold text-[#323130]">Usuários Cadastrados &amp; Controle de Permissões (RBAC)</h3>
            <p class="text-[11px] text-[#605e5c]">Gerencie o status de acesso (Ativo / Revogado) e o perfil de cada usuário autenticado na plataforma.</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <input type="text" id="admin-new-user-nome" placeholder="Nome do colaborador" class="select-input !w-44 text-xs">
            <input type="email" id="admin-new-user-email" placeholder="colaborador@solonetwork.com.br" class="select-input !w-56 text-xs">
            <input type="password" id="admin-new-user-pass" placeholder="Senha inicial (min 6)" class="select-input !w-40 text-xs">
            <button type="button" onclick="Cotador.core.criarNovoUsuarioVisualizador()" class="btn-theme-primary px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap">
              + Cadastrar Visualizador
            </button>
          </div>
        </div>
        <div id="admin-usuarios-container" class="overflow-x-auto">
          <div class="text-center py-12 text-xs text-gray-400">Carregando usuários...</div>
        </div>
      </div>

      <!-- MÓDULO 3: GESTÃO DE DADOS (UPLOAD CSV COM ROLLBACK) -->
      <div id="admin-mod-upload" class="hidden card p-4 md:p-5 space-y-4">
        <div class="border-b border-[#edebe9] pb-3">
          <h3 class="text-sm font-semibold text-[#323130]">Atualização de Tabelas de Preços (Auto-Encoding + Rollback Seguro)</h3>
          <p class="text-[11px] text-[#605e5c]">Faça upload de arquivos CSV originais (Microsoft, Adobe ou Kaspersky). O sistema detecta a codificação (UTF-8/ANSI), cria um snapshot de backup em memória e executa rollback automático em caso de falha.</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label class="section-label">Tabela de Destino</label>
            <select id="admin-upload-table" class="select-input text-xs">
                <option value="auto">Detectar Tabela Automaticamente (Multi-CSVs suportado)</option>
                <option value="crm_mapping">Dicionário CRM Dynamics (crm_mapping)</option>
                <option value="microsoft_scan">Microsoft CSP - Scan (microsoft_scan)</option>
                <option value="microsoft_solo">Microsoft CSP - Solo (microsoft_solo)</option>
                <option value="microsoft_perpetuo">Microsoft CSP Perpétuo - Solo (microsoft_perpetuo)</option>
                <option value="microsoft_mpsa">Microsoft MPSA - Solo (microsoft_mpsa)</option>
                <option value="adobe_base">Adobe VIP - Comercial (adobe_base)</option>
                <option value="adobe_edu">Adobe VIP - Education (adobe_edu)</option>
                <option value="adobe_gov">Adobe VIP - Government (adobe_gov)</option>
                <option value="adobe_promo">Adobe VIP - Promoção (adobe_promo)</option>
                <option value="kaspersky">Kaspersky Completo (kaspersky)</option>
              </select>
          </div>
          <div>
            <label class="section-label">Arquivo(s) CSV Original(is)</label>
            <input type="file" id="admin-upload-files" accept=".csv" multiple class="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#f3f2f1] file:text-[#323130] hover:file:bg-[#edebe9] file:cursor-pointer border border-[#8a8886] rounded bg-[#faf9f8] p-1">
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-3 pt-2">
          <button type="button" id="btn-admin-validar-csv" onclick="Cotador.core.iniciarUploadDadosAdmin(true)" class="flex-1 py-2 px-4 rounded font-semibold text-xs border border-[#8a8886] text-[#323130] bg-[#faf9f8] hover:bg-[#edebe9] transition">
            Apenas Validar CSV(s) (Dry-Run)
          </button>
          <button type="button" id="btn-admin-importar-csv" onclick="Cotador.core.iniciarUploadDadosAdmin(false)" class="flex-[2] py-2 px-4 rounded font-semibold text-xs btn-theme-primary shadow-sm">
            Atualizar Tabelas com Proteção Rollback
          </button>
        </div>

        <div class="space-y-2 pt-2">
          <div class="w-full bg-[#edebe9] rounded-full h-1.5 overflow-hidden">
            <div id="admin-upload-progress" class="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" style="width: 0%"></div>
          </div>
          <pre id="admin-upload-log" class="w-full bg-[#edebe9] text-[#323130] p-3.5 rounded border border-[#c8c6c4] text-[11px] font-mono whitespace-pre-wrap overflow-y-auto h-60 leading-relaxed">Aguardando seleção de arquivo(s) CSV...</pre>
        </div>
      </div>
    `;
  },

  selecionarAbaAdmin(aba) {
    this.adminActiveTab = aba;
    ['solicitacoes', 'usuarios', 'upload'].forEach(id => {
      document.getElementById(`tab-btn-${id}`)?.classList.toggle('active', id === aba);
      document.getElementById(`admin-mod-${id}`)?.classList.toggle('hidden', id !== aba);
    });
    this.recarregarModuloAdminAtual();
  },

  recarregarModuloAdminAtual() {
    this.atualizarContadorPendenciasAdmin();
    if (this.adminActiveTab === 'solicitacoes') this.carregarSolicitacoesAdmin();
    else if (this.adminActiveTab === 'usuarios') this.carregarUsuariosAdmin();
  },

  async carregarSolicitacoesAdmin() {
    const container = document.getElementById('admin-solicitacoes-container');
    if (!container || !window.CotadorAuth?.supabase) return;

    const statusFilter = document.getElementById('admin-filter-req-status')?.value || 'pending';
    container.innerHTML = `<div class="text-center py-10 text-xs text-gray-400 animate-pulse">Consultando fila de solicitações...</div>`;

    try {
      let query = window.CotadorAuth.supabase
        .from('access_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter === 'pending') {
        query = query.in('status', ['pending', 'pendente']);
      } else if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const tabBadge = document.getElementById('tab-badge-pending');
      if (tabBadge && statusFilter === 'pending') {
        tabBadge.textContent = String((data || []).length);
      }

      if (!data || data.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-xs text-gray-500 bg-[#faf9f8] rounded border border-dashed border-[#c8c6c4]">Nenhuma solicitação encontrada para o filtro selecionado.</div>`;
        return;
      }

      const rowsHTML = data.map(req => {
        const rawStatus = String(req.status || 'pending').toLowerCase();
        const status = rawStatus === 'pendente' ? 'pending' : rawStatus;
        const badgeStatus = status === 'approved'
          ? `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Aprovado</span>`
          : (status === 'rejected'
            ? `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">Recusado</span>`
            : `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">Pendente</span>`);

        const dataCriacao = this.formatarDataHoraCompleta(req.created_at);
        const safeId = this.escapeHTML(String(req.id || ''));
        const safeEmail = this.escapeHTML(req.email || '');
        const safeNome = this.escapeHTML(req.nome || '');
        const safeMotivo = this.escapeHTML(req.motivo || '-');

        const acoesHTML = status === 'pending'
          ? `<div class="flex items-center justify-end gap-1.5">
              <button type="button" data-req-id="${safeId}" data-req-email="${safeEmail}" data-req-nome="${safeNome}" onclick="Cotador.core.aprovarSolicitacaoAdmin(this.dataset.reqId, this.dataset.reqEmail, this.dataset.reqNome)" class="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition">Aprovar e Liberar</button>
              <button type="button" data-req-id="${safeId}" onclick="Cotador.core.recusarSolicitacaoAdmin(this.dataset.reqId)" class="px-2.5 py-1 rounded text-[11px] font-semibold bg-white hover:bg-red-50 text-red-700 border border-red-200 transition">Negar</button>
            </div>`
          : `<span class="text-[11px] text-gray-400">Processado</span>`;

        return `
          <tr>
            <td class="font-semibold text-[#323130]">${safeNome}</td>
            <td class="font-mono text-xs text-[#0078d4]">${safeEmail}</td>
            <td class="text-xs text-[#605e5c]">${safeMotivo}</td>
            <td class="text-xs text-gray-500 whitespace-nowrap tabular-nums">${this.escapeHTML(dataCriacao)}</td>
            <td>${badgeStatus}</td>
            <td class="text-right whitespace-nowrap">${acoesHTML}</td>
          </tr>
        `;
      }).join('');

      container.innerHTML = `
        <div class="border border-[#edebe9] rounded overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Nome Completo</th>
                <th>E-mail Corporativo</th>
                <th>Motivo / Departamento</th>
                <th>Data do Pedido</th>
                <th>Status</th>
                <th class="text-right">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs">Erro ao carregar solicitações: ${this.escapeHTML(err.message)}</div>`;
    }
  },

  abrirClienteEmailOutlook(email, nome, senhaTemporaria) {
    const assunto = encodeURIComponent('Acesso Liberado - Gerador Comercial de PNs & Cotação');
    const urlLogin = `${window.location.origin}/login.html`;
    const corpo = encodeURIComponent(
      `Olá ${nome},\n\n` +
      `Sua solicitação de acesso ao Gerador Comercial de PNs (Solo Network) foi aprovada!\n\n` +
      `Link de acesso: ${urlLogin}\n` +
      `E-mail (Login): ${email}\n` +
      `Senha Inicial: ${senhaTemporaria}\n` +
      `Perfil: Visualizador Padrão\n\n` +
      `Atenciosamente,\nAdministração do Sistema`
    );

    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${assunto}&body=${corpo}`;
    const link = document.createElement('a');
    link.href = mailtoUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 300);
  },

  async aprovarSolicitacaoAdmin(reqId, email, nome) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanNome = String(nome || '').trim();

    const senhaTemporaria = prompt(
      `Aprovar acesso de Visualizador para ${cleanNome} (${cleanEmail}).\n\nDigite uma senha temporária inicial (mínimo 6 caracteres) para criar a credencial de acesso do usuário:`,
      `Solo@${Math.floor(1000 + Math.random() * 9000)}`
    );

    if (!senhaTemporaria || senhaTemporaria.trim().length < 6) {
      this.mostrarToast('Aprovação cancelada: a senha deve ter no mínimo 6 caracteres.');
      return;
    }

    const senhaFinal = senhaTemporaria.trim();

    try {
      await window.CotadorAuth.aprovarSolicitacaoCriarUsuario({
        requestId: reqId,
        email: cleanEmail,
        nome: cleanNome,
        password: senhaFinal
      });

      this.mostrarToast(`Acesso aprovado para ${cleanEmail}!`);
      this.carregarSolicitacoesAdmin();
      this.atualizarContadorPendenciasAdmin();

      this.abrirClienteEmailOutlook(cleanEmail, cleanNome, senhaFinal);
    } catch (err) {
      alert('Erro ao aprovar solicitação: ' + (err?.message || err));
    }
  },

  async recusarSolicitacaoAdmin(reqId) {
    if (!confirm('Tem certeza que deseja recusar esta solicitação de acesso?')) return;
    try {
      const { error } = await window.CotadorAuth.supabase
        .from('access_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: this.currentUser?.email || this.ADMIN_MASTER_EMAIL
        })
        .eq('id', reqId);

      if (error) throw error;
      this.mostrarToast('Solicitação recusada.');
      this.carregarSolicitacoesAdmin();
      this.atualizarContadorPendenciasAdmin();
    } catch (err) {
      alert('Erro ao recusar solicitação: ' + err.message);
    }
  },

  async carregarUsuariosAdmin() {
    const container = document.getElementById('admin-usuarios-container');
    if (!container || !window.CotadorAuth?.supabase) return;

    container.innerHTML = `<div class="text-center py-10 text-xs text-gray-400 animate-pulse">Carregando usuários cadastrados...</div>`;

    try {
      const { data, error } = await window.CotadorAuth.supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-xs text-gray-500">Nenhum perfil encontrado em user_profiles.</div>`;
        return;
      }

      const rowsHTML = data.map(u => {
        const emailLower = String(u.email || '').toLowerCase();
        const isMaster = emailLower === this.ADMIN_MASTER_EMAIL.toLowerCase();
        const isAtivo = u.status !== 'revoked';
        const isRoleAdmin = String(u.role || '').toLowerCase() === 'admin';

        const roleBadge = isRoleAdmin
          ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Admin Global</span>`
          : `<span class="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-[#0078d4] border border-blue-200">Visualizador</span>`;

        const statusBadge = isAtivo
          ? `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Ativo</span>`
          : `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">Revogado</span>`;

        const acoesHTML = isMaster
          ? `<span class="text-[11px] text-gray-400 italic">Admin Global Protegido</span>`
          : `<div class="flex items-center justify-end gap-1.5">
              ${isAtivo
                ? `<button type="button" onclick="Cotador.core.alterarStatusUsuarioAdmin('${u.id}', 'revoked')" class="px-2.5 py-1 rounded text-[11px] font-semibold bg-white hover:bg-red-50 text-red-700 border border-red-200 transition">Revogar Acesso</button>`
                : `<button type="button" onclick="Cotador.core.alterarStatusUsuarioAdmin('${u.id}', 'active')" class="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition">Reativar Acesso</button>`
              }
            </div>`;

        return `
          <tr>
            <td class="font-semibold text-[#323130]">${this.escapeHTML(u.nome || '-')}</td>
            <td class="font-mono text-xs text-[#323130]">${this.escapeHTML(u.email || '')}</td>
            <td>${roleBadge}</td>
            <td>${statusBadge}</td>
            <td class="text-xs text-gray-500 whitespace-nowrap tabular-nums">${this.escapeHTML(this.formatarDataHoraCompleta(u.created_at))}</td>
            <td class="text-right whitespace-nowrap">${acoesHTML}</td>
          </tr>
        `;
      }).join('');

      container.innerHTML = `
        <div class="border border-[#edebe9] rounded overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil (Role)</th>
                <th>Status</th>
                <th>Criado em</th>
                <th class="text-right">Controle de Acesso</th>
              </tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs">Erro ao carregar usuários: ${this.escapeHTML(err.message)}</div>`;
    }
  },

  async criarNovoUsuarioVisualizador() {
    const nomeEl = document.getElementById('admin-new-user-nome');
    const emailEl = document.getElementById('admin-new-user-email');
    const passEl = document.getElementById('admin-new-user-pass');

    const nome = (nomeEl?.value || '').trim();
    const email = (emailEl?.value || '').trim().toLowerCase();
    const password = (passEl?.value || '').trim();

    if (!nome || !email || password.length < 6) {
      alert('Preencha Nome, E-mail válido e uma Senha Inicial com no mínimo 6 caracteres.');
      return;
    }

    try {
      await window.CotadorAuth.criarUsuarioVisualizadorDireto({ nome, email, password });
      if (nomeEl) nomeEl.value = '';
      if (emailEl) emailEl.value = '';
      if (passEl) passEl.value = '';
      this.mostrarToast(`Usuário ${email} criado com perfil Visualizador!`);
      this.carregarUsuariosAdmin();
    } catch (err) {
      alert('Falha ao criar usuário: ' + err.message);
    }
  },

  async alterarStatusUsuarioAdmin(userId, novoStatus) {
    const acao = novoStatus === 'revoked' ? 'REVOGAR' : 'REATIVAR';
    if (!confirm(`Confirma ${acao} o acesso deste usuário imediatamente?`)) return;

    try {
      const { error } = await window.CotadorAuth.supabase
        .from('user_profiles')
        .update({ status: novoStatus, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      this.mostrarToast(`Status do usuário atualizado para ${novoStatus === 'revoked' ? 'Revogado' : 'Ativo'}.`);
      this.carregarUsuariosAdmin();
    } catch (err) {
      alert('Erro ao alterar status: ' + err.message);
    }
  },

  // ==========================================================================
  // 3. MOTOR DE UPLOAD CSV COM AUTO-ENCODING E ROLLBACK SEGURO
  // ==========================================================================
  _adminLog(msg) {
    const el = document.getElementById('admin-upload-log');
    if (!el) return;
    el.textContent += '\n' + msg;
    el.scrollTop = el.scrollHeight;
  },

  _adminProgress(pct) {
    const bar = document.getElementById('admin-upload-progress');
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  },

  _normalizarChaveCSV(str) {
    if (!str) return '';
    return String(str).replace(/^\uFEFF/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  },

  async _lerArquivoCSVComEncoding(file) {
    const buffer = await file.arrayBuffer();
    try {
      const decoderUtf8 = new TextDecoder('utf-8', { fatal: true });
      return { text: decoderUtf8.decode(buffer).replace(/^\uFEFF/, ''), encoding: 'UTF-8' };
    } catch (_) {
      const decoderWin1252 = new TextDecoder('windows-1252');
      return { text: decoderWin1252.decode(buffer).replace(/^\uFEFF/, ''), encoding: 'Windows-1252 (ANSI)' };
    }
  },

  _limparLinhasVaziasTopoCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    const headerKeywords = [
      'part number', 'partnumber', 'saleitemname', 'offer display name',
      'idproduto', 'titulo sku', 'productid', 'nome do produto',
      'numero do item', 'nome curto da peca'
    ];
    for (let i = 0; i < Math.min(lines.length, 25); i++) {
      const normLine = this._normalizarChaveCSV(lines[i]);
      if (headerKeywords.some(kw => normLine.includes(kw))) {
        return lines.slice(i).join('\n');
      }
    }
    while (lines.length > 0) {
      const check = lines[0].replace(/[;,\s"\uFEFF]/g, '');
      if (check.length === 0) lines.shift(); else break;
    }
    return lines.join('\n');
  },

  _detectarTabelaPorColunasCSV(headers, fileName) {
    const cols = headers.map(h => this._normalizarChaveCSV(h));
    const fn = this._normalizarChaveCSV(fileName);
    if (cols.includes('id do produto (product id)') || cols.includes('id do produto')) return 'crm_mapping';
    if (cols.includes('numero do item') || cols.includes('nome curto da peca')) return 'microsoft_mpsa';
    if (cols.includes('saleitemname') || cols.includes('preco nao prime')) return 'kaspersky';
    if (cols.includes('offer display name') || cols.includes('ciclo de pagamento')) return 'microsoft_scan';
    if (cols.includes('idproduto') || cols.includes('titulo sku')) return 'microsoft_solo';
    if (cols.includes('productid') || cols.includes('nome do produto')) return 'microsoft_perpetuo';
    if (cols.includes('product family') || cols.includes('part number')) {
      if (fn.includes('promo')) return 'adobe_promo';
      if (fn.includes('base')) return 'adobe_base';
      if (cols.includes('acd indicator') || cols.includes('estimated street price')) return 'adobe_base';
      return 'adobe_promo';
    }
    return null;
  },

  _mapearLinhaCSVParaTabela(table, row) {
    const exactMap = {};
    const normMap = {};
    for (const key in row) {
      if (!key) continue;
      const cleanKey = key.replace(/\uFEFF/g, '').trim();
      const val = (row[key] !== null && row[key] !== undefined) ? String(row[key]).replace(/\uFEFF/g, '').trim() : '';
      exactMap[cleanKey] = val;
      normMap[this._normalizarChaveCSV(cleanKey)] = val;
    }
    const get = (colName, ...aliases) => {
      if (exactMap[colName] !== undefined) return exactMap[colName];
      const normVal = normMap[this._normalizarChaveCSV(colName)];
      if (normVal !== undefined) return normVal;
      for (const alias of aliases) {
        if (exactMap[alias] !== undefined) return exactMap[alias];
        const normAlias = normMap[this._normalizarChaveCSV(alias)];
        if (normAlias !== undefined) return normAlias;
      }
      return '';
    };
    const formatSkuId = (val) => {
      if (!val) return '';
      const s = String(val).trim();
      return /^\d{1,3}$/.test(s) ? s.padStart(4, '0') : s;
    };
    if (table === 'crm_mapping') {
      const pnCrm = String(get('Part Number') || '').replace(/[\uFEFF\u200B]/g, '').trim();
      if (!pnCrm) return null;
      const idProdIt = String(get('ID do produto (product ID)', 'ID do produto') || '').replace(/[\uFEFF\u200B]/g, '').trim();
      return { pn_crm: pnCrm, id_produto_it: idProdIt, nome_crm: get('Nome do item', 'Nome') };
    }
    if (table === 'adobe_base' || table === 'adobe_promo' || table === 'adobe_edu' || table === 'adobe_gov') {
      const partNumber = get('Part Number');
      if (!partNumber) return null;
      return {
        acd_indicator: get('ACD Indicator'), acd_description: get('ACD Description'), acd_effective_date: get('ACD Effective Date'),
        first_order_date: get('First Order Date'), last_order_date: get('Last Order Date'), estimated_ship_date: get('Estimated Ship Date'),
        public_announce_date: get('Public Announce Date'), rma_request_deadline: get('RMA Request Deadline'),
        part_number: partNumber, product_family: get('Product Family'), version: get('Version'), operating_system: get('Operating System'),
        language: get('Language'), product_type: get('Product Type'), product_type_detail: get('Product Type Detail'), additional_detail: get('Additional Detail'),
        users: get('Users'), metric: get('Metric'), bridge: get('Bridge'), level_detail: get('Level Detail', 'Level'), duration: get('Duration'),
        media: get('Media'), upc_ean_code: get('UPC/EAN Code'), gtin_codes: get('GTIN Codes'), country: get('Country'), channel: get('Channel'),
        segment: get('Segment'), pool: get('Pool'), estimated_street_price: get('Estimated Street Price'), partner_price: get('Partner Price'), points: get('Points')
      };
    }
    if (table === 'kaspersky') {
      const partNumber = get('PartNumber', 'Part Number');
      if (!partNumber) return null;
      return {
        part_number: partNumber, sale_item_name: get('SaleItemName'), family: get('Family'), tipo: get('TIPO'),
        banda: get('BANDA'), periodo: get('PERÍODO', 'PERIODO'), preco_nao_prime: get('Preço nao Prime', 'Preco nao Prime', 'Preço Prime'),
        revenda: get('REVENDA'), ro: get('RO'), cross_sem_ro: get('Cross sem RO'), cross_com_ro: get('Cross com RO')
      };
    }
    if (table === 'microsoft_scan') {
      const sku = get('Sku', 'SKU');
      if (!sku) return null;
      const offerDisplayName = get('Offer Display Name');
      const classif = window.Cotador.filters.microsoft.classificarProduto(offerDisplayName);
      return {
        sku: sku, offer_display_name: offerDisplayName,
        produto_base: classif.produto_base, familia_produto: classif.familia_produto, tipo_produto: classif.tipo_produto,
        preco_unitario: get('Preço Unitário', 'Preco Unitario'),
        tempo_contrato: get('Tempo de contrato'), segmento: get('Segmento'), categoria: get('Categoria'), ciclo_pagamento: get('Ciclo de pagamento')
      };
    }
    if (table === 'microsoft_solo') {
      const idProduto = get('IDProduto', 'ID Produto');
      if (!idProduto) return null;
      const tituloSku = get('Titulo SKU', 'Título SKU');
      const classif = window.Cotador.filters.microsoft.classificarProduto(tituloSku);
      return {
        id_produto: idProduto, sku_id: formatSkuId(get('SkuId', 'SKU ID')), titulo_sku: tituloSku,
        produto_base: classif.produto_base, familia_produto: classif.familia_produto, tipo_produto: classif.tipo_produto,
        termo_duracao: get('Termo de Duração', 'Termo de Duracao'), plano_pagamento: get('Plano de Pagamento'), moeda: get('Moeda'),
        fob_impostos: get('FOB + Impostos'), termo_anual_pagamento_mensal: get('Termo anual com pagamento mensal'),
        valor_5pct_servicos: get('Valor com 5% serviços', 'Valor com 5% servicos'), erp_price: get('ERP Price'), segmento: get('Segmento'),
        tags: get('Tags'), categoria: get('Categoria'), descricao_produto: get('Descrição do Produto', 'Descricao do Produto'), condicao_comercial: get('Condição Comercial', 'Condicao Comercial')
      };
    }
    if (table === 'microsoft_perpetuo') {
      const productId = get('ProductId', 'Product ID');
      if (!productId) return null;
      const nomeProduto = get('Nome do Produto');
      const classif = this.classificarProdutoMicrosoft(nomeProduto);
      return {
        product_id: productId, sku_id: formatSkuId(get('SkuId', 'SKU ID')), nome_produto: nomeProduto,
        produto_base: classif.produto_base, familia_produto: classif.familia_produto, tipo_produto: classif.tipo_produto,
        termo_duracao: get('Termo de Duração', 'Termo de Duracao'), plano_pagamento: get('Plano de Pagamento'),
        moeda: get('Moeda'), fob_impostos: get('FOB + Impostos'), erp: get('ERP'), tags: get('Tags'), segment: get('Segment', 'Segmento'), categoria: get('Categoria')
      };
    }
    if (table === 'microsoft_mpsa') {
      const numeroItem = get('NÚMERO DO ITEM', 'NUMERO DO ITEM');
      if (!numeroItem) return null;
      const nomeCurto = get('NOME CURTO DA PEÇA', 'NOME CURTO DA PECA');
      const classif = this.classificarProdutoMicrosoft(nomeCurto);
      return {
        numero_item: numeroItem, nome_curto_peca: nomeCurto,
        produto_base: classif.produto_base, familia_produto: classif.familia_produto, tipo_produto: classif.tipo_produto,
        grupo_itens: get('GRUPO DE ITENS'),
        edicao_item: get('EDIÇÃO DE ITEM', 'EDICAO DE ITEM'), uso_recurso: get('USO DO RECURSO'), tipo_item: get('TIPO DE ITEM'),
        tipo_conta_compras: get('TIPO DE CONTA DE COMPRAS'), categoria_precos: get('CATEGORIA DE PREÇOS', 'CATEGORIA DE PRECOS'),
        unidade_compra: get('UNIDADE DE COMPRA'), duracao_compra: get('DURAÇÃO DE COMPRA', 'DURACAO DE COMPRA'),
        valor_preco_liquido_atual: get('VALOR DO PREÇO LÍQUIDO ATUAL', 'VALOR DO PRECO LIQUIDO ATUAL'), custo_com_imposto: get('Custo com Imposto', 'CUSTO COM IMPOSTO'),
        moeda_precos: get('MOEDA DOS PREÇOS', 'MOEDA DOS PRECOS'), indicador_pre_requisito: get('INDICADOR DE PRÉ-REQUISITO', 'INDICADOR DE PRE-REQUISITO'),
        pool: get('POOL'), contagem_pontos_itens: get('CONTAGEM DE PONTOS DE ITENS'), data_inicio_validade: get('DATA DE INÍCIO DE VALIDADE', 'DATA DE INICIO DE VALIDADE'),
        data_termino_validade: get('DATA DE TÉRMINO DE VALIDADE', 'DATA DE TERMINO DE VALIDADE'), valor_preco_varejo_estimado: get('VALOR DO PREÇO DE VAREJO ESTIMADO', 'VALOR DO PRECO DE VAREJO ESTIMADO'),
        data_lista_precos: get('DATA DA LISTA DE PREÇOS', 'DATA DA LISTA DE PRECOS'), pais: get('PAÍS', 'PAIS')
      };
    }
    return null;
  },

  async iniciarUploadDadosAdmin(isDryRun) {
    if (!this.isAdmin) return;
    if (typeof window.Papa === 'undefined') {
      alert('Biblioteca PapaParse não encontrada. Verifique a inclusão do script no index.html.');
      return;
    }

    const fileInput = document.getElementById('admin-upload-files');
    const selectedMode = document.getElementById('admin-upload-table')?.value || 'auto';
    const btnValidar = document.getElementById('btn-admin-validar-csv');
    const btnImportar = document.getElementById('btn-admin-importar-csv');

    if (!fileInput || !fileInput.files.length) {
      alert('Selecione pelo menos um arquivo CSV para continuar.');
      return;
    }
    if (fileInput.files.length > 1 && selectedMode !== 'auto') {
      alert('Para processar múltiplos arquivos simultaneamente, mantenha o destino em "Detectar Tabela Automaticamente".');
      return;
    }

    const sb = window.CotadorAuth.supabase;
    const pkByTable = {
      adobe_base: 'part_number', adobe_promo: 'part_number', adobe_edu: 'part_number', adobe_gov: 'part_number',
      kaspersky: 'part_number', crm_mapping: 'pn_crm',
      microsoft_scan: 'sku', microsoft_solo: 'id_produto', microsoft_perpetuo: 'product_id', microsoft_mpsa: 'numero_item'
    };

    if (btnValidar) btnValidar.disabled = true;
    if (btnImportar) btnImportar.disabled = true;
    this._adminProgress(2);

    const logEl = document.getElementById('admin-upload-log');
    if (logEl) logEl.textContent = `[Sistema] Iniciando ${isDryRun ? 'VALIDAÇÃO (DRY-RUN)' : 'ATUALIZAÇÃO DE PRODUÇÃO'} de ${fileInput.files.length} arquivo(s)...`;

    const startTime = performance.now();
    let sucessos = 0;
    const totalFiles = fileInput.files.length;

    for (let idx = 0; idx < totalFiles; idx++) {
      const file = fileInput.files[idx];
      this._adminLog(`\n------------------------------------------------------------`);
      this._adminLog(`[Arquivo] Lendo "${file.name}"...`);

      const { text: rawText, encoding } = await this._lerArquivoCSVComEncoding(file);
      const cleanedText = this._limparLinhasVaziasTopoCSV(rawText);

      const ok = await new Promise(resolve => {
        window.Papa.parse(cleanedText, {
          header: true,
          skipEmptyLines: 'greedy',
          delimitersToGuess: [';', ',', '\t', '|'],
          complete: async (results) => {
            const headers = results.meta.fields || [];
            const delimiter = results.meta.delimiter || ';';
            const targetTable = selectedMode === 'auto' ? this._detectarTabelaPorColunasCSV(headers, file.name) : selectedMode;

            if (!targetTable) {
              this._adminLog(`[Erro] Não foi possível identificar a tabela para "${file.name}".`);
              return resolve(false);
            }

            this._adminLog(`[Destino] Tabela: [${targetTable}] | Encoding: ${encoding} | Separador: "${delimiter}"`);
            let mappedRows = results.data.map(r => this._mapearLinhaCSVParaTabela(targetTable, r)).filter(Boolean);
            
            // Remove duplicatas em memória baseadas na Chave Primária (evita Erro Crítico de Unique Constraint)
            const pkField = pkByTable[targetTable] || 'part_number';
            const uniqueMap = new Map();
            mappedRows.forEach(row => {
              if (row[pkField]) uniqueMap.set(row[pkField], row);
            });
            mappedRows = Array.from(uniqueMap.values());

            if (mappedRows.length === 0) {
              this._adminLog(`[Erro] 0 linhas válidas mapeadas para [${targetTable}].`);
              return resolve(false);
            }

            this._adminLog(`[OK] Validação estrutural concluída: ${mappedRows.length} registros válidos.`);
            if (isDryRun) {
              this._adminLog(`[DRY-RUN] Simulação concluída sem alterar o banco de dados.`);
              return resolve(true);
            }

            this._adminLog(`[Backup] Criando snapshot em memória de [${targetTable}]...`);
            const backupRows = [];
            let from = 0;
            while (true) {
              const { data } = await sb.from(targetTable).select('*').range(from, from + 999);
              if (!Array.isArray(data) || data.length === 0) break;
              data.forEach(r => {
                const copy = { ...r };
                delete copy.id; delete copy.created_at; delete copy.updated_at;
                backupRows.push(copy);
              });
              if (data.length < 1000) break;
              from += 1000;
            }
            this._adminLog(`   -> Snapshot salvo (${backupRows.length} registros).`);

            this._adminLog(`[Limpeza] Removendo registros antigos de [${targetTable}]...`);
            let delErr = (await sb.rpc('limpar_tabela', { nome_tabela: targetTable })).error;
            if (delErr) {
              delErr = (await sb.from(targetTable).delete().not(pkByTable[targetTable] || 'part_number', 'is', null)).error;
            }
            if (delErr) {
              this._adminLog(`[Erro] Falha ao limpar [${targetTable}]: ${delErr.message}`);
              return resolve(false);
            }

            const chunkSize = 800;
            for (let i = 0; i < mappedRows.length; i += chunkSize) {
              const chunk = mappedRows.slice(i, i + chunkSize);
              const { error: insErr } = await sb.from(targetTable).insert(chunk);
              if (insErr) {
                this._adminLog(`[Erro Crítico] Falha no lote ${i}: ${insErr.message}. Executando Rollback...`);
                await sb.from(targetTable).delete().not(pkByTable[targetTable] || 'part_number', 'is', null);
                for (let j = 0; j < backupRows.length; j += chunkSize) {
                  await sb.from(targetTable).insert(backupRows.slice(j, j + chunkSize));
                }
                this._adminLog(`[Rollback] Tabela [${targetTable}] restaurada com sucesso.`);
                return resolve(false);
              }
              const done = Math.min(i + chunkSize, mappedRows.length);
              this._adminProgress(Math.round(((idx + (done / mappedRows.length)) / totalFiles) * 100));
              this._adminLog(`   -> Progresso [${targetTable}]: ${done} / ${mappedRows.length}`);
            }

            const meta = this.CATALOGO_TABELAS.find(t => t.id === targetTable);
            await sb.from('catalogo_atualizacoes').upsert({
              tabela: targetTable,
              fabricante: meta?.fab || targetTable,
              nome_exibicao: meta?.nome || targetTable,
              atualizado_em: new Date().toISOString()
            }, { onConflict: 'tabela' });

            this._adminLog(`[Sucesso] Tabela [${targetTable}] atualizada com sucesso!`);
            resolve(true);
          }
        });
      });

      if (ok) sucessos++;
      this._adminProgress(Math.round(((idx + 1) / totalFiles) * 100));
    }

    this._adminLog(`\n============================================================`);
    this._adminLog(`[Finalizado] Concluído em ${((performance.now() - startTime) / 1000).toFixed(1)}s (${sucessos}/${totalFiles} arquivos com sucesso).`);

    if (btnValidar) btnValidar.disabled = false;
    if (btnImportar) btnImportar.disabled = false;

    if (!isDryRun && sucessos > 0) {
      await this.carregarDatasAtualizacao();
      this.mostrarToast('Base de dados atualizada com sucesso!');
    }
  },

  // ==========================================================================
  // 4. MODIFICADORES MICROSOFT E CONTROLE DE SESSÃO DE BUSCA
  // ==========================================================================
  atualizarModificadoresMicrosoft() {
    const chkScan = document.getElementById('chk-scan-discount');
    const descontoScan = chkScan && chkScan.checked ? 7 : 0;
    const msScanInput = document.getElementById('ms-scan-discount');
    if (msScanInput) msScanInput.value = descontoScan;
    const thScanLabel = descontoScan > 0 ? `Custo Final (-7%)` : `Custo Base`;

    const toggleSolo = document.getElementById('chk-solo-service');
    const isSoloEnabled = !toggleSolo || toggleSolo.checked;
    const thSoloLabel = isSoloEnabled ? 'Valor com 5% Serviços' : 'Valor Base (Sem Adicional)';

    document.querySelectorAll('.quote-block-scan').forEach(block => {
      const th = block.querySelector('thead th.col-cost-normal');
      if (th) {
        th.innerHTML = thScanLabel;
        th.dataset.originalHeader = thScanLabel;
      }
      block.querySelectorAll('tbody tr[data-row-kind="ms_scan"]').forEach(tr => {
        const tabela = parseFloat(tr.getAttribute('data-base-price-tabela'));
        if (!isNaN(tabela)) {
          const finalDesc = tabela * (1 - (descontoScan / 100));
          tr.setAttribute('data-unit-price', finalDesc);
          tr.setAttribute('data-base-unit-price', finalDesc);
          const td = tr.querySelector('td.col-cost-normal');
          if (td) {
            const fmt = `R$ ${this.formatBRL(finalDesc)}`;
            const contratoId = tr.getAttribute('data-contract-id');
            const detalhes = this.renderDetalhesScanCSP(contratoId, finalDesc, 1);
            td.innerHTML = `${this.renderCopyLink(fmt, fmt, thScanLabel)}${detalhes}`;
          }
        }
      });
    });

    document.querySelectorAll('.quote-block').forEach(block => {
      const isSoloBlock = block.querySelector('tbody tr[data-row-kind="ms_solo"]') !== null;
      if (isSoloBlock) {
        const th = block.querySelector('thead th.col-cost-normal');
        if (th) {
          th.innerHTML = thSoloLabel;
          th.dataset.originalHeader = thSoloLabel;
        }
        block.querySelectorAll('tbody tr[data-row-kind="ms_solo"]').forEach(tr => {
          const fob = parseFloat(tr.getAttribute('data-fob-impostos')) || 0;
          const custoCom5 = parseFloat(tr.getAttribute('data-custo-com-5')) || 0;
          const mensalAnual = parseFloat(tr.getAttribute('data-termo-anual-mensal')) || 0;
          const divisor = parseFloat(tr.getAttribute('data-divisor')) || 1;
          const contratoId = tr.getAttribute('data-contract-id');

          let custoFinal;
          if (contratoId === 'am') {
            const mensalSem5Calc = mensalAnual > 0 ? mensalAnual : (fob / 12);
            const mensalCom5Calc = (custoCom5 > fob * 0.5 && fob > 0) ? (custoCom5 / 12) : custoCom5;
            custoFinal = isSoloEnabled ? mensalCom5Calc : mensalSem5Calc;
          } else {
            const rawTarget = isSoloEnabled ? custoCom5 : fob;
            custoFinal = rawTarget / divisor;
          }

          tr.setAttribute('data-unit-price', custoFinal);
          tr.setAttribute('data-base-unit-price', custoFinal);

          let mensalSem5 = 0; let anualSem5 = 0;
          if (contratoId === 'am') {
            mensalSem5 = mensalAnual > 0 ? mensalAnual : (fob / 12);
            anualSem5 = fob;
          } else if (contratoId === 'mm') {
            mensalSem5 = fob; anualSem5 = fob * 12;
          } else if (contratoId === 'tm') {
            mensalSem5 = fob / 36; anualSem5 = (fob / 36) * 12;
          } else {
            anualSem5 = fob / divisor;
          }
          tr.setAttribute('data-mensal-sem5', mensalSem5);
          tr.setAttribute('data-anual-sem5', anualSem5);

          const td = tr.querySelector('td.col-cost-normal');
          if (td) {
            const fmt = `R$ ${this.formatBRL(custoFinal)}`;
            const infoMensal = this.renderDetalhesSoloCSP(contratoId, custoFinal, mensalSem5, anualSem5, 1, false);
            td.innerHTML = `${this.renderCopyLink(fmt, fmt, thSoloLabel)}${infoMensal}`;
          }
        });
      }
    });

    this.recalcularSubtotais();
  },

  obterModificadoresPnSolo() {
    const prefix = document.getElementById('ms-solo-prefix')?.value || '';
    const suffix = document.getElementById('ms-solo-suffix')?.value || '';
    return { prefix, suffix };
  },
  async enriquecerCRMBadges() {
    try {
      const pnElements = document.querySelectorAll('td.col-pn [data-pn-val]');
      const pns = Array.from(new Set(Array.from(pnElements).map(el => el.getAttribute('data-pn-val'))));
      if (pns.length === 0) return;
      const crmMap = {};
      const chunkSize = 50;
      for (let i = 0; i < pns.length; i += chunkSize) {
        const chunk = pns.slice(i, i + chunkSize);
        const pnsFilter = chunk.map(p => `"${p}"`).join(',');
        const params = [['select', 'pn_crm,id_produto_it'], ['pn_crm', `in.(${pnsFilter})`]];
        const data = await window.Cotador.core.fetchSupabase('crm_mapping', params);
        if (data && data.length > 0) {
          data.forEach(r => crmMap[r.pn_crm] = r.id_produto_it);
        }
      }
      pnElements.forEach(el => {
        const pn = el.getAttribute('data-pn-val');
        const existingBadge = el.parentElement.querySelector('.crm-badge');
        if (crmMap[pn]) {
          if (existingBadge) {
            existingBadge.setAttribute('data-copy', crmMap[pn]);
            existingBadge.innerHTML = crmMap[pn];
          } else {
            el.insertAdjacentHTML('afterend', `<span onclick="Cotador.core.copiarElemento(event, this)" data-copy="${crmMap[pn]}" data-label="ID Dynamics" title="Copiar ID do Dynamics para inserir no CRM" class="copy-link crm-badge ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#f3f2f1] text-[#605e5c] border border-[#edebe9] cursor-pointer hover:bg-[#edebe9] hover:text-[#323130] transition-colors inline-flex items-center gap-1"><svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>${crmMap[pn]}</span>`);
          }
        } else if (existingBadge) {
          existingBadge.remove();
        }
      });
    } catch(e) {}
  },
  atualizarModificadoresPnSoloEmTempoReal() {
    const mods = this.obterModificadoresPnSolo();
    document.querySelectorAll('tbody tr[data-row-kind="ms_solo"]').forEach(tr => {
      const basePn = tr.getAttribute('data-base-pn') || tr.getAttribute('data-pn') || '';
      if (!basePn) return;
      if (!tr.hasAttribute('data-base-pn')) tr.setAttribute('data-base-pn', basePn);
      
      const novoPn = `${mods.prefix}${basePn}${mods.suffix}`;
      tr.setAttribute('data-pn', novoPn);
      
      const pnBadge = tr.querySelector('td.col-pn [data-pn-val]');
      if (pnBadge) {
        pnBadge.setAttribute('data-pn-val', novoPn);
        pnBadge.setAttribute('data-copy', novoPn);
        pnBadge.textContent = novoPn;
      }
    });
    clearTimeout(this._crmTimer);
    this._crmTimer = setTimeout(() => this.enriquecerCRMBadges(), 800);
  },
  copiarPropostaBlocoCliente(event, blockId) {
    if (event) event.stopPropagation();
    const block = document.getElementById(blockId);
    if (!block) return;
    const { tsv, html } = this.gerarExtracaoBloco(block);
    this.copiarRichTextOuTexto(tsv, html, 'Lista completa copiada para o cliente!');
  },
  iniciarNovaSessaoBusca() {
    if (this._searchAbortController) this._searchAbortController.abort();
    this._searchAbortController = new AbortController();
    return this._searchAbortController.signal;
  },

  cancelarBuscasEmAndamento() {
    if (this._searchAbortController) {
      this._searchAbortController.abort();
      this._searchAbortController = null;
    }
  },

  // ==========================================================================
  // 5. DATAS DE ATUALIZAÇÃO DAS PLANILHAS E POPOVER DO HEADER
  // ==========================================================================
  formatarDataCurta(isoStr) {
    if (!isoStr) return null;
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  formatarDataHoraCompleta(isoStr) {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  },

  ultimasAtualizacoes: {},
  _popoverListenerInitialized: false,

  CATALOGO_TABELAS: [
    { id: 'crm_mapping', fab: 'crm', nome: 'Dicionário CRM Dynamics' },
    { id: 'microsoft_scan', fab: 'microsoft', nome: 'Microsoft CSP - Scan' },
    { id: 'microsoft_solo', fab: 'microsoft', nome: 'Microsoft CSP - Solo' },
    { id: 'microsoft_perpetuo', fab: 'microsoft', nome: 'Microsoft CSP Perpétuo' },
    { id: 'microsoft_mpsa', fab: 'microsoft', nome: 'Microsoft MPSA' },
    { id: 'adobe_base', fab: 'adobe', nome: 'Adobe VIP - Comercial' },
    { id: 'adobe_edu', fab: 'adobe', nome: 'Adobe VIP - Education' },
    { id: 'adobe_gov', fab: 'adobe', nome: 'Adobe VIP - Government' },
    { id: 'adobe_promo', fab: 'adobe', nome: 'Adobe VIP - Promo' },
    { id: 'kaspersky', fab: 'kaspersky', nome: 'Kaspersky B2B' }
  ],

  async carregarDatasAtualizacao() {
    try {
      const rows = await this.fetchSupabase('catalogo_atualizacoes', [['select', '*']], { useAbort: false });
      if (Array.isArray(rows)) {
        rows.forEach(r => {
          if (r.tabela && r.atualizado_em) {
            const meta = this.CATALOGO_TABELAS.find(t => t.id === r.tabela);
            this.ultimasAtualizacoes[r.tabela] = {
              iso: r.atualizado_em,
              fabricante: r.fabricante || meta?.fab || '',
              nome: meta?.nome || r.nome_exibicao || r.tabela
            };
          }
        });
      }
    } catch (_) {}

    this.atualizarBadgeDataFabricante(window.Cotador.app?.currentVendor || 'microsoft');
  },

  atualizarBadgeDataFabricante(vendor) {
    const txtEl = document.getElementById('badge-last-update-text');
    if (!txtEl) return;

    const entradas = Object.values(this.ultimasAtualizacoes).filter(x => x.fabricante === vendor && x.iso);
    if (entradas.length === 0) {
      txtEl.textContent = 'Base: s/ registro';
    } else {
      entradas.sort((a, b) => new Date(b.iso) - new Date(a.iso));
      const maisRecente = this.formatarDataCurta(entradas[0].iso);
      txtEl.textContent = `Base: ${maisRecente}`;
    }

    this.renderizarListaAtualizacoesPopover(vendor);
  },

  renderizarListaAtualizacoesPopover(vendorAtivo) {
    const listEl = document.getElementById('popover-last-update-list');
    if (!listEl) return;
    
    const vendor = vendorAtivo || window.Cotador.app?.currentVendor || 'microsoft';
    
    const tabelasOrdenadas = [...this.CATALOGO_TABELAS].sort((a, b) => {
      const aAtivo = a.fab === vendor ? 0 : 1;
      const bAtivo = b.fab === vendor ? 0 : 1;
      return aAtivo - bAtivo;
    });

    listEl.innerHTML = tabelasOrdenadas.map(t => {
      const info = this.ultimasAtualizacoes[t.id];
      const dataHora = info?.iso ? this.formatarDataHoraCompleta(info.iso) : 'Sem registro';
      const isFabAtivo = t.fab === vendor;
      
      let dotColor = 'bg-amber-400';
      if (info?.iso) {
        const diffDias = (new Date() - new Date(info.iso)) / (1000 * 60 * 60 * 24);
        dotColor = diffDias <= 35 ? 'bg-emerald-500' : 'bg-amber-500';
      }

      const rowBg = isFabAtivo ? 'bg-[#f3f2f1] border-[#0078d4]/40 font-medium' : 'bg-white border-[#edebe9]';

      return `
        <div class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border ${rowBg} hover:bg-[#edebe9] transition-colors">
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-2 h-2 rounded-full ${dotColor} shrink-0" title="${info?.iso ? 'Base Carregada' : 'Sem Dados'}"></span>
            <span class="text-xs text-[#323130] truncate">${this.escapeHTML(t.nome)}</span>
            ${isFabAtivo ? '<span class="text-[9px] px-1 py-0.2 bg-[#0078d4]/10 text-[#0078d4] rounded font-semibold">Ativo</span>' : ''}
          </div>
          <span class="text-[11px] font-mono text-gray-500 tabular-nums whitespace-nowrap">${this.escapeHTML(dataHora)}</span>
        </div>
      `;
    }).join('');
  },

  togglePainelAtualizacoes(event) {
    if (event) event.stopPropagation();
    const pop = document.getElementById('popover-last-update');
    if (!pop) return;

    if (!this._popoverListenerInitialized) {
      this._popoverListenerInitialized = true;
      document.addEventListener('click', (e) => {
        const wrapper = document.getElementById('update-popover-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
          this.fecharPainelAtualizacoes();
        }
      });
    }

    const vaiAbrir = pop.classList.contains('hidden');
    if (vaiAbrir) {
      this.renderizarListaAtualizacoesPopover(window.Cotador.app?.currentVendor || 'microsoft');
      pop.classList.remove('hidden');
    } else {
      pop.classList.add('hidden');
    }
  },

  fecharPainelAtualizacoes() {
    const pop = document.getElementById('popover-last-update');
    if (pop) pop.classList.add('hidden');
  },

  // ==========================================================================
  // 6. MOTOR DE BUSCA INTELIGENTE, CORREÇÃO FUZZY E PARSER DE INPUT
  // ==========================================================================
  SEARCH_KEYWORDS: {
    "office 365 extra file storage": ["Extra File Storage"],
    "extra file storage": ["Extra File Storage"],
    "power apps premium": ["Power Apps", "Premium"],
    "adobe acrobat pro": ["Acrobat", "Pro"],
    "adobe acrobat standard": ["Acrobat", "Standard"],
    "adobe creative cloud": ["Creative Cloud"],
    "adobe illustrator": ["Illustrator"],
    "adobe photoshop": ["Photoshop"],
    "adobe indesign": ["InDesign"],
    "adobe premiere": ["Premiere"],
    "phothosop": ["Photoshop"],
    "photshop": ["Photoshop"],
    "photosop": ["Photoshop"],
    "photopshop": ["Photoshop"],
    "phtoshop": ["Photoshop"],
    "fotoshop": ["Photoshop"],
    "photoshop": ["Photoshop"],
    "ilustrator": ["Illustrator"],
    "illustrator": ["Illustrator"],
    "indesing": ["InDesign"],
    "indesign": ["InDesign"],
    "acrobat pro": ["Acrobat", "Pro"],
    "acrobat dc pro": ["Acrobat", "Pro"],
    "acrobat standard": ["Acrobat", "Standard"],
    "acrobat std": ["Acrobat", "Standard"],
    "adobe sign": ["Acrobat", "Sign"],
    "acrobat sign": ["Acrobat", "Sign"],
    "creative cloud pro": ["Creative Cloud"],
    "creative cloud all apps": ["Creative Cloud"],
    "cc all apps": ["Creative Cloud"],
    "creative cloud": ["Creative Cloud"],
    "premiere": ["Premiere"],
    "premiere pro": ["Premiere"],
    "after effects": ["After Effects"],
    "lightroom": ["Lightroom"],
    "adobe stock": ["Stock"],
    "substance 3d": ["Substance"],
    "dreamweaver": ["Dreamweaver"],
    "animate": ["Animate"],
    "audition": ["Audition"],
    "incopy": ["InCopy"],
    "captivate": ["Captivate"],
    "firefly": ["Firefly"],
    "basic": ["Business", "Basic"],
    "standard": ["Business", "Standard"],
    "std": ["Business", "Standard"],
    "premium": ["Business", "Premium"],
    "business basic": ["Business Basic"],
    "m365 business basic": ["Business Basic"],
    "o365 business basic": ["Business Basic"],
    "microsoft 365 business basic": ["Business Basic"],
    "office 365 business basic": ["Business Basic"],
    "business standard": ["Business Standard"],
    "business standart": ["Business Standard"],
    "business standar": ["Business Standard"],
    "m365 business standard": ["Business Standard"],
    "o365 business standard": ["Business Standard"],
    "microsoft 365 business standard": ["Business Standard"],
    "office 365 business standard": ["Business Standard"],
    "business premium": ["Business Premium"],
    "m365 business premium": ["Business Premium"],
    "o365 business premium": ["Business Premium"],
    "microsoft 365 business premium": ["Business Premium"],
    "office 365 business premium": ["Business Premium"],
    "apps for business": ["Apps for business"],
    "m365 apps for business": ["Apps for business"],
    "microsoft 365 apps for business": ["Apps for business"],
    "apps for enterprise": ["Apps for enterprise"],
    "m365 apps for enterprise": ["Apps for enterprise"],
    "microsoft 365 apps for enterprise": ["Apps for enterprise"],
    "office 365 proplus": ["Apps for enterprise"],
    "proplus": ["Apps for enterprise"],
    "m365 e3": ["Microsoft 365", "E3"],
    "m365 e5": ["Microsoft 365", "E5"],
    "m365 f1": ["Microsoft 365", "F1"],
    "m365 f3": ["Microsoft 365", "F3"],
    "o365 e1": ["Office 365", "E1"],
    "o365 e3": ["Office 365", "E3"],
    "o365 e5": ["Office 365", "E5"],
    "o365 f3": ["Office 365", "F3"],
    "exchange plan 1": ["Exchange Online", "Plan 1"],
    "exchange plan 2": ["Exchange Online", "Plan 2"],
    "exchange online plan 1": ["Exchange Online", "Plan 1"],
    "exchange online plan 2": ["Exchange Online", "Plan 2"],
    "exchange p1": ["Exchange Online", "Plan 1"],
    "exchange p2": ["Exchange Online", "Plan 2"],
    "exchange online archiving": ["Exchange Online", "Archiving"],
    "exchange archiving": ["Exchange Online", "Archiving"],
    "exchange kiosk": ["Exchange Online", "Kiosk"],
    "exchange online kiosk": ["Exchange Online", "Kiosk"],
    "exchange online": ["Exchange Online"],
    "teams essentials": ["Teams", "Essentials"],
    "ms teams essentials": ["Teams", "Essentials"],
    "teams enterprise": ["Teams", "Enterprise"],
    "ms teams enterprise": ["Teams", "Enterprise"],
    "ms teams": ["Teams"],
    "planner": ["Planner"],
    "planner plan 1": ["Planner", "Plan 1"],
    "project plan 1": ["Plan 1"],
    "project p1": ["Plan 1"],
    "project plan 3": ["Project", "Plan 3"],
    "project p3": ["Project", "Plan 3"],
    "project plan 5": ["Project", "Plan 5"],
    "project p5": ["Project", "Plan 5"],
    "visio plan 1": ["Visio", "Plan 1"],
    "visio p1": ["Visio", "Plan 1"],
    "visio plan 2": ["Visio", "Plan 2"],
    "visio p2": ["Visio", "Plan 2"],
    "power bi pro": ["Power BI", "Pro"],
    "powerbi pro": ["Power BI", "Pro"],
    "pbi pro": ["Power BI", "Pro"],
    "power bi premium": ["Power BI", "Premium"],
    "powerbi premium": ["Power BI", "Premium"],
    "power bi premium per user": ["Power BI", "Premium", "User"],
    "power bi ppu": ["Power BI", "Premium", "User"],
    "pbi ppu": ["Power BI", "Premium", "User"],
    "copilot": ["Copilot"],
    "copilot business": ["Copilot", "Business"],
    "m365 copilot business": ["Copilot", "Business"],
    "microsoft 365 copilot business": ["Copilot", "Business"],
    "m365 copilot": ["Microsoft 365", "Copilot"],
    "microsoft 365 copilot": ["Microsoft 365", "Copilot"],
    "copilot studio": ["Copilot Studio"],
    "microsoft copilot studio": ["Copilot Studio"],
    "defender for business": ["Defender", "Business"],
    "defender business": ["Defender", "Business"],
    "defender endpoint p1": ["Defender", "Endpoint", "Plan 1"],
    "defender endpoint p2": ["Defender", "Endpoint", "Plan 2"],
    "defender for office 365 plan 1": ["Defender", "Office 365", "Plan 1"],
    "defender for office 365 plan 2": ["Defender", "Office 365", "Plan 2"],
    "entra id p1": ["Entra ID", "P1"],
    "azure ad p1": ["Entra ID", "P1"],
    "windows server": ["Windows", "Server"],
    "win server": ["Windows", "Server"],
    "sql server": ["SQL", "Server"],
    "entra id p2": ["Entra ID", "P2"],
    "azure ad p2": ["Entra ID", "P2"],
    "intune plan 1": ["Intune", "Plan 1"],
    "kesb select": ["Select"],
    "kaspersky select": ["Select"],
    "endpoint security select": ["Select"],
    "kesb advanced": ["Advanced"],
    "kaspersky advanced": ["Advanced"],
    "endpoint security advanced": ["Advanced"],
    "kesb total": ["Total"],
    "kaspersky total": ["Total"],
    "next edr foundations": ["EDR", "Foundations"],
    "edr foundations": ["EDR", "Foundations"],
    "next edr optimum": ["EDR", "Optimum"],
    "edr optimum": ["EDR", "Optimum"],
    "next xdr expert": ["XDR", "Expert"],
    "xdr expert": ["XDR", "Expert"],
    "ksos": ["Small Office"],
    "small office security": ["Small Office"],
    "kaspersky small office": ["Small Office"],
    "kesc": ["Cloud"],
    "kesc plus": ["Cloud", "Plus"],
    "kesc pro": ["Cloud", "Pro"]
  },

  TOKEN_TYPO_MAP: {
    "standar": "Standard", "standart": "Standard", "standad": "Standard", "stardard": "Standard", "padrao": "Standard", "std": "Standard",
    "entprise": "Enterprise", "enterpise": "Enterprise", "enterprize": "Enterprise", "entreprice": "Enterprise", "ent": "Enterprise",
    "datacent": "Datacenter", "dc": "Datacenter",
    "foudation": "Foundations", "foudations": "Foundations", "foudantions": "Foundations", "foundation": "Foundations",
    "optmium": "Optimum", "optimun": "Optimum",
    "bussiness": "Business", "busines": "Business", "bussines": "Business", "bsiness": "Business", "busness": "Business",
    "microsft": "Microsoft", "micrsoft": "Microsoft", "micosoft": "Microsoft",
    "premiun": "Premium", "premuim": "Premium", "premum": "Premium",
    "exchenge": "Exchange", "exchage": "Exchange", "excange": "Exchange", "exhange": "Exchange", "exchagne": "Exchange",
    "sharepoit": "SharePoint", "sharpoint": "SharePoint",
    "projet": "Project", "projec": "Project",
    "m365": "365", "o365": "365",
    "win": "Windows", "ws": "Windows Server",
    "powerbi": "Power BI", "pbi": "Power BI",
    "phothosop": "Photoshop", "photshop": "Photoshop", "photosop": "Photoshop", "photopshop": "Photoshop", "phtoshop": "Photoshop", "fotoshop": "Photoshop",
    "ilustrator": "Illustrator", "ilustrattor": "Illustrator", "ilustraitor": "Illustrator",
    "indesing": "InDesign", "indising": "InDesign",
    "acobrat": "Acrobat", "premier": "Premiere",
    "kasperky": "Kaspersky", "kasparsky": "Kaspersky"
  },

  CANONICAL_CATALOG_TOKENS: [
    "Microsoft", "Business", "Standard", "Basic", "Premium", "Enterprise",
    "Exchange", "SharePoint", "Project", "Defender", "Copilot", "Photoshop",
    "Illustrator", "InDesign", "Acrobat", "Creative", "Premiere", "Lightroom",
    "Substance", "Kaspersky", "Foundations", "Optimum", "Advanced", "Endpoint",
    "Security", "Datacenter", "Server", "SQL", "Windows", "Visual", "Studio"
  ],

  STOPWORDS_PT: new Set([
    "licenca", "licencas", "unidade", "unidades", "usuario", "usuarios",
    "assinatura", "renovacao", "para", "com", "por"
  ]),

  calcularLevenshtein(a, b) {
    const s = a.toLowerCase();
    const t = b.toLowerCase();
    const m = s.length;
    const n = t.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s[i - 1] === t[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  },

  corrigirTokenFuzzy(token) {
    const clean = String(token || '').trim();
    if (clean.length < 5 || /\d/.test(clean)) return clean;
    const maxDist = clean.length >= 8 ? 2 : 1;
    let melhorPalavra = clean;
    let menorDistancia = maxDist + 1;
    for (const canon of this.CANONICAL_CATALOG_TOKENS) {
      if (Math.abs(canon.length - clean.length) > maxDist) continue;
      const dist = this.calcularLevenshtein(clean, canon);
      if (dist <= maxDist && dist < menorDistancia) {
        menorDistancia = dist;
        melhorPalavra = canon;
        if (dist === 0) break;
      }
    }
    return melhorPalavra;
  },

  escapeHTML(str) {
    if (!str || typeof str !== 'string') return str || '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  },

  sanitizarTermoPostgrest(termo) {
    return String(termo || '').replace(/[,()*%\[\]]/g, ' ').replace(/(?:^|\s)[- /\\]+(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  },

  sanitizarTituloMicrosoft(rawTitle) {
    return String(rawTitle || '').trim();
  },

  construirFiltroAndKeywords(columnName, keywords) {
    const cleanKws = (keywords || []).map(kw => this.sanitizarTermoPostgrest(kw)).filter(Boolean);
    // Trava de segurança: se a pesquisa gerar 0 palavras válidas, impede de travar o sistema carregando a tabela inteira
    if (cleanKws.length === 0) return [[columnName, 'eq.______INVALID______']];
    return cleanKws.map(kw => [columnName, `ilike.*${kw}*`]);
  },

  isPartNumber(str) {
    const s = String(str || '').trim();
    if (!s || /\s/.test(s)) return false;
    if (/^[A-Z0-9]{12}(?:[-:][A-Z0-9\-:]+)?$/i.test(s)) return true;
    if (/^[A-Z0-9]{3,5}-[A-Z0-9]{4,8}(?:-[A-Z0-9]+)*$/i.test(s)) return true;
    if (/^\d{7,8}[A-Z]{2}[A-Z0-9]{0,6}$/i.test(s)) return true;
    if (/^KL[A-Z0-9\-]{4,}$/i.test(s)) return true;
    if (s.length >= 7 && /[A-Z]/i.test(s) && /\d/.test(s) && /^[A-Z0-9\-:_./]+$/i.test(s)) {
      if (!/^(windows|office|microsoft|kaspersky|photoshop|acrobat)\d*$/i.test(s)) return true;
    }
    return false;
  },

  normalizarChaveProdutoMS(rawName, itemIndex) {
    const clean = String(rawName || '').toLowerCase().trim();
    return `ms-item-${itemIndex ?? 0}::${clean}`;
  },

  limparRuidoComercialLinha(str) {
    if (!str) return '';
    return String(str).trim();
  },

  extrairKeywords(prodName) {
    const rawTrimmed = String(prodName || '').trim();
    if (!rawTrimmed) return [];
    if (this.isPartNumber(rawTrimmed)) {
      const nceMatch = rawTrimmed.match(/^([A-Z0-9]{12})(?:[-:]\d{3,4}(?:[-:][A-Z0-9]+)*)$/i);
      if (nceMatch) return [this.sanitizarTermoPostgrest(nceMatch[1])];
      return [this.sanitizarTermoPostgrest(rawTrimmed)];
    }
    const cleanedProd = this.limparRuidoComercialLinha(rawTrimmed);
    const hasNoTeamsIntent = /(no\s+teams|without\s+teams|sem\s+teams)/i.test(rawTrimmed.replace(/[()]/g, ' '));
    const deaccented = cleanedProd.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let normalized = this.sanitizarTermoPostgrest(deaccented).trim();

    const lowerNorm = normalized.toLowerCase();

    // 1. Tenta correspondência EXATA primeiro (ex: "standard" digitado sozinho)
    if (this.SEARCH_KEYWORDS[lowerNorm]) {
      const kws = [...this.SEARCH_KEYWORDS[lowerNorm]];
      if (hasNoTeamsIntent && !kws.includes('Teams')) kws.push('Teams');
      return kws.map(kw => this.sanitizarTermoPostgrest(kw)).filter(Boolean);
    }

    // 2. Tenta encontrar frases COMPOSTAS (multi-word) para extrair o produto central
    // Ex: "comprar business standard anual" -> encontra apenas "business standard"
    const multiWordKeys = Object.keys(this.SEARCH_KEYWORDS)
      .filter(k => k.includes(' '))
      .sort((a, b) => b.length - a.length);

    for (const key of multiWordKeys) {
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(lowerNorm)) {
        const kws = [...this.SEARCH_KEYWORDS[key]];
        if (hasNoTeamsIntent && !kws.includes('Teams')) kws.push('Teams');
        return kws.map(kw => this.sanitizarTermoPostgrest(kw)).filter(Boolean);
      }
    }

    // 3. Fallback: analisa palavra por palavra mantendo suporte a erros de digitação (fuzzy)
    return normalized.split(/\s+/).filter(w => w.length > 0).flatMap(w => {
      const planMatch = w.match(/^__PLAN_(\d+)__$/i);
      if (planMatch) return [`Plan ${planMatch[1]}`];
      const cleanW = w.toLowerCase();
      if (this.STOPWORDS_PT.has(cleanW)) return [];
      const mapped = this.TOKEN_TYPO_MAP[cleanW] || this.corrigirTokenFuzzy(w);
      return [this.sanitizarTermoPostgrest(mapped)];
    }).filter(Boolean);
  },

  isNumeroParteDoProduto(prefixText, numStr) {
    const n = parseInt(numStr, 10);
    if (isNaN(n)) return false;
    const cleanPrefix = (prefixText || '').trim();
    if (!cleanPrefix) return false;
    if (this.isPartNumber(cleanPrefix)) return false;
    const lowerPrefix = cleanPrefix.toLowerCase();
    const tokens = lowerPrefix.split(/\s+/).filter(Boolean);
    const lastWord = (tokens[tokens.length - 1] || '').replace(/[^a-z0-9\-]/g, '');
    const prevWord = (tokens[tokens.length - 2] || '').replace(/[^a-z0-9\-]/g, '');
    const prefixHasYear = /\b20[0-3]\d\b/.test(lowerPrefix);
    if (n >= 2005 && n <= 2035 && !prefixHasYear) return true;
    if (n === 365 && ['microsoft', 'ms', 'office', 'o', 'dynamics', 'windows', 'win', 'm', 'd'].includes(lastWord)) return true;
    const designators = new Set(['plan', 'plano', 'pl', 'level', 'lvl', 'nivel', 'nível', 'tier', 'version', 'versao', 'versão', 'ver', 'v', 'release', 'rel', 'r', 'edition', 'edicao', 'edição', 'ed', 'gen', 'generation', 'geracao', 'geração', 'wave', 'step', 'phase', 'fase', 'type', 'tipo', 'cat', 'categoria', 'group', 'grupo', 'option', 'opcao', 'op', 'pack', 'pacote', 'suite', 'suíte', 'core', 'e', 'f', 'p', 'g', 'a', 'k']);
    if (designators.has(lastWord)) return true;
    if (['windows', 'win'].includes(lastWord) && [7, 8, 10, 11, 365].includes(n)) return true;
    if (lastWord === 'hololens' && [1, 2, 3].includes(n)) return true;
    if (prevWord === 'surface' && ['pro', 'go', 'laptop', 'studio'].includes(lastWord) && n >= 1 && n <= 15) return true;
    return false;
  },

  parseInputLines(rawText) {
    const lines = rawText.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const items = [];
    let sumLicenses = 0;
    lines.forEach((line, idx) => {
      let qty = null;
      let prodName = line.replace(/[\u2010-\u2015\u2212]/g, '-').replace(/^(?:[- >]|\d+[.)])\s*/, '').trim();
      if (!prodName) return;
      if (!/\s/.test(prodName) && this.isPartNumber(prodName)) {
        items.push({ itemIndex: idx, original: this.escapeHTML(prodName), rawSearch: prodName, keywords: this.extrairKeywords(prodName), qty: '-' });
        return;
      }
      const explicitUnitEnd = prodName.match(/^(.*?)(?:[\s:|=\t]+|\s*[- :|=/]\s*|\b(?:qtd|qtde|quant)\s*[:=]?\s*)(\d+)\s*(?:x|un|unid|unidades?|lic|licen[cç]as?|users?|usu[aá]rios?|pcs?|seats?|disp|dispositivos?)\.?$/i);
      const explicitDelimEnd = !explicitUnitEnd && prodName.match(/^(.*?)(?:\t+|\s*[- :|=/]\s*)(\d+)\s*$/);
      const explicitStart = !explicitUnitEnd && !explicitDelimEnd && prodName.match(/^(\d+)\s*(?:x\b|un\b|unid\b|unidades?\b|lic\b|licen[cç]as?\b|\s*[- :|=/]\s*)\s*(.+)$/i);
      if (explicitUnitEnd && explicitUnitEnd[1].trim()) {
        prodName = explicitUnitEnd[1].trim(); qty = parseInt(explicitUnitEnd[2], 10);
      } else if (explicitDelimEnd && explicitDelimEnd[1].trim()) {
        prodName = explicitDelimEnd[1].trim(); qty = parseInt(explicitDelimEnd[2], 10);
      } else if (explicitStart && explicitStart[2].trim()) {
        qty = parseInt(explicitStart[1], 10); prodName = explicitStart[2].trim();
      } else {
        const clean = prodName.replace(/\s+\b(unidades|unidade|licenças|licencas|lic|unid|un)\b\.?$/gi, '').replace(/\s+/g, ' ').trim();
        prodName = clean;
        const matchEnd = clean.match(/^(.*?)\s+(\d+)$/);
        if (matchEnd && matchEnd[1].trim()) {
          const candidateProd = matchEnd[1].trim(); const candidateNum = matchEnd[2];
          if (!this.isNumeroParteDoProduto(candidateProd, candidateNum)) { prodName = candidateProd; qty = parseInt(candidateNum, 10); }
        } else {
          const matchStart = clean.match(/^(\d+)\s+(.+)$/);
          if (matchStart && matchStart[2].trim()) {
            const startNum = parseInt(matchStart[1], 10); const restProd = matchStart[2].trim();
            const is365Brand = startNum === 365 && /^(business|enterprise|apps|e3|e5|f1|f3|copilot|basic|standard|premium)\b/i.test(restProd);
            if (!is365Brand) { qty = startNum; prodName = restProd; }
          }
        }
      }
      prodName = prodName.replace(/^[\s\- :|=/ *+]+|[\s\- :|=/ *+]+$/g, '').trim();
      prodName = this.limparRuidoComercialLinha(prodName);
      if (!prodName) return;
      if (qty !== null && !isNaN(qty)) sumLicenses += qty;
      items.push({ itemIndex: idx, original: this.escapeHTML(prodName), rawSearch: prodName, keywords: this.extrairKeywords(prodName), qty: qty !== null ? qty : '-' });
    });
    return { items, sumLicenses };
  },

  // ==========================================================================
  // 7. SEGMENTOS DE MERCADO E FETCH SUPABASE AUTENTICADO (JWT + RLS)
  // ==========================================================================
  extrairSegmentoRow(rowOrVal) {
    if (!rowOrVal) return '';
    if (typeof rowOrVal === 'string') return rowOrVal.trim();
    if (typeof rowOrVal === 'object') {
      const direct = rowOrVal.segment ?? rowOrVal.Segment ?? rowOrVal.SEGMENT ?? rowOrVal.segmento ?? rowOrVal.Segmento ?? rowOrVal.sub_segment ?? rowOrVal.tipo_conta_compras ?? rowOrVal.market_segment ?? rowOrVal.target_segment ?? rowOrVal.audience;
      if (direct !== undefined && direct !== null && String(direct).trim() !== '') return String(direct).trim();
      for (const [k, v] of Object.entries(rowOrVal)) {
        if (/^(segment|segmento|tipo_conta|market_seg|target_seg|audience)/i.test(k) && v !== null && v !== undefined) return String(v).trim();
      }
    }
    return '';
  },

  construirFiltroPostgrestSegmento(columnName, allowedSegments) {
    const activeSegs = Array.isArray(allowedSegments) && allowedSegments.length > 0 ? allowedSegments : ['commercial'];
    if (activeSegs.length >= 4) return null;
    const clauses = [];
    if (activeSegs.includes('commercial')) clauses.push(`${columnName}.ilike.*commercial*`, `${columnName}.ilike.*comercial*`, `${columnName}.ilike.*corporate*`, `${columnName}.is.null`);
    if (activeSegs.includes('education')) clauses.push(`${columnName}.ilike.*education*`, `${columnName}.ilike.*academic*`, `${columnName}.ilike.*educa*`, `${columnName}.ilike.*faculty*`, `${columnName}.ilike.*student*`);
    if (activeSegs.includes('charity')) clauses.push(`${columnName}.ilike.*charity*`, `${columnName}.ilike.*nonprofit*`, `${columnName}.ilike.*non-profit*`, `${columnName}.ilike.*filantrop*`);
    if (activeSegs.includes('government')) clauses.push(`${columnName}.ilike.*government*`, `${columnName}.ilike.*governo*`, `${columnName}.ilike.*gov*`, `${columnName}.ilike.*public*`);
    return clauses.length > 0 ? `(${clauses.join(',')})` : null;
  },

  detectarSegmentoItem(nomeProduto, rowOrSegmento) {
    const segRaw = this.extrairSegmentoRow(rowOrSegmento).toLowerCase().trim();
    const nome = (nomeProduto || '').toLowerCase().trim();
    if (segRaw) {
      if (/\b(charity|non-profit|nonprofit|non profit|donation|filantropia|ong|beneficente)\b/i.test(segRaw) || segRaw.includes('charity') || segRaw.includes('nonprofit')) return 'charity';
      if (/\b(education|academic|faculty|student|school|educa|acad|ensino|edu)\b/i.test(segRaw) || segRaw.includes('education') || segRaw.includes('academic')) return 'education';
      if (/\b(government|gov|governo|public sector|setor p|state|federal|municipal|gcc)\b/i.test(segRaw) || segRaw.includes('government') || segRaw.includes('public')) return 'government';
    }
    if (/\b(charity|non-profit|nonprofit|non profit|donation|filantropia)\b/i.test(nome)) return 'charity';
    if (/\b(education|faculty|student|academic|academico|acadêmico|school)\b/i.test(nome)) return 'education';
    if (/\b(government|gov|governo|public sector|setor publico|setor público|gcc)\b/i.test(nome)) return 'government';
    return 'commercial';
  },

  isItemSegmentoValido(nomeProduto, rowOrSegmento, allowedSegments, precoUnitario) {
    if (typeof precoUnitario === 'number' && precoUnitario < 0) return false;
    const activeSegs = Array.isArray(allowedSegments) && allowedSegments.length > 0 ? allowedSegments : ['commercial'];
    return activeSegs.includes(this.detectarSegmentoItem(nomeProduto, rowOrSegmento));
  },

  renderSegmentBadge(nomeProduto, rowOrSegmento, allowedSegments) {
    const seg = this.detectarSegmentoItem(nomeProduto, rowOrSegmento);
    if ((Array.isArray(allowedSegments) && allowedSegments.length > 1) || seg !== 'commercial') {
      const map = {
        commercial: { label: 'Comercial', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
        education: { label: 'Educação', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
        charity: { label: 'Charity', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
        government: { label: 'Governo', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      };
      const info = map[seg] || map.commercial;
      return `<span onclick="Cotador.core.copiarElemento(event, this)" data-copy="${info.label}" data-label="Segmento" title="Clique para copiar o segmento" class="copy-link sec-detail ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium border ${info.cls}">${info.label}</span>`;
    }
    return '';
  },

  async fetchSupabase(table, paramsArray, options = {}) {
    const qs = paramsArray.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const url = `${this.SUPABASE_URL}/${table}?${qs}`;

    const headers = {
      'apikey': this.SUPABASE_KEY,
      'Accept': 'application/json'
    };

    if (window.CotadorAuth && typeof window.CotadorAuth.getSession === 'function') {
      const session = await window.CotadorAuth.getSession();
      if (session && session.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      } else {
        window.location.replace('login.html');
        throw new Error('Sessão expirada ou não encontrada.');
      }
    } else if (String(this.SUPABASE_KEY || '').startsWith('eyJ')) {
      headers['Authorization'] = `Bearer ${this.SUPABASE_KEY}`;
    }

    const signal = options.signal !== undefined ? options.signal : (options.useAbort === false ? undefined : this._searchAbortController?.signal);
    let resp;
    try {
      resp = await fetch(url, { method: 'GET', headers, mode: 'cors', cache: 'no-store', signal });
    } catch (netErr) {
      if (netErr.name === 'AbortError') throw netErr;
      throw new Error(`Falha de conexão com o Supabase (${netErr.message}).`);
    }

    if (resp.status === 401 || resp.status === 403) {
      window.location.replace('login.html');
      throw new Error('Acesso não autorizado (401/403).');
    }
    if (!resp.ok) throw new Error(`Erro HTTP (${resp.status}) na tabela [${table}].`);
    return await resp.json();
  },

  // ==========================================================================
  // 8. CÁLCULOS COMERCIAIS: MARGEM DE VENDA DIRETA E MODO CLIENTE
  // ==========================================================================
  parsePrice(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let str = String(val).replace(/[R$US$\s]/g, '').trim();
    if (str === '-' || str === '') return 0;
    if (str.includes('.') && str.includes(',')) {
      str = str.lastIndexOf(',') > str.lastIndexOf('.') ? str.replace(/\./g, '').replace(',', '.') : str.replace(/,/g, '');
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  },

  getSoloPrice(row) {
    const toggle = document.getElementById('chk-solo-service');
    const isAnualMensal =
      String(row.termo_duracao || '').trim().toUpperCase() === 'P1Y' &&
      String(row.plano_pagamento || '').trim().toLowerCase() === 'monthly';

    if (toggle && !toggle.checked) {
      const fob = this.parsePrice(row.fob_impostos || row.erp || 0);
      if (isAnualMensal) {
        const mensal = this.parsePrice(row.termo_anual_pagamento_mensal);
        return mensal > 0 ? mensal : (fob / 12);
      }
      return fob;
    }
    const raw = row.valor_5pct_servicos ?? row.valor_com_5_servicos ?? row['Valor com 5% serviços'] ?? row.fob_impostos;
    return this.parsePrice(raw);
  },

  calcularFatorComercial() {
    const pct = this.obterMarkupEfetivo();
    if (!this.markupEnabled || pct <= 0) return 1;
    if (this.calcMode === 'margin') {
      const safePct = Math.min(pct, 99.9);
      return 1 / (1 - (safePct / 100));
    }
    return 1 + (pct / 100);
  },

  aplicarMarkup(valor) {
    const n = parseFloat(valor);
    if (isNaN(n) || n <= 0) return 0;
    return n * this.calcularFatorComercial();
  },

  obterMarkupEfetivo() {
    return this.markupEnabled ? parseFloat(this.markupPercent) || 0 : 0;
  },

  formatBRL(num) {
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  formatUSD(num) {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  injetarControlesComerciaisHeader() {
    this.inicializarSegurancaERBAC();

    if (document.getElementById('commercial-mode-bar')) return;
    const viewCtrl = document.querySelector('.unified-view-control');
    if (!viewCtrl || !viewCtrl.parentElement) return;

    let ptaxPanel = document.getElementById('header-ptax-panel');
    if (!ptaxPanel) {
      ptaxPanel = document.createElement('div');
      ptaxPanel.id = 'header-ptax-panel';
      viewCtrl.parentElement.insertBefore(ptaxPanel, viewCtrl);
    }

    const bar = document.createElement('div');
    bar.id = 'commercial-mode-bar';
    bar.className = 'unified-view-control';
    bar.innerHTML = `
      <div class="markup-controls-group flex flex-wrap items-center gap-1.5 px-2 text-[11px] text-[#605e5c]">
        <div class="calc-mode-segmented inline-flex items-center bg-[#edebe9] p-0.5 rounded border border-[#c8c6c4]" role="group" aria-label="Tipo de Cálculo Comercial">
          <button type="button" id="btn-mode-margin" onclick="Cotador.core.setCalcMode('margin')" class="calc-seg-btn active" title="Margem Real (Por Dentro): Custo ÷ (1 - %)">
            Margem Real
          </button>
          <button type="button" id="btn-mode-markup" onclick="Cotador.core.setCalcMode('markup')" class="calc-seg-btn" title="Markup (Multiplicador Direto): Custo × (1 + %)">
            Markup
          </button>
        </div>
        <span id="calc-mode-formula-hint" class="calc-formula-pill is-margin hidden sm:inline-block" title="Fórmula matemática ativa">Custo ÷ (1 - %)</span>
        <input type="number" id="input-markup-pct" value="0" step="0.5" min="0" max="500" oninput="Cotador.core.setMarkupPercent(this.value)" class="w-14 bg-white border border-[#8a8886] rounded px-1.5 py-0.5 text-center text-[11px] font-semibold text-[#323130] tabular-nums focus:outline-none transition-colors" title="Informe a porcentagem">
        <span class="font-medium text-[#323130]">%</span>
        <button type="button" id="btn-toggle-markup" onclick="Cotador.core.toggleMarkupAtivo()" class="mini-toggle-btn ml-0.5" title="Ligar/Desligar Cálculo Comercial">
          <span class="dot"></span><span>Aplicar</span>
        </button>
      </div>
      <button type="button" id="btn-modo-cliente" onclick="Cotador.core.toggleModoCliente()" title="Ocultar Custo Interno e PNs para mostrar ao cliente" class="mini-toggle-btn border-l border-[#edebe9] pl-2 ml-1">
        <span class="dot"></span><span>Modo Cliente</span>
      </button>
    `;
    viewCtrl.parentElement.insertBefore(bar, viewCtrl);
    this.modoCliente = false;
    this.markupEnabled = false;
    document.body.classList.remove('client-proposal-mode');
    document.body.classList.add('markup-disabled', 'hide-secondary-details', 'hide-subtotals');
    this.atualizarVisibilidadeDetalhes();
    document.body.setAttribute('data-calc-mode', this.calcMode || 'margin');
  },

  toggleModoCliente() {
    const pct = this.obterMarkupEfetivo();
    if (!this.modoCliente && (!this.markupEnabled || pct <= 0)) {
      this.mostrarToast('Ative uma margem maior que 0% antes de usar o Modo Cliente.');
      document.getElementById('input-markup-pct')?.focus();
      return;
    }
    this.modoCliente = !this.modoCliente;
    document.body.classList.toggle('client-proposal-mode', this.modoCliente);
    document.getElementById('btn-modo-cliente')?.classList.toggle('active', this.modoCliente);
    this.atualizarTitulosColunasModoCliente();
    this.recalcularSubtotais();
  },

  toggleMarkupAtivo() {
    if (this.markupPercent <= 0 && !this.markupEnabled) {
      this.mostrarToast('Defina um valor maior que 0% antes de aplicar a margem.');
      document.getElementById('input-markup-pct')?.focus();
      return;
    }
    this.markupEnabled = !this.markupEnabled;
    if (!this.markupEnabled && this.modoCliente) {
      this.modoCliente = false;
      document.body.classList.remove('client-proposal-mode');
      document.getElementById('btn-modo-cliente')?.classList.remove('active');
      this.mostrarToast('Modo Cliente desativado: Margem desligada.');
    }
    document.getElementById('btn-toggle-markup')?.classList.toggle('active', this.markupEnabled);
    document.body.classList.toggle('markup-disabled', !this.markupEnabled);
    this.atualizarTitulosColunasModoCliente();
    this.recalcularSubtotais();
  },

  setMarkupPercent(val) {
    let parsed = parseFloat(val);
    if (isNaN(parsed) || parsed < 0) parsed = 0;
    
    if (this.calcMode === 'margin' && parsed >= 100) {
      parsed = 99.9;
      const input = document.getElementById('input-markup-pct');
      if (input) input.value = '99.9';
      this.mostrarToast('Na Margem Real (por dentro), o limite máximo é 99,9%.');
    }
    
    this.markupPercent = parsed;
    if (this.markupPercent > 0 && !this.markupEnabled) {
      this.markupEnabled = true;
      document.getElementById('btn-toggle-markup')?.classList.add('active');
      document.body.classList.remove('markup-disabled');
    } else if (this.markupPercent <= 0) {
      this.markupEnabled = false;
      document.getElementById('btn-toggle-markup')?.classList.remove('active');
      document.body.classList.add('markup-disabled');
      if (this.modoCliente) {
        this.modoCliente = false;
        document.body.classList.remove('client-proposal-mode');
        document.getElementById('btn-modo-cliente')?.classList.remove('active');
        this.mostrarToast('Modo Cliente desativado: Margem zerada.');
      }
    }
    this.atualizarTitulosColunasModoCliente();
    this.recalcularSubtotais();
  },

  atualizarTitulosColunasModoCliente() {
    const pct = this.obterMarkupEfetivo();
    document.querySelectorAll('.quote-block thead th').forEach(th => {
      if (!th.dataset.originalHeader) th.dataset.originalHeader = th.innerText.trim();
      const orig = th.dataset.originalHeader;
      if (!orig) return;
      if (th.classList.contains('col-margin-price')) {
        if (this.modoCliente) {
          if (/usd/i.test(orig)) th.innerText = 'Valor Unit. (USD)';
          else if (/brl/i.test(orig)) th.innerText = 'Valor Unit. (BRL)';
          else th.innerText = 'Valor Unitário';
        } else {
          const tituloInterno = (this.markupEnabled && pct > 0)
            ? (this.calcMode === 'margin' ? `Venda [Margem Real ${pct}%]` : `Venda [Markup +${pct}%]`)
            : `Valor c/ Margem`;
            
          if (/usd/i.test(orig)) th.innerText = `${tituloInterno} (USD)`;
          else if (/brl/i.test(orig)) th.innerText = `${tituloInterno} (BRL)`;
          else th.innerText = tituloInterno;
        }
      } else {
        th.innerText = orig;
      }
    });
  },

  // ==========================================================================
  // 9. RENDERIZAÇÃO DE COMPONENTES, DRAG & DROP, SUBTOTAIS E EXPORTAÇÃO
  // ==========================================================================
  renderCopyLink(displayText, copyValue, label = 'Valor', extraClass = '') {
    const safeDisplay = this.escapeHTML(String(displayText ?? ''));
    const safeCopy = this.escapeHTML(String(copyValue ?? displayText ?? ''));
    const safeLabel = this.escapeHTML(label);
    const hint = /[R$US$]/i.test(String(copyValue ?? displayText ?? ''))
      ? `Clique p/ copiar número puro • Shift+Clique p/ copiar com moeda`
      : `Copiar ${safeLabel.toLowerCase()}`;
    
    return `<span onclick="Cotador.core.copiarElemento(event, this)" data-copy="${safeCopy}" data-label="${safeLabel}" title="${hint}" class="copy-link ${extraClass}">${safeDisplay}</span>`;
  },

  renderPnBadge(pn) {
    const safePn = this.escapeHTML(String(pn ?? ''));
    return `<span onclick="Cotador.core.copiarElemento(event, this)" data-copy="${safePn}" data-pn-val="${safePn}" data-label="PN" title="Copiar o PN" class="copy-link pn-mono">${safePn}</span>`;
  },

  renderQtyInput(qty) {
  const val = (qty === '-' || isNaN(qty)) ? '' : qty;
    return `<div class="qty-control-wrap inline-flex items-center gap-1">
      <input type="number" min="1" value="${val}" placeholder="-" oninput="Cotador.core.aoAlterarQuantidade(event, this)" title="Altera em todas as tabelas (Shift p/ alterar só nesta)" class="qty-input">
      <button type="button" onclick="Cotador.core.copiarQuantidadeLinha(event, this)" title="Copiar quantidade (1 clique)" class="no-export copy-qty-btn">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
      </button>
    </div>`;
  },
  copiarQuantidadeLinha(event, btnEl) {
    if (event) event.stopPropagation();
    const td = btnEl ? btnEl.closest('td') : null;
    const input = td ? td.querySelector('.qty-input') : null;
    const val = input && input.value ? String(input.value).trim() : '';
    if (!val || val === '-') {
      this.mostrarToast('Defina uma quantidade antes de copiar.');
      return;
    }
    navigator.clipboard.writeText(val);
    btnEl.classList.add('is-copied');
    setTimeout(() => btnEl.classList.remove('is-copied'), 450);
    this.mostrarToast(`Quantidade copiada: ${val}`);
  },
  aoAlterarQuantidade(event, inputEl) {
    const tr = inputEl ? inputEl.closest('tr') : null;
    const novaQtd = inputEl ? inputEl.value : '';
    const isolado = event && (event.shiftKey || event.altKey);
    if (tr && !isolado) {
      const syncKey = tr.getAttribute('data-sync-key');
      const prodKey = tr.getAttribute('data-prod-key');
      document.querySelectorAll('.quote-block tbody tr').forEach(otherTr => {
        if (otherTr === tr) return;
        if ((syncKey && otherTr.getAttribute('data-sync-key') === syncKey) || (!syncKey && prodKey && otherTr.getAttribute('data-prod-key') === prodKey)) {
          const otherInput = otherTr.querySelector('.qty-input');
          if (otherInput && otherInput.value !== novaQtd) otherInput.value = novaQtd;
        }
      });
    }
    this.recalcularSubtotais();
  },

  renderDetalhesSoloCSP(contratoId, custoCom5, mensalSem5, anualSem5, fator = 1, isMarginCol = false) {
    if (contratoId !== 'am' && contratoId !== 'mm' && contratoId !== 'tm') return '';
    const toggle = document.getElementById('chk-solo-service');
    const isSoloEnabled = !toggle || toggle.checked;
    const anualVal = (custoCom5 * fator) * 12;
    const fmtAnualVal = `R$ ${this.formatBRL(anualVal)}`;
    const labelInterno = isSoloEnabled ? `12x c/ 5%: ${fmtAnualVal}` : `Total 12x: ${fmtAnualVal}`;
    const labelCliente = `Total 12x: ${fmtAnualVal}`;
    if (isMarginCol) {
      return `<div class="sec-detail text-[11px] font-medium text-[#605e5c] mt-0.5">
        <span>${this.renderCopyLink(labelCliente, fmtAnualVal, 'Total 12 meses')}</span>
      </div>`;
    }
    return `<div class="sec-detail text-[11px] font-medium text-[#605e5c] mt-0.5">${this.renderCopyLink(labelInterno, fmtAnualVal, labelInterno.split(':')[0])}</div>`;
  },

  renderDetalhesScanCSP(contratoId, valorUnitario, fator = 1) {
    if (contratoId !== 'am' && contratoId !== 'mm') return '';
    const total12x = valorUnitario * fator * 12;
    const fmt12x = `R$ ${this.formatBRL(total12x)}`;
    return `<div class="sec-detail text-[11px] font-normal text-[#8a8886] mt-0.5">${this.renderCopyLink(`Total 12x: ${fmt12x}`, fmt12x, 'Total 12 meses')}</div>`;
  },

  renderRowActions() {
    return `<div class="flex items-center justify-end gap-1 whitespace-nowrap"><button type="button" onclick="Cotador.core.removerLinhaUnica(this)" title="Remover item da tabela" class="text-[11px] font-normal text-[#8a8886] hover:text-[#a4262c] hover:bg-[#fdf3f4] rounded px-1.5 py-1 transition flex items-center gap-1"><span>&#10005;</span> <span class="hidden sm:inline">Remover</span></button><button type="button" onclick="Cotador.core.removerLinhasSemelhantes(this)" title="Remover produto de todas as tabelas" class="text-[11px] font-medium text-[#8a8886] hover:text-[#a4262c] hover:bg-[#fdf3f4] border border-transparent hover:border-[#f8d7da] rounded px-1.5 py-1 transition flex items-center gap-1"><svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1 1h-4a1 1 0 00-1 1v3M4 7h16"/></svg><span class="hidden sm:inline">Semelhantes</span></button></div>`;
  },

  renderBlockHeader(title, blockId) {
    const safeTitle = this.escapeHTML(title);
    let tabelaRef = null;
    if (blockId.startsWith('blk-scan')) tabelaRef = 'microsoft_scan';
    else if (blockId.startsWith('blk-solo')) tabelaRef = 'microsoft_solo';
    else if (blockId.startsWith('blk-perpetuo')) tabelaRef = 'microsoft_perpetuo';
    else if (blockId.startsWith('blk-mpsa')) tabelaRef = 'microsoft_mpsa';
    else if (blockId.startsWith('blk-adobe_base')) tabelaRef = 'adobe_base';
    else if (blockId.startsWith('blk-adobe_promo')) tabelaRef = 'adobe_promo';
    else if (blockId.startsWith('blk-kaspersky')) tabelaRef = 'kaspersky';
    const infoData = tabelaRef ? this.ultimasAtualizacoes[tabelaRef] : null;
    const dataCurta = infoData ? this.formatarDataCurta(infoData.iso) : null;
    const badgeDataHTML = dataCurta ? `<span class="sec-detail no-export text-[10px] font-normal text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full whitespace-nowrap">Atualizado em ${dataCurta}</span>` : '';
    return `<div onclick="Cotador.core.toggleBlock('${blockId}')" class="block-header-bar flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 cursor-pointer select-none"><div class="flex items-center gap-2"><svg class="w-4 h-4 text-gray-400 chevron-icon transition-transform duration-150 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg><h3 onclick="Cotador.core.copiarBlocoAoClicarTitulo(event, '${blockId}')" class="copy-link text-xs font-semibold text-[#323130]">${safeTitle}</h3></div><div class="flex items-center gap-2" onclick="event.stopPropagation()">${badgeDataHTML}<span id="total-${blockId}" onclick="Cotador.core.copiarElemento(event, this)" data-copy="" data-label="Total da Tabela" class="copy-link block-total-badge text-xs font-semibold theme-badge px-2.5 py-0.5 rounded tabular-nums hidden"></span><button type="button" onclick="Cotador.core.copiarPropostaBlocoCliente(event, '${blockId}')" title="Copiar lista completa do cliente" class="client-only-inline-btn no-export bg-[#ffffff] border border-[#c8c6c4] text-[#323130] hover:bg-[#f3f2f1] px-2 py-0.5 rounded text-[10px] font-semibold items-center gap-1 transition"><svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg><span>Copiar Lista</span></button></div></div>`;
  },

  renderUnmatchedWarning(missingItems) {
    const old = document.getElementById('unmatched-items-banner');
    if (old) old.remove();
    if (!Array.isArray(missingItems) || missingItems.length === 0) return;
    const container = document.getElementById('resultado-container');
    if (!container) return;
    const tags = missingItems.map(it => `<span class="px-1.5 py-0.5 rounded bg-[#fdf3f4] text-[#a4262c] font-mono text-[11px] border border-[#f8d7da]">${this.escapeHTML(it.rawSearch)}</span>`).join(' ');
    container.insertAdjacentHTML('afterbegin', `
      <div id="unmatched-items-banner" class="p-3 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-semibold">Atenção:</span>
          <span>${missingItems.length === 1 ? '1 item da lista não retornou SKUs' : `${missingItems.length} itens da lista não retornaram SKUs`} nos filtros ativos:</span>
          ${tags}
        </div>
        <button type="button" onclick="this.parentElement.remove()" class="text-[11px] text-amber-700 font-medium px-1.5 py-0.5">&#10005;</button>
      </div>`);
  },

  renderEmptyStateGlobal() {
    return `<div class="text-center py-16 px-4 bg-[#faf9f8] rounded border border-dashed border-[#8a8886] text-[#323130] space-y-2"><p class="text-sm font-semibold">Nenhum produto encontrado</p><p class="text-xs text-[#605e5c] max-w-md mx-auto">Nenhum item correspondeu à busca nas modalidades e filtros selecionados.</p></div>`;
  },

  obterChaveProduto(tr) {
    const firstTd = tr ? tr.querySelector('td') : null;
    if (!firstTd) return '';
    const cloneTd = firstTd.cloneNode(true);
    cloneTd.querySelectorAll('.no-export, .sec-detail').forEach(el => el.remove());
    return cloneTd.innerText.replace(/\s+/g, ' ').trim().toLowerCase();
  },

  limparBlocosVazios() {
    const container = document.getElementById('resultado-container');
    if (!container) return;
    container.querySelectorAll('.quote-block').forEach(block => {
      if (block.querySelectorAll('tbody tr').length === 0) block.remove();
    });
    if (container.querySelectorAll('.quote-block').length === 0) container.innerHTML = this.renderEmptyStateGlobal();
  },

  removerLinhaUnica(btn) {
    btn.closest('tr')?.remove();
    this.limparBlocosVazios();
    this.recalcularSubtotais();
  },

  removerLinhasSemelhantes(btn) {
    const tr = btn.closest('tr');
    if (!tr) return;
    const chaveAlvo = tr.getAttribute('data-prod-key') || this.obterChaveProduto(tr);
    if (!chaveAlvo) { this.removerLinhaUnica(btn); return; }
    let removidos = 0;
    document.querySelectorAll('.quote-block tbody tr').forEach(row => {
      if ((row.getAttribute('data-prod-key') || this.obterChaveProduto(row)) === chaveAlvo) {
        row.remove(); removidos++;
      }
    });
    this.limparBlocosVazios();
    this.recalcularSubtotais();
    this.mostrarToast(`Removido em ${removidos} linha(s)!`);
  },

  initDragEvents() {
    if (this._dragInitialized) return;
    this._dragInitialized = true;
    document.addEventListener('mousedown', (e) => { this._lastMouseDownTarget = e.target; }, true);
    document.addEventListener('dragstart', (e) => {
      const tr = e.target.closest('.quote-block tbody tr.draggable-row');
      if (!tr || (this._lastMouseDownTarget && this._lastMouseDownTarget.closest('input, button, .copy-link'))) { e.preventDefault(); return; }
      this._draggedRow = tr; tr.classList.add('is-dragging');
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', tr.getAttribute('data-sync-key') || ''); }
    });
    document.addEventListener('dragover', (e) => {
      if (!this._draggedRow) return;
      const targetTr = e.target.closest('.quote-block tbody tr.draggable-row');
      if (!targetTr || targetTr === this._draggedRow) return;
      const sourceTbody = this._draggedRow.parentElement;
      if (targetTr.parentElement !== sourceTbody) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const isAfter = (e.clientY - targetTr.getBoundingClientRect().top) > (targetTr.getBoundingClientRect().height / 2);
      sourceTbody.insertBefore(this._draggedRow, isAfter ? targetTr.nextElementSibling : targetTr);
    });
    document.addEventListener('drop', (e) => { if (this._draggedRow) e.preventDefault(); });
    document.addEventListener('dragend', () => {
        if (!this._draggedRow) return;
        const movedRow = this._draggedRow; const sourceTbody = movedRow.parentElement;
        movedRow.classList.remove('is-dragging'); this._draggedRow = null;
        if (sourceTbody) this.sincronizarOrdemTabelas(sourceTbody, movedRow);
      });
    },

    prepararLinhasDrag() {
    this.initDragEvents();
    document.querySelectorAll('.quote-block thead th').forEach((th, idx, arr) => {
      if (idx === arr.length - 1 || th.dataset.thReady) return;
      th.dataset.thReady = '1'; th.classList.add('copyable-th');
      th.addEventListener('click', (e) => this.copiarColunaTabela(e, th, idx));
    });
    document.querySelectorAll('.quote-block tbody').forEach(tbody => {
      const keyCounts = {};
      tbody.querySelectorAll('tr').forEach(tr => {
        const firstTd = tr.querySelector('td');
        if (!firstTd) return;
        const baseName = tr.getAttribute('data-prod-key') || this.obterChaveProduto(tr);
        if (baseName && !tr.getAttribute('data-prod-key')) tr.setAttribute('data-prod-key', baseName);
        if (!tr.getAttribute('data-sync-key')) {
          keyCounts[baseName] = (keyCounts[baseName] || 0) + 1;
          tr.setAttribute('data-sync-key', `${baseName}::#${keyCounts[baseName]}`);
        }
        if (!tr.classList.contains('draggable-row')) { tr.classList.add('draggable-row'); tr.setAttribute('draggable', 'true'); }
        if (!firstTd.querySelector('.row-grip-wrap')) {
          const wrap = document.createElement('span'); wrap.className = 'row-grip-wrap no-export';
          wrap.innerHTML = `<span class="drag-handle"><svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="3.5" r="1.2"/><circle cx="10.5" cy="3.5" r="1.2"/><circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/><circle cx="5.5" cy="12.5" r="1.2"/><circle cx="10.5" cy="12.5" r="1.2"/></svg></span>`;
          firstTd.insertBefore(wrap, firstTd.firstChild);
        }
      });
    });
  },

  sincronizarOrdemTabelas(sourceTbody, movedRow) {
    const syncKey = movedRow.getAttribute('data-sync-key');
    if (!syncKey) return;
    const keysAfter = []; let next = movedRow.nextElementSibling;
    while (next) { const k = next.getAttribute('data-sync-key'); if (k) keysAfter.push(k); next = next.nextElementSibling; }
    document.querySelectorAll('.quote-block tbody').forEach(otherTbody => {
      if (otherTbody === sourceTbody) return;
      const rows = Array.from(otherTbody.querySelectorAll('tr'));
      const matchingRow = rows.find(r => r.getAttribute('data-sync-key') === syncKey);
      if (!matchingRow) return;
      let refRow = null;
      for (const afterKey of keysAfter) {
        const candidate = rows.find(r => r.getAttribute('data-sync-key') === afterKey);
        if (candidate && candidate !== matchingRow) { refRow = candidate; break; }
      }
      refRow ? otherTbody.insertBefore(matchingRow, refRow) : otherTbody.appendChild(matchingRow);
      matchingRow.classList.remove('row-synced-flash'); void matchingRow.offsetWidth; matchingRow.classList.add('row-synced-flash');
    });
  },

  toggleBlock(blockId) { document.getElementById(blockId)?.classList.toggle('is-collapsed'); },
  alternarTodasTabelas() {
    const blocks = Array.from(document.querySelectorAll('.quote-block'));
    if (blocks.length === 0) return;
    const algumaAberta = blocks.some(b => !b.classList.contains('is-collapsed'));
    blocks.forEach(b => b.classList.toggle('is-collapsed', algumaAberta));
  },

  toggleMostrarSubtotal() {
    const chk = document.getElementById('chk-mostrar-subtotal');
    chk.checked = !chk.checked;
    document.getElementById('btn-toggle-subtotal').classList.toggle('active', chk.checked);
    this.recalcularSubtotais();
  },

  toggleDetalhesSecundarios() {
    const chk = document.getElementById('chk-mostrar-detalhes');
    chk.checked = !chk.checked;
    this.atualizarVisibilidadeDetalhes();
  },

  alternarVisaoUnificada() {
    const chkSub = document.getElementById('chk-mostrar-subtotal');
    const chkDet = document.getElementById('chk-mostrar-detalhes');
    const ativarAmbos = !(chkSub.checked && chkDet.checked);
    chkSub.checked = chkDet.checked = ativarAmbos;
    document.getElementById('btn-toggle-subtotal').classList.toggle('active', ativarAmbos);
    this.atualizarVisibilidadeDetalhes();
    this.recalcularSubtotais();
  },

  atualizarVisibilidadeDetalhes() {
    const showDet = document.getElementById('chk-mostrar-detalhes').checked;
    document.body.classList.toggle('hide-secondary-details', !showDet);
    document.getElementById('btn-toggle-detalhes')?.classList.toggle('active', showDet);
  },

  atualizarCambioAdobeEmTempoReal(novaTaxa) {
    const taxa = this.parsePrice(novaTaxa);
    if (isNaN(taxa) || taxa <= 0) return;
    document.querySelectorAll('.quote-block[data-currency="USD"]').forEach(block => {
      const newTitle = (block.getAttribute('data-title') || '').replace(/Câmbio:\s*R\$\s*[\d.,]+/i, `Câmbio: R$ ${this.formatBRL(taxa)}`);
      block.setAttribute('data-title', newTitle);
      const h3 = block.querySelector('.block-header-bar h3');
      if (h3) h3.textContent = newTitle.replace(/^###\s*/, '');
      block.querySelectorAll('tbody tr').forEach(tr => {
        const baseUsd = parseFloat(tr.getAttribute('data-base-unit-price') || tr.getAttribute('data-unit-price'));
        if (isNaN(baseUsd)) return;
        const novoBrlBase = baseUsd * taxa;
        tr.setAttribute('data-base-unit-price-brl', String(novoBrlBase));
        const costBrlTd = tr.querySelector('td.col-cost-brl');
        if (costBrlTd) {
          const fmtCostBrl = `R$ ${this.formatBRL(novoBrlBase)}`;
          costBrlTd.innerHTML = this.renderCopyLink(fmtCostBrl, fmtCostBrl, 'Custo BRL');
        }
      });
    });
    this.recalcularSubtotais();
  },

  _recalcTimer: null,
  recalcularSubtotais() {
    if (this._recalcTimer) clearTimeout(this._recalcTimer);
    this._recalcTimer = setTimeout(() => {
      this._executarRecalculoSubtotais();
    }, 150);
  },
  _executarRecalculoSubtotais() {
    this.prepararLinhasDrag();
    this.atualizarTitulosColunasModoCliente();
    const chkSub = document.getElementById('chk-mostrar-subtotal');
    const showSub = Boolean((chkSub && chkSub.checked) || this.modoCliente);
    document.body.classList.toggle('hide-subtotals', !showSub);
    document.getElementById('btn-toggle-subtotal')?.classList.toggle('active', showSub);
    document.querySelectorAll('.col-subtotal').forEach(el => el.classList.toggle('hidden', !showSub));

    const pctEfetivo = this.obterMarkupEfetivo();
    const fatorMarkup = this.calcularFatorComercial();
    document.body.classList.toggle('has-active-markup', pctEfetivo > 0);

    document.querySelectorAll('.quote-block').forEach(block => {
      const isUSD = block.getAttribute('data-currency') === 'USD';
      let somaBloco = 0; let somaBlocoBrl = 0; let somaQtd = 0; let temQtd = false;

      block.querySelectorAll('tbody tr').forEach(tr => {
        if (!tr.hasAttribute('data-base-unit-price')) tr.setAttribute('data-base-unit-price', tr.getAttribute('data-unit-price') || '0');
        if (isUSD && !tr.hasAttribute('data-base-unit-price-brl')) tr.setAttribute('data-base-unit-price-brl', tr.getAttribute('data-unit-price-brl') || '0');

        const baseUnit = parseFloat(tr.getAttribute('data-base-unit-price'));
        const baseUnitBrl = parseFloat(tr.getAttribute('data-base-unit-price-brl'));
        const unitComMargem = baseUnit * fatorMarkup;
        const unitBrlComMargem = (!isNaN(baseUnitBrl) ? baseUnitBrl : 0) * fatorMarkup;

        tr.setAttribute('data-unit-price', String(unitComMargem));
        if (isUSD) tr.setAttribute('data-unit-price-brl', String(unitBrlComMargem));

        if (isUSD) {
          const tdMarginUsd = tr.querySelector('td.col-margin-usd');
          const tdMarginBrl = tr.querySelector('td.col-margin-brl');
          if (tdMarginUsd && !isNaN(unitComMargem)) tdMarginUsd.innerHTML = this.renderCopyLink(`US$ ${this.formatUSD(unitComMargem)}`, `US$ ${this.formatUSD(unitComMargem)}`, 'Valor Unit. USD');
          if (tdMarginBrl && !isNaN(unitBrlComMargem)) tdMarginBrl.innerHTML = this.renderCopyLink(`R$ ${this.formatBRL(unitBrlComMargem)}`, `R$ ${this.formatBRL(unitBrlComMargem)}`, 'Valor Unit. BRL');
        } else {
          const tdMargin = tr.querySelector('td.col-margin-price');
          if (tdMargin && !isNaN(unitComMargem) && unitComMargem > 0) {
            const fmtMargin = `R$ ${this.formatBRL(unitComMargem)}`;
            let detalhesMarginHTML = '';
            const rowKind = tr.getAttribute('data-row-kind');
            const contratoId = tr.getAttribute('data-contract-id') || '';
            if (rowKind === 'ms_solo') {
              const mensalSem5 = parseFloat(tr.getAttribute('data-mensal-sem5') || '0');
              const anualSem5 = parseFloat(tr.getAttribute('data-anual-sem5') || '0');
              detalhesMarginHTML = this.renderDetalhesSoloCSP(contratoId, baseUnit, mensalSem5, anualSem5, fatorMarkup, true);
            } else if (rowKind === 'ms_scan') {
              detalhesMarginHTML = this.renderDetalhesScanCSP(contratoId, baseUnit, fatorMarkup);
            }
            tdMargin.innerHTML = `${this.renderCopyLink(fmtMargin, fmtMargin, 'Valor Unitário')}${detalhesMarginHTML}`;
          } else if (tdMargin) {
            tdMargin.textContent = '-';
          }
        }

        const input = tr.querySelector('.qty-input');
        const subTd = tr.querySelector('.col-subtotal');
        if (!input || isNaN(unitComMargem)) return;

        const qty = parseInt(input.value, 10);
        const qtyCell = input.closest('td.adobe-qty-cell');
        if (qtyCell) {
          const moq = parseInt(qtyCell.getAttribute('data-moq') || '1', 10);
          const warn = qtyCell.querySelector('.moq-warning');
          if (warn && moq > 1) {
            warn.classList.toggle('hidden', !isNaN(qty) && qty >= moq);
          }
        }
        if (!isNaN(qty) && qty > 0) {
          const sub = unitComMargem * qty;
          somaBloco += sub; somaQtd += qty; temQtd = true;
          if (isUSD) {
            const subBrl = unitBrlComMargem * qty;
            somaBlocoBrl += subBrl;
            if (subTd) {
              const formattedUSD = `US$ ${this.formatUSD(sub)}`;
              const formattedBRL = `R$ ${this.formatBRL(subBrl)}`;
              subTd.innerHTML = `${this.renderCopyLink(formattedUSD, formattedUSD, 'Subtotal USD')}${subBrl > 0 ? `<div class="sec-detail text-[11px] font-normal text-gray-500 mt-0.5">${this.renderCopyLink(formattedBRL, formattedBRL, 'Subtotal BRL')}</div>` : ''}`;
            }
          } else if (subTd) {
            const formattedSub = `R$ ${this.formatBRL(sub)}`;
            subTd.innerHTML = this.renderCopyLink(formattedSub, formattedSub, 'Subtotal');
          }
        } else if (subTd) {
          subTd.textContent = '-';
        }
      });

      const badgeTotal = document.getElementById(`total-${block.id}`);
      if (badgeTotal) {
        if (isUSD) {
          const valorUSD = `US$ ${this.formatUSD(somaBloco)}`;
          badgeTotal.innerHTML = `Total: ${valorUSD}<span class="font-normal opacity-80 ml-1.5">(R$ ${this.formatBRL(somaBlocoBrl)})</span>`;
          badgeTotal.setAttribute('data-copy', valorUSD);
        } else {
          const valorFormatado = `R$ ${this.formatBRL(somaBloco)}`;
          badgeTotal.textContent = `Total: ${valorFormatado}`;
          badgeTotal.setAttribute('data-copy', valorFormatado);
        }
        badgeTotal.classList.toggle('hidden', !temQtd || !showSub);
      }

      const table = block.querySelector('table');
      if (table) {
        let tfoot = table.querySelector('tfoot.block-table-tfoot');
        if (!temQtd || !showSub) {
          if (tfoot) tfoot.remove();
        } else {
          if (!tfoot) { tfoot = document.createElement('tfoot'); tfoot.className = 'block-table-tfoot'; table.appendChild(tfoot); }
          const ths = Array.from(table.querySelectorAll('thead th'));
          const cellsHTML = ths.map((th, idx) => {
            if (idx === 0) return `<td class="font-semibold text-[#323130]">Total Geral</td>`;
            if (idx === 1) return `<td class="font-semibold text-[#605e5c] text-center tabular-nums">${somaQtd}</td>`;
            if (th.classList.contains('col-subtotal')) {
              if (isUSD) {
                const fmtTotUSD = `US$ ${this.formatUSD(somaBloco)}`;
                const brlSubLine = somaBlocoBrl > 0 ? `<div class="text-[11px] font-normal text-gray-500 mt-0.5">${this.renderCopyLink(`R$ ${this.formatBRL(somaBlocoBrl)}`, `R$ ${this.formatBRL(somaBlocoBrl)}`, 'Total BRL')}</div>` : '';
                return `<td class="col-subtotal font-bold theme-subtotal whitespace-nowrap tabular-nums">${this.renderCopyLink(fmtTotUSD, fmtTotUSD, 'Total Geral USD')}${brlSubLine}</td>`;
              }
              const fmtTot = `R$ ${this.formatBRL(somaBloco)}`;
              return `<td class="col-subtotal font-bold theme-subtotal whitespace-nowrap tabular-nums">${this.renderCopyLink(fmtTot, fmtTot, 'Total Geral')}</td>`;
            }
            if (idx === ths.length - 1) return `<td></td>`;
            const vis = ['col-pn', 'col-secondary', 'col-cost-normal', 'col-internal-cost', 'col-margin-price'].filter(c => th.classList.contains(c)).join(' ');
            return `<td class="${vis}"></td>`;
          }).join('');
          tfoot.innerHTML = `<tr>${cellsHTML}</tr>`;
        }
      }
    });
  },

  extrairValorCelula(td) {
    const input = td.querySelector('.qty-input');
    if (input) return input.value ? input.value : '-';
    const pnEl = td.querySelector('[data-pn-val]');
    if (pnEl) return pnEl.getAttribute('data-pn-val') || pnEl.innerText.trim();
    const clone = td.cloneNode(true);
    clone.querySelectorAll('.no-export').forEach(el => el.remove());
    if (this.modoCliente) {
      clone.querySelectorAll('.internal-only-detail, .internal-only-text').forEach(el => el.remove());
    } else {
      clone.querySelectorAll('.client-only-text').forEach(el => el.remove());
    }
    if (document.body.classList.contains('hide-secondary-details')) {
      clone.querySelectorAll('.sec-detail').forEach(el => el.remove());
    }
    return clone.innerText.replace(/\s+/g, ' ').trim();
  },

  isColunaVisivel(cell) {
    const showSub = Boolean(document.getElementById('chk-mostrar-subtotal')?.checked || this.modoCliente);
    const showDet = !document.body.classList.contains('hide-secondary-details');
    if (!showSub && cell.classList.contains('col-subtotal')) return false;
    if (!showDet && cell.classList.contains('col-secondary')) return false;
    if (!this.markupEnabled && !this.modoCliente && cell.classList.contains('col-margin-price')) return false;
    if (this.modoCliente) {
      if (cell.classList.contains('col-pn') || cell.classList.contains('col-cost-normal') || cell.classList.contains('col-internal-cost')) return false;
    }
    return true;
  },

  limparTituloBlocoModoCliente(rawTitle) {
    return this.modoCliente ? String(rawTitle || '').replace(/^###\s*/, '').replace(/\s*\(Faturamento:.*?\)/gi, '') : String(rawTitle || '').replace(/^###\s*/, '');
  },

  mostrarToast(msg) {
    const t = document.getElementById('copy-toast');
    if (!t) return;
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
  },

  copiarElemento(event, el) {
    if (event) event.stopPropagation();
    if (!el) return;
    let txt = el.getAttribute('data-copy') ?? el.innerText.trim();
    const comSimboloMoeda = Boolean(event && (event.shiftKey || event.altKey));
    
    if (!comSimboloMoeda && /^(?:R\$|US\$)/i.test(txt)) {
      const num = this.parsePrice(txt);
      txt = num > 0 ? num.toFixed(2).replace('.', ',') : txt.replace(/^(?:R\$|US\$)\s*/i, '').trim();
    }
    
    if (!txt || txt === '-') return;
    navigator.clipboard.writeText(txt);
    el.classList.add('is-copied');
    setTimeout(() => el.classList.remove('is-copied'), 450);
    this.mostrarToast(`${el.getAttribute('data-label') || 'Item'} copiado: ${txt}`);
  },

  copiarColunaTabela(event, th, colIndex) {
    if (event) event.stopPropagation();
    const table = th.closest('table');
    if (!table) return;
    const valores = [];
    table.querySelectorAll('tbody tr').forEach(tr => {
      if (tr.children[colIndex]) {
        let val = this.extrairValorCelula(tr.children[colIndex]);
        if (val && val !== '-') {
          const comSimbolo = Boolean(event && (event.shiftKey || event.altKey));
          if (!comSimbolo && /[R$US$]/i.test(val)) {
            val = this.parsePrice(val).toFixed(2).replace('.', ',');
          }
          valores.push(val);
        }
      }
    });
    if (valores.length > 0) {
      navigator.clipboard.writeText(valores.join('\n'));
      this.mostrarToast(`Coluna "${th.innerText.trim()}" copiada (${valores.length} itens)!`);
    }
  },

  copiarBlocoAoClicarTitulo(event, blockId) {
    if (event) event.stopPropagation();
    const block = document.getElementById(blockId);
    if (!block) return;
    const { tsv, html } = this.gerarExtracaoBloco(block);
    this.copiarRichTextOuTexto(tsv, html, 'Tabela copiada!');
  },

  gerarExtracaoBloco(block) {
    const title = this.limparTituloBlocoModoCliente(block.getAttribute('data-title'));
    const table = block.querySelector('table');
    const headers = Array.from(table.querySelectorAll('thead th')).slice(0, -1).filter(th => this.isColunaVisivel(th)).map(th => th.innerText.trim());
    let tsv = `${title}\n${headers.join('\t')}\n`;
    let html = `<h4 style="font-family:sans-serif;color:#1e293b;margin:12px 0 6px 0;">${title}</h4><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:12px;border-color:#e2e8f0;width:100%;"><thead style="background:#f1f5f9;color:#334155;"><tr>${headers.map(h => `<th align="left">${h}</th>`).join('')}</tr></thead><tbody>`;
    table.querySelectorAll('tbody tr').forEach(tr => {
      const cells = Array.from(tr.querySelectorAll('td')).slice(0, -1).filter(td => this.isColunaVisivel(td)).map(td => this.extrairValorCelula(td));
      if (cells.length > 0) { tsv += `${cells.join('\t')}\n`; html += `<tr>${cells.map(c => `<td style="border:1px solid #e2e8f0;">${c}</td>`).join('')}</tr>`; }
    });
    const tfootTr = table.querySelector('tfoot.block-table-tfoot tr');
    if (tfootTr) {
      const footCells = Array.from(tfootTr.querySelectorAll('td')).slice(0, -1).filter(td => this.isColunaVisivel(td)).map(td => this.extrairValorCelula(td));
      if (footCells.length > 0) { tsv += `${footCells.join('\t')}\n`; html += `<tr style="background:#f8fafc;font-weight:bold;">${footCells.map(c => `<td style="border:1px solid #e2e8f0;font-weight:bold;">${c}</td>`).join('')}</tr>`; }
    }
    return { tsv, html: html + `</tbody></table><br>` };
  },

  async copiarRichTextOuTexto(tsv, html, msgSucesso) {
    try {
      if (window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([tsv.trim()], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) })]);
      } else {
        await navigator.clipboard.writeText(tsv.trim());
      }
    } catch (_) {
      await navigator.clipboard.writeText(tsv.trim());
    }
    this.mostrarToast(msgSucesso);
  }
};