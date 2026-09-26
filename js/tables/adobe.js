// ============================================================================
// MODULO DE TABELAS: ADOBE (Base Padrao & Promo Novos Clientes)
// Arquivo: js/tables/adobe.js
// ----------------------------------------------------------------------------
// CONTRATO DE CONTEXTO PARA IA (GEMINI PRO):
// Registra `adobe_base` e `adobe_promo` em `window.Cotador.tables`.
// ============================================================================

function criarModuloAdobe(tableName, labelTitulo) {
  return {
    async processar(parsedItems, flags) {
      const core = window.Cotador.core;
      const container = document.getElementById('resultado-container');
      let rowsHTML = '';
      
      const promessas = parsedItems.map(async item => {
        const params = [['select', '*'], ['limit', '150']];
        item.keywords.forEach(kw => params.push(['product_family', `ilike.*${kw}*`]));
        let data = await core.fetchSupabase(tableName, params);
        
        if (flags.segmento !== 'all') {
          data = data.filter(r => (r.product_family || '').toLowerCase().includes(flags.segmento));
        }
        if (flags.hide3YCommit) {
          data = data.filter(r => !(r.level_detail || '').toLowerCase().includes('3 year commit'));
        }
        if (flags.targetLevel !== 'all') {
          data = data.filter(r => {
            const ld = (r.level_detail || '').toLowerCase();
            if (flags.targetLevel === '1') return ld.includes('level 1 ') || ld.includes('1 - 9') || ld.includes('1-9');
            if (flags.targetLevel === '2') return ld.includes('level 2 ') || ld.includes('level 12') || ld.includes('10 - 49') || ld.includes('10-49');
            if (flags.targetLevel === '3') return ld.includes('level 3 ') || ld.includes('level 13') || ld.includes('50 - 99') || ld.includes('50-99');
            if (flags.targetLevel === '4') return ld.includes('level 4 ') || ld.includes('level 14') || ld.includes('100+');
            return true;
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
            const usd = core.parsePrice(r.partner_price);
            const brl = usd * flags.taxaDolar;
            const pn = r.part_number;
            rowsHTML += `<tr data-unit-price="${brl}" data-pn="${pn}"><td class="font-medium text-slate-800">${core.escapeHTML(r.product_family)}</td><td>${core.renderQtyInput(item.qty)}</td><td>${core.renderPnBadge(pn)}</td><td class="col-secondary text-xs text-slate-500 font-normal whitespace-nowrap">${r.level_detail}</td><td class="col-secondary text-slate-400 font-normal whitespace-nowrap tabular-nums">US$ ${core.formatUSD(usd)}</td><td class="font-medium text-slate-800 whitespace-nowrap tabular-nums">R$ ${core.formatBRL(brl)}</td><td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td><td class="text-right">${core.renderRowActions()}</td></tr>`;
          });
        }
      });

      const segLabel = flags.segmento === 'enterprise' ? 'For Enterprise' : 'For Teams';
      const bId = `blk-${tableName}`;
      const headerTitle = `${labelTitulo} (${segLabel}) | C\u00e2mbio: R$ ${core.formatBRL(flags.taxaDolar)}`;
      container.innerHTML = `<div id="${bId}" class="quote-block" data-title="### ${headerTitle}">${core.renderBlockHeader(headerTitle, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200"><table><thead><tr><th>Produto</th><th>Qtd</th><th>PN</th><th class="col-secondary">Level</th><th class="col-secondary">Custo (USD)</th><th>Custo (BRL)</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`;
    }
  };
}

window.Cotador.tables.adobe_base = criarModuloAdobe('adobe_base', 'Adobe Base (Padr\u00e3o)');
window.Cotador.tables.adobe_promo = criarModuloAdobe('adobe_promo', 'Adobe Promo (Novos Clientes)');