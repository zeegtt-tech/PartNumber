// ============================================================================
// CONTROLADOR DA APLICAÇÃO (APP) - COTADOR v5.8 ENTERPRISE (js/app.js)
// ============================================================================
window.Cotador.app = {
  currentVendor: 'microsoft',
  parsedItems: [],
  totalLicenses: 0,
  msModalidades: new Set(),
  msSegmentos: new Set(['commercial']),
  adobeSegmentos: new Set(['teams']),
  trienaisVisiveis: false,
  STORAGE_KEY: 'cotador_enterprise_prefs_v58',

  init() {
    window.Cotador.core.injetarControlesComerciaisHeader();

    const inputItens = document.getElementById('input-itens');
    if (inputItens) {
      inputItens.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          this.gerarCotacao();
        }
      });
    }

    // Câmbio Dólar Adobe reativo em tempo real (sem nova requisição ao banco)
    const inputDolar = document.getElementById('adobe-dolar');
    if (inputDolar) {
      inputDolar.addEventListener('input', (e) => {
        this.salvarPreferencias();
        window.Cotador.core.atualizarCambioAdobeEmTempoReal(e.target.value);
      });
    }

    // Marca "License Only" como padrão inicial para MPSA
    const chkMpsaLicOnly = document.getElementById('chk-mpsa-show-liconly');
    if (chkMpsaLicOnly) chkMpsaLicOnly.checked = true;

    this.carregarPreferencias();
    this.atualizarUIMsModalidades();
    this.atualizarUIMsSegmentos();
    this.atualizarUIAdobeSegmentos();

    if (!inputItens || !inputItens.value.trim()) {
      this.preencherExemplo();
    } else {
      this.analisarInput();
    }
  },

  salvarPreferencias() {
    try {
      const prefs = {
        vendor: this.currentVendor,
        dolar: document.getElementById('adobe-dolar')?.value || '4.80',
        msModalidades: Array.from(this.msModalidades)
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(prefs));
    } catch (_) {}
  },

  carregarPreferencias() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const prefs = JSON.parse(raw);
      if (prefs.dolar && document.getElementById('adobe-dolar')) {
        document.getElementById('adobe-dolar').value = prefs.dolar;
      }
      if (Array.isArray(prefs.msModalidades)) {
        this.msModalidades = new Set(prefs.msModalidades);
      }
    } catch (_) {}
  },

  setVendor(vendor) {
    this.currentVendor = vendor;
    document.body.setAttribute('data-vendor', vendor);

    ['microsoft', 'adobe', 'kaspersky'].forEach(v => {
      document.getElementById(`btn-vendor-${v}`).classList.toggle('active', v === vendor);
      document.getElementById(`filtros-${v}`).classList.toggle('hidden', v !== vendor);
    });

    document.getElementById('resultado-container').innerHTML = `<div class="text-center py-24 text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">Fabricante alterado para <span class="theme-text font-semibold uppercase">${vendor}</span>.<br>Insira os itens no painel esquerdo e clique em <span class="theme-text font-medium">Buscar e Montar Tabelas</span>.</div>`;
    document.getElementById('markdown-output').textContent = '';
    this.salvarPreferencias();
    this.analisarInput();
  },

  // ==========================================================================
  // MODALIDADES MICROSOFT (MULTI-SELEÇÃO)
  // ==========================================================================
  toggleMsModalidade(mod) {
    if (this.msModalidades.has(mod)) {
      this.msModalidades.delete(mod);
    } else {
      this.msModalidades.add(mod);
    }
    this.salvarPreferencias();
    this.atualizarUIMsModalidades();
  },

  selecionarTodasMsModalidades() {
    ['scan', 'solo', 'perpetuo', 'mpsa'].forEach(m => this.msModalidades.add(m));
    this.salvarPreferencias();
    this.atualizarUIMsModalidades();
  },

  limparMsModalidades() {
    this.msModalidades.clear();
    this.salvarPreferencias();
    this.atualizarUIMsModalidades();
  },

  obterModalidadesAtivas() {
    const todas = ['scan', 'solo', 'perpetuo', 'mpsa'];
    return this.msModalidades.size > 0
      ? todas.filter(m => this.msModalidades.has(m))
      : todas;
  },

  atualizarUIMsModalidades() {
    const todas = ['scan', 'solo', 'perpetuo', 'mpsa'];
    todas.forEach(m => {
      const btn = document.getElementById(`btn-ms-mod-${m}`);
      if (btn) btn.classList.toggle('active', this.msModalidades.has(m));
    });

    const efetivas = this.obterModalidadesAtivas();
    const hasCSP = efetivas.includes('scan') || efetivas.includes('solo');
    const hasPM = efetivas.includes('perpetuo') || efetivas.includes('mpsa');
    const hasMPSA = efetivas.includes('mpsa');

    const boxContratos = document.getElementById('ms-box-contratos');
    const flagsCSP = document.getElementById('ms-flags-csp');
    const flagsPM = document.getElementById('ms-flags-perpetuo-mpsa');
    const flagsMPSA = document.getElementById('ms-flags-mpsa');

    if (boxContratos) boxContratos.classList.toggle('hidden', !hasCSP);
    if (flagsCSP) flagsCSP.classList.toggle('hidden', !hasCSP);
    if (flagsPM) flagsPM.classList.toggle('hidden', !hasPM);
    if (flagsMPSA) flagsMPSA.classList.toggle('hidden', !hasMPSA);
  },

  // ==========================================================================
  // SEGMENTO DE MERCADO MICROSOFT (SELEÇÃO ÚNICA - 1 POR VEZ)
  // ==========================================================================
  setMsSegmento(seg) {
    this.msSegmentos = new Set([seg || 'commercial']);
    this.atualizarUIMsSegmentos();
  },

  toggleMsSegmento(seg) {
    this.setMsSegmento(seg);
  },

  resetarMsSegmentoComercial() {
    this.setMsSegmento('commercial');
  },

  atualizarUIMsSegmentos() {
    ['commercial', 'education', 'government', 'charity'].forEach(s => {
      const btn = document.getElementById(`btn-ms-seg-${s}`);
      if (btn) btn.classList.toggle('active', this.msSegmentos.has(s));
    });
  },

  // ==========================================================================
  // CONTRATOS TRIENAIS & FLAGS PERPÉTUO/MPSA ("EXIBIR...")
  // ==========================================================================
  toggleTrienaisCSP() {
    this.trienaisVisiveis = !this.trienaisVisiveis;
    const box = document.getElementById('ms-contratos-trienais');
    const btn = document.getElementById('btn-toggle-trienais');
    if (box) box.classList.toggle('hidden', !this.trienaisVisiveis);
    if (btn) btn.textContent = this.trienaisVisiveis ? '- Trienais' : '+ Trienais';
  },

  syncTempFlagsFromMaster(checked) {
    ['chk-pm-show-mensal', 'chk-pm-show-anual', 'chk-pm-show-trienal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = checked;
    });
  },

  syncMasterFromTempPills() {
    const m = document.getElementById('chk-pm-show-mensal')?.checked;
    const a = document.getElementById('chk-pm-show-anual')?.checked;
    const t = document.getElementById('chk-pm-show-trienal')?.checked;
    const master = document.getElementById('chk-pm-show-temp');
    if (master) master.checked = Boolean(m && a && t);
  },

  // ==========================================================================
  // CONTROLES ADOBE (MULTI-SELEÇÃO TEAMS & ENTERPRISE) & KASPERSKY
  // ==========================================================================
  toggleAdobeSegmento(seg) {
    if (this.adobeSegmentos.has(seg)) {
      if (this.adobeSegmentos.size > 1) {
        this.adobeSegmentos.delete(seg);
      }
    } else {
      this.adobeSegmentos.add(seg);
    }
    this.atualizarUIAdobeSegmentos();
  },

  setAdobeSegmento(seg) {
    this.toggleAdobeSegmento(seg);
  },

  selecionarTodosAdobeSegmentos() {
    this.adobeSegmentos = new Set(['teams', 'enterprise']);
    this.atualizarUIAdobeSegmentos();
  },

  obterAdobeSegmentosAtivos() {
    const ordem = ['teams', 'enterprise'];
    return this.adobeSegmentos.size > 0
      ? ordem.filter(s => this.adobeSegmentos.has(s))
      : ['teams'];
  },

  atualizarUIAdobeSegmentos() {
    const ativos = this.obterAdobeSegmentosAtivos();
    const hiddenInput = document.getElementById('adobe-segmento');
    if (hiddenInput) hiddenInput.value = ativos.join(',');

    ['teams', 'enterprise'].forEach(s => {
      const btn = document.getElementById(`btn-adobe-seg-${s}`);
      if (btn) btn.classList.toggle('active', this.adobeSegmentos.has(s));
    });
  },

  setKaspTipo(tipo) {
    document.getElementById('kasp-tipo').value = tipo;
    document.getElementById('btn-kasp-tipo-base').classList.toggle('active', tipo === 'Base');
    document.getElementById('btn-kasp-tipo-renewal').classList.toggle('active', tipo === 'Renewal');
    const labelTipo = tipo === 'Renewal' ? 'Renew' : 'Base';
    document.getElementById('resultado-container').innerHTML = `<div class="text-center py-24 text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">Tipo de licença Kaspersky alterado para <span class="theme-text font-semibold uppercase">${labelTipo}</span>.<br>Clique em <span class="theme-text font-medium">Buscar e Montar Tabelas</span> para consultar.</div>`;
    document.getElementById('markdown-output').textContent = '';
    this.analisarInput();
  },

  limparInput() {
    document.getElementById('input-itens').value = '';
    this.analisarInput();
    document.getElementById('input-itens').focus();
  },

  preencherExemplo() {
    const area = document.getElementById('input-itens');
    if (this.currentVendor === 'microsoft') {
      area.value = "business basic 10\nbusiness standard 26\nExchange plan 1 80";
    } else if (this.currentVendor === 'adobe') {
      area.value = "Illustrator 2\nphotoshop 6\nCreative Cloud Pro 3";
    } else {
      area.value = "Foundations 120";
    }
    this.analisarInput();
  },

  getAdobeAutoLevel(sum) {
    if (sum <= 9) return '1';
    if (sum <= 49) return '2';
    if (sum <= 99) return '3';
    return '4';
  },

  getKaspAutoBanda(sum) {
    if (sum <= 9) return '5-9';
    if (sum <= 14) return '10-14';
    if (sum <= 19) return '15-19';
    if (sum <= 24) return '20-24';
    if (sum <= 49) return '25-49';
    if (sum <= 99) return '50-99';
    if (sum <= 149) return '100-149';
    if (sum <= 249) return '150-249';
    if (sum <= 499) return '250-499';
    if (sum <= 999) return '500-999';
    if (sum <= 1499) return '1000-1499';
    return '1500-2499';
  },

  analisarInput() {
    const raw = document.getElementById('input-itens').value;
    const { items, sumLicenses } = window.Cotador.core.parseInputLines(raw);
    this.parsedItems = items;
    this.totalLicenses = sumLicenses;
  },

  async gerarCotacao() {
    this.analisarInput();
    if (this.parsedItems.length === 0) {
      alert('Digite pelo menos um produto na lista!');
      return;
    }

    const btn = document.getElementById('btn-buscar');
    const container = document.getElementById('resultado-container');
    btn.disabled = true;
    btn.innerHTML = '<span>Consultando SKUs em paralelo e montando propostas...</span>';
    container.innerHTML = '<div class="text-center py-20 text-slate-400 text-xs font-normal animate-pulse bg-slate-50/60 rounded-xl border border-slate-200">Consultando banco de dados corporativo...</div>';

    try {
      let missingItems = [];

      if (this.currentVendor === 'microsoft') {
        const modalidades = this.obterModalidadesAtivas();
        const contratos = [];
        if (document.getElementById('chk-anual-anual')?.checked) {
          contratos.push({ id: 'aa', label: 'Anual / Anual', scanTempo: 'Anual', scanCiclo: 'Anual', soloTermo: 'P1Y', soloPlano: 'Annual' });
        }
        if (document.getElementById('chk-anual-mensal')?.checked) {
          contratos.push({ id: 'am', label: 'Anual / Mensal', scanTempo: 'Anual', scanCiclo: 'Mensal', soloTermo: 'P1Y', soloPlano: 'Monthly' });
        }
        if (document.getElementById('chk-mensal-mensal')?.checked) {
          contratos.push({ id: 'mm', label: 'Mensal / Mensal', scanTempo: 'Mensal', scanCiclo: 'Mensal', soloTermo: 'P1M', soloPlano: 'Monthly' });
        }
        if (document.getElementById('chk-trienal-anual')?.checked) {
          contratos.push({ id: 'ta', label: 'Trienal / Anual', scanTempo: 'Trienal', scanCiclo: 'Anual', soloTermo: 'P3Y', soloPlano: 'Annual' });
        }
        if (document.getElementById('chk-trienal-mensal')?.checked) {
          contratos.push({ id: 'tm', label: 'Trienal / Mensal', scanTempo: 'Trienal', scanCiclo: 'Mensal', soloTermo: 'P3Y', soloPlano: 'Monthly' });
        }
        if (document.getElementById('chk-trienal-trienal')?.checked) {
          contratos.push({ id: 'tt', label: 'Trienal / Total', scanTempo: 'Trienal', scanCiclo: 'Trienal', soloTermo: 'P3Y', soloPlano: 'Triennial' });
        }

        const precisaCSP = modalidades.includes('scan') || modalidades.includes('solo');
        if (precisaCSP && contratos.length === 0) {
          alert('Selecione pelo menos um Contrato CSP (Vigência / Ciclo)!');
          return;
        }

        const flags = {
          contratos,
          segmentos: Array.from(this.msSegmentos).slice(0, 1),
          showNoTeams: document.getElementById('chk-show-noteams')?.checked ?? false,
          showCopilot: document.getElementById('chk-show-copilot')?.checked ?? false,
          showTrial: document.getElementById('chk-show-trial')?.checked ?? false,
          showFrontline: document.getElementById('chk-show-frontline')?.checked ?? true,
          pmShowMensal: document.getElementById('chk-pm-show-mensal')?.checked ?? false,
          pmShowAnual: document.getElementById('chk-pm-show-anual')?.checked ?? false,
          pmShowTrienal: document.getElementById('chk-pm-show-trienal')?.checked ?? false,
          pmShowStepup: document.getElementById('chk-pm-show-stepup')?.checked ?? false,
          pmShowCals: document.getElementById('chk-pm-show-cals')?.checked ?? true,
          showSA: document.getElementById('chk-mpsa-show-sa')?.checked ?? false,
          showLicSA: document.getElementById('chk-mpsa-show-licsa')?.checked ?? false,
          showLicOnly: document.getElementById('chk-mpsa-show-liconly')?.checked ?? false,
          append: true,
          returnHTML: true
        };

        // Executa todas as modalidades Microsoft em paralelo mantendo a ordem de exibição
        const resultadosMod = await Promise.all(
          modalidades.map(mod => window.Cotador.tables[`ms_${mod}`].processar(this.parsedItems, flags))
        );

        const globalMatchedIndices = new Set();
        let combinedHTML = '';
        resultadosMod.forEach(res => {
          if (res && res.html) combinedHTML += res.html;
          if (res && res.matchedItemIndices) {
            res.matchedItemIndices.forEach(idx => globalMatchedIndices.add(idx));
          }
        });

        container.innerHTML = combinedHTML;
        missingItems = this.parsedItems.filter(it => !globalMatchedIndices.has(it.itemIndex));
      } else if (this.currentVendor === 'adobe') {
        const usarPromo = document.getElementById('chk-adobe-promo').checked;
        const tabela = usarPromo ? 'adobe_promo' : 'adobe_base';
        const lvlSelect = document.getElementById('adobe-level').value;
        const segmentos = this.obterAdobeSegmentosAtivos();

        const flags = {
          segmentos,
          segmento: segmentos[0] || 'teams',
          levelSelect: lvlSelect,
          targetLevel: (lvlSelect === 'auto')
            ? (this.totalLicenses > 0 ? this.getAdobeAutoLevel(this.totalLicenses) : 'all')
            : lvlSelect,
          taxaDolar: parseFloat(document.getElementById('adobe-dolar').value) || 4.80,
          showAdobeStock: document.getElementById('chk-adobe-show-stock')?.checked ?? false,
          hide3YCommit: document.getElementById('chk-adobe-hide-3y').checked
        };
        await window.Cotador.tables[tabela].processar(this.parsedItems, flags);
      } else {
        const periodos = [];
        if (document.getElementById('chk-kasp-p1')?.checked) periodos.push({ id: '1a', label: '1 ANO', match: '1 ANO' });
        if (document.getElementById('chk-kasp-p2')?.checked) periodos.push({ id: '2a', label: '2 ANOS', match: '2 ANOS' });
        if (document.getElementById('chk-kasp-p3')?.checked) periodos.push({ id: '3a', label: '3 ANOS', match: '3 ANOS' });
        if (document.getElementById('chk-kasp-p4')?.checked) periodos.push({ id: '4a', label: '4 ANOS', match: '4 ANOS' });
        if (document.getElementById('chk-kasp-p5')?.checked) periodos.push({ id: '5a', label: '5 ANOS', match: '5 ANOS' });

        if (periodos.length === 0) {
          alert('Selecione pelo menos um período para a Kaspersky (1 a 5 Anos)!');
          return;
        }

        const bandaSelect = document.getElementById('kasp-banda')?.value || 'auto';
        const priceRevenda = document.getElementById('chk-kasp-price-revenda')?.checked ?? true;
        const priceRO = document.getElementById('chk-kasp-price-ro')?.checked ?? false;
        const priceNaoPrime = document.getElementById('chk-kasp-price-naoprime')?.checked ?? false;
        const temAlgumPreco = priceRevenda || priceRO || priceNaoPrime;

        const flags = {
          periodos,
          bandaSelect,
          targetBanda: (bandaSelect === 'auto')
            ? (this.totalLicenses > 0 ? this.getKaspAutoBanda(this.totalLicenses) : 'all')
            : bandaSelect,
          tipo: document.getElementById('kasp-tipo')?.value || 'Base',
          showPriceRevenda: temAlgumPreco ? priceRevenda : true,
          showPriceRO: priceRO,
          showPriceNaoPrime: priceNaoPrime,
          showBasePlus: document.getElementById('chk-kasp-show-baseplus')?.checked ?? false,
          showSuccessive: document.getElementById('chk-kasp-show-successive')?.checked ?? false,
          showPublic: document.getElementById('chk-kasp-show-public')?.checked ?? false
        };
        await window.Cotador.tables.kaspersky.processar(this.parsedItems, flags);
      }

      window.Cotador.core.limparBlocosVazios();
      window.Cotador.core.renderUnmatchedWarning(missingItems);
      window.Cotador.core.recalcularSubtotais();
    } catch (err) {
      container.innerHTML = `<div class="p-4 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs"><b>Erro na consulta:</b> ${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Buscar e Montar Tabelas</span>';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => window.Cotador.app.init());