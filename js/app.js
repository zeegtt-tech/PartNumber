// ============================================================================
// CONTROLADOR DA APLICAÇÃO (APP) - COTADOR v5.9
// ============================================================================

window.Cotador.app = {
  currentVendor: 'microsoft',
  parsedItems: [],
  totalLicenses: 0,
  msModalidades: new Set(['scan']),
  msSegmentos: new Set(['commercial']),
  adobeSegmentos: new Set(['teams']),
  adobeModelo: 'base',
  adobeCambioMode: 'fixo',
  ptaxRateCache: null,
  ptaxDateCache: null,
  trienaisVisiveis: false,
  STORAGE_KEY: 'cotador_enterprise_prefs_v59',
  LEGACY_STORAGE_KEYS: [
    'cotador_enterprise_prefs',
    'cotador_enterprise_prefs_v56',
    'cotador_enterprise_prefs_v57',
    'cotador_enterprise_prefs_v58'
  ],

  VENDOR_PLACEHOLDERS: {
    microsoft: "Ex:\nbusiness basic 10\nbusiness standard 26\nExchange plan 1 80",
    adobe: "Ex:\nCreative Cloud 5\nAdobe Acrobat Pro 12\nIllustrator 3",
    kaspersky: "Ex:\nEDR Optimum 50\nNext EDR Foundations 30"
  },

  atualizarPlaceholderFabricante(vendor) {
    const inputItens = document.getElementById('input-itens');
    if (!inputItens) return;
    inputItens.placeholder = this.VENDOR_PLACEHOLDERS[vendor] || this.VENDOR_PLACEHOLDERS.microsoft;
  },

  sanitizarCacheEEstadoInicial() {
    try {
      this.LEGACY_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
    } catch (_) {}
    
    const flagsResetFalse = [
      'chk-show-copilot', 'chk-show-trial', 'chk-show-frontline',
      'chk-ms-show-phone', 'chk-ms-show-dynamics', 'chk-ms-show-win365', 'chk-ms-show-niche',
      'chk-ms-show-extconnector', 'chk-ms-show-azurecloud', 'chk-pm-show-temp',
      'chk-pm-show-mensal', 'chk-pm-show-anual', 'chk-pm-show-trienal', 'chk-pm-show-stepup',
      'chk-mpsa-show-sa', 'chk-mpsa-show-licsa',
      'chk-adobe-show-stock', 'chk-adobe-show-3y', 'chk-adobe-show-frl',
      'chk-adobe-show-pack', 'chk-adobe-show-renewal', 'chk-adobe-show-upgrade',
      'chk-kasp-show-baseplus', 'chk-kasp-show-successive', 'chk-kasp-show-public',
      'chk-kasp-show-training', 'chk-kasp-show-crossgrade', 'chk-kasp-show-educ',
      'chk-kasp-show-xdr', 'chk-kasp-show-noedr'
    ];
    flagsResetFalse.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = false;
    });

    const chkPmCals = document.getElementById('chk-pm-show-cals');
    if (chkPmCals) chkPmCals.checked = true;
    
    this.resetarVisualGavetas();
  },

  reexecutarSeHouverItens() {
    this.analisarInput();
    if (this.parsedItems.length > 0) {
      this.gerarCotacao();
    }
  },

  // Mantido para compatibilidade caso o HTML antigo seja clicado
  aoAlterarFlagsMicrosoft() {
    this.reexecutarSeHouverItens();
  },

  aoAlterarFlagsGlobal() {
    this.reexecutarSeHouverItens();
  },

  resetarVisualGavetas() {
    this.aplicarFiltrosDinamicosGlobal(null, 'ms-drawer-secundarios', 'badge-ms-flags-count', [
      'chk-show-frontline', 'chk-show-noteams', 'chk-show-copilot', 'chk-show-trial',
      'chk-ms-show-phone', 'chk-ms-show-dynamics', 'chk-ms-show-win365', 'chk-ms-show-niche',
      'chk-ms-show-extconnector', 'chk-ms-show-azurecloud'
    ]);
    this.aplicarFiltrosDinamicosGlobal(null, 'adobe-drawer-secundarios', 'badge-adobe-flags-count', [
      'chk-adobe-show-stock', 'chk-adobe-show-3y', 'chk-adobe-show-frl', 
      'chk-adobe-show-pack', 'chk-adobe-show-renewal', 'chk-adobe-show-upgrade'
    ]);
    this.aplicarFiltrosDinamicosGlobal(null, 'kaspersky-drawer-secundarios', 'badge-kasp-flags-count', [
      'chk-kasp-show-baseplus', 'chk-kasp-show-successive', 'chk-kasp-show-public', 
      'chk-kasp-show-training', 'chk-kasp-show-crossgrade', 'chk-kasp-show-educ'
    ]);
  },

  aplicarFiltrosDinamicosGlobal(facetTracker, drawerId, badgeId, idsSecundarios) {
    const drawer = document.getElementById(drawerId);
    const badge = document.getElementById(badgeId);

    let totalDisponiveis = 0;
    let totalAtivos = 0;

    idsSecundarios.forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;
      const labelPill = input.closest('label.flag-mini-pill');
      const spanText = labelPill?.querySelector('span');
      if (!labelPill || !spanText) return;

      if (!spanText.dataset.baseLabel) {
        spanText.dataset.baseLabel = spanText.textContent.trim();
      }
      const baseLabel = spanText.dataset.baseLabel;

      if (!facetTracker) {
        labelPill.classList.remove('hidden');
        spanText.textContent = baseLabel;
        return;
      }

      const count = facetTracker[id] || 0;
      const isChecked = input.checked;

      if (count > 0 || isChecked) {
        labelPill.classList.remove('hidden');
        spanText.textContent = count > 0 ? `${baseLabel} (${count})` : baseLabel;
        totalDisponiveis++;
        if (isChecked) totalAtivos++;
      } else {
        labelPill.classList.add('hidden');
      }
    });

    if (drawer) {
      drawer.querySelectorAll('.grid').forEach(grid => {
        const temVisivel = grid.querySelector('label.flag-mini-pill:not(.hidden)') !== null;
        if (grid.parentElement.tagName === 'DIV') {
          // Evita reexibir as categorias principais que a modalidade já ocultou
          if (!grid.parentElement.id.startsWith('ms-flags-')) {
            grid.parentElement.classList.toggle('hidden', !temVisivel);
          }
        }
      });

      // Linha removida para manter a gaveta sempre aberta por padrão (só fecha se o usuário clicar)

      // NOVO CÓDIGO: Ocultar o box inteiro (wrapper) quando a busca for "Limpa" (0 opções aplicáveis)
      const wrapper = drawer.closest('div[id$="-box-flags"]') || drawer.parentElement;
      if (wrapper) {
        const modAtivas = this.obterModalidadesAtivas();
        const isMsPerpetuoOuMpsa = drawerId === 'ms-drawer-secundarios' && (modAtivas.includes('perpetuo') || modAtivas.includes('mpsa'));
        if (facetTracker && totalDisponiveis === 0 && !isMsPerpetuoOuMpsa) {
          wrapper.classList.add('hidden');
        } else {
          wrapper.classList.remove('hidden');
        }
      }
    }

    if (badge) {
      if (totalAtivos > 0) {
        badge.textContent = `${totalAtivos} ativo${totalAtivos > 1 ? 's' : ''}`;
        badge.className = 'px-1.5 py-0.2 rounded-full bg-[#eff6fc] border border-[#0078d4] text-[9px] font-semibold text-[#0078d4]';
      } else if (facetTracker && totalDisponiveis > 0) {
        badge.textContent = `${totalDisponiveis} opç${totalDisponiveis > 1 ? 'ões' : 'ão'} na busca`;
        badge.className = 'px-1.5 py-0.2 rounded-full bg-amber-50 border border-amber-300 text-[9px] font-semibold text-amber-800';
      } else {
        badge.textContent = 'Busca Limpa';
        badge.className = 'px-1.5 py-0.2 rounded-full bg-white border border-[#c8c6c4] text-[9px] font-normal text-[#605e5c]';
      }
    }
  },

  init() {
    this.sanitizarCacheEEstadoInicial();
    window.Cotador.core.injetarControlesComerciaisHeader();
    const inputItens = document.getElementById('input-itens');
    
    if (inputItens) {
      inputItens.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          e.target.blur(); // Remove o foco do input para evitar o salto de seleção
          this.gerarCotacao();
        }
      });
    }

    this.setAdobeCambioMode('fixo');
    const chkMpsaLicOnly = document.getElementById('chk-mpsa-show-liconly');
    if (chkMpsaLicOnly) chkMpsaLicOnly.checked = true;

    this.carregarPreferencias();
    this.atualizarPlaceholderFabricante(this.currentVendor);
    this.atualizarUIMsModalidades();
    this.atualizarUIMsSegmentos();
    this.atualizarUIAdobeSegmentos();
    
    if (inputItens && inputItens.value.trim()) {
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
        msModalidades: Array.from(this.msModalidades),
        calcMode: window.Cotador.core.calcMode || 'margin',
        soloPnPrefix: document.getElementById('ms-solo-prefix')?.value || '',
        soloPnSuffix: document.getElementById('ms-solo-suffix')?.value || ''
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
        const scanCheck = document.getElementById('chk-scan-discount');
        if (scanCheck) scanCheck.checked = (Number(prefs.scanDiscount) > 0);
      }
      if (Array.isArray(prefs.msModalidades) && prefs.msModalidades.length > 0) {
        this.msModalidades = new Set([prefs.msModalidades[0] || 'scan']);
      }
      if (prefs.calcMode && window.Cotador.core.setCalcMode) {
        window.Cotador.core.setCalcMode(prefs.calcMode);
      }
      if (prefs.soloPnPrefix !== undefined && typeof this.setSoloPnPrefix === 'function') {
        this.setSoloPnPrefix(prefs.soloPnPrefix);
      }
      if (prefs.soloPnSuffix !== undefined && typeof this.setSoloPnSuffix === 'function') {
        this.setSoloPnSuffix(prefs.soloPnSuffix);
      }
    } catch (_) {}
  },

  limparOutputPorSeguranca(motivo, valor) {
    const container = document.getElementById('resultado-container');
    if (container) {
      container.innerHTML = `
        <div class="text-center py-24 text-gray-500 text-xs bg-[#faf9f8] rounded border border-dashed border-[#c8c6c4] flex flex-col items-center justify-center gap-3">
          <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
          <div>
            ${motivo} alterado para <span class="theme-text font-semibold uppercase">${valor}</span>.<br>
            <span class="text-[#a4262c] font-medium">Os resultados anteriores foram limpos para evitar confusão entre ofertas.</span>
          </div>
          <button onclick="Cotador.app.gerarCotacao()" class="mt-2 text-[11px] px-3 py-1.5 rounded bg-white hover:bg-[#edebe9] text-[#323130] border border-[#edebe9] font-semibold transition shadow-sm">
            Buscar Novamente
          </button>
        </div>`;
    }
  },

  setVendor(vendor) {
    if (this.currentVendor === vendor) return;
    window.Cotador.core.cancelarBuscasEmAndamento();
    this.currentVendor = vendor;
    document.body.setAttribute('data-vendor', vendor);
    
    ['microsoft', 'adobe', 'kaspersky'].forEach(v => {
      document.getElementById(`btn-vendor-${v}`).classList.toggle('active', v === vendor);
      document.getElementById(`filtros-${v}`).classList.toggle('hidden', v !== vendor);
    });
    
    this.atualizarPlaceholderFabricante(vendor);
    window.Cotador.core.atualizarBadgeDataFabricante(vendor);
    this.limparOutputPorSeguranca('Fabricante', vendor);
    
    this.salvarPreferencias();
    this.analisarInput();
  },

  setMsModalidade(mod) {
    if (this.msModalidades.has(mod)) return;
    this.msModalidades = new Set([mod || 'scan']);
    this.salvarPreferencias();
    this.atualizarUIMsModalidades();
    this.analisarInput();
    if (this.parsedItems.length > 0) {
      this.gerarCotacao();
    } else {
      this.limparOutputPorSeguranca('Modo de Tabela', mod);
    }
  },

  toggleMsModalidade(mod) {
    this.setMsModalidade(mod);
  },

  setSoloPnPrefix(prefix) {
    const input = document.getElementById('ms-solo-prefix');
    if (input) input.value = prefix || '';
    ['none', 'SN', 'FC', 'PC', 'SP'].forEach(k => {
      const id = k === 'none' ? 'btn-solo-pfx-none' : `btn-solo-pfx-${k}`;
      const matchVal = k === 'none' ? '' : `${k}-SN-NCE-`;
      const isMatch = (k === 'SN' && prefix === 'SN-NCE-') || (prefix === matchVal);
      document.getElementById(id)?.classList.toggle('active', isMatch);
    });
    window.Cotador.core.atualizarModificadoresPnSoloEmTempoReal();
  },
  setSoloPnSuffix(suffix) {
    const input = document.getElementById('ms-solo-suffix');
    if (input) input.value = suffix || '';
    ['none', 'BSC', 'STD', 'PRM'].forEach(k => {
      const id = k === 'none' ? 'btn-solo-sfx-none' : `btn-solo-sfx-${k}`;
      const matchVal = k === 'none' ? '' : `-${k}`;
      document.getElementById(id)?.classList.toggle('active', suffix === matchVal);
    });
    window.Cotador.core.atualizarModificadoresPnSoloEmTempoReal();
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
    const isSolo = efetivas.includes('solo');
    const hasCSP = isScan || isSolo;
    const hasPM = efetivas.includes('perpetuo') || efetivas.includes('mpsa');
    const hasMPSA = efetivas.includes('mpsa');

    const boxScanDiscount = document.getElementById('ms-box-scan-discount');
    const boxSoloService = document.getElementById('ms-box-solo-service');
    const boxSoloModifiers = document.getElementById('ms-box-solo-modifiers');
    const boxContratos = document.getElementById('ms-box-contratos');
    const flagsCSP = document.getElementById('ms-flags-csp');
    const flagsPM = document.getElementById('ms-flags-perpetuo-mpsa');
    const flagsMPSA = document.getElementById('ms-flags-mpsa');
    const boxFlags = document.getElementById('ms-box-flags');
    if (boxFlags && hasPM) boxFlags.classList.remove('hidden');
    if (boxScanDiscount) boxScanDiscount.classList.toggle('hidden', !isScan);
    if (boxSoloService) boxSoloService.classList.toggle('hidden', !isSolo);
    if (boxSoloModifiers) boxSoloModifiers.classList.toggle('hidden', !isSolo);
    if (boxContratos) boxContratos.classList.toggle('hidden', !hasCSP);
    if (flagsCSP) flagsCSP.classList.toggle('hidden', !hasCSP);
    if (flagsPM) flagsPM.classList.toggle('hidden', !hasPM);
    if (flagsMPSA) flagsMPSA.classList.toggle('hidden', !hasMPSA);
  },

  setMsSegmento(seg) {
    if (this.msSegmentos.has(seg)) return;
    this.msSegmentos = new Set([seg || 'commercial']);
    this.atualizarUIMsSegmentos();
    this.analisarInput();
    if (this.parsedItems.length > 0) {
      this.gerarCotacao();
    } else {
      this.limparOutputPorSeguranca('Segmento de Mercado', seg);
    }
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

  setAdobeModelo(mod) {
    if (this.adobeModelo === mod) return;
    this.adobeModelo = mod || 'base';
    const hiddenInput = document.getElementById('adobe-modelo');
    if (hiddenInput) hiddenInput.value = this.adobeModelo;
    ['base', 'gov', 'edu'].forEach(m => {
      const btn = document.getElementById(`btn-adobe-mod-${m}`);
      if (btn) btn.classList.toggle('active', this.adobeModelo === m);
    });
    this.analisarInput();
    if (this.parsedItems.length > 0) {
      this.gerarCotacao();
    } else {
      this.limparOutputPorSeguranca('Modelo Adobe', mod);
    }
  },
  setAdobeSegmento(seg) {
    if (this.adobeSegmentos.has(seg)) return;
    this.adobeSegmentos = new Set([seg || 'teams']);
    this.atualizarUIAdobeSegmentos();
    this.analisarInput();
    if (this.parsedItems.length > 0) {
      this.gerarCotacao();
    } else {
      this.limparOutputPorSeguranca('Vers o Adobe', seg);
    }
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
        panelEl.title = `Dólar PTAX Oficial BCB${dateStr ? ` (${dateStr})` : ''}: R$ ${fmtCompleto} — Clique para copiar`;
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
        iconLock.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>';
      }
      
      this.carregarPainelPtaxHeader();
      window.Cotador.core.atualizarCambioAdobeEmTempoReal(rate);
      
    } catch (err) {
      aplicarEstadoFixo('Erro PTAX — Fixo');
      window.Cotador.core.mostrarToast('Não foi possível obter o PTAX agora. Mantido R$ 4,80.');
    } finally {
      if (btnToggle) btnToggle.disabled = false;
    }
  },

  async obterCotacaoPtaxDia() {
    if (this.ptaxRateCache && this.ptaxRateCache > 0) {
      return { rate: this.ptaxRateCache, dateStr: this.ptaxDateCache };
    }

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
    const kaspTipoEl = document.getElementById('kasp-tipo');
    if (!kaspTipoEl) return;
    
    const currentTipo = kaspTipoEl.value;
    if (currentTipo === tipo) return;

    kaspTipoEl.value = tipo;
    document.getElementById('btn-kasp-tipo-base')?.classList.toggle('active', tipo === 'Base');
    document.getElementById('btn-kasp-tipo-renewal')?.classList.toggle('active', tipo === 'Renewal');

  this.analisarInput();
    if (this.parsedItems.length > 0) {
      this.gerarCotacao();
    } else {
      this.limparOutputPorSeguranca('Tipo de Licença Kaspersky', tipo === 'Renewal' ? 'Renew' : 'Base');
    }
  },

  limparInput() {
    const inputEl = document.getElementById('input-itens');
    if (inputEl) inputEl.value = '';
    
    this.analisarInput();
    this.resetarVisualGavetas();
    
    const container = document.getElementById('resultado-container');
    if (container) {
      container.innerHTML = `
        <div class="text-center py-24 text-gray-500 text-xs bg-[#faf9f8] rounded border border-dashed border-[#c8c6c4]">
          Cole os produtos no painel esquerdo e clique em <span class="theme-text font-semibold">Buscar e Montar Tabelas</span>.
        </div>`;
    }
    if (inputEl) inputEl.focus();
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
  _analisarTimer: null,
  analisarInputDebounced() {
    clearTimeout(this._analisarTimer);
    this._analisarTimer = setTimeout(() => {
      this.analisarInput();
      const el = document.getElementById('input-itens');
      if (el) {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 350) + 'px';
      }
    }, 250);
  },
  analisarInput() {
    const inputEl = document.getElementById('input-itens');
    if (!inputEl) return;
    const raw = inputEl.value;
    const { items, sumLicenses } = window.Cotador.core.parseInputLines(raw);
    this.parsedItems = items;
    this.totalLicenses = sumLicenses;
    
    const feedbackEl = document.getElementById('input-feedback');
    if (feedbackEl) {
      if (items.length > 0) {
        feedbackEl.textContent = items.length === 1 ? '1 Item' : `${items.length} Itens`;
        feedbackEl.classList.remove('hidden');
      } else {
        feedbackEl.classList.add('hidden');
      }
    }
  },

  async gerarCotacao() {
    this.analisarInput();
    
    if (this.parsedItems.length === 0) {
      this.resetarVisualGavetas();
      const container = document.getElementById('resultado-container');
      if (container) {
        container.innerHTML = `
          <div class="text-center py-24 text-gray-500 text-xs bg-[#faf9f8] rounded border border-dashed border-[#c8c6c4]">
            Cole os produtos no painel esquerdo e clique em <span class="theme-text font-semibold">Buscar e Montar Tabelas</span>.
          </div>`;
      }
      window.Cotador.core.cancelarBuscasEmAndamento();
      
      const btn = document.getElementById('btn-buscar');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>Buscar e Montar Tabelas</span>';
      }
      return;
    }

    let modalidadesMs = [];
    let contratosMs = [];

    if (this.currentVendor === 'microsoft') {
      modalidadesMs = this.obterModalidadesAtivas();
      
      if (document.getElementById('chk-anual-anual')?.checked) {
        contratosMs.push({ id: 'aa', label: 'Anual / Anual', scanTempo: 'Anual', scanCiclo: 'Anual', soloTermo: 'P1Y', soloPlano: 'Annual' });
      }
      if (document.getElementById('chk-anual-mensal')?.checked) {
        contratosMs.push({ id: 'am', label: 'Anual / Mensal', scanTempo: 'Anual', scanCiclo: 'Mensal', soloTermo: 'P1Y', soloPlano: 'Monthly' });
      }
      if (document.getElementById('chk-mensal-mensal')?.checked) {
        contratosMs.push({ id: 'mm', label: 'Mensal / Mensal', scanTempo: 'Mensal', scanCiclo: 'Mensal', soloTermo: 'P1M', soloPlano: 'Monthly' });
      }
      if (document.getElementById('chk-trienal-anual')?.checked) {
        contratosMs.push({ id: 'ta', label: 'Trienal / Anual', scanTempo: 'Trienal', scanCiclo: 'Anual', soloTermo: 'P3Y', soloPlano: 'Annual' });
      }
      if (document.getElementById('chk-trienal-mensal')?.checked) {
        contratosMs.push({ id: 'tm', label: 'Trienal / Mensal', scanTempo: 'Trienal', scanCiclo: 'Mensal', soloTermo: 'P3Y', soloPlano: 'Monthly' });
      }
      if (document.getElementById('chk-trienal-trienal')?.checked) {
        contratosMs.push({ id: 'tt', label: 'Trienal / Total', scanTempo: 'Trienal', scanCiclo: 'Trienal', soloTermo: 'P3Y', soloPlano: 'Triennial' });
      }

      const precisaCSP = modalidadesMs.includes('scan') || modalidadesMs.includes('solo');
      if (precisaCSP && contratosMs.length === 0) {
        alert('Selecione pelo menos um Contrato CSP (Vigência / Ciclo)!');
        return;
      }
    }

    const searchSignal = window.Cotador.core.iniciarNovaSessaoBusca();

    const btn = document.getElementById('btn-buscar');
    const container = document.getElementById('resultado-container');

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Consultando SKUs em paralelo e montando propostas...</span>';
    }
    if (container) {
      container.innerHTML = '<div class="text-center py-20 text-gray-500 text-xs font-normal animate-pulse bg-[#faf9f8] rounded border border-[#edebe9]">Consultando banco de dados corporativo...</div>';
    }

    try {
      let missingItems = [];

      if (this.currentVendor === 'microsoft') {
        const modalidades = modalidadesMs;
        const contratos = contratosMs;
        const facetTracker = {};
        const flags = {
          contratos,
          facetTracker, 
          segmentos: Array.from(this.msSegmentos).slice(0, 1),
          showNoTeams: document.getElementById('chk-show-noteams')?.checked ?? false,
          showCopilot: document.getElementById('chk-show-copilot')?.checked ?? false,
          showTrial: document.getElementById('chk-show-trial')?.checked ?? false,
          showFrontline: document.getElementById('chk-show-frontline')?.checked ?? false,
          showPhone: document.getElementById('chk-ms-show-phone')?.checked ?? false,
          showDynamics: document.getElementById('chk-ms-show-dynamics')?.checked ?? false,
          showWin365: document.getElementById('chk-ms-show-win365')?.checked ?? false,
          showNiche: document.getElementById('chk-ms-show-niche')?.checked ?? false,
          showExtConnector: document.getElementById('chk-ms-show-extconnector')?.checked ?? false,
          showAzureCloud: document.getElementById('chk-ms-show-azurecloud')?.checked ?? false,
          pmShowTemp: document.getElementById('chk-pm-show-temp')?.checked ?? false,
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
          modalidades.map(mod => window.Cotador.tables[`ms_${mod}`]?.processar(this.parsedItems, flags))
        );

        this.aplicarFiltrosDinamicosGlobal(facetTracker, 'ms-drawer-secundarios', 'badge-ms-flags-count', [
          'chk-show-frontline', 'chk-show-noteams', 'chk-show-copilot', 'chk-show-trial',
          'chk-ms-show-phone', 'chk-ms-show-dynamics', 'chk-ms-show-win365', 'chk-ms-show-niche',
          'chk-ms-show-extconnector', 'chk-ms-show-azurecloud'
        ]);

        const globalMatchedIndices = new Set();
        let combinedHTML = '';
        resultadosMod.forEach(res => {
          if (res && res.html) combinedHTML += res.html;
          if (res && res.matchedItemIndices) {
            res.matchedItemIndices.forEach(idx => globalMatchedIndices.add(idx));
          }
        });

        if (container) container.innerHTML = combinedHTML;
        missingItems = this.parsedItems.filter(it => !globalMatchedIndices.has(it.itemIndex));

      } else if (this.currentVendor === 'adobe') {
        const modelo = this.adobeModelo || 'base';
        const segmentos = this.obterAdobeSegmentosAtivos();
        const seg = segmentos[0] || 'teams';
        
        let tabela = 'adobe_base';
        if (modelo === 'edu') tabela = 'adobe_edu';
        else if (modelo === 'gov') tabela = 'adobe_gov';
        
        const lvlSelect = document.getElementById('adobe-level')?.value || 'auto';
        
        const facetTracker = {};
        const flags = {
          facetTracker,
          segmentos,
          segmento: segmentos[0] || 'teams',
          levelSelect: lvlSelect,
          targetLevel: (lvlSelect === 'auto')
             ? (this.totalLicenses > 0 ? this.getAdobeAutoLevel(this.totalLicenses) : '1')
             : lvlSelect,
          mesesProRata: parseInt(document.getElementById('adobe-meses')?.value) || 12,
          taxaDolar: parseFloat(document.getElementById('adobe-dolar')?.value) || 4.80,
          showAdobeStock: document.getElementById('chk-adobe-show-stock')?.checked ?? false,
          show3Y: document.getElementById('chk-adobe-show-3y')?.checked ?? false,
          showFRL: document.getElementById('chk-adobe-show-frl')?.checked ?? false,
          showPack: document.getElementById('chk-adobe-show-pack')?.checked ?? false,
          showRenewal: document.getElementById('chk-adobe-show-renewal')?.checked ?? false,
          showUpgrade: document.getElementById('chk-adobe-show-upgrade')?.checked ?? false
        };
        
        // Proteção contra erro de tabela não carregada
        if (!window.Cotador.tables[tabela]) {
          console.warn(`Tabela ${tabela} não encontrada. Recaindo para adobe_base`);
          tabela = 'adobe_base';
        }
        
        const resAdobe = await window.Cotador.tables[tabela]?.processar(this.parsedItems, flags);
        missingItems = this.parsedItems.filter(it => !resAdobe?.matchedItemIndices?.has(it.itemIndex));

        this.aplicarFiltrosDinamicosGlobal(facetTracker, 'adobe-drawer-secundarios', 'badge-adobe-flags-count', [
          'chk-adobe-show-stock', 'chk-adobe-show-3y', 'chk-adobe-show-frl', 'chk-adobe-show-pack', 'chk-adobe-show-renewal', 'chk-adobe-show-upgrade'
        ]);

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

        const facetTracker = {};
        const flags = {
          facetTracker,
          periodos,
          bandaSelect,
          targetBanda: (bandaSelect === 'auto') 
            ? (this.totalLicenses > 0 ? this.getKaspAutoBanda(this.totalLicenses) : '5-9') 
            : bandaSelect,
          tipo: document.getElementById('kasp-tipo')?.value || 'Base',
          showPriceRevenda: temAlgumPreco ? priceRevenda : true,
          showPriceRO: priceRO,
          showPriceNaoPrime: priceNaoPrime,
          showBasePlus: document.getElementById('chk-kasp-show-baseplus')?.checked ?? false,
          showSuccessive: document.getElementById('chk-kasp-show-successive')?.checked ?? false,
          showPublic: document.getElementById('chk-kasp-show-public')?.checked ?? false,
          showTraining: document.getElementById('chk-kasp-show-training')?.checked ?? false,
          showCrossgrade: document.getElementById('chk-kasp-show-crossgrade')?.checked ?? false,
          showEduc: document.getElementById('chk-kasp-show-educ')?.checked ?? false,
          showXdr: document.getElementById('chk-kasp-show-xdr')?.checked ?? false,
          showNoEdr: document.getElementById('chk-kasp-show-noedr')?.checked ?? false
        };
        const resKasp = await window.Cotador.tables.kaspersky?.processar(this.parsedItems, flags);
        missingItems = this.parsedItems.filter(it => !resKasp?.matchedItemIndices?.has(it.itemIndex));
        this.aplicarFiltrosDinamicosGlobal(facetTracker, 'kaspersky-drawer-secundarios', 'badge-kasp-flags-count', [
          'chk-kasp-show-baseplus', 'chk-kasp-show-successive', 'chk-kasp-show-public', 'chk-kasp-show-training', 'chk-kasp-show-crossgrade', 'chk-kasp-show-educ', 'chk-kasp-show-xdr', 'chk-kasp-show-noedr'
        ]);
      }

      window.Cotador.core.limparBlocosVazios();
      window.Cotador.core.renderUnmatchedWarning(missingItems);
      window.Cotador.core.recalcularSubtotais();
      setTimeout(() => window.Cotador.core.enriquecerCRMBadges(), 800);
    } catch (err) {
        if (err && err.name === 'AbortError') {
          return;
        }
        if (container) {
          container.innerHTML = `<div class="p-4 rounded bg-[#fdf3f4] border border-[#f8d7da] text-[#a4262c] text-xs"><b>Erro na consulta:</b> ${err.message}</div>`;
        }
      } finally {
      if (!searchSignal.aborted && btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>Buscar e Montar Tabelas</span>';
      }
    }
  }
};
document.addEventListener('DOMContentLoaded', () => window.Cotador.app.init());