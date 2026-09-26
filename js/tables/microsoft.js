// ============================================================================
// MÓDULO DE TABELAS: MICROSOFT (Scan, Solo, Perpétuo, MPSA) - v5.7 ENTERPRISE
// Arquivo: js/tables/microsoft.js
// ============================================================================
window.Cotador.tables.ms_scan = {
  async processar(parsedItems, flags = {}) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    if (!flags.append) container.innerHTML = '';

    const promessas = parsedItems.map(async item => {
      const params = [['select', '*'], ['limit', '400']];
      item.keywords.forEach(kw => params.push(['offer_display_name', `ilike.*${kw}*`]));
      let data = await core.fetchSupabase('microsoft_scan', params);

      data = data.filter(r => {
        const nome = (r.offer_display_name || '').toLowerCase();
        const preco = core.parsePrice(r.preco_unitario);
        if (!core.isItemSegmentoValido(r.offer_display_name, r, flags.segmentos, preco)) return false;
        if (flags.hideNoTeams && /\b(no|sem|without)\s+teams\b/i.test(nome)) return false;
        if (flags.hideCopilot && (nome.includes('copilot') || nome.includes('add-on') || nome.includes('attach'))) return false;
        if (flags.hideTrial && /\b(trial|free|gratuito|promo)\b/i.test(nome)) return false;
        if (flags.hideFrontline && /\b(frontline|kiosk|f1|f3)\b/i.test(nome)) return false;
        return true;
      });
      return { item, data };
    });

    const resultadosPorItem = await Promise.all(promessas);

    for (const c of (flags.contratos || [])) {
      let rowsHTML = '';
      for (const { item, data } of resultadosPorItem) {
        const filtrados = data.filter(r => {
          const termo = (r.tempo_contrato || '').trim().toUpperCase();
          const plano = (r.ciclo_pagamento || '').trim().toUpperCase();
          return (c.scanTempo.toUpperCase() === termo) && (c.scanCiclo.toUpperCase() === plano);
        });

        filtrados.forEach(r => {
          const tabela = core.parsePrice(r.preco_unitario);
          const finalDesc = tabela * 0.93;
          const pn = r.sku;
          const fmtTabela = `R$ ${core.formatBRL(tabela)}`;
          const fmtFinal = `R$ ${core.formatBRL(finalDesc)}`;
          const segBadge = core.renderSegmentBadge(r.offer_display_name, r, flags.segmentos);

          rowsHTML += `<tr data-unit-price="${finalDesc}" data-pn="${core.escapeHTML(pn)}">
            <td class="font-medium text-slate-800">${core.renderCopyLink(r.offer_display_name, r.offer_display_name, 'Produto')}${segBadge}</td>
            <td>${core.renderQtyInput(item.qty)}</td>
            <td>${core.renderPnBadge(pn)}</td>
            <td class="col-secondary text-slate-400 font-normal whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtTabela, fmtTabela, 'Custo Tabela')}</td>
            <td class="font-medium text-slate-800 whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtFinal, fmtFinal, 'Custo Final (-7%)')}</td>
            <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
            <td class="text-right">${core.renderRowActions()}</td>
          </tr>`;
        });
      }

      if (!rowsHTML) continue;

      const bId = `blk-scan-${c.id}`;
      const headerTitle = `Contrato: ${c.label} (Faturamento: Scansource -7%)`;
      container.insertAdjacentHTML('beforeend', `<div id="${bId}" class="quote-block" data-title="### ${headerTitle}">${core.renderBlockHeader(headerTitle, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200"><table><thead><tr><th>Produto</th><th>Qtd</th><th>PN (SKU)</th><th class="col-secondary">Custo Tabela</th><th>Custo Final (-7%)</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`);
    }
  }
};

