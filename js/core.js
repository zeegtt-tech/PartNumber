// ============================================================================
// NÚCLEO CENTRAL BLINDADO (CORE) - COTADOR v5.8.3 ENTERPRISE (js/core.js)
// ============================================================================

window.Cotador = { core: {}, tables: {}, app: {} };

window.Cotador.core = {
  SUPABASE_URL: "https://rftvbxlbltmiwamjhgzl.supabase.co/rest/v1",
  SUPABASE_KEY: "sb_publishable_fN_BXmhXXod2gpeyJ8u38Q_rvgDPl7N",
  _dragInitialized: false,
  _draggedRow: null,
  _lastMouseDownTarget: null,
  _searchAbortController: null,
  modoCliente: false,
  markupPercent: 0,
  markupEnabled: false,
  calcMode: 'markup', // 'markup' = Custo * (1 + pct/100) | 'margin' = Custo / (1 - pct/100)
  ultimasAtualizacoes: {},

  iniciarNovaSessaoBusca() {
    if (this._searchAbortController) {
      this._searchAbortController.abort();
    }
    this._searchAbortController = new AbortController();
    return this._searchAbortController.signal;
  },

  cancelarBuscasEmAndamento() {
    if (this._searchAbortController) {
      this._searchAbortController.abort();
      this._searchAbortController = null;
    }
  },

  formatarDataCurta(isoStr) {
    if (!isoStr) return null;
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  },

  formatarDataHoraCompleta(isoStr) {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  async carregarDatasAtualizacao() {
    try {
      const rows = await this.fetchSupabase('catalogo_atualizacoes', [['select', '*']], { useAbort: false });
      if (Array.isArray(rows)) {
        rows.forEach(r => {
          if (r.tabela && r.atualizado_em) {
            this.ultimasAtualizacoes[r.tabela] = {
              iso: r.atualizado_em,
              fabricante: r.fabricante,
              nome: r.nome_exibicao || r.tabela
            };
          }
        });
      }
    } catch (_) {
      const tabelas = [
        { id: 'microsoft_scan', fab: 'microsoft', nome: 'Scan' },
        { id: 'microsoft_solo', fab: 'microsoft', nome: 'CSP Solo' },
        { id: 'microsoft_perpetuo', fab: 'microsoft', nome: 'CSP Perpétuo' },
        { id: 'microsoft_mpsa', fab: 'microsoft', nome: 'MPSA' },
        { id: 'adobe_base', fab: 'adobe', nome: 'Adobe Base' },
        { id: 'adobe_promo', fab: 'adobe', nome: 'Adobe Promo' },
        { id: 'kaspersky', fab: 'kaspersky', nome: 'Kaspersky' }
      ];
      await Promise.allSettled(tabelas.map(async t => {
        const res = await this.fetchSupabase(t.id, [['select', 'updated_at'], ['order', 'updated_at.desc'], ['limit', '1']], { useAbort: false });
        if (res && res[0] && res[0].updated_at) {
          this.ultimasAtualizacoes[t.id] = { iso: res[0].updated_at, fabricante: t.fab, nome: t.nome };
        }
      }));
    }
    this.atualizarBadgeDataFabricante(window.Cotador.app?.currentVendor || 'microsoft');
  },

  atualizarBadgeDataFabricante(vendor) {
    const txtEl = document.getElementById('badge-last-update-text');
    const badgeEl = document.getElementById('badge-last-update');
    if (!txtEl || !badgeEl) return;

    const entradas = Object.values(this.ultimasAtualizacoes).filter(x => x.fabricante === vendor);
    if (entradas.length === 0) {
      txtEl.textContent = 'Tabela s/ registro';
      return;
    }

    entradas.sort((a, b) => new Date(b.iso) - new Date(a.iso));
    const maisRecente = this.formatarDataCurta(entradas[0].iso);
    txtEl.textContent = `Base: ${maisRecente}`;

    badgeEl.title = entradas
      .map(e => `${e.nome}: ${this.formatarDataHoraCompleta(e.iso)}`)
      .join('\n');
  },

  SEARCH_KEYWORDS: {
    // Adobe VIP MP
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
    "creative cloud todas as aplicacoes": ["Creative Cloud"],
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
    // Microsoft 365 / Office 365 / Suites Comerciais
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
    // Microsoft Exchange / Teams / Colaboração / Segurança / BI
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
    "entra id p2": ["Entra ID", "P2"],
    "azure ad p2": ["Entra ID", "P2"],
    "intune plan 1": ["Intune", "Plan 1"],
    // Kaspersky
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
    "standar": "Standard",
    "standart": "Standard",
    "standad": "Standard",
    "stardard": "Standard",
    "padrao": "Standard",
    "std": "Standard",
    "entprise": "Enterprise",
    "enterpise": "Enterprise",
    "enterprize": "Enterprise",
    "entreprice": "Enterprise",
    "ent": "Enterprise",
    "datacent": "Datacenter",
    "dc": "Datacenter",
    "foudation": "Foundations",
    "foudations": "Foundations",
    "foudantions": "Foundations",
    "foundation": "Foundations",
    "bussiness": "Business",
    "busines": "Business",
    "bussines": "Business",
    "bsiness": "Business",
    "busness": "Business",
    "microsft": "Microsoft",
    "micrsoft": "Microsoft",
    "micosoft": "Microsoft",
    "premiun": "Premium",
    "premuim": "Premium",
    "premum": "Premium",
    "exchenge": "Exchange",
    "exchage": "Exchange",
    "excange": "Exchange",
    "exhange": "Exchange",
    "exchagne": "Exchange",
    "sharepoit": "SharePoint",
    "sharpoint": "SharePoint",
    "projet": "Project",
    "projec": "Project",
    "m365": "365",
    "o365": "365",
    "win": "Windows",
    "ws": "Windows Server",
    "powerbi": "Power BI",
    "pbi": "Power BI",
    "phothosop": "Photoshop",
    "photshop": "Photoshop",
    "photosop": "Photoshop",
    "photopshop": "Photoshop",
    "phtoshop": "Photoshop",
    "fotoshop": "Photoshop",
    "ilustrator": "Illustrator",
    "ilustrattor": "Illustrator",
    "ilustraitor": "Illustrator",
    "indesing": "InDesign",
    "indising": "InDesign",
    "acobrat": "Acrobat",
    "premier": "Premiere",
    "kasperky": "Kaspersky",
    "kasparsky": "Kaspersky"
  },

  CANONICAL_CATALOG_TOKENS: [
    "Microsoft", "Business", "Standard", "Basic", "Premium", "Enterprise",
    "Exchange", "SharePoint", "Project", "Defender", "Copilot", "Photoshop",
    "Illustrator", "InDesign", "Acrobat", "Creative", "Premiere", "Lightroom",
    "Substance", "Kaspersky", "Foundations", "Optimum", "Advanced", "Endpoint",
    "Security", "Datacenter"
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
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
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
    return String(termo || '')
      .replace(/[,()*%\[\]]/g, ' ')
      .replace(/(?:^|\s)[-–—/\\]+(?=\s|$)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  construirFiltroAndKeywords(columnName, keywords) {
    return keywords
      .map(kw => this.sanitizarTermoPostgrest(kw))
      .filter(Boolean)
      .map(kw => [columnName, `ilike.*${kw}*`]);
  },

  isPartNumber(str) {
    const s = String(str || '').trim();
    if (!s || /\s/.test(s)) return false;
    if (/^[A-Z0-9]{12}(?:[-:][A-Z0-9\-:]+)?$/i.test(s)) return true;
    if (/^[A-Z0-9]{3,5}-[A-Z0-9]{4,8}(?:-[A-Z0-9]+)*$/i.test(s)) return true;
    if (/^\d{7,8}[A-Z]{2}[A-Z0-9]{0,6}$/i.test(s)) return true;
    if (/^KL[A-Z0-9\-]{4,}$/i.test(s)) return true;
    if (s.length >= 7 && /[A-Z]/i.test(s) && /\d/.test(s) && /^[A-Z0-9\-:_./]+$/i.test(s)) {
      if (!/^(windows|office|microsoft|kaspersky|photoshop|acrobat)\d*$/i.test(s)) {
        return true;
      }
    }
    return false;
  },

  normalizarChaveProdutoMS(rawName, itemIndex) {
    const clean = String(rawName || '')
      .toLowerCase()
      .replace(/\(.*?\)/g, ' ')
      .replace(/\b(commercial|education|academic|faculty|student|charity|non-profit|nonprofit|government|gov)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return `ms-item-${itemIndex ?? 0}::${clean}`;
  },

  extrairKeywords(prodName) {
    const rawTrimmed = String(prodName || '').trim();
    if (!rawTrimmed) return [];

    if (this.isPartNumber(rawTrimmed)) {
      const nceMatch = rawTrimmed.match(/^([A-Z0-9]{12})(?:[-:]\d{3,4}(?:[-:][A-Z0-9]+)*)$/i);
      if (nceMatch) {
        return [this.sanitizarTermoPostgrest(nceMatch[1])];
      }
      return [this.sanitizarTermoPostgrest(rawTrimmed)];
    }

    const deaccented = rawTrimmed
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const lower = this.sanitizarTermoPostgrest(deaccented).toLowerCase();
    if (this.SEARCH_KEYWORDS[lower]) {
      return this.SEARCH_KEYWORDS[lower]
        .map(kw => this.sanitizarTermoPostgrest(kw))
        .filter(Boolean);
    }

    let normalized = this.sanitizarTermoPostgrest(deaccented)
      .replace(/\b(exchenge|exchage|excange|exhange|exchagne)\b/gi, 'Exchange')
      .replace(/\bexchange\s+(?:online\s+)?(?:plan(?:o)?|p)\s*(\d+)\b/gi, 'Exchange Online __PLAN_$1__')
      .replace(/\b(project|visio|planner|intune)\s+(?:plan(?:o)?|p)\s*(\d+)\b/gi, '$1 __PLAN_$2__')
      .replace(/\bplan(?:o)?\s*(\d+)\b/gi, '__PLAN_$1__');

    const lowerNorm = normalized.toLowerCase().trim();
    for (const [key, kwList] of Object.entries(this.SEARCH_KEYWORDS)) {
      if (lowerNorm === key) {
        return kwList
          .map(kw => this.sanitizarTermoPostgrest(kw))
          .filter(Boolean);
      }
    }

    return normalized
      .split(/\s+/)
      .filter(w => w.length > 0)
      .flatMap(w => {
        const planMatch = w.match(/^__PLAN_(\d+)__$/i);
        if (planMatch) return [`Plan ${planMatch[1]}`];
        const cleanW = w.toLowerCase();
        if (this.STOPWORDS_PT.has(cleanW)) return [];
        const mapped = this.TOKEN_TYPO_MAP[cleanW] || this.corrigirTokenFuzzy(w);
        return [this.sanitizarTermoPostgrest(mapped)];
      })
      .filter(Boolean);
  },

  isNumeroParteDoProduto(prefixText, numStr) {
    const n = parseInt(numStr, 10);
    if (isNaN(n)) return false;
    const cleanPrefix = (prefixText || '').trim();
    if (!cleanPrefix) return false;

    if (this.isPartNumber(cleanPrefix)) {
      return false;
    }

    const lowerPrefix = cleanPrefix.toLowerCase();
    const tokens = lowerPrefix.split(/\s+/).filter(Boolean);
    const lastWord = (tokens[tokens.length - 1] || '').replace(/[^a-z0-9\-]/g, '');
    const prevWord = (tokens[tokens.length - 2] || '').replace(/[^a-z0-9\-]/g, '');

    const prefixHasYear = /\b20[0-3]\d\b/.test(lowerPrefix);
    if (n >= 2005 && n <= 2035 && !prefixHasYear) {
      return true;
    }

    if (n === 365 && ['microsoft', 'ms', 'office', 'o', 'dynamics', 'windows', 'win', 'm', 'd'].includes(lastWord)) {
      return true;
    }

    const designators = new Set([
      'plan', 'plano', 'pl',
      'level', 'lvl', 'nivel', 'nível', 'tier',
      'version', 'versao', 'versão', 'ver', 'v', 'release', 'rel', 'r',
      'edition', 'edicao', 'edição', 'ed',
      'gen', 'generation', 'geracao', 'geração',
      'wave', 'step', 'phase', 'fase',
      'type', 'tipo', 'cat', 'categoria', 'group', 'grupo', 'option', 'opcao', 'opção',
      'pack', 'pacote', 'suite', 'suíte', 'core',
      'e', 'f', 'p', 'g', 'a', 'k'
    ]);
    if (designators.has(lastWord)) {
      return true;
    }

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
      let prodName = line
        .replace(/[\u2010-\u2015\u2212]/g, '-')
        .replace(/^(?:[-•*▪‣◦>]|\d+[.)])\s*/, '')
        .trim();

      if (!prodName) return;

      if (!/\s/.test(prodName) && this.isPartNumber(prodName)) {
        items.push({
          itemIndex: idx,
          original: this.escapeHTML(prodName),
          rawSearch: prodName,
          keywords: this.extrairKeywords(prodName),
          qty: '-'
        });
        return;
      }

      const explicitUnitEnd = prodName.match(/^(.*?)(?:[\s:|=\t]+|\s*[-–—:|=/]\s*|\b(?:qtd|qtde|quant)\s*[:=]?\s*)(\d+)\s*(?:x|un|unid|unidades?|lic|licen[cç]as?|users?|usu[aá]rios?|pcs?|seats?|disp|dispositivos?)\.?$/i);
      const explicitDelimEnd = !explicitUnitEnd && prodName.match(/^(.*?)(?:\t+|\s*[-–—:|=/]\s*)(\d+)\s*$/);
      const explicitStart = !explicitUnitEnd && !explicitDelimEnd && prodName.match(/^(\d+)\s*(?:x\b|un\b|unid\b|unidades?\b|lic\b|licen[cç]as?\b|\s*[-–—:|=/]\s*)\s*(.+)$/i);

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
        const clean = prodName
          .replace(/\s+\b(unidades|unidade|licenças|licencas|lic|unid|un)\b\.?$/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        prodName = clean;

        const matchEnd = clean.match(/^(.*?)\s+(\d+)$/);
        if (matchEnd && matchEnd[1].trim()) {
          const candidateProd = matchEnd[1].trim();
          const candidateNum = matchEnd[2];
          if (!this.isNumeroParteDoProduto(candidateProd, candidateNum)) {
            prodName = candidateProd;
            qty = parseInt(candidateNum, 10);
          }
        } else {
          const matchStart = clean.match(/^(\d+)\s+(.+)$/);
          if (matchStart && matchStart[2].trim()) {
            const startNum = parseInt(matchStart[1], 10);
            const restProd = matchStart[2].trim();
            const is365Brand = startNum === 365 && /^(business|enterprise|apps|e3|e5|f1|f3|copilot|basic|standard|premium)\b/i.test(restProd);
            if (!is365Brand) {
              qty = startNum;
              prodName = restProd;
            }
          }
        }
      }

      prodName = prodName.replace(/^[\s\-–—:|=/•*+]+|[\s\-–—:|=/•*+]+$/g, '').trim();
      if (!prodName) return;

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

  async fetchSupabase(table, paramsArray, options = {}) {
    const qs = paramsArray.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const url = `${this.SUPABASE_URL}/${table}?${qs}`;
    const headers = {
      'apikey': this.SUPABASE_KEY,
      'Accept': 'application/json'
    };
    if (String(this.SUPABASE_KEY || '').startsWith('eyJ')) {
      headers['Authorization'] = `Bearer ${this.SUPABASE_KEY}`;
    }

    // Usa o signal explícito ou o signal global de busca de produtos (exceto quando useAbort=false, ex: datas de catálogo)
    const signal = options.signal !== undefined
      ? options.signal
      : (options.useAbort === false ? undefined : this._searchAbortController?.signal);

    let resp;
    try {
      resp = await fetch(url, { method: 'GET', headers, mode: 'cors', cache: 'no-store', signal });
    } catch (netErr) {
      if (netErr.name === 'AbortError') {
        throw netErr; // Propaga silenciosamente o cancelamento intencional
      }
      throw new Error(
        `Falha de conexão com o Supabase (${netErr.message}). Verifique se o projeto rftvbxlbltmiwamjhgzl não está pausado ou bloqueado.`
      );
    }
    if (!resp.ok) {
      const errTxt = await resp.text();
      throw new Error(`Erro HTTP (${resp.status}) na tabela [${table}]: ${errTxt}`);
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

  calcularFatorComercial() {
    const pct = this.obterMarkupEfetivo();
    if (!this.markupEnabled || pct === 0) return 1;
    if (this.calcMode === 'margin') {
      // Trava de segurança matemática para evitar divisão por zero ou negativo (>= 99%)
      const pctSeguro = Math.min(pct, 99);
      return 1 / (1 - (pctSeguro / 100));
    }
    return 1 + (pct / 100);
  },

  setCalcMode(mode, silent = false) {
    this.calcMode = mode === 'margin' ? 'margin' : 'markup';
    const btnMode = document.getElementById('btn-calc-mode');
    const inputMarkup = document.getElementById('input-markup-pct');

    if (btnMode) {
      const isMargin = this.calcMode === 'margin';
      btnMode.textContent = isMargin ? 'Margem Real' : 'Markup';
      btnMode.title = isMargin
        ? 'Fórmula ativa: MARGEM BRUTA REAL [ Preço = Custo / (1 - %/100) ]. Clique para alternar para Markup.'
        : 'Fórmula ativa: MARKUP [ Preço = Custo * (1 + %/100) ]. Clique para alternar para Margem Bruta Real.';
    }

    if (inputMarkup) {
      inputMarkup.max = this.calcMode === 'margin' ? '95' : '500';
      if (this.calcMode === 'margin' && parseFloat(inputMarkup.value) > 95) {
        this.setMarkupPercent(95);
        inputMarkup.value = '95';
      }
    }

    this.atualizarTitulosColunasModoCliente();
    this.recalcularSubtotais();

    if (!silent) {
      window.Cotador.app?.salvarPreferencias?.();
      this.mostrarToast(
        this.calcMode === 'margin'
          ? '📊 Cálculo alterado para Margem Bruta: Custo ÷ (1 - %)'
          : '📊 Cálculo alterado para Markup: Custo × (1 + %)'
      );
    }
  },

  toggleCalcMode() {
    const nextMode = this.calcMode === 'markup' ? 'margin' : 'markup';
    this.setCalcMode(nextMode, false);
  },

  aplicarMarkup(valor) {
    const n = parseFloat(valor);
    if (isNaN(n) || n <= 0) return 0;
    return n * this.calcularFatorComercial();
  },

  obterMarkupEfetivo() {
    if (!this.markupEnabled) return 0;
    return parseFloat(this.markupPercent) || 0;
  },

  formatBRL(num) { return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
  formatUSD(num) { return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },

  injetarControlesComerciaisHeader() {
    if (document.getElementById('commercial-mode-bar')) return;
    const viewCtrl = document.querySelector('.unified-view-control');
    if (!viewCtrl || !viewCtrl.parentElement) return;

    // Se o painel PTAX ainda não estiver no HTML, cria-o automaticamente à esquerda do Modo Cliente
    let ptaxPanel = document.getElementById('header-ptax-panel');
    if (!ptaxPanel) {
      ptaxPanel = document.createElement('div');
      ptaxPanel.id = 'header-ptax-panel';
      ptaxPanel.className = 'copy-link text-[11px] px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/90 font-medium flex items-center gap-1.5 select-none tabular-nums transition-colors';
      ptaxPanel.setAttribute('onclick', 'Cotador.core.copiarElemento(event, this)');
      ptaxPanel.setAttribute('data-copy', '');
      ptaxPanel.setAttribute('data-label', 'Dólar PTAX');
      ptaxPanel.title = 'Consultando cotação PTAX oficial do Banco Central...';
      ptaxPanel.innerHTML = `
        <span id="header-ptax-dot" class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
        <span class="text-slate-400 font-normal">PTAX:</span>
        <span id="header-ptax-value" class="font-semibold text-slate-700">R$ --,--</span>
      `;
    }
    viewCtrl.parentElement.insertBefore(ptaxPanel, viewCtrl);

    const bar = document.createElement('div');
    bar.id = 'commercial-mode-bar';
    bar.className = 'unified-view-control';
    bar.innerHTML = `
      <button type="button" id="btn-modo-cliente" onclick="Cotador.core.toggleModoCliente()" title="Quando ativo: oculta PN, colunas de Custo e controles de percentual, exibindo apenas o Valor Unitário comercial (Exige margem > 0%)" class="mini-toggle-btn">
        <span class="dot"></span>
        <span>Modo Cliente</span>
      </button>
      <div class="markup-controls-group flex items-center gap-1 pl-1 pr-1.5 border-l border-slate-200/80 text-[11px] text-slate-600">
        <button type="button" id="btn-toggle-markup" onclick="Cotador.core.toggleMarkupAtivo()" title="Ligar ou desligar a aplicação de rentabilidade" class="mini-toggle-btn">
          <span class="dot"></span>
          <span>Aplicar</span>
        </button>
        <button type="button" id="btn-calc-mode" onclick="Cotador.core.toggleCalcMode()" title="Fórmula ativa: MARKUP [ Preço = Custo * (1 + %/100) ]. Clique para alternar para Margem Bruta Real." class="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-semibold text-slate-600 hover:text-slate-900 hover:border-slate-300 transition">
          Markup
        </button>
        <input type="number" id="input-markup-pct" value="0" step="1" min="0" max="500"
          oninput="Cotador.core.setMarkupPercent(this.value)"
          title="Define o percentual comercial aplicado sobre o custo"
          class="w-12 bg-white border border-slate-200 rounded px-1 py-0.5 text-center text-[11px] font-semibold text-slate-800 tabular-nums focus:outline-none transition-colors">
        <span class="text-slate-400 font-medium">%</span>
      </div>
    `;
    viewCtrl.parentElement.insertBefore(bar, viewCtrl);

    // Garante que Modo Cliente, Margem, Detalhes e Subtotais iniciem desmarcados nativamente
    this.modoCliente = false;
    this.markupEnabled = false;
    document.body.classList.remove('client-proposal-mode');
    document.body.classList.add('markup-disabled', 'hide-secondary-details', 'hide-subtotals');
    this.atualizarVisibilidadeDetalhes();
  },

  toggleModoCliente() {
    const pct = this.obterMarkupEfetivo();
    
    // BLOQUEIO DE SEGURANÇA: Impede ligar Modo Cliente se não houver margem positiva aplicada
    if (!this.modoCliente) {
      if (!this.markupEnabled || pct <= 0) {
        this.mostrarToast('⚠️ Defina uma margem maior que 0% antes de ativar o Modo Cliente.');
        const inputMarkup = document.getElementById('input-markup-pct');
        if (inputMarkup) inputMarkup.focus();
        return;
      }
    }

    this.modoCliente = !this.modoCliente;
    document.body.classList.toggle('client-proposal-mode', this.modoCliente);
    
    const btn = document.getElementById('btn-modo-cliente');
    if (btn) btn.classList.toggle('active', this.modoCliente);
    
    this.atualizarTitulosColunasModoCliente();
    this.recalcularSubtotais();
  },

  toggleMarkupAtivo() {
    this.markupEnabled = !this.markupEnabled;
    
    // Proteção: se desligar a margem enquanto o Modo Cliente estiver ligado, encerra o Modo Cliente imediatamente
    if (!this.markupEnabled && this.modoCliente) {
      this.modoCliente = false;
      document.body.classList.remove('client-proposal-mode');
      const btnCli = document.getElementById('btn-modo-cliente');
      if (btnCli) btnCli.classList.remove('active');
      this.mostrarToast('⚠️ Modo Cliente desativado por segurança: Margem desligada.');
    }

    const btn = document.getElementById('btn-toggle-markup');
    if (btn) btn.classList.toggle('active', this.markupEnabled);
    document.body.classList.toggle('markup-disabled', !this.markupEnabled);
    
    this.atualizarTitulosColunasModoCliente();
    this.recalcularSubtotais();
  },

  setMarkupPercent(val) {
    const parsed = parseFloat(val);
    this.markupPercent = isNaN(parsed) ? 0 : parsed;
    
    if (this.markupPercent > 0 && !this.markupEnabled) {
      this.markupEnabled = true;
      const btn = document.getElementById('btn-toggle-markup');
      if (btn) btn.classList.add('active');
      document.body.classList.remove('markup-disabled');
    }

    // Proteção: se o percentual for zerado ou negativo com Modo Cliente ativo, desativa-o
    if (this.markupPercent <= 0 && this.modoCliente) {
      this.modoCliente = false;
      document.body.classList.remove('client-proposal-mode');
      const btnCli = document.getElementById('btn-modo-cliente');
      if (btnCli) btnCli.classList.remove('active');
      this.mostrarToast('⚠️ Modo Cliente desativado: Margem zerada ou inválida.');
    }

    this.atualizarTitulosColunasModoCliente();
    this.recalcularSubtotais();
  },

  atualizarTitulosColunasModoCliente() {
    const pct = this.obterMarkupEfetivo();
    const tipoTag = this.calcMode === 'margin' ? 'MG' : 'MKP';
    const sufixoPct = pct !== 0 ? ` (${tipoTag} ${pct > 0 ? '+' : ''}${pct}%)` : '';

    document.querySelectorAll('.quote-block thead th').forEach(th => {
      if (!th.dataset.originalHeader) {
        th.dataset.originalHeader = th.innerText.trim();
      }
      const orig = th.dataset.originalHeader;
      if (!orig) return;

      if (th.classList.contains('col-margin-price')) {
        if (this.modoCliente) {
          if (/usd/i.test(orig)) th.innerText = 'Valor Unit. (USD)';
          else if (/brl/i.test(orig)) th.innerText = 'Valor Unit. (BRL)';
          else th.innerText = 'Valor Unitário';
        } else {
          if (/usd/i.test(orig)) th.innerText = `Valor c/ Margem (USD)${sufixoPct}`;
          else if (/brl/i.test(orig)) th.innerText = `Valor c/ Margem (BRL)${sufixoPct}`;
          else th.innerText = `Valor c/ Margem${sufixoPct}`;
        }
      } else {
        th.innerText = orig;
      }
    });
  },

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
    return `<input type="number" min="1" value="${val}" placeholder="-" oninput="Cotador.core.aoAlterarQuantidade(event, this)" title="Altera a quantidade em todas as tabelas comparativas (segure Shift para alterar apenas nesta linha)" class="qty-input">`;
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
        const matchSync = syncKey && otherTr.getAttribute('data-sync-key') === syncKey;
        const matchProd = !syncKey && prodKey && otherTr.getAttribute('data-prod-key') === prodKey;
        if (matchSync || matchProd) {
          const otherInput = otherTr.querySelector('.qty-input');
          if (otherInput && otherInput.value !== novaQtd) {
            otherInput.value = novaQtd;
          }
        }
      });
    }
    this.recalcularSubtotais();
  },

  renderDetalhesSoloCSP(contratoId, custoCom5, mensalSem5, anualSem5, fator = 1, isMarginCol = false) {
    if (contratoId !== 'am' && contratoId !== 'mm' && contratoId !== 'tm') return '';
    const anualCom5 = (custoCom5 * fator) * 12;
    const fmtAnualCom5 = `R$ ${this.formatBRL(anualCom5)}`;
    const labelInterno = `12x c/ 5%: ${fmtAnualCom5}`;
    const labelCliente = `Total 12x: ${fmtAnualCom5}`;

    if (isMarginCol) {
      return `<div class="sec-detail text-[11px] font-medium text-slate-600 mt-0.5">
        <span class="internal-only-text">${this.renderCopyLink(labelInterno, fmtAnualCom5, 'Total 12x c/ 5%')}</span>
        <span class="client-only-text">${this.renderCopyLink(labelCliente, fmtAnualCom5, 'Total 12 meses')}</span>
      </div>`;
    }
    return `<div class="sec-detail text-[11px] font-medium text-slate-600 mt-0.5">${this.renderCopyLink(labelInterno, fmtAnualCom5, 'Total 12x c/ 5%')}</div>`;
  },

  renderDetalhesScanCSP(contratoId, valorUnitario, fator = 1) {
    if (contratoId !== 'am' && contratoId !== 'mm') return '';
    const total12x = valorUnitario * fator * 12;
    const fmt12x = `R$ ${this.formatBRL(total12x)}`;
    return `<div class="sec-detail text-[11px] font-normal text-slate-500 mt-0.5">${this.renderCopyLink(`Total 12x: ${fmt12x}`, fmt12x, 'Total 12 meses')}</div>`;
  },

  renderRowActions() {
    return `<div class="flex items-center justify-end gap-1 whitespace-nowrap"><button type="button" onclick="Cotador.core.removerLinhaUnica(this)" title="Remover apenas este item desta tabela" class="text-[11px] font-normal text-slate-400 hover:text-red-600 hover:bg-red-50 rounded px-1.5 py-1 transition flex items-center gap-1"><span>&#10005;</span> <span class="hidden sm:inline">Remover</span></button><button type="button" onclick="Cotador.core.removerLinhasSemelhantes(this)" title="Remover este produto de todas as tabelas e contratos" class="text-[11px] font-medium text-slate-400 hover:text-red-700 hover:bg-red-100/80 border border-transparent hover:border-red-200 rounded px-1.5 py-1 transition flex items-center gap-1"><svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1 1h-4a1 1 0 00-1 1v3M4 7h16"/></svg><span class="hidden sm:inline">Semelhantes</span></button></div>`;
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
    const dataCompleta = infoData ? this.formatarDataHoraCompleta(infoData.iso) : '';

    const badgeDataHTML = dataCurta
      ? `<span title="Última atualização desta tabela no Supabase: ${dataCompleta}" class="sec-detail no-export text-[10px] font-normal text-slate-400 bg-white/80 border border-slate-200/80 px-2 py-0.5 rounded-full whitespace-nowrap">Atualizado em ${dataCurta}</span>`
      : '';

    return `<div onclick="Cotador.core.toggleBlock('${blockId}')" class="block-header-bar flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 cursor-pointer select-none" title="Clique na barra para recolher ou expandir esta tabela"><div class="flex items-center gap-2"><svg class="w-4 h-4 text-slate-400 chevron-icon transition-transform duration-150 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg><h3 onclick="Cotador.core.copiarBlocoAoClicarTitulo(event, '${blockId}')" title="Clique no título para copiar toda esta tabela" class="copy-link text-xs font-semibold text-slate-700 uppercase tracking-wide">${safeTitle}</h3></div><div class="flex items-center gap-2" onclick="event.stopPropagation()">${badgeDataHTML}<span id="total-${blockId}" onclick="Cotador.core.copiarElemento(event, this)" data-copy="" data-label="Total da Tabela" title="Clique para copiar o valor Total desta tabela (Shift+Clique para número puro)" class="copy-link block-total-badge text-xs font-semibold theme-badge px-2.5 py-0.5 rounded tabular-nums hidden"></span></div></div>`;
  },

  renderUnmatchedWarning(missingItems) {
    const old = document.getElementById('unmatched-items-banner');
    if (old) old.remove();
    if (!Array.isArray(missingItems) || missingItems.length === 0) return;

    const container = document.getElementById('resultado-container');
    if (!container) return;

    const tags = missingItems
      .map(it => `<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[11px] border border-amber-300">${this.escapeHTML(it.rawSearch)}</span>`)
      .join(' ');

    const html = `
      <div id="unmatched-items-banner" class="p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-semibold">Atenção:</span>
          <span>${missingItems.length === 1 ? '1 item da lista não retornou SKUs' : `${missingItems.length} itens da lista não retornaram SKUs`} nos filtros ativos:</span>
          ${tags}
        </div>
        <button type="button" onclick="this.parentElement.remove()" class="text-[11px] text-amber-700 hover:text-amber-950 font-medium px-1.5 py-0.5">Fechar &#10005;</button>
      </div>`;
    container.insertAdjacentHTML('afterbegin', html);
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
      }
    });
  },

  prepararLinhasDrag() {
    this.initDragEvents();

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

        const baseName = tr.getAttribute('data-prod-key') || this.obterChaveProduto(tr);
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
  },

  atualizarCambioAdobeEmTempoReal(novaTaxa) {
    const taxa = parseFloat(novaTaxa);
    if (isNaN(taxa) || taxa <= 0) return;

    document.querySelectorAll('.quote-block[data-currency="USD"]').forEach(block => {
      const oldTitle = block.getAttribute('data-title') || '';
      const newTitle = oldTitle.replace(/Câmbio:\s*R\$\s*[\d.,]+/i, `Câmbio: R$ ${this.formatBRL(taxa)}`);
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

  recalcularSubtotais() {
    this.prepararLinhasDrag();
    this.atualizarTitulosColunasModoCliente();
    const chkSub = document.getElementById('chk-mostrar-subtotal');
    const showSub = Boolean((chkSub && chkSub.checked) || this.modoCliente);
    document.body.classList.toggle('hide-subtotals', !showSub);
    const btnSub = document.getElementById('btn-toggle-subtotal');
    if (btnSub) btnSub.classList.toggle('active', showSub);
    document.querySelectorAll('.col-subtotal').forEach(el => el.classList.toggle('hidden', !showSub));

    const pctEfetivo = this.obterMarkupEfetivo();
    const fatorMarkup = this.calcularFatorComercial();
    const temMargemAtiva = pctEfetivo > 0;
    document.body.classList.toggle('has-active-markup', temMargemAtiva);

    document.querySelectorAll('.quote-block').forEach(block => {
      const isUSD = block.getAttribute('data-currency') === 'USD';
      let somaBloco = 0;
      let somaBlocoBrl = 0;
      let somaQtd = 0;
      let temQtd = false;

      block.querySelectorAll('tbody tr').forEach(tr => {
        if (!tr.hasAttribute('data-base-unit-price')) {
          tr.setAttribute('data-base-unit-price', tr.getAttribute('data-unit-price') || '0');
        }
        if (isUSD && !tr.hasAttribute('data-base-unit-price-brl')) {
          tr.setAttribute('data-base-unit-price-brl', tr.getAttribute('data-unit-price-brl') || '0');
        }

        const baseUnit = parseFloat(tr.getAttribute('data-base-unit-price'));
        const baseUnitBrl = parseFloat(tr.getAttribute('data-base-unit-price-brl'));
        const unitComMargem = baseUnit * fatorMarkup;
        const unitBrlComMargem = (!isNaN(baseUnitBrl) ? baseUnitBrl : 0) * fatorMarkup;

        tr.setAttribute('data-unit-price', String(unitComMargem));
        if (isUSD) tr.setAttribute('data-unit-price-brl', String(unitBrlComMargem));

        if (isUSD) {
          const tdMarginUsd = tr.querySelector('td.col-margin-usd');
          const tdMarginBrl = tr.querySelector('td.col-margin-brl');
          if (tdMarginUsd && !isNaN(unitComMargem)) {
            const fmtUsd = `US$ ${this.formatUSD(unitComMargem)}`;
            tdMarginUsd.innerHTML = this.renderCopyLink(fmtUsd, fmtUsd, 'Valor Unit. USD');
          }
          if (tdMarginBrl && !isNaN(unitBrlComMargem)) {
            const fmtBrl = `R$ ${this.formatBRL(unitBrlComMargem)}`;
            tdMarginBrl.innerHTML = this.renderCopyLink(fmtBrl, fmtBrl, 'Valor Unit. BRL');
          }
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
          } else if (tdMargin && (isNaN(unitComMargem) || unitComMargem <= 0)) {
            tdMargin.textContent = '-';
          }
        }

        const input = tr.querySelector('.qty-input');
        const subTd = tr.querySelector('.col-subtotal');
        if (!input || isNaN(unitComMargem)) return;

        const qty = parseInt(input.value, 10);
        if (!isNaN(qty) && qty > 0) {
          const sub = unitComMargem * qty;
          somaBloco += sub;
          somaQtd += qty;
          temQtd = true;

          if (isUSD) {
            const subBrl = unitBrlComMargem * qty;
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
          badgeTotal.innerHTML = `Total: ${valorUSD}<span class="font-normal opacity-80 ml-1.5">(${valorBRL})</span>`;
          badgeTotal.setAttribute('data-copy', valorUSD);
        } else {
          const valorFormatado = `R$ ${this.formatBRL(somaBloco)}`;
          badgeTotal.textContent = `Total: ${valorFormatado}`;
          badgeTotal.setAttribute('data-copy', valorFormatado);
        }
        badgeTotal.classList.toggle('hidden', !temQtd || !showSub);
      }

      // Renderiza ou atualiza o rodapé (tfoot) com a soma total na própria tabela
      const table = block.querySelector('table');
      if (table) {
        let tfoot = table.querySelector('tfoot.block-table-tfoot');
        if (!temQtd || !showSub) {
          if (tfoot) tfoot.remove();
        } else {
          if (!tfoot) {
            tfoot = document.createElement('tfoot');
            tfoot.className = 'block-table-tfoot';
            table.appendChild(tfoot);
          }
          const ths = Array.from(table.querySelectorAll('thead th'));
          const cellsHTML = ths.map((th, idx) => {
            if (idx === 0) {
              return `<td class="font-semibold text-slate-800">Total Geral</td>`;
            }
            if (idx === 1) {
              return `<td class="font-semibold text-slate-700 text-center tabular-nums">${somaQtd}</td>`;
            }
            if (th.classList.contains('col-subtotal')) {
              if (isUSD) {
                const fmtTotUSD = `US$ ${this.formatUSD(somaBloco)}`;
                const fmtTotBRL = `R$ ${this.formatBRL(somaBlocoBrl)}`;
                const brlSubLine = somaBlocoBrl > 0
                  ? `<div class="text-[11px] font-normal text-slate-500 mt-0.5">${this.renderCopyLink(fmtTotBRL, fmtTotBRL, 'Total Geral BRL')}</div>`
                  : '';
                return `<td class="col-subtotal font-bold theme-subtotal whitespace-nowrap tabular-nums">${this.renderCopyLink(fmtTotUSD, fmtTotUSD, 'Total Geral USD')}${brlSubLine}</td>`;
              }
              const fmtTot = `R$ ${this.formatBRL(somaBloco)}`;
              return `<td class="col-subtotal font-bold theme-subtotal whitespace-nowrap tabular-nums">${this.renderCopyLink(fmtTot, fmtTot, 'Total Geral')}</td>`;
            }
            if (idx === ths.length - 1) {
              return `<td></td>`;
            }
            const classesVisibilidade = ['col-pn', 'col-secondary', 'col-cost-normal', 'col-internal-cost', 'col-margin-price']
              .filter(c => th.classList.contains(c))
              .join(' ');
            return `<td class="${classesVisibilidade}"></td>`;
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
    const chkSub = document.getElementById('chk-mostrar-subtotal');
    const showSub = Boolean((chkSub && chkSub.checked) || this.modoCliente);
    const showDet = !document.body.classList.contains('hide-secondary-details');
    if (!showSub && cell.classList.contains('col-subtotal')) return false;
    if (!showDet && cell.classList.contains('col-secondary')) return false;
    if (this.modoCliente) {
      if (cell.classList.contains('col-pn')) return false;
      if (cell.classList.contains('col-cost-normal')) return false;
      if (cell.classList.contains('col-internal-cost')) return false;
    }
    return true;
  },

  limparTituloBlocoModoCliente(rawTitle) {
    const clean = String(rawTitle || '').replace(/^###\s*/, '');
    if (!this.modoCliente) return clean;
    return clean.replace(/\s*\(Faturamento:.*?\)/gi, '');
  },

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
    if (event && (event.shiftKey || event.altKey) && /[R$US$]/i.test(txt)) {
      const num = this.parsePrice(txt);
      if (num > 0) {
        txt = num.toFixed(2).replace('.', ',');
      } else {
        txt = txt.replace(/[R$US$\s]/gi, '').trim();
      }
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
    const title = this.limparTituloBlocoModoCliente(block.getAttribute('data-title'));
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

    const tfootTr = table.querySelector('tfoot.block-table-tfoot tr');
    if (tfootTr) {
      const footCells = Array.from(tfootTr.querySelectorAll('td'))
        .slice(0, -1)
        .filter(td => this.isColunaVisivel(td))
        .map(td => this.extrairValorCelula(td));
      if (footCells.length > 0) {
        tsv += `${footCells.join('\t')}\n`;
        html += `<tr style="background:#f8fafc;font-weight:bold;">${footCells.map(c => `<td style="border:1px solid #e2e8f0;font-weight:bold;">${c}</td>`).join('')}</tr>`;
      }
    }

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
  }
};