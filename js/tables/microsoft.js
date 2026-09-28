// ============================================================================
// MÓDULO DE TABELAS: MICROSOFT (Scan, Solo, Perpétuo, MPSA) - v5.8 ENTERPRISE
// Arquivo: js/tables/microsoft.js
// ============================================================================

window.Cotador.tables.ms_scan = {
  async processar(parsedItems, flags = {}) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    if (!flags.append && !flags.returnHTML) container.innerHTML = '';

    // Lê o desconto configurável da Scansource (via flags.scanDiscountPct ou input na UI, padrão 7%)
    const domScanInput = document.getElementById('ms-scan-discount') || document.getElementById('scan-discount-pct');
    const rawScanPct = (flags.scanDiscountPct !== undefined && flags.scanDiscountPct !== null && flags.scanDiscountPct !== '')
      ? Number(flags.scanDiscountPct)
      : (domScanInput && domScanInput.value !== '' ? Number(domScanInput.value) : 7);
    const descontoScan = Number.isFinite(rawScanPct) ? Math.min(100, Math.max(0, rawScanPct)) : 7;
    const fmtDescPct = Number.isInteger(descontoScan) ? String(descontoScan) : String(descontoScan).replace('.', ',');

    const segOrFilter = core.construirFiltroPostgrestSegmento('segmento', flags.segmentos);

    const promessas = parsedItems.map(async item => {
      const params = [['select', '*'], ['limit', '1000']];
      const isPnQuery = item.keywords.length === 1 && /^[0-9A-Z\-]{5,22}$/i.test(item.keywords[0]) && /\d/.test(item.keywords[0]);

      if (isPnQuery) {
        const term = item.keywords[0];
        params.push(['or', `(sku.ilike.*${term}*,offer_display_name.ilike.*${term}*)`]);
      } else {
        item.keywords.forEach(kw => params.push(['offer_display_name', `ilike.*${kw}*`]));
      }
      if (segOrFilter) params.push(['or', segOrFilter]);

      let data = [];
      try {
        data = await core.fetchSupabase('microsoft_scan', params);
      } catch (_) {
        const fallback = [['select', '*'], ['limit', '1000']];
        if (isPnQuery) {
          const term = item.keywords[0];
          fallback.push(['or', `(sku.ilike.*${term}*,offer_display_name.ilike.*${term}*)`]);
        } else {
          item.keywords.forEach(kw => fallback.push(['offer_display_name', `ilike.*${kw}*`]));
        }
        data = await core.fetchSupabase('microsoft_scan', fallback);
      }

      data = data.filter(r => {
        const nome = (r.offer_display_name || '').toLowerCase();
        const preco = core.parsePrice(r.preco_unitario);
        if (preco <= 0) return false;
        if (!core.isItemSegmentoValido(r.offer_display_name, r, flags.segmentos, preco)) return false;
        
        // 1. Filtro No Teams
        if (!flags.showNoTeams && /\b(no|sem|without)\s+teams\b/i.test(nome)) return false;
        
        // 2. Classificação de Copilot / Bundles / Add-ons
        const isBundleWithCopilot = /\b(?:with|w\/)\s+.*copilot\b/i.test(nome);
        const isGenericAddonOrAttach = /\b(attach|add[\s\-]?on)\b/i.test(nome);
        const isNativeCopilotProduct = /^(?:microsoft\s+)?(?:365\s+)?copilot\b/i.test(nome) ||
                                       /\bcopilot\s+(?:studio|for\s+sales|for\s+service|for\s+security|business)\b/i.test(nome);

        if (!flags.showCopilot) {
          // Descarta bundles tipo "Business Standard with Copilot"
          if (isBundleWithCopilot) return false;
          
          // Descarta add-ons e attaches secundários genéricos, mas PRESERVA o Copilot nativo
          if (isGenericAddonOrAttach && !isNativeCopilotProduct) return false;
          
          // Se tiver 'copilot' no nome mas for uma suíte composta (não nativa autônoma)
          if (nome.includes('copilot') && !isNativeCopilotProduct) return false;
        }
        
        // 3. Flags de Trial e Frontline
        if (!flags.showTrial && /\b(trial|free|gratuito|promo)\b/i.test(nome)) return false;
        if (!flags.showFrontline && /\b(frontline|kiosk|f1|f3|flw)\b/i.test(nome)) return false;
        
        return true;
      });

      return { item, data };
    });

    const resultadosPorItem = await Promise.all(promessas);
    let blocksHTML = '';
    const matchedItemIndices = new Set();

    for (const c of (flags.contratos || [])) {
      let rowsHTML = '';
      for (const { item, data } of resultadosPorItem) {
        const filtrados = data.filter(r => {
          const termo = (r.tempo_contrato || '').trim().toUpperCase();
          const plano = (r.ciclo_pagamento || '').trim().toUpperCase();
          return (c.scanTempo.toUpperCase() === termo) && (c.scanCiclo.toUpperCase() === plano);
        });

        filtrados.forEach(r => {
          matchedItemIndices.add(item.itemIndex);
          const tabela = core.parsePrice(r.preco_unitario);
          const finalDesc = tabela * (1 - (descontoScan / 100));
          const pn = r.sku;
          const fmtTabela = `R$ ${core.formatBRL(tabela)}`;
          const fmtFinal = `R$ ${core.formatBRL(finalDesc)}`;
          const segBadge = core.renderSegmentBadge(r.offer_display_name, r, flags.segmentos);
          const prodKey = core.normalizarChaveProdutoMS(r.offer_display_name, item.itemIndex);
          const detalhesScanCusto = core.renderDetalhesScanCSP(c.id, finalDesc, 1);

          rowsHTML += `<tr data-row-kind="ms_scan" data-contract-id="${c.id}" data-unit-price="${finalDesc}" data-pn="${core.escapeHTML(pn)}" data-prod-key="${core.escapeHTML(prodKey)}">
            <td class="font-medium text-slate-800">${core.renderCopyLink(r.offer_display_name, r.offer_display_name, 'Produto')}${segBadge}</td>
            <td>${core.renderQtyInput(item.qty)}</td>
            <td class="col-pn">${core.renderPnBadge(pn)}</td>
            <td class="col-secondary col-internal-cost text-slate-400 font-normal whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtTabela, fmtTabela, 'Custo Tabela')}</td>
            <td class="col-cost-normal font-medium text-slate-800 whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtFinal, fmtFinal, `Custo Final (-${fmtDescPct}%)`)}${detalhesScanCusto}</td>
            <td class="col-margin-price font-semibold text-slate-900 whitespace-nowrap tabular-nums">-</td>
            <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
            <td class="text-right">${core.renderRowActions()}</td>
          </tr>`;
        });
      }

      if (!rowsHTML) continue;
      const bId = `blk-scan-${c.id}`;
      const headerTitle = `Contrato: ${c.label} (Faturamento: Scansource)`;
      blocksHTML += `<div id="${bId}" class="quote-block quote-block-scan" data-title="### ${headerTitle}">${core.renderBlockHeader(headerTitle, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200"><table><thead><tr><th>Produto</th><th>Qtd</th><th class="col-pn">PN (SKU)</th><th class="col-secondary col-internal-cost">Custo Tabela</th><th class="col-cost-normal">Custo Final (-${fmtDescPct}%)</th><th class="col-margin-price">Valor c/ Margem</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`;
    }

    if (!flags.returnHTML && blocksHTML) {
      container.insertAdjacentHTML('beforeend', blocksHTML);
    }
    return { html: blocksHTML, matchedItemIndices };
  }
};

