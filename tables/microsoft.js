/**
 * ============================================================================
 * MÓDULO DE TABELAS: MICROSOFT (Scan, Solo, Perpétuo, MPSA)
 * Arquivo: js/tables/microsoft.js
 * ----------------------------------------------------------------------------
 * CONTRATO DE CONTEXTO PARA IA (GEMINI PRO):
 * Este módulo registra `ms_scan`, `ms_solo`, `ms_perpetuo` e `ms_mpsa` em `window.Cotador.tables`.
 *
 * MÉTODOS DISPONÍVEIS EM `window.Cotador.core`:
 * - core.fetchSupabase(table, paramsArray) : Promise<Array>
 * - core.isItemComercialValido(nome, segmento, preco) : Boolean
 * - core.parsePrice(val) : Number | core.getSoloPrice(row) : Number
 * - core.formatBRL(num) : String  | core.formatUSD(num) : String
 * - core.escapeHTML(str) : String
 * - core.renderPnBadge(pn) : HTMLString
 * - core.renderQtyInput(qty) : HTMLString
 * - core.renderRowActions() : HTMLString
 * - core.renderNotFoundRow(item, colspan) : HTMLString
 * - core.renderBlockHeader(title, blockId) : HTMLString
 *
 * REGRAS OBRIGATÓRIAS DE DOM PARA CADA TABELA GERADA:
 * 1. Wrapper do bloco: `<div id="${bId}" class="quote-block" data-title="### ${headerTitle}">`
 * 2. Wrapper da tabela: `<div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200">`
 * 3. Linha de produto: `<tr data-unit-price="${precoFinalFloat}" data-pn="${pn}">`
 * 4. Coluna de Subtotal: `<th class="col-subtotal">` e `<td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>`
 * 5. Detalhes secundários ocultáveis: usar classe `col-secondary` em `<th>/<td>` e `sec-detail` em `<span>/<div>` internos.
 * ============================================================================
 */

window.Cotador.tables.ms_scan = {
  async processar(parsedItems, flags) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    container.innerHTML = '';
    
    const promessas = parsedItems.map(async item => {
      const params = [['select', '*'], ['limit', '250']];
      item.keywords.forEach(kw => params.push(['offer_display_name', `ilike.*${kw}*`]));
      let data = await core.fetchSupabase('microsoft_scan', params);
      data = data.filter(r => {
        const nome = (r.offer_display_name || '').toLowerCase();
        const preco = core.parsePrice(r.preco_unitario);
        if (!core.isItemComercialValido(r.offer_display_name, r.segmento, preco)) return false;
        if (flags.hideNoTeams && /\b(no|sem|without)\s+teams\b/i.test(nome)) return false;
        if (flags.hideCopilot && (nome.includes('copilot') || nome.includes('add-on') || nome.includes('attach'))) return false;
        return true;
      });
      return { item, data };
    });
    
    const resultadosPorItem = await Promise.all(promessas);

    for (const c of flags.contratos) {
      let rowsHTML = '';
      for (const { item, data } of resultadosPorItem) {
        const filtrados = data.filter(r => {
          const termo = (r.tempo_contrato || '').trim().toUpperCase();
          const plano = (r.ciclo_pagamento || '').trim().toUpperCase();
          return (c.scanTempo.toUpperCase() === termo) && (c.scanCiclo.toUpperCase() === plano);
        });

        if (filtrados.length === 0) {
          rowsHTML += core.renderNotFoundRow(item, 6);
        } else {
          filtrados.forEach(r => {
            const tabela = core.parsePrice(r.preco_unitario);
            const finalDesc = tabela * 0.93;
            const pn = r.sku;
            rowsHTML += `
              <tr data-unit-price="${finalDesc}" data-pn="${pn}">
                <td class="font-medium text-slate-800">${core.escapeHTML(r.offer_display_name)}</td>
                <td>${core.renderQtyInput(item.qty)}</td>
                <td>${core.renderPnBadge(pn)}</td>
                <td class="col-secondary text-slate-400 font-normal whitespace-nowrap tabular-nums">R$ ${core.formatBRL(tabela)}</td>
                <td class="font-medium text-slate-800 whitespace-nowrap tabular-nums">R$ ${core.formatBRL(finalDesc)}</td>
                <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
                <td class="text-right">${core.renderRowActions()}</td>
              </tr>`;
          });
        }
      }
      const bId = `blk-scan-${c.id}`;
      const headerTitle = `Contrato: ${c.label} (Faturamento: Scansource -7%)`;
      container.innerHTML += `
        <div id="${bId}" class="quote-block" data-title="### ${headerTitle}">
          ${core.renderBlockHeader(headerTitle, bId)}
          <div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200">
            <table>
              <thead><tr><th>Produto</th><th>Qtd</th><th>PN (SKU)</th><th class="col-secondary">Custo Tabela</th><th>Custo Final (-7%)</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead>
              <tbody>${rowsHTML}</tbody>
            </table>
          </div>
        </div>`;
    }
  }
};

