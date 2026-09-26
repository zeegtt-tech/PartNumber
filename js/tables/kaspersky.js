// ============================================================================
// MÓDULO DE TABELAS: KASPERSKY (1 a 5 Anos, Base/Renew, Bandas & RO) - v5.7
// Arquivo: js/tables/kaspersky.js
// ============================================================================
function extrairOrdemBandaKaspersky(bandaStr) {
  const match = String(bandaStr || '').trim().match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 999999;
}

window.Cotador.tables.kaspersky = {
  async processar(parsedItems, flags) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    container.innerHTML = '';

    const promessas = parsedItems.map(async item => {
      let data = [];
      const hasFoundationKw = item.keywords.some(kw => kw.toLowerCase().includes('foundation'));
      const hasEdrKw = item.keywords.some(kw => kw.toLowerCase() === 'edr');

      // Se buscar por "Foundations" sem especificar "EDR", traz ambas as versões (Com e Sem EDR)
      if (hasFoundationKw && !hasEdrKw) {
        const p1 = [['select', '*'], ['limit', '1000'], ['sale_item_name', 'ilike.*Foundations*']];
        const p2 = [['select', '*'], ['limit', '1000'], ['sale_item_name', 'ilike.*Endpoint Security Cloud*']];
        const [d1, d2] = await Promise.all([
          core.fetchSupabase('kaspersky', p1),
          core.fetchSupabase('kaspersky', p2)
        ]);
        data = [...d1, ...d2];
      } else {
        const params = [['select', '*'], ['limit', '1000']];
        item.keywords.forEach(kw => params.push(['sale_item_name', `ilike.*${kw}*`]));
        data = await core.fetchSupabase('kaspersky', params);
      }

      // Licenças ocultas por padrão: só aparecem se o usuário marcar as caixas correspondentes
      data = data.filter(r => {
        const nome = (r.sale_item_name || '').toLowerCase();
        const tipo = (r.tipo || '').toLowerCase();

        const isSuccessive = nome.includes('successive') || tipo.includes('successive');
        const isPublic = nome.includes('public sector') || tipo.includes('public sector');
        const isBasePlus = nome.includes('base plus') || tipo.includes('base plus');

        if (!flags.showSuccessive && isSuccessive) return false;
        if (!flags.showPublic && isPublic) return false;
        if (!flags.showBasePlus && isBasePlus) return false;

        if (flags.tipo !== 'all') {
          const targetTipo = flags.tipo.toLowerCase();
          if (targetTipo === 'base') {
            const matchBase = tipo === 'base' ||
              (flags.showBasePlus && isBasePlus && !tipo.includes('renew')) ||
              (flags.showSuccessive && isSuccessive && !tipo.includes('renew')) ||
              (flags.showPublic && isPublic && !tipo.includes('renew'));
            if (!matchBase) return false;
          } else if (targetTipo === 'renewal') {
            const matchRenew = tipo === 'renewal' || tipo.includes('renew');
            if (!matchRenew) return false;
          }
        }

        return true;
      });

      // Se não foi colocada quantidade junto ao produto e a Banda está em 'auto', traz todos os ranges
      const semQuantidade = item.qty === '-' || item.qty === null || item.qty === '' || isNaN(item.qty);
      const effectiveBanda = (flags.bandaSelect === 'auto' && semQuantidade)
        ? 'all'
        : flags.targetBanda;

      if (effectiveBanda !== 'all') {
        data = data.filter(r => (r.banda || '').trim() === effectiveBanda);
      }

      return { item, data, effectiveBanda };
    });

    const resultadosPorItem = await Promise.all(promessas);
    const tipoLabel = flags.tipo === 'Renewal' ? 'Renew' : 'Base';
    const algumTodosRanges = resultadosPorItem.some(r => r.effectiveBanda === 'all');
    const bandaHeaderLabel = algumTodosRanges ? 'Todas as Faixas' : flags.targetBanda;

    for (const p of flags.periodos) {
      let rowsHTML = '';

      for (const { item, data } of resultadosPorItem) {
        const filtrados = data.filter(r => (r.periodo || '').toUpperCase().includes(p.match));

        // Mantém separado por produto e ordena os ranges (bandas) em ordem crescente
        filtrados.sort((a, b) => {
          const prodA = (a.sale_item_name || '').toLowerCase().trim();
          const prodB = (b.sale_item_name || '').toLowerCase().trim();
          if (prodA !== prodB) return prodA.localeCompare(prodB);
          return extrairOrdemBandaKaspersky(a.banda) - extrairOrdemBandaKaspersky(b.banda);
        });

        filtrados.forEach(r => {
          const revenda = core.parsePrice(r.revenda);
          const roOficial = core.parsePrice(r.ro);
          const unitarioRef = (flags.mostrarRO && roOficial > 0) ? roOficial : revenda;
          const pn = r.part_number;

          const fmtRevenda = `R$ ${core.formatBRL(revenda)}`;
          const fmtRO = roOficial > 0 ? `R$ ${core.formatBRL(roOficial)}` : '-';

          const hasEdr = (r.sale_item_name || '').toLowerCase().includes('edr');
          const badgeEdr = hasEdr
            ? `<span onclick="Cotador.core.copiarElemento(event, this)" data-copy="COM EDR" data-label="EDR" title="Clique para copiar" class="copy-link sec-detail ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200">COM EDR</span>`
            : `<span onclick="Cotador.core.copiarElemento(event, this)" data-copy="SEM EDR" data-label="EDR" title="Clique para copiar" class="copy-link sec-detail ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-normal bg-slate-100 text-slate-600 border border-slate-200">SEM EDR</span>`;
          const bandaTxt = `Banda: ${r.banda}`;

          rowsHTML += `<tr data-unit-price="${unitarioRef}" data-pn="${core.escapeHTML(pn)}">
            <td class="font-medium text-slate-800">${core.renderCopyLink(r.sale_item_name, r.sale_item_name, 'Produto')}${badgeEdr}</td>
            <td>${core.renderQtyInput(item.qty)}</td>
            <td>${core.renderPnBadge(pn)}</td>
            <td class="col-secondary text-xs text-slate-500 font-normal whitespace-nowrap">${core.renderCopyLink(bandaTxt, r.banda, 'Faixa / Banda')}</td>
            <td class="font-medium text-slate-800 whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtRevenda, fmtRevenda, 'Custo Revenda')}</td>
            ${flags.mostrarRO ? `<td class="font-medium theme-text-dark whitespace-nowrap tabular-nums">${roOficial > 0 ? core.renderCopyLink(fmtRO, fmtRO, 'Custo com RO') : '-'}</td>` : ''}
            <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
            <td class="text-right">${core.renderRowActions()}</td>
          </tr>`;
        });
      }

      if (!rowsHTML) continue;
      const bId = `blk-kaspersky-${p.id}`;
      const headerTitle = `Kaspersky (${tipoLabel}) | Período: ${p.label} (Banda: ${bandaHeaderLabel})`;
      container.insertAdjacentHTML('beforeend', `<div id="${bId}" class="quote-block" data-title="### ${headerTitle}">${core.renderBlockHeader(headerTitle, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200"><table><thead><tr><th>Produto</th><th>Qtd</th><th>PN</th><th class="col-secondary">Faixa / Banda</th><th>Custo Revenda</th>${flags.mostrarRO ? '<th>Custo com RO</th>' : ''}<th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`);
    }
  }
};