window.Cotador.tables.ms_solo = {
  async processar(parsedItems, flags = {}) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    if (!flags.append && !flags.returnHTML) container.innerHTML = '';

    const segOrFilter = core.construirFiltroPostgrestSegmento('segmento', flags.segmentos);

    const promessas = parsedItems.map(async item => {
      const params = [['select', '*'], ['limit', '1500']];
      const isPnQuery = item.keywords.length === 1 && /^[0-9A-Z\-]{5,35}$/i.test(item.keywords[0]) && /\d/.test(item.keywords[0]);

      if (isPnQuery) {
        const term = item.keywords[0];
        const basePn = term.split('-')[0];
        params.push(['or', `(id_produto.ilike.*${basePn}*,titulo_sku.ilike.*${term}*)`]);
      } else {
        item.keywords.forEach(kw => params.push(['titulo_sku', `ilike.*${kw}*`]));
      }
      if (segOrFilter) params.push(['or', segOrFilter]);

      let data = [];
      try {
        data = await core.fetchSupabase('microsoft_solo', params);
      } catch (_) {
        const fallback = [['select', '*'], ['limit', '1500']];
        if (isPnQuery) {
          const term = item.keywords[0];
          const basePn = term.split('-')[0];
          fallback.push(['or', `(id_produto.ilike.*${basePn}*,titulo_sku.ilike.*${term}*)`]);
        } else {
          item.keywords.forEach(kw => fallback.push(['titulo_sku', `ilike.*${kw}*`]));
        }
        data = await core.fetchSupabase('microsoft_solo', fallback);
      }

      data = data.filter(r => {
        const nome = (r.titulo_sku || '').toLowerCase();
        const preco = core.getSoloPrice(r);
        if (preco <= 0) return false;
        if (!core.isItemSegmentoValido(r.titulo_sku, r, flags.segmentos, preco)) return false;
        
        // 1. Filtro No Teams
        if (!flags.showNoTeams && /\b(no|sem|without)\s+teams\b/i.test(nome)) return false;
        
        // 2. Classificação de Copilot / Bundles / Add-ons
        const isBundleWithCopilot = /\b(?:with|w\/)\s+.*copilot\b/i.test(nome);
        const isGenericAddonOrAttach = /\b(attach|add[\s\-]?on)\b/i.test(nome);
        const isNativeCopilotProduct = /^(?:microsoft\s+)?(?:365\s+)?copilot\b/i.test(nome) ||
                                       /\bcopilot\s+(?:studio|for\s+sales|for\s+service|for\s+security|business)\b/i.test(nome);

        if (!flags.showCopilot) {
          if (isBundleWithCopilot) return false;
          if (isGenericAddonOrAttach && !isNativeCopilotProduct) return false;
          if (nome.includes('copilot') && !isNativeCopilotProduct) return false;
        }
        
        // 3. Flags de Trial e Frontline
        if (!flags.showTrial && /\b(trial|free|gratuito|promo)\b/i.test(nome)) return false;
        if (!flags.showFrontline && /\b(frontline|kiosk|f1|f3|flw)\b/i.test(nome)) return false;
        
        return true;
      });

      return { item, data };
    });

    const resultadosPorItem = await Promise.all(promessas);
    let blocksHTML = '';
    const matchedItemIndices = new Set();

    for (const c of (flags.contratos || [])) {
      let rowsHTML = '';
      for (const { item, data } of resultadosPorItem) {
        const filtrados = data.filter(r =>
          (r.termo_duracao || '').trim().toUpperCase() === c.soloTermo &&
          (r.plano_pagamento || '').trim().toLowerCase() === c.soloPlano.toLowerCase()
        );

        filtrados.forEach(r => {
          matchedItemIndices.add(item.itemIndex);
          const skuId = String(r.sku_id || '').padStart(4, '0');
          const pn = `${r.id_produto}-${skuId}-${r.termo_duracao}-${r.plano_pagamento}`;
          const rawCusto = core.getSoloPrice(r);
          const rawFob = core.parsePrice(r.fob_impostos);
          const rawMensalAnual = core.parsePrice(r.termo_anual_pagamento_mensal);

          // Corrige escala P3Y do CSV Solo (onde Annual e Monthly vêm com o total de 36 meses)
          const divisor = c.id === 'ta' ? 3 : (c.id === 'tm' ? 36 : 1);
          const custo = rawCusto / divisor;

          let mensalSem5 = 0;
          let anualSem5 = 0;
          if (c.id === 'am') {
            mensalSem5 = rawMensalAnual > 0 ? rawMensalAnual : (rawFob / 12);
            anualSem5 = rawFob;
          } else if (c.id === 'mm') {
            mensalSem5 = rawFob;
            anualSem5 = rawFob * 12;
          } else if (c.id === 'tm') {
            mensalSem5 = rawFob / 36;
            anualSem5 = (rawFob / 36) * 12;
          } else {
            anualSem5 = rawFob / divisor;
          }

          const fmtCusto = `R$ ${core.formatBRL(custo)}`;
          const infoMensal = core.renderDetalhesSoloCSP(c.id, custo, mensalSem5, anualSem5, 1, false);
          const segBadge = core.renderSegmentBadge(r.titulo_sku, r, flags.segmentos);
          const prodKey = core.normalizarChaveProdutoMS(r.titulo_sku, item.itemIndex);

          rowsHTML += `<tr data-row-kind="ms_solo" data-contract-id="${c.id}" data-mensal-sem5="${mensalSem5}" data-anual-sem5="${anualSem5}" data-unit-price="${custo}" data-pn="${core.escapeHTML(pn)}" data-prod-key="${core.escapeHTML(prodKey)}">
            <td class="font-medium text-slate-800">${core.renderCopyLink(r.titulo_sku, r.titulo_sku, 'Produto')}${segBadge}</td>
            <td>${core.renderQtyInput(item.qty)}</td>
            <td class="col-pn">${core.renderPnBadge(pn)}</td>
            <td class="col-cost-normal font-medium text-slate-800 whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtCusto, fmtCusto, 'Valor com 5% Serviços')}${infoMensal}</td>
            <td class="col-margin-price font-semibold text-slate-900 whitespace-nowrap tabular-nums">-</td>
            <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
            <td class="text-right">${core.renderRowActions()}</td>
          </tr>`;
        });
      }

      if (!rowsHTML) continue;
      const bId = `blk-solo-${c.id}`;
      const headerTitle = `Contrato: ${c.label} (Faturamento: Solo CSP)`;
      blocksHTML += `<div id="${bId}" class="quote-block" data-title="### ${headerTitle}">${core.renderBlockHeader(headerTitle, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200"><table><thead><tr><th>Produto</th><th>Qtd</th><th class="col-pn">PN (SKU)</th><th class="col-cost-normal">Valor com 5% Serviços</th><th class="col-margin-price">Valor c/ Margem</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`;
    }

    if (!flags.returnHTML && blocksHTML) {
      container.insertAdjacentHTML('beforeend', blocksHTML);
    }
    return { html: blocksHTML, matchedItemIndices };
  }
};

