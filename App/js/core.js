window.Cotador = window.Cotador || {};
window.Cotador.tables = window.Cotador.tables || {};

window.Cotador.core = {
  SUPABASE_URL: "https://rftvbxlbltmiwamjhgzl.supabase.co/rest/v1",
  SUPABASE_KEY: "sb_publishable_fN_BXmhXXod2gpeyJ8u38Q_rvgDPl7N",

  // Dicionário de sinônimos e correção de digitação do input bruto
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
    "business premium": ["Business Premium"],
    "exchange plan 1": ["Exchange Online", "Plan 1"],
    "exchange plan 2": ["Exchange Online", "Plan 2"],
    "exchange online": ["Exchange Online"],
    "planner": ["Planner"]
  },

  extrairKeywords(prodName) {
    const lower = prodName.toLowerCase().trim();
    for (const [key, kwList] of Object.entries(this.SEARCH_KEYWORDS)) {
      if (lower === key || lower.includes(key)) return kwList;
    }
    return prodName.replace(/[()]/g, ' ').split(/\s+/).filter(w => w.length > 0);
  },

  parseInputLines(rawText) {
    const lines = rawText.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const items = [];
    let sumLicenses = 0;

    lines.forEach(line => {
      const clean = line.replace(/\b(unidades|unidade|licenças|licencas|lic|unid|un)\b/gi, '').trim();
      let qty = null;
      let prodName = clean;

      const matchEnd = clean.match(/^(.*?)(?:[\s\-:]+)(\d+)\s*$/);
      const matchStart = clean.match(/^(\d+)(?:x|\s+|\s*-\s*)(.+)$/i);

      if (matchEnd) {
        prodName = matchEnd[1].trim();
        qty = parseInt(matchEnd[2], 10);
      } else if (matchStart) {
        qty = parseInt(matchStart[1], 10);
        prodName = matchStart[2].trim();
      }

      if (qty !== null && !isNaN(qty)) sumLicenses += qty;

      items.push({
        original: prodName,
        keywords: this.extrairKeywords(prodName),
        qty: qty !== null ? qty : '-'
      });
    });

    return { items, sumLicenses };
  },

  async fetchSupabase(table, paramsArray) {
    const qs = paramsArray.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const url = `${this.SUPABASE_URL}/${table}?${qs}`;
    
    // Chaves sb_publishable_ devem ir APENAS no header 'apikey'
    const headers = {
      'apikey': this.SUPABASE_KEY,
      'Accept': 'application/json'
    };
    if (this.SUPABASE_KEY.startsWith('eyJ')) {
      headers['Authorization'] = `Bearer ${this.SUPABASE_KEY}`;
    }

    const resp = await fetch(url, { method: 'GET', headers });
    if (!resp.ok) {
      const errTxt = await resp.text();
      throw new Error(`Erro Supabase (${resp.status}) em [${table}]: ${errTxt}`);
    }
    return await resp.json();
  },

  parsePrice(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let str = String(val).replace(/[R$US$\s]/g, '').trim();
    if (str === '-' || str === '') return 0;
    if (str.includes('.') && str.includes(',')) {
      if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
        str = str.replace(/\./g, '').replace(',', '.');
      } else {
        str = str.replace(/,/g, '');
      }
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  },

  formatBRL(num) {
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  formatUSD(num) {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  renderPnBadge(pn) {
    return `<span onclick="Cotador.core.copiarTextoUnico('${pn}')" title="Clique para copiar este PN" class="pn-badge">${pn} <span class="text-[10px] opacity-60">📋</span></span>`;
  },

  renderQtyInput(qty) {
    const val = (qty === '-' || isNaN(qty)) ? '' : qty;
    return `<input type="number" min="1" value="${val}" placeholder="-" oninput="Cotador.core.recalcularSubtotais()" class="qty-input">`;
  },

  renderNotFoundRow(item, colspan) {
    return `
      <tr>
        <td class="text-red-400 font-medium">${item.original} (${item.qty})</td>
        <td colspan="${colspan}" class="text-red-400 text-xs">Produto não localizado nesta tabela com os filtros ativos.</td>
      </tr>`;
  },

  renderBlockHeader(title, blockId) {
    return `
      <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 px-3.5 py-2.5 rounded-t-lg border border-b-0 border-slate-700">
        <h3 class="text-xs font-bold text-sky-400 uppercase tracking-wider">${title}</h3>
        <div class="flex items-center gap-2">
          <span id="total-${blockId}" class="text-xs font-bold text-emerald-400 mr-2 hidden"></span>
          <button onclick="Cotador.core.copiarBlocoUnico('${blockId}', false)" class="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition">
            📑 Copiar Tabela
          </button>
          <button onclick="Cotador.core.copiarBlocoUnico('${blockId}', true)" class="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition">
            🔢 Copiar PNs
          </button>
        </div>
      </div>`;
  },

  recalcularSubtotais() {
    const showSub = document.getElementById('chk-mostrar-subtotal').checked;
    document.querySelectorAll('.col-subtotal').forEach(el => el.classList.toggle('hidden', !showSub));

    document.querySelectorAll('.quote-block').forEach(block => {
      let somaBloco = 0;
      let temQtd = false;

      block.querySelectorAll('tbody tr').forEach(tr => {
        const unit = parseFloat(tr.getAttribute('data-unit-price'));
        const input = tr.querySelector('.qty-input');
        const subTd = tr.querySelector('.col-subtotal');
        if (!input || isNaN(unit)) return;

        const qty = parseInt(input.value, 10);
        if (!isNaN(qty) && qty > 0) {
          const sub = unit * qty;
          somaBloco += sub;
          temQtd = true;
          if (subTd) subTd.textContent = `R$ ${this.formatBRL(sub)}`;
        } else if (subTd) {
          subTd.textContent = '-';
        }
      });

      const badgeTotal = document.getElementById(`total-${block.id}`);
      if (badgeTotal) {
        badgeTotal.textContent = `Total: R$ ${this.formatBRL(somaBloco)}`;
        badgeTotal.classList.toggle('hidden', !temQtd);
      }
    });

    this.atualizarMarkdownBruto();
  },

  extrairValorCelula(td) {
    const input = td.querySelector('.qty-input');
    if (input) return input.value ? input.value : '-';
    const badge = td.querySelector('.pn-badge');
    if (badge) return badge.childNodes[0].textContent.trim();
    return td.innerText.trim();
  },

  atualizarMarkdownBruto() {
    const showSub = document.getElementById('chk-mostrar-subtotal').checked;
    const blocks = document.querySelectorAll('.quote-block');
    let md = '';

    blocks.forEach(block => {
      md += `${block.getAttribute('data-title')}\n`;
      const table = block.querySelector('table');
      const headers = Array.from(table.querySelectorAll('thead th'))
        .slice(0, -1)
        .filter(th => showSub || !th.classList.contains('col-subtotal'))
        .map(th => th.innerText.trim());

      md += `| ${headers.join(' | ')} |\n|${headers.map(() => '---').join('|')}|\n`;

      table.querySelectorAll('tbody tr').forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td'))
          .slice(0, -1)
          .filter(td => showSub || !td.classList.contains('col-subtotal'));
        if (cells.length > 0) {
          md += `| ${cells.map(td => this.extrairValorCelula(td)).join(' | ')} |\n`;
        }
      });
      md += '\n';
    });

    document.getElementById('markdown-output').textContent = md.trim();
  },

  mostrarToast(msg) {
    const t = document.getElementById('copy-toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 2200);
  },

  copiarTextoUnico(txt) {
    navigator.clipboard.writeText(txt);
    this.mostrarToast(`✅ PN copiado: ${txt}`);
  },

  copiarBlocoUnico(blockId, apenasPNs) {
    const showSub = document.getElementById('chk-mostrar-subtotal').checked;
    const block = document.getElementById(blockId);
    if (!block) return;

    if (apenasPNs) {
      const pns = Array.from(block.querySelectorAll('tbody tr[data-pn]')).map(tr => tr.getAttribute('data-pn'));
      navigator.clipboard.writeText(pns.join('\n'));
      this.mostrarToast(`✅ ${pns.length} PN(s) copiados!`);
      return;
    }

    let out = block.getAttribute('data-title').replace('### ', '') + '\n';
    const table = block.querySelector('table');
    const headers = Array.from(table.querySelectorAll('thead th'))
      .slice(0, -1)
      .filter(th => showSub || !th.classList.contains('col-subtotal'))
      .map(th => th.innerText.trim());
    out += headers.join('\t') + '\n';

    table.querySelectorAll('tbody tr').forEach(tr => {
      const cells = Array.from(tr.querySelectorAll('td'))
        .slice(0, -1)
        .filter(td => showSub || !td.classList.contains('col-subtotal'))
        .map(td => this.extrairValorCelula(td));
      out += cells.join('\t') + '\n';
    });

    navigator.clipboard.writeText(out.trim());
    this.mostrarToast('✅ Tabela copiada!');
  },

  copiarApenasPNsGlobal() {
    const pns = Array.from(document.querySelectorAll('tbody tr[data-pn]')).map(tr => tr.getAttribute('data-pn'));
    navigator.clipboard.writeText(pns.join('\n'));
    this.mostrarToast(`✅ ${pns.length} PNs copiados em lista!`);
  },

  copiarMarkdown() {
    this.atualizarMarkdownBruto();
    navigator.clipboard.writeText(document.getElementById('markdown-output').textContent);
    this.mostrarToast('✅ Markdown copiado!');
  },

  copiarTabelasHTML() {
    const showSub = document.getElementById('chk-mostrar-subtotal').checked;
    const blocks = document.querySelectorAll('.quote-block');
    let textTab = '';

    blocks.forEach(block => {
      textTab += `${block.getAttribute('data-title').replace('### ', '')}\n`;
      const table = block.querySelector('table');
      const headers = Array.from(table.querySelectorAll('thead th'))
        .slice(0, -1)
        .filter(th => showSub || !th.classList.contains('col-subtotal'))
        .map(th => th.innerText.trim());
      textTab += headers.join('\t') + '\n';

      table.querySelectorAll('tbody tr').forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td'))
          .slice(0, -1)
          .filter(td => showSub || !td.classList.contains('col-subtotal'))
          .map(td => this.extrairValorCelula(td));
        textTab += cells.join('\t') + '\n';
      });
      textTab += '\n';
    });

    navigator.clipboard.writeText(textTab.trim());
    this.mostrarToast('✅ Todas as tabelas copiadas para Excel/Proposta!');
  }
};