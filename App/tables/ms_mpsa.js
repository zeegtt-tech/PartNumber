window.Cotador.tables.ms_mpsa = {
  async processar(parsedItems, flags) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    let rowsHTML = '';

    for (const item of parsedItems) {
      const params = [['select', '*'], ['limit', '100']];
      item.keywords.forEach(kw => params.push(['nome_curto_peca', `ilike.*${kw}*`]));

      let data = await core.fetchSupabase('microsoft_mpsa', params);

      if (flags.onlyCommercial) {
        data = data.filter(r => (r.tipo_conta_compras || '').toLowerCase() === 'commercial');
      }

      if (data.length === 0) {
        rowsHTML += core.renderNotFoundRow(item, 6);
      } else {
        data.forEach(r => {
          const pn = r.numero_item;
          const custoImp = core.parsePrice(r.custo_com_imposto);
          rowsHTML += `
            <tr data-unit-price="${custoImp}" data-pn="${pn}">
              <td class="font-medium text-white">${r.nome_curto_peca} <span class="text-xs text-slate-400">(${r.uso_recurso || ''})</span></td>
              <td>${core.renderQtyInput(item.qty)}</td>
              <td>${core.renderPnBadge(pn)}</td>
              <td class="text-xs text-slate-300">Pool: ${r.pool || '-'} (Cat. ${r.categoria_precos || '-'})</td>
              <td class="font-semibold text-emerald-400 whitespace-nowrap">R$ ${core.formatBRL(custoImp)}</td>
              <td class="col-subtotal hidden font-bold text-amber-400 whitespace-nowrap">-</td>
              <td class="text-right"><button onclick="this.closest('tr').remove(); Cotador.core.recalcularSubtotais();" class="text-slate-500 hover:text-red-400 px-1">✕</button></td>
            </tr>`;
        });
      }
    }

    const bId = 'blk-mpsa';
    const title = 'Microsoft MPSA (Faturamento: Solo)';
    container.innerHTML = `
      <div id="${bId}" class="quote-block" data-title="### ${title}">
        ${core.renderBlockHeader(title, bId)}
        <div class="overflow-x-auto rounded-b-lg border border-slate-700">
          <table>
            <thead>
              <tr><th>Produto</th><th>Qtd</th><th>PN (Item)</th><th>Pool / Cat.</th><th>Custo c/ Imposto</th><th class="col-subtotal hidden">Subtotal</th><th></th></tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
          </table>
        </div>
      </div>`;
  }
};