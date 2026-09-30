// ============================================================================
// MÓDULO DE TABELAS: KASPERSKY (Separado por Produto, Período e Faixa) - v5.9
// Arquivo: js/tables/kaspersky.js
// ============================================================================

function extrairOrdemBandaKaspersky(bandaStr) {
  const nums = String(bandaStr || '').trim().match(/\d+/g);
  if (!nums || nums.length === 0) return 99999999;
  const min = parseInt(nums[0], 10);
  const max = nums.length > 1 ? parseInt(nums[1], 10) : min;
  return min * 10000 + (max % 10000);
}

function obterBandaAutoPorQtdKaspersky(qty) {
  const n = parseInt(qty, 10);
  if (isNaN(n) || n <= 0) return 'all';
  if (n <= 9) return '5-9';
  if (n <= 14) return '10-14';
  if (n <= 19) return '15-19';
  if (n <= 24) return '20-24';
  if (n <= 49) return '25-49';
  if (n <= 99) return '50-99';
  if (n <= 149) return '100-149';
  if (n <= 249) return '150-249';
  if (n <= 499) return '250-499';
  if (n <= 999) return '500-999';
  if (n <= 1499) return '1000-1499';
  return '1500-2499';
}

function extrairOrdemTipoKaspersky(row) {
  const nome = String(row.sale_item_name || '').toLowerCase();
  const tipo = String(row.tipo || '').toLowerCase();
  if (nome.includes('base plus') || tipo.includes('base plus')) return 2;
  if (nome.includes('successive') || tipo.includes('successive')) return 3;
  if (nome.includes('public sector') || tipo.includes('public sector') || tipo.includes('gov')) return 4;
  return 1;
}

function extrairInfoProdutoKaspersky(saleItemName) {
  const raw = String(saleItemName || '').trim();
  const lower = raw.toLowerCase();
  if (lower.startsWith('kaspersky atc training')) {
    const parts = raw.split('.').map(p => p.trim()).filter(Boolean);
    const curso = parts[2] ? parts[2].replace(/\s*Brazilian Edition\b/i, '').trim() : '';
    const titulo = parts.length >= 3 ? `${parts[0]} ${parts[1]} (${curso})` : (parts[0] || raw);
    const slug = titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'atc';
    return { id: slug, titulo, ordem: 90 };
  }
  
  const base = raw.split('.')[0].trim();
  let tituloLimpo = base.replace(/\s*Brazilian Edition\b/i, '').trim();
  if (tituloLimpo.toLowerCase().includes('foundation') && !tituloLimpo.toLowerCase().includes('edr')) {
    tituloLimpo += ' (Sem EDR)';
  }
  
  const tl = tituloLimpo.toLowerCase();
  let ordem = 50;
  if (tl.includes('next foundations')) ordem = 1;
  else if (tl.includes('edr foundations')) ordem = 2;
  else if (tl.includes('edr optimum')) ordem = 3;
  else if (tl.includes('edr expert')) ordem = 4;
  else if (tl.includes('xdr core')) ordem = 5;
  else if (tl.includes('mxdr optimum')) ordem = 8;
  else if (tl.includes('xdr optimum')) ordem = 6;
  else if (tl.includes('xdr expert')) ordem = 7;
  
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kasp-prod';
  return { id: slug, titulo: tituloLimpo, ordem };
}

function extrairPrecoNaoPrimeKaspersky(row, core) {
  if (!row) return 0;
  const direct = row.preco_nao_prime ?? row.preco_n_prime ?? row.nao_prime ?? row.valor_nao_prime ?? row['Pre o nao Prime'] ?? row['Preco nao Prime'] ?? row['pre o nao prime'] ?? row['preco nao prime'];
  if (direct !== undefined && direct !== null) return core.parsePrice(direct);
  for (const [k, v] of Object.entries(row)) {
    if (/prime/i.test(k) && v !== null && v !== undefined) {
      return core.parsePrice(v);
    }
  }
  return 0;
}

function normalizarChaveProdutoKaspersky(saleItemName, banda) {
  let s = String(saleItemName || '').toLowerCase().trim();
  const b = String(banda || '').toLowerCase().trim();
  if (b && b !== '-') { s = s.split(b).join('__banda__'); }
  s = s.replace(/\b\d+\s*-\s*\d+\b/g, '__banda__').replace(/\b\d+\s*(?:year|years|ano|anos|month|months|m s|meses)\b/gi, '__periodo__').replace(/\s+/g, ' ').trim();
  return s;
}