window.Cotador.tables.ms_solo = {
  async processar(parsedItems, flags = {}) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    if (!flags.append) container.innerHTML = '';

    const promessas = parsedItems.map(async item => {
      const params = [['select', '*'], ['limit', '1000']];
      item.keywords.forEach(kw => params.push(['titulo_sku', `ilike.*${kw}*`]));
      let data = await core.fetchSupabase('microsoft_solo', params);

      data = data.filter(r => {
        const nome = (r.titulo_sku || '').toLowerCase();
        const preco = core.getSoloPrice(r);
        if (!core.isItemSegmentoValido(r.titulo_sku, r, flags.segmentos, preco)) return false;
        if (flags.hideNoTeams && /\b(no|sem|without)\s+teams\b/i.test(nome)) return false;
        if (flags.hideCopilot && (nome.includes('copilot') || nome.includes('add-on') || nome.includes('attach'))) return false;
        if (flags.hideTrial && /\b(trial|free|gratuito|promo)\b/i.test(nome)) return false;
        if (flags.hideFrontline && /\b(frontline|kiosk|f1|f3)\b/i.test(nome)) return false;
        return true;
      });
      return { item, data };
    });

    const resultadosPorItem = await Promise.all(promessas);

    for (const c of (flags.contratos || [])) {
      let rowsHTML = '';
      for (const { item, data } of resultadosPorItem) {
        const filtrados = data.filter(r =>
          (r.termo_duracao || '').trim().toUpperCase() === c.soloTermo &&
          (r.plano_pagamento || '').trim().toLowerCase() === c.soloPlano.toLowerCase()
        );

        filtrados.forEach(r => {
          const skuId = String(r.sku_id || '').padStart(4, '0');
          const pn = `${r.id_produto}-${skuId}-${r.termo_duracao}-${r.plano_pagamento}`;
          const custo = core.getSoloPrice(r);
          const fmtCusto = `R$ ${core.formatBRL(custo)}`;
          const mensalParc = core.parsePrice(r.termo_anual_pagamento_mensal);
          const fmtParc = `R$ ${core.formatBRL(mensalParc)}`;
          const infoMensal = (c.id === 'am' && mensalParc > 0)
            ? `<div class="sec-detail text-[11px] font-normal text-slate-500 mt-0.5">${core.renderCopyLink(`12x de ${fmtParc}/mês`, fmtParc, 'Parcela Mensal')}</div>`
            : '';
          const segBadge = core.renderSegmentBadge(r.titulo_sku, r, flags.segmentos);

          rowsHTML += `<tr data-unit-price="${custo}" data-pn="${core.escapeHTML(pn)}">
            <td class="font-medium text-slate-800">${core.renderCopyLink(r.titulo_sku, r.titulo_sku, 'Produto')}${segBadge}</td>
            <td>${core.renderQtyInput(item.qty)}</td>
            <td>${core.renderPnBadge(pn)}</td>
            <td class="font-medium text-slate-800 whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtCusto, fmtCusto, 'Valor com 5% Serviços')}${infoMensal}</td>
            <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
            <td class="text-right">${core.renderRowActions()}</td>
          </tr>`;
        });
      }

      if (!rowsHTML) continue;

      const bId = `blk-solo-${c.id}`;
      const headerTitle = `Contrato: ${c.label} (Faturamento: Solo CSP)`;
      container.insertAdjacentHTML('beforeend', `<div id="${bId}" class="quote-block" data-title="### ${headerTitle}">${core.renderBlockHeader(headerTitle, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200"><table><thead><tr><th>Produto</th><th>Qtd</th><th>PN (SKU)</th><th>Valor com 5% Serviços</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`);
    }
  }
};