window.Cotador.tables.ms_solo = {
  async processar(parsedItems, flags) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    container.innerHTML = '';
    
    const promessas = parsedItems.map(async item => {
      const params = [['select', '*'], ['limit', '1000']];
      item.keywords.forEach(kw => params.push(['titulo_sku', `ilike.*${kw}*`]));
      let data = await core.fetchSupabase('microsoft_solo', params);
      data = data.filter(r => {
        const nome = (r.titulo_sku || '').toLowerCase();
        const preco = core.getSoloPrice(r);
        if (!core.isItemComercialValido(r.titulo_sku, r.segmento, preco)) return false;
        if (flags.hideNoTeams && /\b(no|sem|without)\s+teams\b/i.test(nome)) return false;
        if (flags.hideCopilot && (nome.includes('copilot') || nome.includes('add-on') || nome.includes('attach'))) return false;
        return true;
      });
      return { item, data };
    });

    const resultadosPorItem = await Promise.all(promessas);

    for (const c of flags.contratos) {
      let rowsHTML = '';
      for (const { item, data } of resultadosPorItem) {
        const filtrados = data.filter(r => 
          (r.termo_duracao || '').trim().toUpperCase() === c.soloTermo &&
          (r.plano_pagamento || '').trim().toLowerCase() === c.soloPlano.toLowerCase()
        );

        if (filtrados.length === 0) {
          rowsHTML += core.renderNotFoundRow(item, 5);
        } else {
          filtrados.forEach(r => {
            const skuId = String(r.sku_id || '').padStart(4, '0');
            const pn = `${r.id_produto}-${skuId}-${r.termo_duracao}-${r.plano_pagamento}`;
            const custo = core.getSoloPrice(r);
            const mensalParc = core.parsePrice(r.termo_anual_pagamento_mensal);
            const infoMensal = (c.id === 'am' && mensalParc > 0)
              ? `<div class="sec-detail text-[11px] font-normal text-slate-500">12x de R$ ${core.formatBRL(mensalParc)}/mês</div>`
              : '';

            rowsHTML += `
              <tr data-unit-price="${custo}" data-pn="${pn}">
                <td class="font-medium text-slate-800">${core.escapeHTML(r.titulo_sku)}</td>
                <td>${core.renderQtyInput(item.qty)}</td>
                <td>${core.renderPnBadge(pn)}</td>
                <td class="font-medium text-slate-800 whitespace-nowrap tabular-nums">
                  R$ ${core.formatBRL(custo)}
                  ${infoMensal}
                </td>
                <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
                <td class="text-right">${core.renderRowActions()}</td>
              </tr>`;
          });
        }
      }
      const bId = `blk-solo-${c.id}`;
      const headerTitle = `Contrato: ${c.label} (Faturamento: Solo CSP)`;
      container.innerHTML += `
        <div id="${bId}" class="quote-block" data-title="### ${headerTitle}">
          ${core.renderBlockHeader(headerTitle, bId)}
          <div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200">
            <table>
              <thead><tr><th>Produto</th><th>Qtd</th><th>PN (SKU)</th><th>Valor com 5% Serviços</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead>
              <tbody>${rowsHTML}</tbody>
            </table>
          </div>
        </div>`;
    }
  }
};

