window.Cotador.tables.kaspersky = {
  async processar(parsedItems, flags) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    let rowsHTML = '';

    for (const item of parsedItems) {
      const params = [['select', '*'], ['limit', '200']];
      item.keywords.forEach(kw => params.push(['sale_item_name', `ilike.*${kw}*`]));

      let data = await core.fetchSupabase('kaspersky', params);

      if (flags.targetBanda !== 'all') {
        data = data.filter(r => (r.banda || '').trim() === flags.targetBanda);
      }
      if (flags.periodo !== 'all') {
        data = data.filter(r => (r.periodo || '').toUpperCase().includes(flags.periodo));
      }
      if (flags.tipo !== 'all') {
        data = data.filter(r => (r.tipo || '').toLowerCase() === flags.tipo.toLowerCase());
      }

      if (data.length === 0) {
        rowsHTML += core.renderNotFoundRow(item, flags.mostrarRO ? 7 : 6);
      } else {
        data.forEach(r => {
          const revenda = core.parsePrice(r.revenda);
          const roOficial = core.parsePrice(r.ro); // Lê direto da coluna RO oficial do CSV!
          const unitarioRef = (flags.mostrarRO && roOficial > 0) ? roOficial : revenda;
          const pn = r.part_number;
          rowsHTML += `
            <tr data-unit-price="${unitarioRef}" data-pn="${pn}">
              <td class="font-medium text-white">${r.sale_item_name}</td>
              <td>${core.renderQtyInput(item.qty)}</td>
              <td>${core.renderPnBadge(pn)}</td>
              <td class="text-xs text-slate-300 whitespace-nowrap">${r.banda} (${r.periodo})</td>
              <td class="font-semibold text-emerald-400 whitespace-nowrap">R$ ${core.formatBRL(revenda)}</td>
              ${flags.mostrarRO ? `<td class="font-semibold text-amber-400 whitespace-nowrap">${roOficial > 0 ? 'R$ ' + core.formatBRL(roOficial) : '-'}</td>` : ''}
              <td class="col-subtotal hidden font-bold text-amber-400 whitespace-nowrap">-</td>
              <td class="text-right"><button onclick="this.closest('tr').remove(); Cotador.core.recalcularSubtotais();" class="text-slate-500 hover:text-red-400 px-1">✕</button></td>
            </tr>`;
        });
      }
    }

    const bId = 'blk-kaspersky';
    const headerTitle = `Kaspersky | Banda: ${flags.targetBanda}`;
    container.innerHTML = `
      <div id="${bId}" class="quote-block" data-title="### ${headerTitle}">
        ${core.renderBlockHeader(headerTitle, bId)}
        <div class="overflow-x-auto rounded-b-lg border border-slate-700">
          <table>
            <thead>
              <tr>
                <th>Produto</th><th>Qtd</th><th>PN</th><th>Banda / Período</th><th>Custo Revenda</th>
                ${flags.mostrarRO ? '<th>Custo Oficial c/ RO</th>' : ''}
                <th class="col-subtotal hidden">Subtotal</th><th></th>
              </tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
          </table>
        </div>
      </div>`;
  }
};