window.Cotador.tables.kaspersky = {
  async processar(parsedItems, flags) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    container.innerHTML = '';

    let showRevenda = flags.showPriceRevenda !== false;
    const showRO = Boolean(flags.showPriceRO);
    const showNaoPrime = Boolean(flags.showPriceNaoPrime);
    if (!showRevenda && !showRO && !showNaoPrime) {
      showRevenda = true;
    }

    const periodosAtivos = [...(flags.periodos || [])];
    if (flags.showSuccessive && !periodosAtivos.some(p => p.match === '1 MÊS')) {
      periodosAtivos.unshift({ id: '1m', label: '1 MÊS', match: '1 MÊS' });
    }

    const somaTotalQtd = parsedItems.reduce((acc, it) => {
      const q = parseInt(it.qty, 10);
      return acc + (!isNaN(q) && q > 0 ? q : 0);
    }, 0);
    const modoBanda = flags.bandaSelect || flags.targetBanda || 'auto';

    const promessas = parsedItems.map(async item => {
      let data = [];
      const hasFoundationKw = item.keywords.some(kw => kw.toLowerCase().includes('foundation'));
      const hasEdrKw = item.keywords.some(kw => kw.toLowerCase() === 'edr');
      const isPnQuery = item.keywords.length === 1 && /^KL[0-9A-Z\-]{5,}$/i.test(item.keywords[0]);

      if (isPnQuery) {
        const params = [['select', '*'], ['limit', '500'], ['part_number', `ilike.*${item.keywords[0]}*`]];
        data = await core.fetchSupabase('kaspersky', params);
      } else if (hasFoundationKw && !hasEdrKw) {
        const p1 = [['select', '*'], ['limit', '1200'], ['sale_item_name', 'ilike.*Foundations*']];
        const p2 = [['select', '*'], ['limit', '1200'], ['sale_item_name', 'ilike.*Endpoint Security Cloud*']];
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
        const params = [['select', '*'], ['limit', '1200']];
        item.keywords.forEach(kw => params.push(['sale_item_name', `ilike.*${kw}*`]));
        data = await core.fetchSupabase('kaspersky', params);
      }

      data = data.filter(r => {
        const nome = String(r.sale_item_name || '').toLowerCase();
        const tipo = String(r.tipo || '').toLowerCase().trim();
        const family = String(r.family || '').toLowerCase().trim();

        const isBasePlus = nome.includes('base plus') || tipo.includes('base plus');
        const isSuccessive = nome.includes('successive') || tipo.includes('successive');
        const isPublic = nome.includes('public sector') || tipo.includes('public sector') || tipo.includes('gov');
        const isTraining =
          nome.startsWith('kaspersky atc training') ||
          nome.includes('atc training') ||
          /\btraining\b/i.test(nome) ||
          /\btraining\b/i.test(family) ||
          /\btraining\b/i.test(tipo);
        const isCrossgrade = /\b(cross[\s\-]?grade|cross)\b/i.test(nome) || /\bcross\b/i.test(tipo);
        const isEduc = /\b(educational|education|academic|escola|edu)\b/i.test(nome) || /\b(educ|acad)\b/i.test(tipo);
        const isServiceOrTraining = tipo === '-' || isTraining;

        if (flags.facetTracker) {
          if (isBasePlus) flags.facetTracker['chk-kasp-show-baseplus'] = (flags.facetTracker['chk-kasp-show-baseplus'] || 0) + 1;
          if (isSuccessive) flags.facetTracker['chk-kasp-show-successive'] = (flags.facetTracker['chk-kasp-show-successive'] || 0) + 1;
          if (isPublic) flags.facetTracker['chk-kasp-show-public'] = (flags.facetTracker['chk-kasp-show-public'] || 0) + 1;
          if (isTraining) flags.facetTracker['chk-kasp-show-training'] = (flags.facetTracker['chk-kasp-show-training'] || 0) + 1;
          if (isCrossgrade) flags.facetTracker['chk-kasp-show-crossgrade'] = (flags.facetTracker['chk-kasp-show-crossgrade'] || 0) + 1;
          if (isEduc) flags.facetTracker['chk-kasp-show-educ'] = (flags.facetTracker['chk-kasp-show-educ'] || 0) + 1;
        }

        if (!flags.showBasePlus && isBasePlus) return false;
        if (!flags.showSuccessive && isSuccessive) return false;
        if (!flags.showPublic && isPublic) return false;
        if (!flags.showTraining && isTraining) return false;
        if (!flags.showCrossgrade && isCrossgrade) return false;
        if (!flags.showEduc && isEduc) return false;

        if (flags.tipo && flags.tipo !== 'all' && !isServiceOrTraining) {
          const targetTipo = String(flags.tipo).toLowerCase();
          if (targetTipo === 'base') {
            const matchBase = tipo === 'base' ||
              (flags.showBasePlus && isBasePlus && !tipo.includes('renew') && !tipo.includes('renov') && !nome.includes('renewal')) ||
              (flags.showSuccessive && isSuccessive && !tipo.includes('renew') && !tipo.includes('renov')) ||
              (flags.showPublic && isPublic && !tipo.includes('renew') && !tipo.includes('renov') && !nome.includes('renewal')) ||
              (flags.showCrossgrade && isCrossgrade && !tipo.includes('renew') && !tipo.includes('renov')) ||
              (flags.showEduc && isEduc && !tipo.includes('renew') && !tipo.includes('renov') && !nome.includes('renewal'));
            if (!matchBase) return false;
          } else if (targetTipo === 'renewal') {
            const matchRenew = tipo === 'renewal' || tipo.includes('renew') || tipo.includes('renov') || nome.includes('renewal');
            if (!matchRenew) return false;
          }
        }
        return true;
      });

      const semQuantidade = item.qty === '-' || item.qty === null || item.qty === '' || isNaN(item.qty);
      let effectiveBanda = flags.targetBanda;

      if (modoBanda === 'auto' || modoBanda === 'auto_sum') {
        effectiveBanda = somaTotalQtd > 0 ? obterBandaAutoPorQtdKaspersky(somaTotalQtd) : 'all';
      } else if (modoBanda === 'auto_item') {
        effectiveBanda = semQuantidade ? 'all' : obterBandaAutoPorQtdKaspersky(item.qty);
      }

      if (effectiveBanda && effectiveBanda !== 'all') {
        data = data.filter(r => {
          const b = (r.banda || '').trim();
          return b === effectiveBanda || b === '-';
        });
      }

      return { item, data };
    });

    const resultadosPorItem = await Promise.all(promessas);
    const matchedItemIndices = new Set();
    const tipoLabel = flags.tipo === 'Renewal' ? 'Renew' : 'Base';

    const produtosMap = new Map();
    resultadosPorItem.forEach(({ item, data }) => {
      data.forEach(r => {
        const infoProd = extrairInfoProdutoKaspersky(r.sale_item_name);
        if (!produtosMap.has(infoProd.id)) {
          produtosMap.set(infoProd.id, {
            ...infoProd,
            firstItemIndex: item.itemIndex ?? 0
          });
        }
      });
    });

    const produtosOrdenados = Array.from(produtosMap.values()).sort((a, b) => {
      if (a.firstItemIndex !== b.firstItemIndex) return a.firstItemIndex - b.firstItemIndex;
      if (a.ordem !== b.ordem) return a.ordem - b.ordem;
      return a.titulo.localeCompare(b.titulo);
    });

    for (const prodInfo of produtosOrdenados) {
      for (const p of periodosAtivos) {
        const bandasSet = new Set();

        resultadosPorItem.forEach(({ data }) => {
          data.forEach(r => {
            const rProd = extrairInfoProdutoKaspersky(r.sale_item_name);
            if (rProd.id === prodInfo.id && (r.periodo || '').toUpperCase().includes(p.match)) {
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

          for (const { item, data } of resultadosPorItem) {
            const filtrados = data.filter(r => {
              const rProd = extrairInfoProdutoKaspersky(r.sale_item_name);
              return (
                rProd.id === prodInfo.id &&
                (r.periodo || '').toUpperCase().includes(p.match) &&
                (r.banda || '').trim() === bandaAtual
              );
            });

            filtrados.sort((a, b) => extrairOrdemTipoKaspersky(a) - extrairOrdemTipoKaspersky(b));

            filtrados.forEach(r => {
              matchedItemIndices.add(item.itemIndex);
              const revenda = core.parsePrice(r.revenda);
              const roOficial = core.parsePrice(r.ro);
              const naoPrime = extrairPrecoNaoPrimeKaspersky(r, core);

              let unitarioRef = NaN;
              let usouFallbackRO = false;

              if (showRO && roOficial > 0) {
                unitarioRef = roOficial;
              } else if (showRevenda && revenda > 0) {
                unitarioRef = revenda;
              } else if (showNaoPrime && naoPrime > 0) {
                unitarioRef = naoPrime;
              } else if (roOficial > 0) {
                unitarioRef = roOficial;
                usouFallbackRO = true;
              }

              const pn = r.part_number;
              const fmtRevenda = revenda > 0 ? `R$ ${core.formatBRL(revenda)}` : '-';
              const fmtRO = roOficial > 0 ? `R$ ${core.formatBRL(roOficial)}` : '-';
              const fmtNaoPrime = naoPrime > 0 ? `R$ ${core.formatBRL(naoPrime)}` : '-';

              const nomeLower = (r.sale_item_name || '').toLowerCase();
              const isFoundationsSemEdr = nomeLower.includes('foundation') && !nomeLower.includes('edr');
              const badgeSemEdr = isFoundationsSemEdr
                ? `<span onclick="Cotador.core.copiarElemento(event, this)" data-copy="SEM EDR" data-label="EDR" title="Clique para copiar" class="copy-link sec-detail ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-normal bg-slate-100 text-slate-600 border border-slate-200">SEM EDR</span>`
                : '';

              const badgeExigeRO = usouFallbackRO
                ? `<span onclick="Cotador.core.copiarElemento(event, this)" data-copy="[Exige RO]" data-label="Aviso RO" title="Faixa possui apenas preço com Registro de Oportunidade (RO)" class="copy-link sec-detail ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">[Exige RO]</span>`
                : '';

              const bandaTxt = bandaAtual === '-' ? 'Único / Serviço' : `Banda: ${bandaAtual}`;
              const prodKey = normalizarChaveProdutoKaspersky(r.sale_item_name, bandaAtual);

              rowsHTML += `<tr data-unit-price="${unitarioRef}" data-pn="${core.escapeHTML(pn)}" data-prod-key="${core.escapeHTML(prodKey)}">
                <td class="font-medium text-slate-800">${core.renderCopyLink(r.sale_item_name, r.sale_item_name, 'Produto')}${badgeSemEdr}${badgeExigeRO}</td>
                <td>${core.renderQtyInput(item.qty)}</td>
                <td class="col-pn">${core.renderPnBadge(pn)}</td>
                <td class="col-secondary text-xs text-slate-500 font-normal whitespace-nowrap">${core.renderCopyLink(bandaTxt, bandaAtual, 'Faixa / Banda')}</td>
                ${showRevenda ? `<td class="col-cost-normal font-medium text-slate-800 whitespace-nowrap tabular-nums">${revenda > 0 ? core.renderCopyLink(fmtRevenda, fmtRevenda, 'Custo Revenda') : '-'}</td>` : ''}
                ${showRO ? `<td class="col-cost-normal font-medium theme-text-dark whitespace-nowrap tabular-nums">${roOficial > 0 ? core.renderCopyLink(fmtRO, fmtRO, 'Custo com RO') : '-'}</td>` : ''}
                ${showNaoPrime ? `<td class="col-cost-normal font-medium text-slate-700 whitespace-nowrap tabular-nums">${naoPrime > 0 ? core.renderCopyLink(fmtNaoPrime, fmtNaoPrime, 'Custo Não Prime sem RO') : '-'}</td>` : ''}
                <td class="col-margin-price font-semibold text-slate-900 whitespace-nowrap tabular-nums">-</td>
                <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
                <td class="text-right">${core.renderRowActions()}</td>
              </tr>`;
            });
          }

          if (!rowsHTML) continue;

          const bandaSlug = bandaAtual.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'unico';
          const bId = `blk-kaspersky-${prodInfo.id}-${p.id}-${bandaSlug}`;
          const headerTitle = `${prodInfo.titulo} (${tipoLabel}) | Período: ${p.label} | Faixa: ${bandaAtual}`;

          container.insertAdjacentHTML('beforeend', `<div id="${bId}" class="quote-block" data-title="### ${headerTitle}">${core.renderBlockHeader(headerTitle, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200"><table><thead><tr><th>Produto</th><th>Qtd</th><th class="col-pn">PN</th><th class="col-secondary">Faixa / Banda</th>${showRevenda ? '<th class="col-cost-normal">Custo Revenda</th>' : ''}${showRO ? '<th class="col-cost-normal">Custo com RO</th>' : ''}${showNaoPrime ? '<th class="col-cost-normal">Não Prime (Sem RO)</th>' : ''}<th class="col-margin-price">Valor c/ Margem</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`);
        }
      }
    }

    return { matchedItemIndices };
  }
};