window.Cotador.tables.ms_perpetuo = {
  async processar(parsedItems) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    let rowsHTML = '';
    
    const promessas = parsedItems.map(async item => {
      const params = [['select', '*'], ['limit', '200']];
      item.keywords.forEach(kw => params.push(['nome_produto', `ilike.*${kw}*`]));
      let data = await core.fetchSupabase('microsoft_perpetuo', params);
      
      data = data.filter(r => {
        const seg = (r.segment || '').toLowerCase().trim();
        if (seg && !seg.includes('commercial') && !seg.includes('comercial') && !seg.includes('corp')) return false;
        const nome = (r.nome_produto || '').toLowerCase();
        const restritos = ['education', 'academic', 'charity', 'non-profit', 'government'];
        return !restritos.some(t => nome.includes(t));
      });
      return { item, data };
    });

    const resultados = await Promise.all(promessas);
    resultados.forEach(({item, data}) => {
      if (data.length === 0) {
        rowsHTML += core.renderNotFoundRow(item, 5);
      } else {
        data.forEach(row => {
          const skuId = String(row.sku_id || '').padStart(4, '0');
          const pn = `${row.product_id}-${skuId}`;
          const preco = core.parsePrice(row.fob_impostos || row.erp);
          rowsHTML += `
            <tr data-unit-price="${preco}" data-pn="${pn}">
              <td class="font-medium text-slate-800">${core.escapeHTML(row.nome_produto)}</td>
              <td>${core.renderQtyInput(item.qty)}</td>
              <td>${core.renderPnBadge(pn)}</td>
              <td class="font-medium text-slate-800 whitespace-nowrap tabular-nums">R$ ${core.formatBRL(preco)}</td>
              <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
              <td class="text-right">${core.renderRowActions()}</td>
            </tr>`;
        });
      }
    });

    const bId = 'blk-perpetuo';
    const title = 'Microsoft CSP Perpétuo (Faturamento: Solo)';
    container.innerHTML = `
      <div id="${bId}" class="quote-block" data-title="### ${title}">
        ${core.renderBlockHeader(title, bId)}
        <div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200">
          <table>
            <thead><tr><th>Produto</th><th>Qtd</th><th>PN (SKU)</th><th>Custo Final (FOB+Impostos)</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead>
            <tbody>${rowsHTML}</tbody>
          </table>
        </div>
      </div>`;
  }
};

window.Cotador.tables.ms_mpsa = {
  async processar(parsedItems, flags) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    let rowsHTML = '';
    
    const promessas = parsedItems.map(async item => {
      const params = [['select', '*'], ['limit', '250']];
      
      const lowerOrig = item.rawSearch.toLowerCase();
      let searchTerms = [...item.keywords];
      if (lowerOrig.includes('office standard') || lowerOrig.includes('office std')) searchTerms.push('OffStd');
      else if (lowerOrig.includes('windows server') && lowerOrig.includes('datacenter')) searchTerms.push('WinSvrDtc');
      else if (lowerOrig.includes('windows server') || lowerOrig.includes('win server')) searchTerms.push('WinSvr');
      else if (lowerOrig.includes('sql server')) searchTerms.push('SQLSvr');

      searchTerms.forEach(kw => params.push(['nome_curto_peca', `ilike.*${kw}*`]));
      let data = await core.fetchSupabase('microsoft_mpsa', params);
      
      data = data.filter(r => {
        const tc = (r.tipo_conta_compras || '').toLowerCase().trim();
        if (!tc) return true;
        return tc.includes('comercial') || tc.includes('commercial') || tc.includes('corporate');
      });

      if (flags.hideSA) {
        data = data.filter(r => {
          const uso = (r.uso_recurso || '').toLowerCase();
          const nome = (r.nome_curto_peca || '').toLowerCase();
          return !uso.includes('sa only') && !nome.includes('sa only');
        });
      }

      return { item, data };
    });

    const resultados = await Promise.all(promessas);
    resultados.forEach(({item, data}) => {
      if (data.length === 0) {
        rowsHTML += core.renderNotFoundRow(item, 6);
      } else {
        data.forEach(r => {
          const pn = r.numero_item || '';
          const custoImp = core.parsePrice(r.custo_com_imposto || r.valor_preco_liquido_atual);
          rowsHTML += `
            <tr data-unit-price="${custoImp}" data-pn="${pn}">
              <td class="font-medium text-slate-800">${core.escapeHTML(r.nome_curto_peca)} <span class="sec-detail text-xs text-slate-400 font-normal">(${r.uso_recurso || ''})</span></td>
              <td>${core.renderQtyInput(item.qty)}</td>
              <td>${core.renderPnBadge(pn)}</td>
              <td class="col-secondary text-xs text-slate-500 font-normal">Pool: ${r.pool || '-'} (${r.categoria_precos || '-'})</td>
              <td class="font-medium text-slate-800 whitespace-nowrap tabular-nums">R$ ${core.formatBRL(custoImp)}</td>
              <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
              <td class="text-right">${core.renderRowActions()}</td>
            </tr>`;
        });
      }
    });

    const bId = 'blk-mpsa';
    const title = 'Microsoft MPSA (Faturamento: Solo)';
    container.innerHTML = `
      <div id="${bId}" class="quote-block" data-title="### ${title}">
        ${core.renderBlockHeader(title, bId)}
        <div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200">
          <table>
            <thead><tr><th>Produto</th><th>Qtd</th><th>PN (Item)</th><th class="col-secondary">Pool / Cat.</th><th>Custo c/ Imposto</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead>
            <tbody>${rowsHTML}</tbody>
          </table>
        </div>
      </div>`;
  }
};