window.Cotador.tables.ms_perpetuo = {
  async processar(parsedItems, flags = {}) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    if (!flags.append) container.innerHTML = '';
    let rowsHTML = '';

    const segOrFilter = core.construirFiltroPostgrestSegmento('segment', flags.segmentos);

    const promessas = parsedItems.map(async item => {
      const params = [['select', '*'], ['limit', '600']];
      item.keywords.forEach(kw => params.push(['nome_produto', `ilike.*${kw}*`]));
      if (segOrFilter) params.push(['or', segOrFilter]);

      let data = [];
      try {
        data = await core.fetchSupabase('microsoft_perpetuo', params);
      } catch (_) {
        // Fallback caso a cláusula OR encontre alguma restrição de schema
        const fallbackParams = [['select', '*'], ['limit', '600']];
        item.keywords.forEach(kw => fallbackParams.push(['nome_produto', `ilike.*${kw}*`]));
        data = await core.fetchSupabase('microsoft_perpetuo', fallbackParams);
      }

      data = data.filter(r => {
        const nome = (r.nome_produto || '').toLowerCase();
        const preco = core.parsePrice(r.fob_impostos || r.erp);
        if (!core.isItemSegmentoValido(r.nome_produto, r, flags.segmentos, preco)) return false;
        if (flags.pmHideMensal && /\b(1\s*m|month|mensal|p1m)\b/i.test(nome)) return false;
        if (flags.pmHideAnual && /\b(1\s*y|1\s*year|1\s*ano|annual|anual|p1y)\b/i.test(nome)) return false;
        if (flags.pmHideTrienal && /\b(3\s*y|3\s*year|3\s*anos|trienal|triennial|p3y)\b/i.test(nome)) return false;
        if (flags.pmHideStepup && /\b(step-up|step up|upgrade|migration)\b/i.test(nome)) return false;
        if (flags.pmHideCals && /\b(cal|rds)\b/i.test(nome)) return false;
        return true;
      });
      return { item, data };
    });

    const resultados = await Promise.all(promessas);
    resultados.forEach(({ item, data }) => {
      data.forEach(row => {
        const skuId = String(row.sku_id || '').padStart(4, '0');
        const pn = `${row.product_id}-${skuId}`;
        const preco = core.parsePrice(row.fob_impostos || row.erp);
        const fmtPreco = `R$ ${core.formatBRL(preco)}`;
        const segBadge = core.renderSegmentBadge(row.nome_produto, row, flags.segmentos);

        rowsHTML += `<tr data-unit-price="${preco}" data-pn="${core.escapeHTML(pn)}">
          <td class="font-medium text-slate-800">${core.renderCopyLink(row.nome_produto, row.nome_produto, 'Produto')}${segBadge}</td>
          <td>${core.renderQtyInput(item.qty)}</td>
          <td>${core.renderPnBadge(pn)}</td>
          <td class="font-medium text-slate-800 whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtPreco, fmtPreco, 'Custo Final')}</td>
          <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
          <td class="text-right">${core.renderRowActions()}</td>
        </tr>`;
      });
    });

    if (!rowsHTML) return;

    const bId = 'blk-perpetuo';
    const title = 'Microsoft CSP Perpétuo (Faturamento: Solo)';
    container.insertAdjacentHTML('beforeend', `<div id="${bId}" class="quote-block" data-title="### ${title}">${core.renderBlockHeader(title, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200"><table><thead><tr><th>Produto</th><th>Qtd</th><th>PN (SKU)</th><th>Custo Final (FOB+Impostos)</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`);
  }
};

