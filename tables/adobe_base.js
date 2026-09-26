window.Cotador.tables.adobe_base = {
  async processar(parsedItems, flags) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    let rowsHTML = '';

    for (const item of parsedItems) {
      const params = [['select', '*'], ['limit', '150']];
      item.keywords.forEach(kw => params.push(['product_family', `ilike.*${kw}*`]));

      let data = await core.fetchSupabase('adobe_base', params);

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

      if (data.length === 0) {
        rowsHTML += core.renderNotFoundRow(item, 6);
      } else {
        data.forEach(r => {
          const usd = core.parsePrice(r.partner_price);
          const brl = usd * flags.taxaDolar;
          const pn = r.part_number;
          rowsHTML += `
            <tr data-unit-price="${brl}" data-pn="${pn}">
              <td class="font-medium text-white">${r.product_family}</td>
              <td>${core.renderQtyInput(item.qty)}</td>
              <td>${core.renderPnBadge(pn)}</td>
              <td class="text-xs text-slate-300 whitespace-nowrap">${r.level_detail}</td>
              <td class="text-slate-400 whitespace-nowrap">US$ ${core.formatUSD(usd)}</td>
              <td class="font-semibold text-emerald-400 whitespace-nowrap">R$ ${core.formatBRL(brl)}</td>
              <td class="col-subtotal hidden font-bold text-amber-400 whitespace-nowrap">-</td>
              <td class="text-right"><button onclick="this.closest('tr').remove(); Cotador.core.recalcularSubtotais();" class="text-slate-500 hover:text-red-400 px-1">✕</button></td>
            </tr>`;
        });
      }
    }

    const bId = 'blk-adobe-base';
    const headerTitle = `Adobe Base (Renovação) | Câmbio: R$ ${core.formatBRL(flags.taxaDolar)}`;
    container.innerHTML = `
      <div id="${bId}" class="quote-block" data-title="### ${headerTitle}">
        ${core.renderBlockHeader(headerTitle, bId)}
        <div class="overflow-x-auto rounded-b-lg border border-slate-700">
          <table>
            <thead>
              <tr><th>Produto</th><th>Qtd</th><th>PN</th><th>Level</th><th>Custo (USD)</th><th>Custo (BRL)</th><th class="col-subtotal hidden">Subtotal</th><th></th></tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
          </table>
        </div>
      </div>`;
  }
};