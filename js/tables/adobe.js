// ============================================================================
// MÓDULO DE TABELAS: ADOBE (Base Padrão & Promo Novos Clientes) - v5.7 ENTERPRISE
// Arquivo: js/tables/adobe.js
// ============================================================================
function criarModuloAdobe(tableName, labelTitulo) {
  return {
    async processar(parsedItems, flags) {
      const core = window.Cotador.core;
      const container = document.getElementById('resultado-container');
      container.innerHTML = '';
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
      resultados.forEach(({ item, data }) => {
        data.forEach(r => {
          const usd = core.parsePrice(r.partner_price);
          const brl = usd * flags.taxaDolar;
          const pn = r.part_number;
          const fmtUSD = `US$ ${core.formatUSD(usd)}`;
          const fmtBRL = `R$ ${core.formatBRL(brl)}`;

          rowsHTML += `<tr data-unit-price="${brl}" data-pn="${core.escapeHTML(pn)}">
            <td class="font-medium text-slate-800">${core.renderCopyLink(r.product_family, r.product_family, 'Produto')}</td>
            <td>${core.renderQtyInput(item.qty)}</td>
            <td>${core.renderPnBadge(pn)}</td>
            <td class="col-secondary text-xs text-slate-500 font-normal whitespace-nowrap">${core.renderCopyLink(r.level_detail, r.level_detail, 'Level')}</td>
            <td class="col-secondary text-slate-400 font-normal whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtUSD, fmtUSD, 'Custo USD')}</td>
            <td class="font-medium text-slate-800 whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtBRL, fmtBRL, 'Custo BRL')}</td>
            <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
            <td class="text-right">${core.renderRowActions()}</td>
          </tr>`;
        });
      });

      if (!rowsHTML) return;

      const segLabel = flags.segmento === 'enterprise' ? 'For Enterprise' : 'For Teams';
      const bId = `blk-${tableName}`;
      const headerTitle = `${labelTitulo} (${segLabel}) | Câmbio: R$ ${core.formatBRL(flags.taxaDolar)}`;
      container.innerHTML = `<div id="${bId}" class="quote-block" data-title="### ${headerTitle}">${core.renderBlockHeader(headerTitle, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200"><table><thead><tr><th>Produto</th><th>Qtd</th><th>PN</th><th class="col-secondary">Level</th><th class="col-secondary">Custo (USD)</th><th>Custo (BRL)</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`;
    }
  };
}

window.Cotador.tables.adobe_base = criarModuloAdobe('adobe_base', 'Adobe Base (Padrão)');
window.Cotador.tables.adobe_promo = criarModuloAdobe('adobe_promo', 'Adobe Promo (Novos Clientes)');