// ============================================================================
// CONTROLADOR DA APLICAÇÃO (APP) - COTADOR v5.8 ENTERPRISE (js/app.js)
// ============================================================================
window.Cotador.app = {
  currentVendor: 'microsoft',
  parsedItems: [],
  totalLicenses: 0,
  msModalidades: new Set(['scan']),
  msSegmentos: new Set(['commercial']),
  adobeSegmentos: new Set(['teams']),
  adobeCambioMode: 'fixo',
  ptaxRateCache: null,
  ptaxDateCache: null,
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

    // Inicializa o câmbio Adobe travado na flag padrão (R$ 4,80)
    this.setAdobeCambioMode('fixo');

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

    window.Cotador.core.carregarDatasAtualizacao();
    this.carregarPainelPtaxHeader();
  },

  salvarPreferencias() {
    try {
      const prefs = {
        vendor: this.currentVendor,
        scanDiscount: document.getElementById('ms-scan-discount')?.value ?? '7',
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
      if (prefs.scanDiscount !== undefined && document.getElementById('ms-scan-discount')) {
        document.getElementById('ms-scan-discount').value = prefs.scanDiscount;
      }
      if (Array.isArray(prefs.msModalidades) && prefs.msModalidades.length > 0) {
        this.msModalidades = new Set([prefs.msModalidades[0] || 'scan']);
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

    window.Cotador.core.atualizarBadgeDataFabricante(vendor);

    document.getElementById('resultado-container').innerHTML = `<div class="text-center py-24 text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">Fabricante alterado para <span class="theme-text font-semibold uppercase">${vendor}</span>.<br>Insira os itens no painel esquerdo e clique em <span class="theme-text font-medium">Buscar e Montar Tabelas</span>.</div>`;
    this.salvarPreferencias();
    this.analisarInput();
  },

  // ==========================================================================
  // MODALIDADES MICROSOFT (SELEÇÃO ÚNICA - 1 POR VEZ)
  // ==========================================================================
  setMsModalidade(mod) {
    this.msModalidades = new Set([mod || 'scan']);
    this.salvarPreferencias();
    this.atualizarUIMsModalidades();
  },

  toggleMsModalidade(mod) {
    this.setMsModalidade(mod);
  },

  obterModalidadesAtivas() {
    const todas = ['scan', 'solo', 'perpetuo', 'mpsa'];
    const selecionada = Array.from(this.msModalidades).find(m => todas.includes(m));
    return [selecionada || 'scan'];
  },

  atualizarUIMsModalidades() {
    const todas = ['scan', 'solo', 'perpetuo', 'mpsa'];
    todas.forEach(m => {
      const btn = document.getElementById(`btn-ms-mod-${m}`);
      if (btn) btn.classList.toggle('active', this.msModalidades.has(m));
    });

    const efetivas = this.obterModalidadesAtivas();
    const isScan = efetivas.includes('scan');
    const hasCSP = isScan || efetivas.includes('solo');
    const hasPM = efetivas.includes('perpetuo') || efetivas.includes('mpsa');
    const hasMPSA = efetivas.includes('mpsa');

    const boxScanDiscount = document.getElementById('ms-box-scan-discount');
    const boxContratos = document.getElementById('ms-box-contratos');
    const flagsCSP = document.getElementById('ms-flags-csp');
    const flagsPM = document.getElementById('ms-flags-perpetuo-mpsa');
    const flagsMPSA = document.getElementById('ms-flags-mpsa');

    if (boxScanDiscount) boxScanDiscount.classList.toggle('hidden', !isScan);
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
  // CONTROLES ADOBE (SELEÇÃO ÚNICA - 1 POR VEZ) & KASPERSKY
  // ==========================================================================
  setAdobeSegmento(seg) {
    this.adobeSegmentos = new Set([seg || 'teams']);
    this.atualizarUIAdobeSegmentos();
  },

  toggleAdobeSegmento(seg) {
    this.setAdobeSegmento(seg);
  },

  obterAdobeSegmentosAtivos() {
    const ordem = ['teams', 'enterprise'];
    const selecionado = Array.from(this.adobeSegmentos).find(s => ordem.includes(s));
    return [selecionado || 'teams'];
  },

  atualizarUIAdobeSegmentos() {
    const ativos = this.obterAdobeSegmentosAtivos();
    const hiddenInput = document.getElementById('adobe-segmento');
    if (hiddenInput) hiddenInput.value = ativos[0];

    ['teams', 'enterprise'].forEach(s => {
      const btn = document.getElementById(`btn-adobe-seg-${s}`);
      if (btn) btn.classList.toggle('active', this.adobeSegmentos.has(s));
    });
  },

  async carregarPainelPtaxHeader() {
    const valEl = document.getElementById('header-ptax-value');
    const panelEl = document.getElementById('header-ptax-panel');
    const dotEl = document.getElementById('header-ptax-dot');
    try {
      const { rate, dateStr } = await this.obterCotacaoPtaxDia();
      const fmtCurto = `R$ ${Number(rate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const fmtCompleto = Number(rate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
      if (valEl) valEl.textContent = fmtCurto;
      if (panelEl) {
        panelEl.setAttribute('data-copy', fmtCurto);
        panelEl.title = `Dólar PTAX Oficial BCB${dateStr ? ` (${dateStr})` : ''}: R$ ${fmtCompleto} • Clique para copiar`;
      }
      if (dotEl) {
        dotEl.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0';
      }
    } catch (_) {
      if (valEl) valEl.textContent = 'Indisp.';
      if (dotEl) dotEl.className = 'w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0';
      if (panelEl) panelEl.title = 'Não foi possível consultar a API PTAX do Banco Central agora';
    }
  },

  toggleAdobeCambioMode() {
    const proximoModo = this.adobeCambioMode === 'fixo' ? 'ptax' : 'fixo';
    this.setAdobeCambioMode(proximoModo);
  },

  async setAdobeCambioMode(mode) {
    const modoEfetivo = mode === 'ptax' ? 'ptax' : 'fixo';
    this.adobeCambioMode = modoEfetivo;

    const btnToggle = document.getElementById('btn-adobe-cambio-toggle');
    const btnLabel = document.getElementById('adobe-cambio-btn-label');
    const iconLock = document.getElementById('icon-adobe-cambio-lock');
    const statusEl = document.getElementById('adobe-ptax-status');
    const inputDolar = document.getElementById('adobe-dolar');

    const aplicarEstadoFixo = (msgStatus = 'Travado') => {
      this.adobeCambioMode = 'fixo';
      if (inputDolar) inputDolar.value = '4.80';
      if (btnToggle) {
        btnToggle.classList.add('is-locked');
        btnToggle.setAttribute('aria-checked', 'true');
      }
      if (btnLabel) btnLabel.textContent = 'R$ 4,80 (Fixo)';
      if (statusEl) statusEl.textContent = msgStatus;
      if (iconLock) {
        iconLock.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>';
      }
      window.Cotador.core.atualizarCambioAdobeEmTempoReal(4.80);
    };

    if (modoEfetivo === 'fixo') {
      aplicarEstadoFixo('Travado');
      return;
    }

    // Modo PTAX (Destravado): busca cotação oficial sem permitir digitação manual
    if (btnToggle) {
      btnToggle.classList.remove('is-locked');
      btnToggle.setAttribute('aria-checked', 'false');
      btnToggle.disabled = true;
    }
    if (btnLabel) btnLabel.textContent = 'Buscando PTAX...';
    if (statusEl) statusEl.textContent = 'BCB...';

    try {
      const { rate, dateStr } = await this.obterCotacaoPtaxDia();
      const rateFixed = Number(rate).toFixed(4);
      const rateShort = Number(rate).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      if (inputDolar) inputDolar.value = rateFixed;
      if (btnLabel) btnLabel.textContent = `PTAX: R$ ${rateShort}`;
      if (statusEl) statusEl.textContent = dateStr ? `PTAX (${dateStr})` : 'PTAX Atual';
      if (iconLock) {
        // Ícone de cadeado aberto indicando que saiu da trava de 4,80 para o PTAX do dia
        iconLock.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>';
      }

      // Sincroniza também o painel visual do topo caso ainda não estivesse preenchido
      this.carregarPainelPtaxHeader();
      window.Cotador.core.atualizarCambioAdobeEmTempoReal(rate);
    } catch (err) {
      aplicarEstadoFixo('Erro PTAX • Fixo');
      window.Cotador.core.mostrarToast('Não foi possível obter o PTAX agora. Mantido R$ 4,80.');
    } finally {
      if (btnToggle) btnToggle.disabled = false;
    }
  },

  async obterCotacaoPtaxDia() {
    if (this.ptaxRateCache && this.ptaxRateCache > 0) {
      return { rate: this.ptaxRateCache, dateStr: this.ptaxDateCache };
    }

    // 1ª Tentativa: API Oficial Olinda do Banco Central do Brasil (últimos 7 dias para cobrir fins de semana/feriados)
    try {
      const hoje = new Date();
      const inicio = new Date(hoje);
      inicio.setDate(hoje.getDate() - 7);
      const fmtMDY = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
      const urlBcb = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='${fmtMDY(inicio)}'&@dataFinalCotacao='${fmtMDY(hoje)}'&$orderby=dataHoraCotacao%20desc&$top=1&$format=json`;

      const resp = await fetch(urlBcb, { cache: 'no-store' });
      if (resp.ok) {
        const json = await resp.json();
        const ultimo = json?.value?.[0];
        const cotacaoVenda = parseFloat(ultimo?.cotacaoVenda);
        if (!isNaN(cotacaoVenda) && cotacaoVenda > 0) {
          this.ptaxRateCache = cotacaoVenda;
          const rawDate = String(ultimo.dataHoraCotacao || '').split(' ')[0];
          const parts = rawDate.split('-');
          this.ptaxDateCache = parts.length === 3 ? `${parts[2]}/${parts[1]}` : '';
          return { rate: this.ptaxRateCache, dateStr: this.ptaxDateCache };
        }
      }
    } catch (_) {}

    // 2ª Tentativa (Contingência): AwesomeAPI USD-BRL
    const respFallback = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', { cache: 'no-store' });
    if (!respFallback.ok) throw new Error('Falha ao consultar PTAX');
    const dataFallback = await respFallback.json();
    const ask = parseFloat(dataFallback?.USDBRL?.ask);
    if (isNaN(ask) || ask <= 0) throw new Error('Cotação inválida');

    this.ptaxRateCache = ask;
    this.ptaxDateCache = 'Hoje';
    return { rate: ask, dateStr: 'Hoje' };
  },

  setKaspTipo(tipo) {
    document.getElementById('kasp-tipo').value = tipo;
    document.getElementById('btn-kasp-tipo-base').classList.toggle('active', tipo === 'Base');
    document.getElementById('btn-kasp-tipo-renewal').classList.toggle('active', tipo === 'Renewal');
    const labelTipo = tipo === 'Renewal' ? 'Renew' : 'Base';
    document.getElementById('resultado-container').innerHTML = `<div class="text-center py-24 text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">Tipo de licença Kaspersky alterado para <span class="theme-text font-semibold uppercase">${labelTipo}</span>.<br>Clique em <span class="theme-text font-medium">Buscar e Montar Tabelas</span> para consultar.</div>`;
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
        const resAdobe = await window.Cotador.tables[tabela].processar(this.parsedItems, flags);
        missingItems = this.parsedItems.filter(it => !resAdobe?.matchedItemIndices?.has(it.itemIndex));
      } else {
        const todosPeriodos = [
          { id: '1a', label: '1 ANO', match: '1 ANO' },
          { id: '2a', label: '2 ANOS', match: '2 ANOS' },
          { id: '3a', label: '3 ANOS', match: '3 ANOS' },
          { id: '4a', label: '4 ANOS', match: '4 ANOS' },
          { id: '5a', label: '5 ANOS', match: '5 ANOS' }
        ];
        const marcados = todosPeriodos.filter((_, idx) => document.getElementById(`chk-kasp-p${idx + 1}`)?.checked);
        const periodos = marcados.length > 0 ? marcados : todosPeriodos;

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
          showPublic: document.getElementById('chk-kasp-show-public')?.checked ?? false,
          showTraining: document.getElementById('chk-kasp-show-training')?.checked ?? false
        };
        const resKasp = await window.Cotador.tables.kaspersky.processar(this.parsedItems, flags);
        missingItems = this.parsedItems.filter(it => !resKasp?.matchedItemIndices?.has(it.itemIndex));
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