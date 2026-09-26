// ============================================================================
// MÓDULO DE TABELAS: KASPERSKY (1 a 5 Anos, Base/Renew, Bandas & RO) - v5.7
// Arquivo: js/tables/kaspersky.js
// ============================================================================

function extrairOrdemBandaKaspersky(bandaStr) {
  const nums = String(bandaStr || '').trim().match(/\d+/g);
  if (!nums || nums.length === 0) return 99999999;
  const min = parseInt(nums[0], 10);
  const max = nums.length > 1 ? parseInt(nums[1], 10) : min;
  return min * 10000 + (max % 10000);
}

function extrairMinimoBandaKaspersky(bandaStr) {
  const match = String(bandaStr || '').trim().match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function extrairOrdemTipoKaspersky(row) {
  const nome = (row.sale_item_name || '').toLowerCase();
  const tipo = (row.tipo || '').toLowerCase();
  if (nome.includes('base plus') || tipo.includes('base plus')) return 2;
  if (nome.includes('successive') || tipo.includes('successive')) return 3;
  if (nome.includes('public sector') || tipo.includes('public sector')) return 4;
  return 1;
}

function normalizarChaveProdutoKaspersky(saleItemName, banda) {
  let s = String(saleItemName || '').toLowerCase().trim();
  const b = String(banda || '').toLowerCase().trim();
  if (b && b !== '-') {
    s = s.split(b).join('__banda__');
  }
  s = s
    .replace(/\b\d+\s*-\s*\d+\b/g, '__banda__')
    .replace(/\b\d+\s*(?:year|years|ano|anos|month|months|mês|meses)\b/gi, '__periodo__')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

window.Cotador.tables.kaspersky = {
  async processar(parsedItems, flags) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    container.innerHTML = '';

    // Se algum item não tiver quantidade definida e a Banda estiver em 'auto', exibe todas as tabelas de range em ordem crescente
    const algumSemQuantidade = parsedItems.some(
      item => item.qty === '-' || item.qty === null || item.qty === '' || isNaN(item.qty)
    );
    const effectiveBanda = (flags.bandaSelect === 'auto' && algumSemQuantidade)
      ? 'all'
      : flags.targetBanda;

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
        const seen = new Set();
        [...d1, ...d2].forEach(r => {
          const key = `${r.part_number || ''}_${r.banda || ''}_${r.periodo || ''}_${r.tipo || ''}`;
          if (!seen.has(key)) {
            seen.add(key);
            data.push(r);
          }
        });
      } else {
        const params = [['select', '*'], ['limit', '1000']];
        item.keywords.forEach(kw => params.push(['sale_item_name', `ilike.*${kw}*`]));
        data = await core.fetchSupabase('kaspersky', params);
      }

      // Licenças ocultas por padrão: só aparecem se o usuário marcar as caixas correspondentes
      data = data.filter(r => {
        const nome = (r.sale_item_name || '').toLowerCase();
        const tipo = (r.tipo || '').toLowerCase();

        const isBasePlus = nome.includes('base plus') || tipo.includes('base plus');
        const isSuccessive = nome.includes('successive') || tipo.includes('successive');
        const isPublic = nome.includes('public sector') || tipo.includes('public sector');

        if (!flags.showBasePlus && isBasePlus) return false;
        if (!flags.showSuccessive && isSuccessive) return false;
        if (!flags.showPublic && isPublic) return false;

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

      if (effectiveBanda !== 'all') {
        data = data.filter(r => (r.banda || '').trim() === effectiveBanda);
      }

      return { item, data };
    });

    const resultadosPorItem = await Promise.all(promessas);
    const tipoLabel = flags.tipo === 'Renewal' ? 'Renew' : 'Base';

    // Separa as tabelas por Período e por Range (Banda) em ordem crescente
    for (const p of flags.periodos) {
      const bandasSet = new Set();

      resultadosPorItem.forEach(({ data }) => {
        data.forEach(r => {
          if ((r.periodo || '').toUpperCase().includes(p.match)) {
            const b = (r.banda || '').trim();
            if (b) bandasSet.add(b);
          }
        });
      });

      const bandasOrdenadas = Array.from(bandasSet).sort(
        (a, b) => extrairOrdemBandaKaspersky(a) - extrairOrdemBandaKaspersky(b)
      );

      for (const bandaAtual of bandasOrdenadas) {
        let rowsHTML = '';
        const minBanda = extrairMinimoBandaKaspersky(bandaAtual);
        const mostrarRONaTabela = flags.roMode
          ? (flags.roMode === 'always' || (flags.roMode === 'auto' && ((flags.totalLicenses || 0) >= 100 || minBanda >= 100)))
          : Boolean(flags.mostrarRO || minBanda >= 100);

        for (const { item, data } of resultadosPorItem) {
          const filtrados = data.filter(r =>
            (r.periodo || '').toUpperCase().includes(p.match) &&
            (r.banda || '').trim() === bandaAtual
          );

          // Ordena dentro da tabela do range: Produto -> Tipo (Base, Base Plus, Successive, Public Sector)
          filtrados.sort((a, b) => {
            const keyA = normalizarChaveProdutoKaspersky(a.sale_item_name, a.banda);
            const keyB = normalizarChaveProdutoKaspersky(b.sale_item_name, b.banda);
            if (keyA !== keyB) return keyA.localeCompare(keyB);
            return extrairOrdemTipoKaspersky(a) - extrairOrdemTipoKaspersky(b);
          });

          filtrados.forEach(r => {
            const revenda = core.parsePrice(r.revenda);
            const roOficial = core.parsePrice(r.ro);
            const unitarioRef = (mostrarRONaTabela && roOficial > 0) ? roOficial : revenda;
            const pn = r.part_number;
            const fmtRevenda = `R$ ${core.formatBRL(revenda)}`;
            const fmtRO = roOficial > 0 ? `R$ ${core.formatBRL(roOficial)}` : '-';

            const hasEdr = (r.sale_item_name || '').toLowerCase().includes('edr');
            const badgeEdr = hasEdr
              ? `<span onclick="Cotador.core.copiarElemento(event, this)" data-copy="COM EDR" data-label="EDR" title="Clique para copiar" class="copy-link sec-detail ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200">COM EDR</span>`
              : `<span onclick="Cotador.core.copiarElemento(event, this)" data-copy="SEM EDR" data-label="EDR" title="Clique para copiar" class="copy-link sec-detail ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-normal bg-slate-100 text-slate-600 border border-slate-200">SEM EDR</span>`;

            const bandaTxt = `Banda: ${bandaAtual}`;
            const prodKey = normalizarChaveProdutoKaspersky(r.sale_item_name, bandaAtual);

            rowsHTML += `<tr data-unit-price="${unitarioRef}" data-pn="${core.escapeHTML(pn)}" data-prod-key="${core.escapeHTML(prodKey)}">
              <td class="font-medium text-slate-800">${core.renderCopyLink(r.sale_item_name, r.sale_item_name, 'Produto')}${badgeEdr}</td>
              <td>${core.renderQtyInput(item.qty)}</td>
              <td>${core.renderPnBadge(pn)}</td>
              <td class="col-secondary text-xs text-slate-500 font-normal whitespace-nowrap">${core.renderCopyLink(bandaTxt, bandaAtual, 'Faixa / Banda')}</td>
              <td class="font-medium text-slate-800 whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtRevenda, fmtRevenda, 'Custo Revenda')}</td>
              ${mostrarRONaTabela ? `<td class="font-medium theme-text-dark whitespace-nowrap tabular-nums">${roOficial > 0 ? core.renderCopyLink(fmtRO, fmtRO, 'Custo com RO') : '-'}</td>` : ''}
              <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
              <td class="text-right">${core.renderRowActions()}</td>
            </tr>`;
          });
        }

        if (!rowsHTML) continue;

        const bandaSlug = bandaAtual.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const bId = `blk-kaspersky-${p.id}-${bandaSlug}`;
        const headerTitle = `Kaspersky (${tipoLabel}) | Período: ${p.label} | Faixa: ${bandaAtual}`;

        container.insertAdjacentHTML('beforeend', `<div id="${bId}" class="quote-block" data-title="### ${headerTitle}">${core.renderBlockHeader(headerTitle, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200"><table><thead><tr><th>Produto</th><th>Qtd</th><th>PN</th><th class="col-secondary">Faixa / Banda</th><th>Custo Revenda</th>${mostrarRONaTabela ? '<th>Custo com RO</th>' : ''}<th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`);
      }
    }
  }
};