window.Cotador.tables.ms_mpsa = {
  gerarTermosAbreviadosMPSA(rawSearch, keywords) {
    const lower = rawSearch.toLowerCase();
    const terms = [];
    if (lower.includes('office') && (lower.includes('standard') || lower.includes('std'))) {
      terms.push('OffStd');
    } else if (lower.includes('windows server') || lower.includes('win server')) {
      if (lower.includes('datacenter') || lower.includes('datacent')) terms.push('WinSvrDtc');
      else if (lower.includes('standard') || lower.includes('standar') || lower.includes('std')) terms.push('WinSvrStd');
      else terms.push('WinSvr');
    } else if (lower.includes('sql server')) {
      if (lower.includes('enterprise')) terms.push('SQLSvrEnt');
      else if (lower.includes('standard') || lower.includes('standar') || lower.includes('std')) terms.push('SQLSvrStd');
      else terms.push('SQLSvr');
    }
    return terms;
  },

  async processar(parsedItems, flags = {}) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    if (!flags.append) container.innerHTML = '';
    let rowsHTML = '';

    const promessas = parsedItems.map(async item => {
      const queries = [];

      // 1. Busca pelas keywords diretas
      const p1 = [['select', '*'], ['limit', '300']];
      item.keywords.forEach(kw => p1.push(['nome_curto_peca', `ilike.*${kw}*`]));
      queries.push(core.fetchSupabase('microsoft_mpsa', p1));

      // 2. Busca complementar pelas abreviações oficiais MPSA (ex: WinSvrStd, OffStd)
      const abrevTerms = this.gerarTermosAbreviadosMPSA(item.rawSearch, item.keywords);
      if (abrevTerms.length > 0) {
        const p2 = [['select', '*'], ['limit', '300']];
        abrevTerms.forEach(kw => p2.push(['nome_curto_peca', `ilike.*${kw}*`]));
        queries.push(core.fetchSupabase('microsoft_mpsa', p2));
      }

      const listas = await Promise.all(queries);
      const seen = new Set();
      let data = [];
      listas.flat().forEach(r => {
        const key = `${r.numero_item || ''}_${r.nome_curto_peca || ''}_${r.uso_recurso || ''}_${r.pool || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          data.push(r);
        }
      });

      data = data.filter(r => {
        const nome = (r.nome_curto_peca || '').toLowerCase();
        const uso = (r.uso_recurso || '').toLowerCase();
        const preco = core.parsePrice(r.custo_com_imposto || r.valor_preco_liquido_atual);
        if (!core.isItemSegmentoValido(r.nome_curto_peca, r, flags.segmentos, preco)) return false;
        if (flags.pmHideMensal && /\b(1\s*m|month|mensal)\b/i.test(nome)) return false;
        if (flags.pmHideAnual && /\b(1\s*y|1\s*year|1\s*ano|annual|anual)\b/i.test(nome)) return false;
        if (flags.pmHideTrienal && /\b(3\s*y|3\s*year|3\s*anos|trienal|triennial)\b/i.test(nome)) return false;
        if (flags.pmHideStepup && /\b(step-up|step up|upgrade|migration)\b/i.test(nome + ' ' + uso)) return false;
        if (flags.pmHideCals && /\b(cal|rds)\b/i.test(nome + ' ' + uso)) return false;
        if (flags.hideSA && (uso.includes('sa only') || nome.includes('sa only'))) return false;
        if (flags.hideLicSA && (uso.includes('license and software assurance') || uso.includes('lic/sa') || nome.includes('licsa'))) return false;
        if (flags.hideLicOnly && (uso.includes('license only') || uso === 'license')) return false;
        return true;
      });
      return { item, data };
    });

    const resultados = await Promise.all(promessas);
    resultados.forEach(({ item, data }) => {
      data.forEach(r => {
        const pn = r.numero_item || '';
        const custoImp = core.parsePrice(r.custo_com_imposto || r.valor_preco_liquido_atual);
        const fmtCusto = `R$ ${core.formatBRL(custoImp)}`;
        const usoTxt = r.uso_recurso ? `(${r.uso_recurso})` : '';
        const usoLink = usoTxt
          ? core.renderCopyLink(usoTxt, r.uso_recurso, 'Uso do Recurso', 'sec-detail text-xs text-slate-400 font-normal ml-1')
          : '';
        const poolTxt = `Pool: ${r.pool || '-'} (${r.categoria_precos || '-'})`;
        const segBadge = core.renderSegmentBadge(r.nome_curto_peca, r, flags.segmentos);

        rowsHTML += `<tr data-unit-price="${custoImp}" data-pn="${core.escapeHTML(pn)}">
          <td class="font-medium text-slate-800">${core.renderCopyLink(r.nome_curto_peca, r.nome_curto_peca, 'Produto')}${usoLink}${segBadge}</td>
          <td>${core.renderQtyInput(item.qty)}</td>
          <td>${core.renderPnBadge(pn)}</td>
          <td class="col-secondary text-xs text-slate-500 font-normal whitespace-nowrap">${core.renderCopyLink(poolTxt, poolTxt, 'Pool / Categoria')}</td>
          <td class="font-medium text-slate-800 whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtCusto, fmtCusto, 'Custo c/ Imposto')}</td>
          <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
          <td class="text-right">${core.renderRowActions()}</td>
        </tr>`;
      });
    });

    if (!rowsHTML) return;

    const bId = 'blk-mpsa';
    const title = 'Microsoft MPSA (Faturamento: Solo)';
    container.insertAdjacentHTML('beforeend', `<div id="${bId}" class="quote-block" data-title="### ${title}">${core.renderBlockHeader(title, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200"><table><thead><tr><th>Produto</th><th>Qtd</th><th>PN (Item)</th><th class="col-secondary">Pool / Cat.</th><th>Custo c/ Imposto</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`);
  }
};