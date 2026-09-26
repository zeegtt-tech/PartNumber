// ============================================================================
// CONTROLADOR DA APLICACAO (APP) - COTADOR v5.6 ENTERPRISE (js/app.js)
// ============================================================================
window.Cotador.app = {
  currentVendor: 'microsoft',
  parsedItems: [],
  totalLicenses: 0,
  msModalidades: new Set(['scan']),
  msSegmentos: new Set(['commercial']),
  trienaisVisiveis: false,

  init() {
    document.getElementById('input-itens').addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.gerarCotacao();
      }
    });
    this.atualizarUIMsModalidades();
    this.atualizarUIMsSegmentos();
    this.preencherExemplo();
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
    this.analisarInput();
  },

  // ==========================================================================
  // MODALIDADES MICROSOFT (MULTI-SELECAO v5.6)
  // ==========================================================================
  toggleMsModalidade(mod) {
    if (this.msModalidades.has(mod)) {
      this.msModalidades.delete(mod);
    } else {
      this.msModalidades.add(mod);
    }
    this.atualizarUIMsModalidades();
  },

  selecionarTodasMsModalidades() {
    ['scan', 'solo', 'perpetuo', 'mpsa'].forEach(m => this.msModalidades.add(m));
    this.atualizarUIMsModalidades();
  },

  limparMsModalidades() {
    this.msModalidades.clear();
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
  // SEGMENTOS DE MERCADO MICROSOFT (v5.6)
  // ==========================================================================
  toggleMsSegmento(seg) {
    if (this.msSegmentos.has(seg)) {
      this.msSegmentos.delete(seg);
      if (this.msSegmentos.size === 0) this.msSegmentos.add('commercial');
    } else {
      this.msSegmentos.add(seg);
    }
    this.atualizarUIMsSegmentos();
  },

  resetarMsSegmentoComercial() {
    this.msSegmentos = new Set(['commercial']);
    this.atualizarUIMsSegmentos();
  },

  selecionarTodosMsSegmentos() {
    this.msSegmentos = new Set(['commercial', 'education', 'government', 'charity']);
    this.atualizarUIMsSegmentos();
  },

  atualizarUIMsSegmentos() {
    ['commercial', 'education', 'government', 'charity'].forEach(s => {
      const btn = document.getElementById(`btn-ms-seg-${s}`);
      if (btn) btn.classList.toggle('active', this.msSegmentos.has(s));
    });
  },

  // ==========================================================================
  // CONTRATOS TRIENAIS & FLAGS PERPETUO/MPSA (v5.6)
  // ==========================================================================
  toggleTrienaisCSP() {
    this.trienaisVisiveis = !this.trienaisVisiveis;
    const box = document.getElementById('ms-contratos-trienais');
    const btn = document.getElementById('btn-toggle-trienais');
    if (box) box.classList.toggle('hidden', !this.trienaisVisiveis);
    if (btn) btn.textContent = this.trienaisVisiveis ? '- Trienais' : '+ Trienais';
  },

  syncTempFlagsFromMaster(checked) {
    ['chk-pm-hide-mensal', 'chk-pm-hide-anual', 'chk-pm-hide-trienal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = checked;
    });
  },

  syncMasterFromTempPills() {
    const m = document.getElementById('chk-pm-hide-mensal')?.checked;
    const a = document.getElementById('chk-pm-hide-anual')?.checked;
    const t = document.getElementById('chk-pm-hide-trienal')?.checked;
    const master = document.getElementById('chk-pm-hide-temp');
    if (master) master.checked = Boolean(m && a && t);
  },

  // ==========================================================================
  // CONTROLES ADOBE & KASPERSKY
  // ==========================================================================
  setAdobeSegmento(seg) {
    document.getElementById('adobe-segmento').value = seg;
    ['teams', 'enterprise'].forEach(s => {
      const btn = document.getElementById(`btn-adobe-seg-${s}`);
      if (btn) btn.classList.toggle('active', s === seg);
    });
    const labelSeg = seg === 'enterprise' ? 'For Enterprise' : 'For Teams';
    document.getElementById('resultado-container').innerHTML = `<div class="text-center py-24 text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">Segmento Adobe alterado para <span class="theme-text font-semibold uppercase">${labelSeg}</span>.<br>Clique em <span class="theme-text font-medium">Buscar e Montar Tabelas</span> para consultar.</div>`;
    document.getElementById('markdown-output').textContent = '';
    this.analisarInput();
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
    btn.innerHTML = '<span>Consultando SKUs e montando propostas...</span>';
    container.innerHTML = '<div class="text-center py-20 text-slate-400 text-xs font-normal animate-pulse bg-slate-50/60 rounded-xl border border-slate-200">Consultando banco de dados corporativo...</div>';

    try {
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
          segmentos: Array.from(this.msSegmentos),
          hideNoTeams: document.getElementById('chk-hide-noteams')?.checked ?? true,
          hideCopilot: document.getElementById('chk-hide-copilot')?.checked ?? true,
          hideTrial: document.getElementById('chk-hide-trial')?.checked ?? true,
          hideFrontline: document.getElementById('chk-hide-frontline')?.checked ?? false,
          pmHideMensal: document.getElementById('chk-pm-hide-mensal')?.checked ?? false,
          pmHideAnual: document.getElementById('chk-pm-hide-anual')?.checked ?? false,
          pmHideTrienal: document.getElementById('chk-pm-hide-trienal')?.checked ?? false,
          pmHideStepup: document.getElementById('chk-pm-hide-stepup')?.checked ?? true,
          pmHideCals: document.getElementById('chk-pm-hide-cals')?.checked ?? false,
          hideSA: document.getElementById('chk-mpsa-hide-sa')?.checked ?? true,
          hideLicSA: document.getElementById('chk-mpsa-hide-licsa')?.checked ?? false,
          hideLicOnly: document.getElementById('chk-mpsa-hide-liconly')?.checked ?? false,
          append: true
        };

        container.innerHTML = '';
        for (const mod of modalidades) {
          await window.Cotador.tables[`ms_${mod}`].processar(this.parsedItems, flags);
        }

      } else if (this.currentVendor === 'adobe') {
        const usarPromo = document.getElementById('chk-adobe-promo').checked;
        const tabela = usarPromo ? 'adobe_promo' : 'adobe_base';
        const lvlSelect = document.getElementById('adobe-level').value;
        const flags = {
          segmento: document.getElementById('adobe-segmento').value || 'teams',
          targetLevel: (lvlSelect === 'auto') ? this.getAdobeAutoLevel(this.totalLicenses) : lvlSelect,
          taxaDolar: parseFloat(document.getElementById('adobe-dolar').value) || 4.80,
          hide3YCommit: document.getElementById('chk-adobe-hide-3y').checked
        };
        await window.Cotador.tables[tabela].processar(this.parsedItems, flags);

      } else {
        const periodos = [];
        if (document.getElementById('chk-kasp-p1').checked) periodos.push({ id: '1a', label: '1 ANO', match: '1 ANO' });
        if (document.getElementById('chk-kasp-p2').checked) periodos.push({ id: '2a', label: '2 ANOS', match: '2 ANOS' });
        if (document.getElementById('chk-kasp-p3').checked) periodos.push({ id: '3a', label: '3 ANOS', match: '3 ANOS' });
        if (document.getElementById('chk-kasp-p4').checked) periodos.push({ id: '4a', label: '4 ANOS', match: '4 ANOS' });
        if (document.getElementById('chk-kasp-p5').checked) periodos.push({ id: '5a', label: '5 ANOS', match: '5 ANOS' });

        if (periodos.length === 0) {
          alert('Selecione pelo menos um período para a Kaspersky (1 a 5 Anos)!');
          return;
        }

        const bandaSelect = document.getElementById('kasp-banda').value;
        const roMode = document.getElementById('kasp-ro-mode').value;

        const flags = {
          periodos,
          targetBanda: (bandaSelect === 'auto') ? this.getKaspAutoBanda(this.totalLicenses) : bandaSelect,
          edrFilter: document.getElementById('kasp-edr-filter').value,
          tipo: document.getElementById('kasp-tipo').value || 'Base',
          mostrarRO: roMode === 'always' || (roMode === 'auto' && this.totalLicenses >= 100),
          ignoreSuccessive: document.getElementById('chk-kasp-ignore-successive').checked,
          ignorePublic: document.getElementById('chk-kasp-ignore-public').checked
        };
        await window.Cotador.tables.kaspersky.processar(this.parsedItems, flags);
      }

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