// ============================================================================
// MODULO DE TABELAS: KASPERSKY (1 a 5 Anos, Base/Renew, Bandas, RO & EDR)
// Arquivo: js/tables/kaspersky.js
// ----------------------------------------------------------------------------
// CONTRATO DE CONTEXTO PARA IA (GEMINI PRO):
// Registra `kaspersky` em `window.Cotador.tables`.
// ============================================================================

window.Cotador.tables.kaspersky = {
  async processar(parsedItems, flags) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    container.innerHTML = '';
    
    const promessas = parsedItems.map(async item => {
      let data = [];
      const isFoundations = item.rawSearch.toLowerCase().includes('foundation');

      if (isFoundations) {
        const p1 = [['select', '*'], ['limit', '300'], ['sale_item_name', 'ilike.*Foundations*']];
        const p2 = [['select', '*'], ['limit', '300'], ['sale_item_name', 'ilike.*Endpoint Security Cloud*']];
        const [d1, d2] = await Promise.all([
          core.fetchSupabase('kaspersky', p1),
          core.fetchSupabase('kaspersky', p2)
        ]);
        data = [...d1, ...d2];
      } else {
        const params = [['select', '*'], ['limit', '300']];
        item.keywords.forEach(kw => params.push(['sale_item_name', `ilike.*${kw}*`]));
        data = await core.fetchSupabase('kaspersky', params);
      }

      data = data.filter(r => {
        const nome = (r.sale_item_name || '').toLowerCase();
        const tipo = (r.tipo || '').toLowerCase();
        if (flags.ignoreSuccessive && (nome.includes('successive') || tipo.includes('successive'))) return false;
        if (flags.ignorePublic && (nome.includes('public sector') || tipo.includes('public sector'))) return false;
        return true;
      });

      if (flags.edrFilter === 'with_edr') {
        data = data.filter(r => (r.sale_item_name || '').toLowerCase().includes('edr'));
      } else if (flags.edrFilter === 'without_edr') {
        data = data.filter(r => !(r.sale_item_name || '').toLowerCase().includes('edr'));
      }

      if (flags.tipo !== 'all') {
        data = data.filter(r => (r.tipo || '').toLowerCase() === flags.tipo.toLowerCase());
      }
      if (flags.targetBanda !== 'all') {
        data = data.filter(r => (r.banda || '').trim() === flags.targetBanda);
      }

      return { item, data };
    });

    const resultadosPorItem = await Promise.all(promessas);
    const tipoLabel = flags.tipo === 'Renewal' ? 'Renew' : 'Base';

    for (const p of flags.periodos) {
      let rowsHTML = '';
      
      for (const { item, data } of resultadosPorItem) {
        const filtrados = data.filter(r => (r.periodo || '').toUpperCase().includes(p.match));

        if (filtrados.length === 0) {
          rowsHTML += core.renderNotFoundRow(item, flags.mostrarRO ? 7 : 6);
        } else {
          filtrados.forEach(r => {
            const revenda = core.parsePrice(r.revenda);
            const roOficial = core.parsePrice(r.ro);
            const unitarioRef = (flags.mostrarRO && roOficial > 0) ? roOficial : revenda;
            const pn = r.part_number;
            const hasEdr = (r.sale_item_name || '').toLowerCase().includes('edr');
            const badgeEdr = hasEdr
              ? `<span class="sec-detail ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200">COM EDR</span>`
              : `<span class="sec-detail ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-normal bg-slate-100 text-slate-600 border border-slate-200">SEM EDR</span>`;

            rowsHTML += `<tr data-unit-price="${unitarioRef}" data-pn="${pn}"><td class="font-medium text-slate-800">${core.escapeHTML(r.sale_item_name)}${badgeEdr}</td><td>${core.renderQtyInput(item.qty)}</td><td>${core.renderPnBadge(pn)}</td><td class="col-secondary text-xs text-slate-500 font-normal whitespace-nowrap">Banda: ${r.banda}</td><td class="font-medium text-slate-800 whitespace-nowrap tabular-nums">R$ ${core.formatBRL(revenda)}</td>${flags.mostrarRO ? `<td class="font-medium theme-text-dark whitespace-nowrap tabular-nums">${roOficial > 0 ? 'R$ ' + core.formatBRL(roOficial) : '-'}</td>` : ''}<td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td><td class="text-right">${core.renderRowActions()}</td></tr>`;
          });
        }
      }

      const bId = `blk-kaspersky-${p.id}`;
      const headerTitle = `Kaspersky (${tipoLabel}) | Per\u00edodo: ${p.label} (Banda: ${flags.targetBanda})`;
      container.innerHTML += `<div id="${bId}" class="quote-block" data-title="### ${headerTitle}">${core.renderBlockHeader(headerTitle, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200"><table><thead><tr><th>Produto</th><th>Qtd</th><th>PN</th><th class="col-secondary">Faixa / Banda</th><th>Custo Revenda</th>${flags.mostrarRO ? '<th>Custo com RO</th>' : ''}<th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`;
    }
  }
};