window.Cotador.tables.ms_perpetuo = {
  async processar(parsedItems, flags = {}) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    if (!flags.append && !flags.returnHTML) container.innerHTML = '';
    let rowsHTML = '';
    const matchedItemIndices = new Set();

    const segOrFilter = core.construirFiltroPostgrestSegmento('segment', flags.segmentos);

    // Verifica contratos CSP selecionados para liberar assinaturas equivalentes na planilha Perpétuo
    const contratos = flags.contratos || [];
    const hasCspMensal = contratos.some(c => c.id === 'mm' || String(c.soloTermo || '').toUpperCase() === 'P1M');
    const hasCspAnual = contratos.some(c => c.id === 'aa' || c.id === 'am' || String(c.soloTermo || '').toUpperCase() === 'P1Y');
    const hasCspTrienal = contratos.some(c => c.id === 'ta' || c.id === 'tm' || String(c.soloTermo || '').toUpperCase() === 'P3Y');

    const allowMensal = Boolean(flags.pmShowMensal || hasCspMensal);
    const allowAnual = Boolean(flags.pmShowAnual || hasCspAnual);
    const allowTrienal = Boolean(flags.pmShowTrienal || hasCspTrienal);

    const promessas = parsedItems.map(async item => {
      const params = [['select', '*'], ['limit', '800']];
      const isPnQuery = item.keywords.length === 1 && /^[0-9A-Z\-]{5,25}$/i.test(item.keywords[0]) && /\d/.test(item.keywords[0]);

      if (isPnQuery) {
        const term = item.keywords[0];
        const basePn = term.split('-')[0];
        params.push(['or', `(product_id.ilike.*${basePn}*,nome_produto.ilike.*${term}*)`]);
      } else {
        item.keywords.forEach(kw => params.push(['nome_produto', `ilike.*${kw}*`]));
      }
      if (segOrFilter) params.push(['or', segOrFilter]);

      let data = [];
      try {
        data = await core.fetchSupabase('microsoft_perpetuo', params);
      } catch (_) {
        const fallbackParams = [['select', '*'], ['limit', '800']];
        if (isPnQuery) {
          const term = item.keywords[0];
          const basePn = term.split('-')[0];
          fallbackParams.push(['or', `(product_id.ilike.*${basePn}*,nome_produto.ilike.*${term}*)`]);
        } else {
          item.keywords.forEach(kw => fallbackParams.push(['nome_produto', `ilike.*${kw}*`]));
        }
        data = await core.fetchSupabase('microsoft_perpetuo', fallbackParams);
      }

      data = data.filter(r => {
        const nome = (r.nome_produto || '').toLowerCase();
        const plano = (r.plano_pagamento || '').trim().toLowerCase();
        const preco = core.parsePrice(r.fob_impostos || r.erp);
        if (preco <= 0) return false;
        if (!core.isItemSegmentoValido(r.nome_produto, r, flags.segmentos, preco)) return false;

        const isOneTime = plano === 'onetime' || plano === '';

        if (!isOneTime) {
          const isTrienal = plano === 'triennial' || /\b(3\s*y|3\s*year|3\s*anos|trienal|triennial|p3y)\b/i.test(nome);
          const isMensal = plano === 'monthly' || /\b(1\s*m|month|mensal|p1m)\b/i.test(nome);
          const isAnual = !isTrienal && !isMensal && (plano === 'annual' || /\b(1\s*y|1\s*year|1\s*ano|annual|anual|p1y)\b/i.test(nome));

          if (!allowMensal && isMensal) return false;
          if (!allowAnual && isAnual) return false;
          if (!allowTrienal && isTrienal) return false;
        }

        if (!flags.pmShowStepup && /\b(step-up|step up|upgrade|migration)\b/i.test(nome)) return false;
        if (!flags.pmShowCals && /\b(cal|rds)\b/i.test(nome)) return false;
        return true;
      });

      return { item, data };
    });

    const resultados = await Promise.all(promessas);

    resultados.forEach(({ item, data }) => {
      data.forEach(row => {
        matchedItemIndices.add(item.itemIndex);
        const skuId = String(row.sku_id || '').padStart(4, '0');
        const pn = `${row.product_id}-${skuId}`;
        const preco = core.parsePrice(row.fob_impostos || row.erp);
        const fmtPreco = `R$ ${core.formatBRL(preco)}`;
        const segBadge = core.renderSegmentBadge(row.nome_produto, row, flags.segmentos);
        const prodKey = core.normalizarChaveProdutoMS(row.nome_produto, item.itemIndex);

        const planoRaw = String(row.plano_pagamento || '').trim();
        const planoBadge = (planoRaw && planoRaw.toLowerCase() !== 'onetime')
          ? `<span class="sec-detail ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-50 text-sky-700 border border-sky-200">Ciclo: ${core.escapeHTML(planoRaw)}</span>`
          : '';

        rowsHTML += `<tr data-unit-price="${preco}" data-pn="${core.escapeHTML(pn)}" data-prod-key="${core.escapeHTML(prodKey)}">
          <td class="font-medium text-slate-800">${core.renderCopyLink(row.nome_produto, row.nome_produto, 'Produto')}${planoBadge}${segBadge}</td>
          <td>${core.renderQtyInput(item.qty)}</td>
          <td class="col-pn">${core.renderPnBadge(pn)}</td>
          <td class="col-cost-normal font-medium text-slate-800 whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtPreco, fmtPreco, 'Custo Final')}</td>
          <td class="col-margin-price font-semibold text-slate-900 whitespace-nowrap tabular-nums">-</td>
          <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
          <td class="text-right">${core.renderRowActions()}</td>
        </tr>`;
      });
    });

    if (!rowsHTML) return { html: '', matchedItemIndices };
    const bId = 'blk-perpetuo';
    const title = 'Microsoft CSP Perpétuo (Faturamento: Solo)';
    const blockHTML = `<div id="${bId}" class="quote-block" data-title="### ${title}">${core.renderBlockHeader(title, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200"><table><thead><tr><th>Produto</th><th>Qtd</th><th class="col-pn">PN (SKU)</th><th class="col-cost-normal">Custo Final (FOB+Impostos)</th><th class="col-margin-price">Valor c/ Margem</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`;

    if (!flags.returnHTML) {
      container.insertAdjacentHTML('beforeend', blockHTML);
    }
    return { html: blockHTML, matchedItemIndices };
  }
};

