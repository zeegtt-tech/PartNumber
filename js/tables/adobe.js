// ============================================================================
// MÓDULO DE TABELAS: ADOBE (Base Padrão & Promo Novos Clientes) - v5.7 ENTERPRISE
// Arquivo: js/tables/adobe.js
// ============================================================================
function extrairOrdemLevelAdobe(levelDetail) {
  const ld = (levelDetail || '').toLowerCase();
  if (ld.includes('level 1 ') || ld.includes('1 - 9') || ld.includes('1-9')) return 1;
  if (ld.includes('level 2 ') || ld.includes('level 12') || ld.includes('10 - 49') || ld.includes('10-49')) return 2;
  if (ld.includes('level 3 ') || ld.includes('level 13') || ld.includes('50 - 99') || ld.includes('50-99')) return 3;
  if (ld.includes('level 4 ') || ld.includes('level 14') || ld.includes('100+')) return 4;
  return 99;
}

function criarModuloAdobe(tableName, labelTitulo) {
  return {
    async processar(parsedItems, flags) {
      const core = window.Cotador.core;
      const container = document.getElementById('resultado-container');
      container.innerHTML = '';

      const segmentosAtivos = Array.isArray(flags.segmentos) && flags.segmentos.length > 0
        ? flags.segmentos
        : [flags.segmento || 'teams'];

      const promessas = parsedItems.map(async item => {
        const params = [['select', '*'], ['limit', '300']];
        item.keywords.forEach(kw => params.push(['product_family', `ilike.*${kw}*`]));
        let data = await core.fetchSupabase(tableName, params);

        if (flags.hide3YCommit) {
          data = data.filter(r => !(r.level_detail || '').toLowerCase().includes('3 year commit'));
        }

        // Se o produto não tiver quantidade e o filtro estiver em 'auto', retorna todos os levels
        const semQuantidade = item.qty === '-' || item.qty === null || item.qty === '' || isNaN(item.qty);
        const effectiveLevel = (flags.levelSelect === 'auto' && semQuantidade)
          ? 'all'
          : flags.targetLevel;

        if (effectiveLevel !== 'all') {
          data = data.filter(r => {
            const ld = (r.level_detail || '').toLowerCase();
            if (effectiveLevel === '1') return ld.includes('level 1 ') || ld.includes('1 - 9') || ld.includes('1-9');
            if (effectiveLevel === '2') return ld.includes('level 2 ') || ld.includes('level 12') || ld.includes('10 - 49') || ld.includes('10-49');
            if (effectiveLevel === '3') return ld.includes('level 3 ') || ld.includes('level 13') || ld.includes('50 - 99') || ld.includes('50-99');
            if (effectiveLevel === '4') return ld.includes('level 4 ') || ld.includes('level 14') || ld.includes('100+');
            return true;
          });
        }

        return { item, data };
      });

      const resultados = await Promise.all(promessas);

      for (const seg of segmentosAtivos) {
        let rowsHTML = '';

        resultados.forEach(({ item, data }) => {
          let filtradosSeg = data.filter(r => (r.product_family || '').toLowerCase().includes(seg));

          // Mantém agrupado por produto e ordena os levels/ranges em ordem crescente
          filtradosSeg.sort((a, b) => {
            const prodA = (a.product_family || '').toLowerCase().trim();
            const prodB = (b.product_family || '').toLowerCase().trim();
            if (prodA !== prodB) return prodA.localeCompare(prodB);
            return extrairOrdemLevelAdobe(a.level_detail) - extrairOrdemLevelAdobe(b.level_detail);
          });

          filtradosSeg.forEach(r => {
            const usd = core.parsePrice(r.partner_price);
            const brl = usd * flags.taxaDolar;
            const pn = r.part_number;
            const fmtUSD = `US$ ${core.formatUSD(usd)}`;
            const fmtBRL = `R$ ${core.formatBRL(brl)}`;

            rowsHTML += `<tr data-unit-price="${usd}" data-unit-price-brl="${brl}" data-currency="USD" data-pn="${core.escapeHTML(pn)}">
              <td class="font-medium text-slate-800">${core.renderCopyLink(r.product_family, r.product_family, 'Produto')}</td>
              <td>${core.renderQtyInput(item.qty)}</td>
              <td>${core.renderPnBadge(pn)}</td>
              <td class="col-secondary text-xs text-slate-500 font-normal whitespace-nowrap">${core.renderCopyLink(r.level_detail, r.level_detail, 'Level')}</td>
              <td class="font-medium text-slate-800 whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtUSD, fmtUSD, 'Custo USD')}</td>
              <td class="col-secondary text-slate-400 font-normal whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtBRL, fmtBRL, 'Custo BRL')}</td>
              <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
              <td class="text-right">${core.renderRowActions()}</td>
            </tr>`;
          });
        });

        if (!rowsHTML) continue;

        const segLabel = seg === 'enterprise' ? 'For Enterprise' : 'For Teams';
        const bId = `blk-${tableName}-${seg}`;
        const headerTitle = `${labelTitulo} (${segLabel}) | Câmbio: R$ ${core.formatBRL(flags.taxaDolar)}`;

        container.insertAdjacentHTML('beforeend', `<div id="${bId}" class="quote-block" data-currency="USD" data-title="### ${headerTitle}">${core.renderBlockHeader(headerTitle, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200"><table><thead><tr><th>Produto</th><th>Qtd</th><th>PN</th><th class="col-secondary">Level</th><th>Custo (USD)</th><th class="col-secondary">Custo (BRL)</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`);
      }
    }
  };
}

window.Cotador.tables.adobe_base = criarModuloAdobe('adobe_base', 'Adobe Base (Padrão)');
window.Cotador.tables.adobe_promo = criarModuloAdobe('adobe_promo', 'Adobe Promo (Novos Clientes)');