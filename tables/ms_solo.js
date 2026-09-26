window.Cotador.tables.ms_solo = {
  async processar(parsedItems, flags) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    container.innerHTML = '';

    const resultadosPorItem = [];
    for (const item of parsedItems) {
      const params = [['select', '*'], ['limit', '3000']];
      item.keywords.forEach(kw => params.push(['titulo_sku', `ilike.*${kw}*`]));

      let data = await core.fetchSupabase('microsoft_solo', params);

      data = data.filter(r => {
        const nome = (r.titulo_sku || '').toLowerCase();
        const seg = (r.segmento || '').toLowerCase();
        if (flags.onlyCommercial && seg && seg !== 'commercial') return false;
        if (flags.onlyCommercial && (nome.includes('education') || nome.includes('faculty') || nome.includes('student') || nome.includes('charity'))) return false;
        if (flags.hideNoTeams && (nome.includes('no teams') || nome.includes('sem teams') || nome.includes('without teams'))) return false;
        if (flags.hideCopilot && (nome.includes('copilot') || nome.includes('add-on') || nome.includes('add on') || nome.includes('attach'))) return false;
        return true;
      });

      resultadosPorItem.push({ item, data });
    }

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
            const custo = core.parsePrice(r.fob_impostos);
            rowsHTML += `
              <tr data-unit-price="${custo}" data-pn="${pn}">
                <td class="font-medium text-white">${r.titulo_sku}</td>
                <td>${core.renderQtyInput(item.qty)}</td>
                <td>${core.renderPnBadge(pn)}</td>
                <td class="font-semibold text-emerald-400 whitespace-nowrap">R$ ${core.formatBRL(custo)}</td>
                <td class="col-subtotal hidden font-bold text-amber-400 whitespace-nowrap">-</td>
                <td class="text-right"><button onclick="this.closest('tr').remove(); Cotador.core.recalcularSubtotais();" class="text-slate-500 hover:text-red-400 px-1">✕</button></td>
              </tr>`;
          });
        }
      }

      const bId = `blk-solo-${c.id}`;
      const headerTitle = `Contrato: ${c.label} (Faturamento: Solo CSP)`;
      container.innerHTML += `
        <div id="${bId}" class="quote-block" data-title="### ${headerTitle}">
          ${core.renderBlockHeader(headerTitle, bId)}
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
  }
};