window.Cotador.tables.ms_mpsa = {
  gerarTermosAbreviadosMPSA(rawSearch, keywords) {
    const mpsaTokenMap = {
      'windows': 'Win',
      'standard': 'Std',
      'enterprise': 'Ent',
      'exchange online': 'ExchOnline',
      'exchange': 'Exch',
      'sharepoint': 'ShrPnt',
      'professional': 'Pro',
      'business': 'Bus',
      'plan 1': 'Plan1',
      'plan 2': 'Plan2',
      'plan 3': 'Plan3'
    };

    const mapped = keywords.map(kw => {
      const lowerKw = kw.toLowerCase().trim();
      return mpsaTokenMap[lowerKw] || kw;
    });

    const changed = mapped.some((m, i) => m.toLowerCase() !== keywords[i].toLowerCase());
    return changed ? mapped : [];
  },

  classificarItemMPSA(row) {
    const tipo = String(row.tipo_item || '').toLowerCase().trim();
    const nome = String(row.nome_curto_peca || '').toLowerCase().trim();
    const uso = String(row.uso_recurso || '').toLowerCase().trim();

    const isStepUp =
      tipo === 'transition' ||
      tipo.startsWith('upgrade') ||
      /\bfm\b/i.test(nome) ||
      /\b(step-up|step up|upgrade|migration)\b/i.test(nome + ' ' + uso);

    const isSAOnly =
      tipo.endsWith(' sa') ||
      tipo.includes('license sa') ||
      /\b(sftsa|clasa|ecsa|upsa|sa only)\b/i.test(nome);

    const isLicSA =
      tipo.endsWith(' lsa') ||
      /\b(lsa|calsa|eclsa|mlsa|uplsa|lic\/sa|licsa)\b/i.test(nome) && !isSAOnly;

    const isLicOnly =
      tipo.endsWith(' license') ||
      /\b(sl|uplic)\b/i.test(nome);

    return { isStepUp, isSAOnly, isLicSA, isLicOnly };
  },

  async processar(parsedItems, flags = {}) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    if (!flags.append && !flags.returnHTML) container.innerHTML = '';
    let rowsHTML = '';
    const matchedItemIndices = new Set();

    const segOrFilterMpsa = core.construirFiltroPostgrestSegmento('tipo_conta_compras', flags.segmentos);

    const promessas = parsedItems.map(async item => {
      const queries = [];
      const isPnQuery = item.keywords.length === 1 && /^[0-9A-Z\-]{5,22}$/i.test(item.keywords[0]) && /\d/.test(item.keywords[0]);

      // 1. Busca por PN (numero_item) ou pelas keywords originais em nome_curto_peca
      const p1 = [['select', '*'], ['limit', '800']];
      if (isPnQuery) {
        const term = item.keywords[0];
        p1.push(['or', `(numero_item.ilike.*${term}*,nome_curto_peca.ilike.*${term}*)`]);
      } else {
        item.keywords.forEach(kw => p1.push(['nome_curto_peca', `ilike.*${kw}*`]));
      }
      if (segOrFilterMpsa) p1.push(['or', segOrFilterMpsa]);
      // Prioriza ordenação por categoria_precos A direto no banco
      p1.push(['order', 'categoria_precos.asc']);

      queries.push(
        core.fetchSupabase('microsoft_mpsa', p1).catch(() => {
          const fallbackP1 = [['select', '*'], ['limit', '800']];
          if (isPnQuery) {
            const term = item.keywords[0];
            fallbackP1.push(['or', `(numero_item.ilike.*${term}*,nome_curto_peca.ilike.*${term}*)`]);
          } else {
            item.keywords.forEach(kw => fallbackP1.push(['nome_curto_peca', `ilike.*${kw}*`]));
          }
          return core.fetchSupabase('microsoft_mpsa', fallbackP1);
        })
      );

      // 2. Busca pelos termos abreviados reais do catálogo MPSA (apenas quando não for PN direto)
      if (!isPnQuery) {
        const abrevTerms = this.gerarTermosAbreviadosMPSA(item.rawSearch, item.keywords);
        if (abrevTerms.length > 0) {
          const p2 = [['select', '*'], ['limit', '800']];
          abrevTerms.forEach(kw => p2.push(['nome_curto_peca', `ilike.*${kw}*`]));
          if (segOrFilterMpsa) p2.push(['or', segOrFilterMpsa]);
          p2.push(['order', 'categoria_precos.asc']);

          queries.push(
            core.fetchSupabase('microsoft_mpsa', p2).catch(() => {
              const fallbackP2 = [['select', '*'], ['limit', '800']];
              abrevTerms.forEach(kw => fallbackP2.push(['nome_curto_peca', `ilike.*${kw}*`]));
              return core.fetchSupabase('microsoft_mpsa', fallbackP2);
            })
          );
        }
      }

      const listas = await Promise.all(queries);

      // Ordena priorizando CATEGORIA DE PREÇOS = 'A' (Nível Base) antes de desduplicar,
      // corrigindo os 1.123 produtos em que a Faixa 'D' aparece antes da 'A' no CSV.
      const todasLinhas = listas.flat().sort((a, b) => {
        const catA = String(a.categoria_precos || 'Z').trim().toUpperCase();
        const catB = String(b.categoria_precos || 'Z').trim().toUpperCase();
        if (catA !== catB) return catA.localeCompare(catB);
        return 0;
      });

      const seen = new Set();
      let data = [];
      todasLinhas.forEach(r => {
        const key = `${r.numero_item || ''}_${r.nome_curto_peca || ''}_${r.uso_recurso || ''}_${r.duracao_compra || ''}_${r.tipo_conta_compras || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          data.push(r);
        }
      });

      // Se nenhuma das 3 flags de escopo MPSA estiver marcada, exibe "License Only" por padrão
      const nenhumaFlagMpsaMarcada = !flags.showSA && !flags.showLicSA && !flags.showLicOnly;
      const permitirLicOnly = flags.showLicOnly || nenhumaFlagMpsaMarcada;

      data = data.filter(r => {
        const nome = (r.nome_curto_peca || '').toLowerCase();
        const uso = (r.uso_recurso || '').toLowerCase();
        const duracao = (r.duracao_compra || '').toLowerCase();
        const preco = core.parsePrice(r.custo_com_imposto || r.valor_preco_liquido_atual);
        if (preco <= 0) return false;
        if (!core.isItemSegmentoValido(r.nome_curto_peca, r, flags.segmentos, preco)) return false;

        const isShortTerm = duracao.includes('short-term') || /\b(1\s*m|month|mensal)\b/i.test(nome);
        const isAnual = /\b(1\s*y|1\s*year|1\s*ano|annual|anual)\b/i.test(nome);
        const isTrienal = duracao.includes('3 yr') || /\b(3\s*y|3\s*year|3\s*anos|trienal|triennial)\b/i.test(nome);

        if (!flags.pmShowMensal && isShortTerm) return false;
        if (!flags.pmShowAnual && isAnual) return false;
        if (!flags.pmShowTrienal && isTrienal && !flags.showLicSA) return false;

        const { isStepUp, isSAOnly, isLicSA, isLicOnly } = this.classificarItemMPSA(r);
        if (!flags.pmShowStepup && isStepUp) return false;
        if (!flags.pmShowCals && /\b(cal|rds|clasa|calsa|ecl)\b/i.test(nome + ' ' + uso + ' ' + (r.tipo_item || ''))) return false;

        if (!flags.showSA && isSAOnly) return false;
        if (!flags.showLicSA && isLicSA) return false;
        if (!permitirLicOnly && isLicOnly) return false;

        return true;
      });

      return { item, data };
    });

    const resultados = await Promise.all(promessas);

    resultados.forEach(({ item, data }) => {
      data.forEach(r => {
        matchedItemIndices.add(item.itemIndex);
        const pn = r.numero_item || '';
        const custoImp = core.parsePrice(r.custo_com_imposto || r.valor_preco_liquido_atual);
        const fmtCusto = `R$ ${core.formatBRL(custoImp)}`;
        const usoTxt = r.uso_recurso ? `(${r.uso_recurso})` : '';
        const usoLink = usoTxt
          ? core.renderCopyLink(usoTxt, r.uso_recurso, 'Uso do Recurso', 'sec-detail text-xs text-slate-400 font-normal ml-1')
          : '';
        const poolTxt = `Pool: ${r.pool || '-'} (Nível ${r.categoria_precos || 'A'})`;
        const segBadge = core.renderSegmentBadge(r.nome_curto_peca, r, flags.segmentos);
        const prodKey = core.normalizarChaveProdutoMS(r.nome_curto_peca, item.itemIndex);

        rowsHTML += `<tr data-unit-price="${custoImp}" data-pn="${core.escapeHTML(pn)}" data-prod-key="${core.escapeHTML(prodKey)}">
          <td class="font-medium text-slate-800">${core.renderCopyLink(r.nome_curto_peca, r.nome_curto_peca, 'Produto')}${usoLink}${segBadge}</td>
          <td>${core.renderQtyInput(item.qty)}</td>
          <td class="col-pn">${core.renderPnBadge(pn)}</td>
          <td class="col-secondary text-xs text-slate-500 font-normal whitespace-nowrap">${core.renderCopyLink(poolTxt, poolTxt, 'Pool / Categoria')}</td>
          <td class="col-cost-normal font-medium text-slate-800 whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtCusto, fmtCusto, 'Custo c/ Imposto')}</td>
          <td class="col-margin-price font-semibold text-slate-900 whitespace-nowrap tabular-nums">-</td>
          <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
          <td class="text-right">${core.renderRowActions()}</td>
        </tr>`;
      });
    });

    if (!rowsHTML) return { html: '', matchedItemIndices };
    const bId = 'blk-mpsa';
    const title = 'Microsoft MPSA (Faturamento: Solo)';
    const blockHTML = `<div id="${bId}" class="quote-block" data-title="### ${title}">${core.renderBlockHeader(title, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200"><table><thead><tr><th>Produto</th><th>Qtd</th><th class="col-pn">PN (Item)</th><th class="col-secondary">Pool / Cat.</th><th class="col-cost-normal">Custo c/ Imposto</th><th class="col-margin-price">Valor c/ Margem</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`;

    if (!flags.returnHTML) {
      container.insertAdjacentHTML('beforeend', blockHTML);
    }
    return { html: blockHTML, matchedItemIndices };
  }
};