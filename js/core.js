// ============================================================================
// NÚCLEO CENTRAL BLINDADO (CORE) - COTADOR v5.7 ENTERPRISE (js/core.js)
// ============================================================================
window.Cotador = { core: {}, tables: {}, app: {} };

window.Cotador.core = {
  SUPABASE_URL: "https://rftvbxlbltmiwamjhgzl.supabase.co/rest/v1",
  SUPABASE_KEY: "sb_publishable_fN_BXmhXXod2gpeyJ8u38Q_rvgDPl7N",
  _dragInitialized: false,
  _draggedRow: null,
  _lastMouseDownTarget: null,

  SEARCH_KEYWORDS: {
    "phothosop": ["Photoshop"],
    "photshop": ["Photoshop"],
    "photosop": ["Photoshop"],
    "photoshop": ["Photoshop"],
    "ilustrator": ["Illustrator"],
    "illustrator": ["Illustrator"],
    "indesing": ["InDesign"],
    "acrobat pro": ["Acrobat", "Pro"],
    "creative cloud pro": ["Creative Cloud"],
    "creative cloud": ["Creative Cloud"],
    "business basic": ["Business Basic"],
    "business standard": ["Business Standard"],
    "business standart": ["Business Standard"],
    "business standar": ["Business Standard"],
    "business premium": ["Business Premium"],
    "exchange plan 1": ["Exchange Online", "Plan 1"],
    "exchange plan 2": ["Exchange Online", "Plan 2"],
    "exchange online plan 1": ["Exchange Online", "Plan 1"],
    "exchange online plan 2": ["Exchange Online", "Plan 2"],
    "exchange online": ["Exchange Online"],
    "planner": ["Planner"]
  },

  TOKEN_TYPO_MAP: {
    "standar": "Standard",
    "standart": "Standard",
    "std": "Standard",
    "entprise": "Enterprise",
    "enterpise": "Enterprise",
    "datacent": "Datacenter",
    "foudation": "Foundations",
    "foudations": "Foundations",
    "foundation": "Foundations",
    "bussiness": "Business",
    "busines": "Business",
    "exchenge": "Exchange",
    "projet": "Project",
    "projec": "Project"
  },

  escapeHTML(str) {
    if (!str || typeof str !== 'string') return str || '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  },

  extrairKeywords(prodName) {
    const lower = prodName.toLowerCase().trim();

    // 1. Correspondência exata com o dicionário de atalhos
    if (this.SEARCH_KEYWORDS[lower]) {
      return [...this.SEARCH_KEYWORDS[lower]];
    }

    // 2. Normaliza "exchange plan X" e agrupa "plan X" / "plano X" como token único ("Plan X")
    let normalized = prodName
      .replace(/[()]/g, ' ')
      .replace(/\bexchenge\b/gi, 'Exchange')
      .replace(/\bexchange\s+(?:online\s+)?plan(?:o)?\s*(\d+)\b/gi, 'Exchange Online __PLAN_$1__')
      .replace(/\bplan(?:o)?\s*(\d+)\b/gi, '__PLAN_$1__');

    // 3. Aplica substituição de expressões conhecidas sem perder qualificadores extras
    const lowerNorm = normalized.toLowerCase().trim();
    for (const [key, kwList] of Object.entries(this.SEARCH_KEYWORDS)) {
      if (lowerNorm === key) return [...kwList];
    }

    return normalized
      .split(/\s+/)
      .filter(w => w.length > 0)
      .map(w => {
        const planMatch = w.match(/^__PLAN_(\d+)__$/i);
        if (planMatch) return `Plan ${planMatch[1]}`;
        const cleanW = w.toLowerCase();
        return this.TOKEN_TYPO_MAP[cleanW] || w;
      });
  },

  // ==========================================================================
  // PARSER SEMÂNTICO DE INPUT: DIFERENCIA VERSÃO/PLANO/ANO DE QUANTIDADE
  // ==========================================================================
  isNumeroParteDoProduto(prefixText, numStr) {
    const n = parseInt(numStr, 10);
    if (isNaN(n)) return false;

    const cleanPrefix = (prefixText || '').trim().toLowerCase();
    if (!cleanPrefix) return false;

    const tokens = cleanPrefix.split(/\s+/).filter(Boolean);
    const lastWord = (tokens[tokens.length - 1] || '').replace(/[^a-z0-9\-áéíóúâêôãõç]/g, '');
    const prevWord = (tokens[tokens.length - 2] || '').replace(/[^a-z0-9\-áéíóúâêôãõç]/g, '');

    // 1. Anos de lançamento de software (ex: Windows Server 2025, SQL Server 2022, Office 2024)
    // Se o texto antes do número ainda não possui um ano, um número entre 2005 e 2035 é o ano da versão
    const prefixHasYear = /\b20[0-3]\d\b/.test(cleanPrefix);
    if (n >= 2005 && n <= 2035 && !prefixHasYear) {
      return true;
    }

    // 2. Família "365" (ex: "Microsoft 365", "Office 365", "Dynamics 365", "Windows 365")
    if (n === 365 && ['microsoft', 'ms', 'office', 'o', 'dynamics', 'windows', 'win', 'm', 'd'].includes(lastWord)) {
      return true;
    }

    // 3. Palavras designadoras de Plano, Nível, Versão ou Edição imediatamente antes do número
    // Ex: "project plan 3", "exchange plan 1", "visio plan 2", "plano 3", "level 1", "tier 2"
    const designators = new Set([
      'plan', 'plano', 'pl',
      'level', 'lvl', 'nivel', 'nível', 'tier',
      'version', 'versao', 'versão', 'ver', 'v', 'release', 'rel', 'r',
      'edition', 'edicao', 'edição', 'ed',
      'gen', 'generation', 'geracao', 'geração',
      'wave', 'step', 'phase', 'fase',
      'type', 'tipo', 'cat', 'categoria', 'group', 'grupo', 'option', 'opcao', 'opção',
      'pack', 'pacote', 'suite', 'suíte',
      'e', 'f', 'p', 'g', 'a', 'k'
    ]);
    if (designators.has(lastWord)) {
      return true;
    }

    // 4. Sistemas Operacionais e Produtos com versão numérica direta
    // Ex: "windows 10", "windows 11", "win 10", "win 11", "hololens 2", "surface pro 9"
    if (['windows', 'win'].includes(lastWord) && [7, 8, 10, 11, 365].includes(n)) {
      return true;
    }
    if (lastWord === 'hololens' && [1, 2, 3].includes(n)) {
      return true;
    }
    if (prevWord === 'surface' && ['pro', 'go', 'laptop', 'studio'].includes(lastWord) && n >= 1 && n <= 15) {
      return true;
    }

    return false;
  },

  parseInputLines(rawText) {
    const lines = rawText.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const items = [];
    let sumLicenses = 0;

    lines.forEach((line, idx) => {
      let qty = null;
      let prodName = line.trim();

      // 1. Quantidade explícita no final com unidade (ex: "project plan 3 10 un", "business basic 15 lic", "photoshop 5x")
      const explicitUnitEnd = prodName.match(/^(.*?)(?:[\s\-:|=\t]+|\b(?:qtd|qtde|quant)\s*[:=]?\s*)(\d+)\s*(?:x|un|unid|unidades?|lic|licen[cç]as?|users?|usu[aá]rios?|pcs?|seats?|disp|dispositivos?)\.?$/i);

      // 2. Quantidade explícita no final separada por delimitador claro (: | = Tab ou " - ")
      const explicitDelimEnd = !explicitUnitEnd && prodName.match(/^(.*?)(?:\t+|\s*[:|=]\s*|\s+-\s+)(\d+)\s*$/);

      // 3. Quantidade explícita no início com multiplicador/unidade/hífen (ex: "10x windows server 2025", "5 un project plan 3", "3 - photoshop")
      const explicitStart = !explicitUnitEnd && !explicitDelimEnd && prodName.match(/^(\d+)\s*(?:x\b|un\b|unid\b|unidades?\b|lic\b|licen[cç]as?\b|\s*-\s+)\s*(.+)$/i);

      if (explicitUnitEnd && explicitUnitEnd[1].trim()) {
        prodName = explicitUnitEnd[1].trim();
        qty = parseInt(explicitUnitEnd[2], 10);
      } else if (explicitDelimEnd && explicitDelimEnd[1].trim()) {
        prodName = explicitDelimEnd[1].trim();
        qty = parseInt(explicitDelimEnd[2], 10);
      } else if (explicitStart && explicitStart[2].trim()) {
        qty = parseInt(explicitStart[1], 10);
        prodName = explicitStart[2].trim();
      } else {
        // Remove palavras de unidade residuais soltas caso existam
        const clean = prodName.replace(/\b(unidades|unidade|licenças|licencas|lic|unid|un)\b/gi, '').replace(/\s+/g, ' ').trim();
        prodName = clean;

        // 4. Número ao final separado por espaço (ex: "business basic 10", "windows server 2025 10", "project plan 3")
        const matchEnd = clean.match(/^(.*?)\s+(\d+)$/);
        if (matchEnd && matchEnd[1].trim()) {
          const candidateProd = matchEnd[1].trim();
          const candidateNum = matchEnd[2];

          // Verifica se esse número final faz parte do nome do produto (ex: "2025" em Windows Server 2025 ou "3" em Project Plan 3)
          if (!this.isNumeroParteDoProduto(candidateProd, candidateNum)) {
            prodName = candidateProd;
            qty = parseInt(candidateNum, 10);
          }
        } else {
          // 5. Número no início separado apenas por espaço (ex: "10 business basic")
          const matchStart = clean.match(/^(\d+)\s+(.+)$/);
          if (matchStart && matchStart[2].trim()) {
            const startNum = parseInt(matchStart[1], 10);
            const restProd = matchStart[2].trim();
            // Evita confundir "365 business basic" com 365 unidades
            const is365Brand = startNum === 365 && /^(business|enterprise|apps|e3|e5|f1|f3|copilot|basic|standard|premium)\b/i.test(restProd);
            if (!is365Brand) {
              qty = startNum;
              prodName = restProd;
            }
          }
        }
      }

      if (qty !== null && !isNaN(qty)) sumLicenses += qty;

      items.push({
        itemIndex: idx,
        original: this.escapeHTML(prodName),
        rawSearch: prodName,
        keywords: this.extrairKeywords(prodName),
        qty: qty !== null ? qty : '-'
      });
    });

    return { items, sumLicenses };
  },

  // ==========================================================================
  // DETECÇÃO E FILTRAGEM EFICIENTE DE SEGMENTO (COLUNA SEGMENT + NOME)
  // ==========================================================================
  extrairSegmentoRow(rowOrVal) {
    if (!rowOrVal) return '';
    if (typeof rowOrVal === 'string') return rowOrVal.trim();
    if (typeof rowOrVal === 'object') {
      const direct =
        rowOrVal.segment ??
        rowOrVal.Segment ??
        rowOrVal.SEGMENT ??
        rowOrVal.segmento ??
        rowOrVal.Segmento ??
        rowOrVal.sub_segment ??
        rowOrVal.tipo_conta_compras ??
        rowOrVal.market_segment ??
        rowOrVal.target_segment ??
        rowOrVal.audience;
      if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
        return String(direct).trim();
      }
      for (const [k, v] of Object.entries(rowOrVal)) {
        if (/^(segment|segmento|tipo_conta|market_seg|target_seg|audience)/i.test(k) && v !== null && v !== undefined) {
          return String(v).trim();
        }
      }
    }
    return '';
  },

  construirFiltroPostgrestSegmento(columnName, allowedSegments) {
    const activeSegs = Array.isArray(allowedSegments) && allowedSegments.length > 0
      ? allowedSegments
      : ['commercial'];
    if (activeSegs.length >= 4) return null;

    const clauses = [];
    if (activeSegs.includes('commercial')) {
      clauses.push(
        `${columnName}.ilike.*commercial*`,
        `${columnName}.ilike.*comercial*`,
        `${columnName}.ilike.*corporate*`,
        `${columnName}.is.null`
      );
    }
    if (activeSegs.includes('education')) {
      clauses.push(
        `${columnName}.ilike.*education*`,
        `${columnName}.ilike.*academic*`,
        `${columnName}.ilike.*educa*`,
        `${columnName}.ilike.*faculty*`,
        `${columnName}.ilike.*student*`
      );
    }
    if (activeSegs.includes('charity')) {
      clauses.push(
        `${columnName}.ilike.*charity*`,
        `${columnName}.ilike.*nonprofit*`,
        `${columnName}.ilike.*non-profit*`,
        `${columnName}.ilike.*filantrop*`
      );
    }
    if (activeSegs.includes('government')) {
      clauses.push(
        `${columnName}.ilike.*government*`,
        `${columnName}.ilike.*governo*`,
        `${columnName}.ilike.*gov*`,
        `${columnName}.ilike.*public*`
      );
    }
    return clauses.length > 0 ? `(${clauses.join(',')})` : null;
  },

  detectarSegmentoItem(nomeProduto, rowOrSegmento) {
    const segRaw = this.extrairSegmentoRow(rowOrSegmento).toLowerCase().trim();
    const nome = (nomeProduto || '').toLowerCase().trim();

    // 1. Checa indicadores de segmentos especiais na coluna segment
    if (segRaw) {
      if (/\b(charity|non-profit|nonprofit|non profit|donation|filantropia|ong|beneficente)\b/i.test(segRaw) || segRaw.includes('charity') || segRaw.includes('nonprofit')) {
        return 'charity';
      }
      if (/\b(education|academic|faculty|student|school|educa|acad|ensino|edu)\b/i.test(segRaw) || segRaw.includes('education') || segRaw.includes('academic')) {
        return 'education';
      }
      if (/\b(government|gov|governo|public sector|setor p|state|federal|municipal|gcc)\b/i.test(segRaw) || segRaw.includes('government') || segRaw.includes('public')) {
        return 'government';
      }
    }

    // 2. Checa indicadores de segmentos especiais no nome do produto
    if (/\b(charity|non-profit|nonprofit|non profit|donation|filantropia)\b/i.test(nome)) {
      return 'charity';
    }
    if (/\b(education|faculty|student|academic|academico|acadêmico|school)\b/i.test(nome)) {
      return 'education';
    }
    if (/\b(government|gov|governo|public sector|setor publico|setor público|gcc)\b/i.test(nome)) {
      return 'government';
    }

    return 'commercial';
  },

  isItemSegmentoValido(nomeProduto, rowOrSegmento, allowedSegments, precoUnitario) {
    if (typeof precoUnitario === 'number' && precoUnitario < 0) return false;
    const activeSegs = Array.isArray(allowedSegments) && allowedSegments.length > 0
      ? allowedSegments
      : ['commercial'];
    const itemSeg = this.detectarSegmentoItem(nomeProduto, rowOrSegmento);
    return activeSegs.includes(itemSeg);
  },

  renderSegmentBadge(nomeProduto, rowOrSegmento, allowedSegments) {
    const seg = this.detectarSegmentoItem(nomeProduto, rowOrSegmento);
    const multiOrNonComm = (Array.isArray(allowedSegments) && allowedSegments.length > 1) || seg !== 'commercial';
    if (!multiOrNonComm) return '';
    const map = {
      commercial: { label: 'Comercial', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
      education: { label: 'Educação', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
      charity: { label: 'Charity', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
      government: { label: 'Governo', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    };
    const info = map[seg] || map.commercial;
    return `<span onclick="Cotador.core.copiarElemento(event, this)" data-copy="${info.label}" data-label="Segmento" title="Clique para copiar o segmento" class="copy-link sec-detail ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium border ${info.cls}">${info.label}</span>`;
  },

  async fetchSupabase(table, paramsArray) {
    const qs = paramsArray.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const url = `${this.SUPABASE_URL}/${table}?${qs}`;
    const headers = {
      'apikey': this.SUPABASE_KEY,
      'Authorization': `Bearer ${this.SUPABASE_KEY}`,
      'Accept': 'application/json'
    };
    const resp = await fetch(url, { method: 'GET', headers });
    if (!resp.ok) {
      const errTxt = await resp.text();
      throw new Error(`Erro (${resp.status}) na tabela [${table}]: ${errTxt}`);
    }
    return await resp.json();
  },

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
    const raw = row.valor_5pct_servicos ?? row.valor_com_5_servicos ?? row['Valor com 5% serviços'] ?? row.fob_impostos;
    return this.parsePrice(raw);
  },

  formatBRL(num) { return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
  formatUSD(num) { return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },

  // ==========================================================================
  // COMPONENTES INTERATIVOS DE CÓPIA DIRETA (CLICK-TO-COPY)
  // ==========================================================================
  renderCopyLink(displayText, copyValue, label = 'Valor', extraClass = '') {
    const safeDisplay = this.escapeHTML(String(displayText ?? ''));
    const safeCopy = this.escapeHTML(String(copyValue ?? displayText ?? ''));
    const safeLabel = this.escapeHTML(label);
    const isMonetary = /[R$US$]/i.test(String(copyValue ?? displayText ?? ''));
    const hint = isMonetary
      ? `Clique para copiar ${safeLabel.toLowerCase()} (Shift+Clique para número puro)`
      : `Clique para copiar ${safeLabel.toLowerCase()}`;
    return `<span onclick="Cotador.core.copiarElemento(event, this)" data-copy="${safeCopy}" data-label="${safeLabel}" title="${hint}" class="copy-link ${extraClass}">${safeDisplay}</span>`;
  },

  renderPnBadge(pn) {
    const safePn = this.escapeHTML(String(pn ?? ''));
    return `<span onclick="Cotador.core.copiarElemento(event, this)" data-copy="${safePn}" data-pn-val="${safePn}" data-label="PN" title="Clique para copiar o PN" class="copy-link pn-mono">${safePn}</span>`;
  },

  renderQtyInput(qty) {
    const val = (qty === '-' || isNaN(qty)) ? '' : qty;
    return `<input type="number" min="1" value="${val}" placeholder="-" oninput="Cotador.core.recalcularSubtotais()" class="qty-input">`;
  },

  renderRowActions() {
    return `<div class="flex items-center justify-end gap-1 whitespace-nowrap"><button type="button" onclick="Cotador.core.removerLinhaUnica(this)" title="Remover apenas este item desta tabela" class="text-[11px] font-normal text-slate-400 hover:text-red-600 hover:bg-red-50 rounded px-1.5 py-1 transition flex items-center gap-1"><span>&#10005;</span> <span class="hidden sm:inline">Remover</span></button><button type="button" onclick="Cotador.core.removerLinhasSemelhantes(this)" title="Remover este produto de todas as tabelas e contratos" class="text-[11px] font-medium text-slate-400 hover:text-red-700 hover:bg-red-100/80 border border-transparent hover:border-red-200 rounded px-1.5 py-1 transition flex items-center gap-1"><svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg><span class="hidden sm:inline">Semelhantes</span></button></div>`;
  },

  renderBlockHeader(title, blockId) {
    const safeTitle = this.escapeHTML(title);
    return `<div onclick="Cotador.core.toggleBlock('${blockId}')" class="block-header-bar flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 cursor-pointer select-none" title="Clique na barra para recolher ou expandir esta tabela"><div class="flex items-center gap-2"><svg class="w-4 h-4 text-slate-400 chevron-icon transition-transform duration-150 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg><h3 onclick="Cotador.core.copiarBlocoAoClicarTitulo(event, '${blockId}')" title="Clique no título para copiar toda esta tabela" class="copy-link text-xs font-semibold text-slate-700 uppercase tracking-wide">${safeTitle}</h3></div><div class="flex items-center gap-1.5" onclick="event.stopPropagation()"><span id="total-${blockId}" onclick="Cotador.core.copiarElemento(event, this)" data-copy="" data-label="Total da Tabela" title="Clique para copiar o valor Total desta tabela (Shift+Clique para número puro)" class="copy-link block-total-badge text-xs font-semibold theme-badge px-2.5 py-0.5 rounded tabular-nums hidden"></span></div></div>`;
  },

  renderEmptyStateGlobal() {
    return `<div class="text-center py-16 px-4 bg-amber-50/50 rounded-xl border border-amber-200/80 text-amber-900 space-y-2"><div class="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></div><p class="text-sm font-semibold">Nenhum produto encontrado</p><p class="text-xs text-amber-700/90 max-w-md mx-auto">Nenhum item correspondeu à busca nas modalidades e filtros selecionados. Verifique a grafia dos produtos ou ajuste os filtros de segmento e contrato no painel lateral.</p></div>`;
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
      if (block.querySelectorAll('tbody tr').length === 0) {
        block.remove();
      }
    });
    if (container.querySelectorAll('.quote-block').length === 0) {
      container.innerHTML = this.renderEmptyStateGlobal();
    }
  },

  removerLinhaUnica(btn) {
    const tr = btn.closest('tr');
    if (!tr) return;
    tr.remove();
    this.limparBlocosVazios();
    this.recalcularSubtotais();
  },

  removerLinhasSemelhantes(btn) {
    const tr = btn.closest('tr');
    if (!tr) return;
    const chaveAlvo = tr.getAttribute('data-prod-key') || this.obterChaveProduto(tr);
    if (!chaveAlvo) {
      this.removerLinhaUnica(btn);
      return;
    }

    let removidos = 0;
    document.querySelectorAll('.quote-block tbody tr').forEach(row => {
      const chaveRow = row.getAttribute('data-prod-key') || this.obterChaveProduto(row);
      if (chaveRow === chaveAlvo) {
        row.remove();
        removidos++;
      }
    });

    this.limparBlocosVazios();
    this.recalcularSubtotais();
    this.mostrarToast(`Produto removido em ${removidos} linha(s)/tabela(s)!`);
  },

  // ==========================================================================
  // DRAG & DROP DE LINHAS (APENAS ARRASTAR - SINCRONIZADO ENTRE TABELAS)
  // ==========================================================================
  initDragEvents() {
    if (this._dragInitialized) return;
    this._dragInitialized = true;

    document.addEventListener('mousedown', (e) => {
      this._lastMouseDownTarget = e.target;
    }, true);

    document.addEventListener('dragstart', (e) => {
      const tr = e.target.closest('.quote-block tbody tr.draggable-row');
      if (!tr) return;
      if (this._lastMouseDownTarget && this._lastMouseDownTarget.closest('input, button, .copy-link')) {
        e.preventDefault();
        return;
      }
      this._draggedRow = tr;
      tr.classList.add('is-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', tr.getAttribute('data-sync-key') || '');
      }
    });

    document.addEventListener('dragover', (e) => {
      if (!this._draggedRow) return;
      const targetTr = e.target.closest('.quote-block tbody tr.draggable-row');
      if (!targetTr || targetTr === this._draggedRow) return;
      const sourceTbody = this._draggedRow.parentElement;
      if (targetTr.parentElement !== sourceTbody) return;

      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

      const rect = targetTr.getBoundingClientRect();
      const isAfter = (e.clientY - rect.top) > (rect.height / 2);
      if (isAfter) {
        sourceTbody.insertBefore(this._draggedRow, targetTr.nextElementSibling);
      } else {
        sourceTbody.insertBefore(this._draggedRow, targetTr);
      }
    });

    document.addEventListener('drop', (e) => {
      if (!this._draggedRow) return;
      e.preventDefault();
    });

    document.addEventListener('dragend', () => {
      if (!this._draggedRow) return;
      const movedRow = this._draggedRow;
      const sourceTbody = movedRow.parentElement;
      movedRow.classList.remove('is-dragging');
      this._draggedRow = null;

      if (sourceTbody) {
        this.sincronizarOrdemTabelas(sourceTbody, movedRow);
        this.atualizarMarkdownBruto();
      }
    });
  },

  prepararLinhasDrag() {
    this.initDragEvents();

    // Torna cabeçalhos de coluna clicáveis para copiar a coluna inteira
    document.querySelectorAll('.quote-block thead th').forEach((th, idx, arr) => {
      if (idx === arr.length - 1 || th.dataset.thReady) return;
      th.dataset.thReady = '1';
      th.classList.add('copyable-th');
      th.title = `Clique para copiar todos os valores da coluna "${th.innerText.trim()}"`;
      th.addEventListener('click', () => this.copiarColunaTabela(th, idx));
    });

    document.querySelectorAll('.quote-block tbody').forEach(tbody => {
      const keyCounts = {};
      tbody.querySelectorAll('tr').forEach(tr => {
        const firstTd = tr.querySelector('td');
        if (!firstTd) return;

        const baseName = this.obterChaveProduto(tr);
        if (baseName && !tr.getAttribute('data-prod-key')) {
          tr.setAttribute('data-prod-key', baseName);
        }

        if (!tr.getAttribute('data-sync-key')) {
          const count = (keyCounts[baseName] || 0) + 1;
          keyCounts[baseName] = count;
          tr.setAttribute('data-sync-key', `${baseName}::#${count}`);
        }

        if (!tr.classList.contains('draggable-row')) {
          tr.classList.add('draggable-row');
          tr.setAttribute('draggable', 'true');
        }

        if (!firstTd.querySelector('.row-grip-wrap')) {
          const wrap = document.createElement('span');
          wrap.className = 'row-grip-wrap no-export';
          wrap.innerHTML = `
            <span class="drag-handle" title="Arraste para reordenar (sincroniza entre todas as tabelas)">
              <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="3.5" r="1.2"/><circle cx="10.5" cy="3.5" r="1.2"/><circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/><circle cx="5.5" cy="12.5" r="1.2"/><circle cx="10.5" cy="12.5" r="1.2"/></svg>
            </span>`;
          firstTd.insertBefore(wrap, firstTd.firstChild);
        }
      });
    });
  },

  sincronizarOrdemTabelas(sourceTbody, movedRow) {
    const syncKey = movedRow.getAttribute('data-sync-key');
    if (!syncKey) return;

    const keysAfter = [];
    let next = movedRow.nextElementSibling;
    while (next) {
      const k = next.getAttribute('data-sync-key');
      if (k) keysAfter.push(k);
      next = next.nextElementSibling;
    }

    document.querySelectorAll('.quote-block tbody').forEach(otherTbody => {
      if (otherTbody === sourceTbody) return;
      const rows = Array.from(otherTbody.querySelectorAll('tr'));
      const matchingRow = rows.find(r => r.getAttribute('data-sync-key') === syncKey);
      if (!matchingRow) return;

      let refRow = null;
      for (const afterKey of keysAfter) {
        const candidate = rows.find(r => r.getAttribute('data-sync-key') === afterKey);
        if (candidate && candidate !== matchingRow) {
          refRow = candidate;
          break;
        }
      }

      if (refRow) {
        otherTbody.insertBefore(matchingRow, refRow);
      } else {
        otherTbody.appendChild(matchingRow);
      }

      matchingRow.classList.remove('row-synced-flash');
      void matchingRow.offsetWidth;
      matchingRow.classList.add('row-synced-flash');
    });
  },

  // ==========================================================================
  // CONTROLES DE VISIBILIDADE E SUBTOTAIS
  // ==========================================================================
  toggleBlock(blockId) {
    const block = document.getElementById(blockId);
    if (block) block.classList.toggle('is-collapsed');
  },

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

    chkSub.checked = ativarAmbos;
    chkDet.checked = ativarAmbos;

    document.getElementById('btn-toggle-subtotal').classList.toggle('active', ativarAmbos);
    this.atualizarVisibilidadeDetalhes();
    this.recalcularSubtotais();
  },

  atualizarVisibilidadeDetalhes() {
    const showDet = document.getElementById('chk-mostrar-detalhes').checked;
    document.body.classList.toggle('hide-secondary-details', !showDet);
    const btnDet = document.getElementById('btn-toggle-detalhes');
    if (btnDet) btnDet.classList.toggle('active', showDet);
    this.atualizarMarkdownBruto();
  },

  recalcularSubtotais() {
    this.prepararLinhasDrag();
    const showSub = document.getElementById('chk-mostrar-subtotal').checked;
    document.body.classList.toggle('hide-subtotals', !showSub);
    const btnSub = document.getElementById('btn-toggle-subtotal');
    if (btnSub) btnSub.classList.toggle('active', showSub);

    document.querySelectorAll('.col-subtotal').forEach(el => el.classList.toggle('hidden', !showSub));

    document.querySelectorAll('.quote-block').forEach(block => {
      const isUSD = block.getAttribute('data-currency') === 'USD';
      let somaBloco = 0;
      let somaBlocoBrl = 0;
      let temQtd = false;

      block.querySelectorAll('tbody tr').forEach(tr => {
        const unit = parseFloat(tr.getAttribute('data-unit-price'));
        const unitBrl = parseFloat(tr.getAttribute('data-unit-price-brl'));
        const input = tr.querySelector('.qty-input');
        const subTd = tr.querySelector('.col-subtotal');
        if (!input || isNaN(unit)) return;

        const qty = parseInt(input.value, 10);
        if (!isNaN(qty) && qty > 0) {
          const sub = unit * qty;
          somaBloco += sub;
          temQtd = true;

          if (isUSD) {
            const subBrl = (!isNaN(unitBrl) ? unitBrl : 0) * qty;
            somaBlocoBrl += subBrl;
            if (subTd) {
              const formattedUSD = `US$ ${this.formatUSD(sub)}`;
              const formattedBRL = `R$ ${this.formatBRL(subBrl)}`;
              const detailBrl = subBrl > 0
                ? `<div class="sec-detail text-[11px] font-normal text-slate-400 mt-0.5">${this.renderCopyLink(formattedBRL, formattedBRL, 'Subtotal BRL')}</div>`
                : '';
              subTd.innerHTML = `${this.renderCopyLink(formattedUSD, formattedUSD, 'Subtotal USD')}${detailBrl}`;
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
          const valorBRL = `R$ ${this.formatBRL(somaBlocoBrl)}`;
          badgeTotal.innerHTML = `Total: ${valorUSD}<span class="sec-detail font-normal opacity-80 ml-1.5">(${valorBRL})</span>`;
          badgeTotal.setAttribute('data-copy', valorUSD);
        } else {
          const valorFormatado = `R$ ${this.formatBRL(somaBloco)}`;
          badgeTotal.textContent = `Total: ${valorFormatado}`;
          badgeTotal.setAttribute('data-copy', valorFormatado);
        }
        badgeTotal.classList.toggle('hidden', !temQtd || !showSub);
      }
    });

    this.atualizarMarkdownBruto();
  },

  extrairValorCelula(td) {
    const input = td.querySelector('.qty-input');
    if (input) return input.value ? input.value : '-';
    const pnEl = td.querySelector('[data-pn-val]');
    if (pnEl) return pnEl.getAttribute('data-pn-val') || pnEl.innerText.trim();

    const clone = td.cloneNode(true);
    clone.querySelectorAll('.no-export').forEach(el => el.remove());
    if (document.body.classList.contains('hide-secondary-details')) {
      clone.querySelectorAll('.sec-detail').forEach(el => el.remove());
    }
    return clone.innerText.replace(/\s+/g, ' ').trim();
  },

  isColunaVisivel(cell) {
    const showSub = document.getElementById('chk-mostrar-subtotal').checked;
    const showDet = !document.body.classList.contains('hide-secondary-details');
    if (!showSub && cell.classList.contains('col-subtotal')) return false;
    if (!showDet && cell.classList.contains('col-secondary')) return false;
    return true;
  },

  atualizarMarkdownBruto() {
    const blocks = document.querySelectorAll('.quote-block');
    let md = '';
    blocks.forEach(block => {
      md += `${block.getAttribute('data-title')}\n`;
      const table = block.querySelector('table');
      const headers = Array.from(table.querySelectorAll('thead th'))
        .slice(0, -1).filter(th => this.isColunaVisivel(th))
        .map(th => th.innerText.trim());

      md += `| ${headers.join(' | ')} |\n|${headers.map(() => '---').join('|')}|\n`;

      table.querySelectorAll('tbody tr').forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td'))
          .slice(0, -1).filter(td => this.isColunaVisivel(td));
        if (cells.length > 0) md += `| ${cells.map(td => this.extrairValorCelula(td)).join(' | ')} |\n`;
      });
      md += '\n';
    });
    const out = document.getElementById('markdown-output');
    if (out) out.textContent = md.trim();
  },

  // ==========================================================================
  // FUNÇÕES DE CÓPIA INTERATIVA E FEEDBACK VISUAL
  // ==========================================================================
  mostrarToast(msg) {
    const t = document.getElementById('copy-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
  },

  copiarElemento(event, el) {
    if (event) event.stopPropagation();
    if (!el) return;
    let txt = el.getAttribute('data-copy') ?? el.innerText.trim();
    const label = el.getAttribute('data-label') || 'Item';

    // Se Shift ou Alt estiver pressionado em um valor monetário, copia apenas o número puro
    if (event && (event.shiftKey || event.altKey) && /[R$US$]/i.test(txt)) {
      txt = txt.replace(/[R$US$\s]/gi, '').trim();
    }
    if (!txt || txt === '-') return;

    navigator.clipboard.writeText(txt);
    el.classList.add('is-copied');
    setTimeout(() => el.classList.remove('is-copied'), 450);
    this.mostrarToast(`${label} copiado: ${txt}`);
  },

  copiarColunaTabela(th, colIndex) {
    const table = th.closest('table');
    if (!table) return;
    const valores = [];
    table.querySelectorAll('tbody tr').forEach(tr => {
      const td = tr.children[colIndex];
      if (td) {
        const val = this.extrairValorCelula(td);
        if (val && val !== '-') valores.push(val);
      }
    });
    if (valores.length === 0) return;
    navigator.clipboard.writeText(valores.join('\n'));
    this.mostrarToast(`Coluna "${th.innerText.trim()}" copiada (${valores.length} itens)!`);
  },

  copiarBlocoAoClicarTitulo(event, blockId) {
    if (event) event.stopPropagation();
    const block = document.getElementById(blockId);
    if (!block) return;
    const { tsv, html } = this.gerarExtracaoBloco(block);
    this.copiarRichTextOuTexto(tsv, html, 'Tabela completa copiada!');
  },

  gerarExtracaoBloco(block) {
    const title = block.getAttribute('data-title').replace('### ', '');
    const table = block.querySelector('table');
    const headers = Array.from(table.querySelectorAll('thead th'))
      .slice(0, -1)
      .filter(th => this.isColunaVisivel(th))
      .map(th => th.innerText.trim());

    let tsv = `${title}\n${headers.join('\t')}\n`;
    let html = `<h4 style="font-family:sans-serif;color:#1e293b;margin:12px 0 6px 0;">${title}</h4>`;
    html += `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:12px;border-color:#e2e8f0;width:100%;">`;
    html += `<thead style="background:#f1f5f9;color:#334155;"><tr>${headers.map(h => `<th align="left">${h}</th>`).join('')}</tr></thead><tbody>`;

    table.querySelectorAll('tbody tr').forEach(tr => {
      const cells = Array.from(tr.querySelectorAll('td'))
        .slice(0, -1)
        .filter(td => this.isColunaVisivel(td))
        .map(td => this.extrairValorCelula(td));

      if (cells.length > 0) {
        tsv += `${cells.join('\t')}\n`;
        html += `<tr>${cells.map(c => `<td style="border:1px solid #e2e8f0;">${c}</td>`).join('')}</tr>`;
      }
    });

    html += `</tbody></table><br>`;
    return { tsv, html };
  },

  async copiarRichTextOuTexto(tsv, html, msgSucesso) {
    try {
      if (window.ClipboardItem) {
        const item = new ClipboardItem({
          'text/plain': new Blob([tsv.trim()], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' })
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(tsv.trim());
      }
    } catch (_) {
      await navigator.clipboard.writeText(tsv.trim());
    }
    this.mostrarToast(msgSucesso);
  },

  copiarMarkdown() {
    this.atualizarMarkdownBruto();
    const txt = document.getElementById('markdown-output')?.textContent || '';
    if (!txt) return;
    navigator.clipboard.writeText(txt);
    this.mostrarToast('Markdown copiado!');
  }
};