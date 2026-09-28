// ============================================================================
// MÓDULO DE TABELAS: ADOBE (Base Padrão & Promo Novos Clientes) - v5.8 ENTERPRISE
// Ficheiro: js/tables/adobe.js
// ============================================================================

function obterInfoLevelAdobe(levelDetail) {
  const raw = String(levelDetail || '').trim();
  const ld = raw.toLowerCase();
  const is3Y = ld.includes('3 year commit') || ld.includes('3y commit');
  const suffix3Y = is3Y ? ' (3Y Commit)' : '';
  const offset = is3Y ? 10 : 0;

  if (/\blevel\s*0?1\b/i.test(ld) || /\b1\s*-\s*9\b/.test(ld) || /\b1\s+to\s+9\b/i.test(ld)) {
    return {
      id: is3Y ? 'lvl-1-3y' : 'lvl-1',
      ordem: 1 + offset,
      groupCode: '1',
      label: `Level 1 (1-9)${suffix3Y}`
    };
  }
  if (/\blevel\s*12\b/i.test(ld)) {
    return {
      id: 'lvl-12',
      ordem: 2 + offset,
      groupCode: '2',
      label: `Level 12 (10-49)${suffix3Y}`
    };
  }
  if (/\blevel\s*0?2\b/i.test(ld) || /\b10\s*-\s*49\b/.test(ld) || /\b10\s+to\s+49\b/i.test(ld)) {
    return {
      id: is3Y ? 'lvl-2-3y' : 'lvl-2',
      ordem: 2 + offset,
      groupCode: '2',
      label: `Level 2 (10-49)${suffix3Y}`
    };
  }
  if (/\blevel\s*13\b/i.test(ld)) {
    return {
      id: 'lvl-13',
      ordem: 3 + offset,
      groupCode: '3',
      label: `Level 13 (50-99)${suffix3Y}`
    };
  }
  if (/\blevel\s*0?3\b/i.test(ld) || /\b50\s*-\s*99\b/.test(ld) || /\b50\s+to\s+99\b/i.test(ld)) {
    return {
      id: is3Y ? 'lvl-3-3y' : 'lvl-3',
      ordem: 3 + offset,
      groupCode: '3',
      label: `Level 3 (50-99)${suffix3Y}`
    };
  }
  if (/\blevel\s*14\b/i.test(ld)) {
    return {
      id: 'lvl-14',
      ordem: 4 + offset,
      groupCode: '4',
      label: `Level 14 (100+)${suffix3Y}`
    };
  }
  if (/\blevel\s*0?4\b/i.test(ld) || /100\+/.test(ld)) {
    return {
      id: is3Y ? 'lvl-4-3y' : 'lvl-4',
      ordem: 4 + offset,
      groupCode: '4',
      label: `Level 4 (100+)${suffix3Y}`
    };
  }

  const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'other';
  return {
    id: `lvl-${slug}`,
    ordem: 99,
    groupCode: 'other',
    label: raw || 'Padrão'
  };
}

function extrairQualificadorAdobe(row) {
  const add = String(row.additional_detail || '').trim();
  const pType = String(row.product_type || '').trim();
  const badges = [];
  let isPackOrSpecial = false;

  const packMatch = add.match(/\b(\d+\s*Pack)\b/i);
  if (packMatch) {
    badges.push(packMatch[1]);
    isPackOrSpecial = true;
  }

  const moqMatch = add.match(/\b(High Growth Offer\s*\d+\s*MOQ)\b/i);
  if (moqMatch) {
    badges.push(moqMatch[1]);
    isPackOrSpecial = true;
  }

  const creditMatch = add.match(/\b(\d+[K]?\s*(?:CREDIT PACK|Credits))\b/i);
  if (creditMatch) {
    badges.push(creditMatch[1]);
    isPackOrSpecial = true;
  }

  const assetsMatch = add.match(/\b((?:Team\s+)?\d+\s*assets\s*per\s*month)\b/i);
  if (assetsMatch) {
    badges.push(assetsMatch[1]);
  }

  if (/\bMICROSOFT AZURE\b/i.test(add)) badges.push('Azure');
  else if (/\bAWS\b/i.test(add)) badges.push('AWS');

  if (/Feature Restricted/i.test(pType) || /Feature Restricted/i.test(add)) {
    badges.push('FRL 36M');
    isPackOrSpecial = true;
  } else if (/Term License/i.test(pType)) {
    badges.push('Term License');
    isPackOrSpecial = true;
  }

  return {
    badges,
    fullDetail: add,
    isPackOrSpecial
  };
}

