// ============================================================================
// NUCLEO CENTRAL BLINDADO (CORE) - COTADOR v5.6 ENTERPRISE (js/core.js)
// ============================================================================
window.Cotador = { core: {}, tables: {}, app: {} };

window.Cotador.core = {
  SUPABASE_URL: "https://rftvbxlbltmiwamjhgzl.supabase.co/rest/v1",
  SUPABASE_KEY: "sb_publishable_fN_BXmhXXod2gpeyJ8u38Q_rvgDPl7N",
  _dragInitialized: false,
  _draggedRow: null,
  _lastMouseDownTarget: null,

  SEARCH_KEYWORDS: {
    "phothosop": ["Photoshop"], "photshop": ["Photoshop"], "photosop": ["Photoshop"], "photoshop": ["Photoshop"],
    "ilustrator": ["Illustrator"], "illustrator": ["Illustrator"], "indesing": ["InDesign"], "acrobat pro": ["Acrobat", "Pro"],
    "creative cloud pro": ["Creative Cloud"], "creative cloud": ["Creative Cloud"], "business basic": ["Business Basic"],
    "business standard": ["Business Standard"], "business standart": ["Business Standard"], "business premium": ["Business Premium"],
    "exchange plan 1": ["Exchange Online", "Plan 1"], "exchange plan 2": ["Exchange Online", "Plan 2"],
    "exchange online": ["Exchange Online"], "planner": ["Planner"]
  },

  escapeHTML(str) {
    if (!str || typeof str !== 'string') return str || '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  },

  extrairKeywords(prodName) {
    const lower = prodName.toLowerCase().trim();
    for (const [key, kwList] of Object.entries(this.SEARCH_KEYWORDS)) {
      if (lower === key || lower.includes(key)) return kwList;
    }
    return prodName.replace(/[()]/g, ' ').split(/\s+/).filter(w => w.length > 0);
  },

  detectarSegmentoItem(nomeProduto, segmentoRaw) {
    const nome = (nomeProduto || '').toLowerCase();
    const seg = (segmentoRaw || '').trim().toLowerCase();

    const isEdu = ['education', 'faculty', 'student', 'academic', 'academico', 'acadêmico'].some(t => seg.includes(t) || nome.includes(t));
    if (isEdu) return 'education';

    const isCharity = ['charity', 'non-profit', 'nonprofit', 'non profit', 'donation', 'filantropia'].some(t => seg.includes(t) || nome.includes(t));
    if (isCharity) return 'charity';

    const isGov = ['government', 'gov ', 'governo', 'public sector', 'setor publico', 'setor público'].some(t => seg.includes(t) || nome.includes(t));
    if (isGov) return 'government';

    return 'commercial';
  },

  isItemSegmentoValido(nomeProduto, segmentoRaw, allowedSegments, precoUnitario) {
    if (typeof precoUnitario === 'number' && precoUnitario < 0) return false;
    const activeSegs = Array.isArray(allowedSegments) && allowedSegments.length > 0
      ? allowedSegments
      : ['commercial'];
    const itemSeg = this.detectarSegmentoItem(nomeProduto, segmentoRaw);
    return activeSegs.includes(itemSeg);
  },

  isItemComercialValido(nomeProduto, segmento, precoUnitario) {
    return this.isItemSegmentoValido(nomeProduto, segmento, ['commercial'], precoUnitario);
  },

  parseInputLines(rawText) {
    const lines = rawText.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const items = [];
    let sumLicenses = 0;

    lines.forEach((line, idx) => {
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
        itemIndex: idx,
        original: this.escapeHTML(prodName),
        rawSearch: prodName,
        keywords: this.extrairKeywords(prodName),
        qty: qty !== null ? qty : '-'
      });
    });

    return { items, sumLicenses };
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

  renderPnBadge(pn) {
    const safePn = this.escapeHTML(pn);
    return `<button type="button" onclick="Cotador.core.copiarTextoUnico('${safePn}')" title="Clique para copiar este PN" class="pn-badge" data-pn-val="${safePn}"><span>${safePn}</span><svg class="w-3.5 h-3.5 copy-icon shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>`;
  },

  renderQtyInput(qty) {
    const val = (qty === '-' || isNaN(qty)) ? '' : qty;
    return `<input type="number" min="1" value="${val}" placeholder="-" oninput="Cotador.core.recalcularSubtotais()" class="qty-input">`;
  },

  renderRowActions() {
    return `<div class="flex items-center justify-end gap-1 whitespace-nowrap"><button type="button" onclick="Cotador.core.removerLinhaUnica(this)" title="Remover apenas este item desta tabela" class="text-[11px] font-normal text-slate-400 hover:text-red-600 hover:bg-red-50 rounded px-1.5 py-1 transition flex items-center gap-1"><span>&#10005;</span> <span class="hidden sm:inline">Remover</span></button><button type="button" onclick="Cotador.core.removerLinhasSemelhantes(this)" title="Remover este produto de todas as tabelas e contratos" class="text-[11px] font-medium text-slate-400 hover:text-red-700 hover:bg-red-100/80 border border-transparent hover:border-red-200 rounded px-1.5 py-1 transition flex items-center gap-1"><svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg><span class="hidden sm:inline">Semelhantes</span></button></div>`;
  },

  obterChaveProduto(tr) {
    const firstTd = tr ? tr.querySelector('td') : null;
    if (!firstTd) return '';
    const cloneTd = firstTd.cloneNode(true);
    cloneTd.querySelectorAll('.no-export').forEach(el => el.remove());
    return cloneTd.innerText.replace(/\s+/g, ' ').trim().toLowerCase();
  },

  removerLinhaUnica(btn) {
    const tr = btn.closest('tr');
    if (!tr) return;
    tr.remove();
    this.recalcularSubtotais();
  },

  removerLinhasSemelhantes(btn) {
    const tr = btn.closest('tr');
    if (!tr) return;
    const chaveAlvo = tr.getAttribute('data-prod-key') || this.obterChaveProduto(tr);
    if (!chaveAlvo) {
      tr.remove();
      this.recalcularSubtotais();
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
    this.recalcularSubtotais();
    this.mostrarToast(`Produto removido em ${removidos} linha(s)/tabela(s)!`);
  },

  renderNotFoundRow(item, colspan) {
    return `<tr class="bg-amber-50/40"><td class="text-amber-900 font-medium">${item.original} <span class="text-xs font-normal text-amber-700">(Qtd: ${item.qty})</span></td><td colspan="${colspan}" class="text-amber-700 text-xs font-normal">Produto não localizado nesta modalidade com os filtros ativos.</td></tr>`;
  },

  renderBlockHeader(title, blockId) {
    return `<div onclick="Cotador.core.toggleBlock('${blockId}')" class="block-header-bar flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 cursor-pointer select-none" title="Clique para recolher ou expandir esta tabela"><div class="flex items-center gap-2"><svg class="w-4 h-4 text-slate-400 chevron-icon transition-transform duration-150 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg><h3 class="text-xs font-semibold text-slate-700 uppercase tracking-wide">${title}</h3></div><div class="flex items-center gap-1.5" onclick="event.stopPropagation()"><span id="total-${blockId}" class="block-total-badge text-xs font-semibold theme-badge px-2.5 py-0.5 rounded tabular-nums mr-1 hidden"></span><button type="button" onclick="Cotador.core.copiarBlocoUnico('${blockId}', false)" class="text-[11px] font-medium px-2.5 py-1 rounded bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition">Copiar Tabela</button><button type="button" onclick="Cotador.core.copiarBlocoUnico('${blockId}', true)" class="text-[11px] font-medium px-2.5 py-1 rounded btn-theme-primary">Copiar PNs</button></div></div>`;
  },

  // ==========================================================================
  // DRAG & DROP DE LINHAS COM SINCRONIZACAO ENTRE TABELAS DE CONTRATO/PERIODO
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
      if (this._lastMouseDownTarget && this._lastMouseDownTarget.closest('input, button:not(.drag-handle)')) {
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

  moverLinha(btn, direcao) {
    const tr = btn.closest('tr');
    if (!tr || !tr.parentElement) return;
    const tbody = tr.parentElement;
    if (direcao < 0 && tr.previousElementSibling) {
      tbody.insertBefore(tr, tr.previousElementSibling);
    } else if (direcao > 0 && tr.nextElementSibling) {
      tbody.insertBefore(tr.nextElementSibling, tr);
    } else {
      return;
    }
    this.sincronizarOrdemTabelas(tbody, tr);
    this.atualizarMarkdownBruto();
  },

  prepararLinhasDrag() {
    this.initDragEvents();
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
            <span class="drag-handle" title="Arraste para organizar (sincroniza entre contratos)">
              <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="3.5" r="1.2"/><circle cx="10.5" cy="3.5" r="1.2"/><circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/><circle cx="5.5" cy="12.5" r="1.2"/><circle cx="10.5" cy="12.5" r="1.2"/></svg>
            </span>
            <span class="row-move-btns">
              <button type="button" class="row-move-btn" onclick="Cotador.core.moverLinha(this, -1)" title="Subir linha">&#9650;</button>
              <button type="button" class="row-move-btn" onclick="Cotador.core.moverLinha(this, 1)" title="Descer linha">&#9660;</button>
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
        badgeTotal.classList.toggle('hidden', !temQtd || !showSub);
      }
    });
    this.atualizarMarkdownBruto();
  },

  extrairValorCelula(td) {
    const input = td.querySelector('.qty-input');
    if (input) return input.value ? input.value : '-';
    const badge = td.querySelector('.pn-badge');
    if (badge) return badge.getAttribute('data-pn-val') || badge.childNodes[0].textContent.trim();
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
    document.getElementById('markdown-output').textContent = md.trim();
  },

  mostrarToast(msg) {
    const t = document.getElementById('copy-toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.add('hidden'), 2400);
  },

  copiarTextoUnico(txt) {
    navigator.clipboard.writeText(txt);
    this.mostrarToast(`PN copiado: ${txt}`);
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

  copiarBlocoUnico(blockId, apenasPNs) {
    const block = document.getElementById(blockId);
    if (!block) return;
    if (apenasPNs) {
      const pns = Array.from(block.querySelectorAll('tbody tr[data-pn]')).map(tr => tr.getAttribute('data-pn'));
      navigator.clipboard.writeText(pns.join('\n'));
      this.mostrarToast(`${pns.length} PN(s) copiados!`);
      return;
    }
    const { tsv, html } = this.gerarExtracaoBloco(block);
    this.copiarRichTextOuTexto(tsv, html, 'Tabela copiada!');
  },

  copiarApenasPNsGlobal() {
    const pns = Array.from(document.querySelectorAll('tbody tr[data-pn]')).map(tr => tr.getAttribute('data-pn'));
    navigator.clipboard.writeText(pns.join('\n'));
    this.mostrarToast(`${pns.length} PNs copiados em lista!`);
  },

  copiarMarkdown() {
    this.atualizarMarkdownBruto();
    navigator.clipboard.writeText(document.getElementById('markdown-output').textContent);
    this.mostrarToast('Markdown copiado!');
  },

  copiarTabelasHTML() {
    const blocks = document.querySelectorAll('.quote-block');
    let allTsv = '';
    let allHtml = '';
    blocks.forEach(block => {
      const { tsv, html } = this.gerarExtracaoBloco(block);
      allTsv += tsv + '\n';
      allHtml += html;
    });
    this.copiarRichTextOuTexto(allTsv, allHtml, 'Proposta completa copiada (Excel / Word / Teams)!');
  }
};