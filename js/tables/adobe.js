// ============================================================================
// MÓDULO DE TABELAS: ADOBE (Base Padrão & Promo Novos Clientes) - v5.7 ENTERPRISE
// Arquivo: js/tables/adobe.js
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

function criarModuloAdobe(tableName, labelTitulo) {
  return {
    async processar(parsedItems, flags) {
      const core = window.Cotador.core;
      const container = document.getElementById('resultado-container');
      container.innerHTML = '';

      const segmentosAtivos = Array.isArray(flags.segmentos) && flags.segmentos.length > 0
        ? flags.segmentos
        : [flags.segmento || 'teams'];

      // Se algum item não tiver quantidade definida e o filtro estiver em 'auto', exibe todas as tabelas de range
      const algumSemQuantidade = parsedItems.some(
        item => item.qty === '-' || item.qty === null || item.qty === '' || isNaN(item.qty)
      );
      const effectiveLevel = (flags.levelSelect === 'auto' && algumSemQuantidade)
        ? 'all'
        : flags.targetLevel;

      const promessas = parsedItems.map(async item => {
        const params = [['select', '*'], ['limit', '500']];
        item.keywords.forEach(kw => params.push(['product_family', `ilike.*${kw}*`]));

        let data = await core.fetchSupabase(tableName, params);
        const buscouStockExplicito = (item.rawSearch || '').toLowerCase().includes('stock');

        data = data.filter(r => {
          const prodName = (r.product_family || '').toLowerCase();
          const ld = (r.level_detail || '').toLowerCase();

          // Filtra "VIP Select 3 year commit" se a flag de ocultar estiver ativa
          if (flags.hide3YCommit && ld.includes('3 year commit')) {
            return false;
          }

          // Filtra opções "with Adobe Stock" a menos que a flag esteja marcada ou o usuário tenha buscado por "stock"
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

      // Separa as tabelas por Segmento (For Teams / For Enterprise) e por Range (Level 1, Level 2, Level 3, Level 4...) em ordem crescente
      for (const seg of segmentosAtivos) {
        const levelsMap = new Map();

        resultados.forEach(({ data }) => {
          data.forEach(r => {
            if (!(r.product_family || '').toLowerCase().includes(seg)) return;
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
              const matchSeg = (r.product_family || '').toLowerCase().includes(seg);
              const info = obterInfoLevelAdobe(r.level_detail);
              return matchSeg && info.id === lvl.id;
            });

            // Ordena alfabeticamente variantes do mesmo item dentro daquele range
            filtrados.sort((a, b) => {
              const prodA = (a.product_family || '').toLowerCase().trim();
              const prodB = (b.product_family || '').toLowerCase().trim();
              if (prodA !== prodB) return prodA.localeCompare(prodB);
              return core.parsePrice(a.partner_price) - core.parsePrice(b.partner_price);
            });

            filtrados.forEach(r => {
              const usd = core.parsePrice(r.partner_price);
              const brl = usd * flags.taxaDolar;
              const pn = r.part_number;
              const fmtUSD = `US$ ${core.formatUSD(usd)}`;
              const fmtBRL = `R$ ${core.formatBRL(brl)}`;

              const nomeBase = (r.product_family || '').trim();
              const infoLvl = obterInfoLevelAdobe(r.level_detail);
              const nomeComLevel = infoLvl.label ? `${nomeBase} - ${infoLvl.label}` : nomeBase;

              // Chave normalizada sem o sufixo de level para sincronizar Drag & Drop e "Remover Semelhantes" entre todas as tabelas de range
              const prodKey = nomeBase
                .toLowerCase()
                .replace(/\bfor\s+(teams|enterprise)\b/gi, '')
                .replace(/\s+/g, ' ')
                .trim();

              const produtoDisplayHTML = `<span onclick="Cotador.core.copiarElemento(event, this)" data-copy="${core.escapeHTML(nomeComLevel)}" data-label="Produto" title="Clique para copiar produto com level" class="copy-link"><span>${core.escapeHTML(nomeBase)}</span>${infoLvl.label ? ` <span class="theme-text font-semibold">- ${core.escapeHTML(infoLvl.label)}</span>` : ''}</span>`;

              rowsHTML += `<tr data-unit-price="${usd}" data-unit-price-brl="${brl}" data-currency="USD" data-pn="${core.escapeHTML(pn)}" data-prod-key="${core.escapeHTML(prodKey)}">
                <td class="font-medium text-slate-800">${produtoDisplayHTML}</td>
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
          const bId = `blk-${tableName}-${seg}-${lvl.id}`;
          const headerTitle = `${labelTitulo} (${segLabel}) | Faixa: ${lvl.label} | Câmbio: R$ ${core.formatBRL(flags.taxaDolar)}`;

          container.insertAdjacentHTML('beforeend', `<div id="${bId}" class="quote-block" data-currency="USD" data-title="### ${headerTitle}">${core.renderBlockHeader(headerTitle, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b-lg border border-slate-200"><table><thead><tr><th>Produto</th><th>Qtd</th><th>PN</th><th class="col-secondary">Level</th><th>Custo (USD)</th><th class="col-secondary">Custo (BRL)</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`);
        }
      }
    }
  };
}

window.Cotador.tables.adobe_base = criarModuloAdobe('adobe_base', 'Adobe Base (Padrão)');
window.Cotador.tables.adobe_promo = criarModuloAdobe('adobe_promo', 'Adobe Promo (Novos Clientes)');