// Auxiliar para não descartar "Acrobat Sign Solutions for business" nem "Elements 2026"
function pertenceAoSegmentoAdobe(prodFamily, seg, totalSegmentosAtivos) {
  const pf = String(prodFamily || '').toLowerCase();
  if (pf.includes(seg)) return true;
  const semSegmentoExplicito = !pf.includes('teams') && !pf.includes('enterprise');
  // Se não tiver 'teams' nem 'enterprise', exibe em 'teams' (ou no único segmento selecionado)
  return semSegmentoExplicito && (seg === 'teams' || totalSegmentosAtivos === 1);
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

      const algumSemQuantidade = parsedItems.some(
        item => item.qty === '-' || item.qty === null || item.qty === '' || isNaN(item.qty)
      );
      const effectiveLevel = (flags.levelSelect === 'auto' && algumSemQuantidade)
        ? 'all'
        : flags.targetLevel;

      const promessas = parsedItems.map(async item => {
        const params = [['select', '*'], ['limit', '800']];
        const isPnQuery = item.keywords.length === 1 && /^[0-9A-Z]{10,18}$/i.test(item.keywords[0]);

        if (isPnQuery) {
          params.push(['part_number', `ilike.*${item.keywords[0]}*`]);
        } else {
          item.keywords.forEach(kw => params.push(['product_family', `ilike.*${kw}*`]));
        }

        let data = await core.fetchSupabase(tableName, params);
        const buscouStockExplicito = (item.rawSearch || '').toLowerCase().includes('stock');

        data = data.filter(r => {
          const prodName = (r.product_family || '').toLowerCase();
          const ld = (r.level_detail || '').toLowerCase();
          const preco = core.parsePrice(r.partner_price);
          if (preco <= 0) return false;

          if (flags.hide3YCommit && ld.includes('3 year commit')) {
            return false;
          }

          if (!flags.showAdobeStock && !buscouStockExplicito && prodName.includes('with adobe stock')) {
            return false;
          }

          return true;
        });

        if (effectiveLevel !== 'all') {
          data = data.filter(r => obterInfoLevelAdobe(r.level_detail).groupCode === String(effectiveLevel));
        }

        return { item, data };
      });

      const resultados = await Promise.all(promessas);
      const matchedItemIndices = new Set();

      for (const seg of segmentosAtivos) {
        const levelsMap = new Map();

        resultados.forEach(({ data }) => {
          data.forEach(r => {
            if (!pertenceAoSegmentoAdobe(r.product_family, seg, segmentosAtivos.length)) return;
            const infoLvl = obterInfoLevelAdobe(r.level_detail);
            if (!levelsMap.has(infoLvl.id)) {
              levelsMap.set(infoLvl.id, infoLvl);
            }
          });
        });

        const levelsOrdenados = Array.from(levelsMap.values()).sort((a, b) => {
          if (a.ordem !== b.ordem) return a.ordem - b.ordem;
          return a.label.localeCompare(b.label);
        });

        for (const lvl of levelsOrdenados) {
          let rowsHTML = '';

          resultados.forEach(({ item, data }) => {
            const filtrados = data.filter(r => {
              const matchSeg = pertenceAoSegmentoAdobe(r.product_family, seg, segmentosAtivos.length);
              const info = obterInfoLevelAdobe(r.level_detail);
              return matchSeg && info.id === lvl.id;
            });

            // Ordena priorizando licença padrão (sem Pack/MOQ restrito) antes de Packs promocionais
            filtrados.sort((a, b) => {
              const prodA = (a.product_family || '').toLowerCase().trim();
              const prodB = (b.product_family || '').toLowerCase().trim();
              if (prodA !== prodB) return prodA.localeCompare(prodB);

              const qualA = extrairQualificadorAdobe(a);
              const qualB = extrairQualificadorAdobe(b);
              if (qualA.isPackOrSpecial !== qualB.isPackOrSpecial) {
                return qualA.isPackOrSpecial ? 1 : -1;
              }
              return core.parsePrice(a.partner_price) - core.parsePrice(b.partner_price);
            });

            filtrados.forEach(r => {
              matchedItemIndices.add(item.itemIndex);
              const usd = core.parsePrice(r.partner_price);
              const brl = usd * flags.taxaDolar;
              const pn = r.part_number;
              const fmtUSD = `US$ ${core.formatUSD(usd)}`;
              const fmtBRL = `R$ ${core.formatBRL(brl)}`;

              const nomeBase = (r.product_family || '').trim();
              const infoLvl = obterInfoLevelAdobe(r.level_detail);
              const qual = extrairQualificadorAdobe(r);
              const sufixoQual = qual.badges.length > 0 ? ` [${qual.badges.join(' • ')}]` : '';
              const nomeComLevel = infoLvl.label ? `${nomeBase}${sufixoQual} - ${infoLvl.label}` : `${nomeBase}${sufixoQual}`;

              const prodKey = `${nomeBase}${sufixoQual}`
                .toLowerCase()
                .replace(/\bfor\s+(teams|enterprise)\b/gi, '')
                .replace(/\s+/g, ' ')
                .trim();

              const badgesHTML = qual.badges
                .map(b => `<span onclick="Cotador.core.copiarElemento(event, this)" data-copy="${core.escapeHTML(b)}" data-label="Detalhe SKU" title="${core.escapeHTML(qual.fullDetail || b)}" class="copy-link sec-detail ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">${core.escapeHTML(b)}</span>`)
                .join('');

              const produtoDisplayHTML = `<span onclick="Cotador.core.copiarElemento(event, this)" data-copy="${core.escapeHTML(nomeComLevel)}" data-label="Produto" title="Clique para copiar produto com level" class="copy-link"><span>${core.escapeHTML(nomeBase)}</span>${infoLvl.label ? ` <span class="theme-text font-semibold">- ${core.escapeHTML(infoLvl.label)}</span>` : ''}</span>${badgesHTML}`;

              rowsHTML += `<tr data-unit-price="${usd}" data-unit-price-brl="${brl}" data-currency="USD" data-pn="${core.escapeHTML(pn)}" data-prod-key="${core.escapeHTML(prodKey)}">
                <td class="font-medium text-slate-800">${produtoDisplayHTML}</td>
                <td>${core.renderQtyInput(item.qty)}</td>
                <td class="col-pn">${core.renderPnBadge(pn)}</td>
                <td class="col-secondary text-xs text-slate-500 font-normal whitespace-nowrap">${core.renderCopyLink(r.level_detail, r.level_detail, 'Level')}</td>
                <td class="col-cost-normal font-medium text-slate-800 whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtUSD, fmtUSD, 'Custo USD')}</td>
                <td class="col-secondary col-cost-brl text-slate-400 font-normal whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtBRL, fmtBRL, 'Custo BRL')}</td>
                <td class="col-margin-price col-margin-usd font-semibold text-slate-900 whitespace-nowrap tabular-nums">-</td>
                <td class="col-margin-price col-margin-brl font-semibold text-slate-700 whitespace-nowrap tabular-nums">-</td>
                <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
                <td class="text-right">${core.renderRowActions()}</td>
              </tr>`;
            });
          });

          if (!rowsHTML) continue;

          const segLabel = seg === 'enterprise' ? 'For Enterprise' : 'For Teams';
          const bId = `blk-${tableName}-${seg}-${lvl.id}`;
          const headerTitle = `${labelTitulo} (${segLabel}) | Faixa: ${lvl.label} | Câmbio: R$ ${core.formatBRL(flags.taxaDolar)}`;

          container.insertAdjacentHTML('beforeend', `<div id="${bId}" class="quote-block" data-currency="USD" data-title="### ${headerTitle}">${core.renderBlockHeader(headerTitle, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200"><table><thead><tr><th>Produto</th><th>Qtd</th><th class="col-pn">PN</th><th class="col-secondary">Level</th><th class="col-cost-normal">Custo (USD)</th><th class="col-secondary col-cost-brl">Custo (BRL)</th><th class="col-margin-price col-margin-usd">Valor c/ Margem (USD)</th><th class="col-margin-price col-margin-brl">Valor c/ Margem (BRL)</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`);
        }
      }

      const missingItems = parsedItems.filter(it => !matchedItemIndices.has(it.itemIndex));
      queueMicrotask(() => core.renderUnmatchedWarning(missingItems));
      return { matchedItemIndices };
    }
  };
}

window.Cotador.tables.adobe_base = criarModuloAdobe('adobe_base', 'Adobe Base (Padrão)');
window.Cotador.tables.adobe_promo = criarModuloAdobe('adobe_promo', 'Adobe Promo (Novos Clientes)');