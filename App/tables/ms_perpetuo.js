window.Cotador.tables.ms_perpetuo = {
  async processar(parsedItems, flags) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    let rowsHTML = '';

    for (const item of parsedItems) {
      const params = [['select', '*'], ['limit', '100']];
      item.keywords.forEach(kw => params.push(['nome_produto', `ilike.*${kw}*`]));

      let data = await core.fetchSupabase('microsoft_perpetuo', params);

      if (flags.onlyCommercial) {
        data = data.filter(r => {
          const seg = (r.segment || '').toLowerCase();
          return !seg || seg === 'commercial';
        });
      }

      if (data.length === 0) {
        rowsHTML += core.renderNotFoundRow(item, 5);
      } else {
        data.forEach(row => {
          const skuId = String(row.sku_id || '').padStart(4, '0');
          const pn = `${row.product_id}-${skuId}`;
          const preco = core.parsePrice(row.fob_impostos);
          rowsHTML += `
            <tr data-unit-price="${preco}" data-pn="${pn}">
              <td class="font-medium text-white">${row.nome_produto}</td>
              <td>${core.renderQtyInput(item.qty)}</td>
              <td>${core.renderPnBadge(pn)}</td>
              <td class="font-semibold text-emerald-400 whitespace-nowrap">R$ ${core.formatBRL(preco)}</td>
              <td class="col-subtotal hidden font-bold text-amber-400 whitespace-nowrap">-</td>
              <td class="text-right"><button onclick="this.closest('tr').remove(); Cotador.core.recalcularSubtotais();" class="text-slate-500 hover:text-red-400 px-1">✕</button></td>
            </tr>`;
        });
      }
    }

    const bId = 'blk-perpetuo';
    const title = 'Licenciamento Perpétuo (Faturamento: Solo)';
    container.innerHTML = `
      <div id="${bId}" class="quote-block" data-title="### ${title}">
        ${core.renderBlockHeader(title, bId)}
        <div class="overflow-x-auto rounded-b-lg border border-slate-700">
          <table>
            <thead>
              <tr><th>Produto</th><th>Qtd</th><th>PN (SKU)</th><th>Custo Final (FOB+Impostos)</th><th class="col-subtotal hidden">Subtotal</th><th></th></tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
          </table>
        </div>
      </div>`;
  }
};