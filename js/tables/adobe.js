// ============================================================================
// MÓDULO DE TABELAS: ADOBE (Base Padrão & Promo Novos Clientes) - v5.9
// Arquivo: js/tables/adobe.js
// ============================================================================

function obterInfoLevelAdobe(levelDetail) {
  const raw = String(levelDetail || '').trim();
  const ld = raw.toLowerCase();
  const isVipSelectLevel = /\blevel\s*1[234]\b/i.test(ld);
  const is3Y = ld.includes('3 year commit') || ld.includes('3y commit');
  const suffix3Y = is3Y ? ' (3Y Commit)' : '';
  const offset = is3Y ? 20 : (isVipSelectLevel ? 10 : 0);

  if (/\blevel\s*0?1\b/i.test(ld) || /\b1\s*-\s*9\b/.test(ld) || /\b1\s+to\s+9\b/i.test(ld)) {
    return {
      id: is3Y ? 'lvl-1-3y' : 'lvl-1',
      ordem: 1 + offset,
      groupCode: '1',
      exactCode: '1',
      is3Y,
      isVipSelectLevel: false,
      label: `Level 1 (1-9)${suffix3Y}`
    };
  }
  if (/\blevel\s*12\b/i.test(ld)) {
    return {
      id: is3Y ? 'lvl-12-3y' : 'lvl-12',
      ordem: 2 + offset,
      groupCode: '2',
      exactCode: '12',
      is3Y,
      isVipSelectLevel: true,
      label: `Level 12 (10-49)${suffix3Y}`
    };
  }
  if (/\blevel\s*0?2\b/i.test(ld) || /\b10\s*-\s*49\b/.test(ld) || /\b10\s+to\s+49\b/i.test(ld)) {
    return {
      id: is3Y ? 'lvl-2-3y' : 'lvl-2',
      ordem: 2 + offset,
      groupCode: '2',
      exactCode: '2',
      is3Y,
      isVipSelectLevel: false,
      label: `Level 2 (10-49)${suffix3Y}`
    };
  }
  if (/\blevel\s*13\b/i.test(ld)) {
    return {
      id: is3Y ? 'lvl-13-3y' : 'lvl-13',
      ordem: 3 + offset,
      groupCode: '3',
      exactCode: '13',
      is3Y,
      isVipSelectLevel: true,
      label: `Level 13 (50-99)${suffix3Y}`
    };
  }
  if (/\blevel\s*0?3\b/i.test(ld) || /\b50\s*-\s*99\b/.test(ld) || /\b50\s+to\s+99\b/i.test(ld)) {
    return {
      id: is3Y ? 'lvl-3-3y' : 'lvl-3',
      ordem: 3 + offset,
      groupCode: '3',
      exactCode: '3',
      is3Y,
      isVipSelectLevel: false,
      label: `Level 3 (50-99)${suffix3Y}`
    };
  }
  if (/\blevel\s*14\b/i.test(ld)) {
    return {
      id: is3Y ? 'lvl-14-3y' : 'lvl-14',
      ordem: 4 + offset,
      groupCode: '4',
      exactCode: '14',
      is3Y,
      isVipSelectLevel: true,
      label: `Level 14 (100+)${suffix3Y}`
    };
  }
  if (/\blevel\s*0?4\b/i.test(ld) || /100\+/.test(ld)) {
    return {
      id: is3Y ? 'lvl-4-3y' : 'lvl-4',
      ordem: 4 + offset,
      groupCode: '4',
      exactCode: '4',
      is3Y,
      isVipSelectLevel: false,
      label: `Level 4 (100+)${suffix3Y}`
    };
  }

  const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'other';
  return {
    id: `lvl-${slug}`,
    ordem: 99,
    groupCode: 'other',
    exactCode: 'other',
    is3Y,
    isVipSelectLevel,
    label: raw || 'Padrão'
  };
}

function extrairQualificadorAdobe(row) {
  const add = String(row.additional_detail || '').trim();
  const pType = String(row.product_type || '').trim();
  const pTypeDetail = String(row.product_type_detail || '').trim();
  const lang = String(row.language || '').trim();
  const os = String(row.operating_system || '').trim();
  const ver = String(row.version || '').trim();
  const dur = String(row.duration || '').trim();
  const seg = String(row.segment || '').trim();
  const metric = String(row.metric || '').trim();

  const badges = [];
  let isPackOrSpecial = false;
  let moq = 1;

  // 1. Tipo de Operação / Licença (New, Renewal, Upgrade, Term, FRL)
  if (/renewal|renov/i.test(pTypeDetail) || /renewal/i.test(pType)) {
    badges.push('Renewal');
    isPackOrSpecial = true;
  } else if (/upgrade|migrat|step/i.test(pTypeDetail) || /upgrade|migrat/i.test(add)) {
    badges.push('Upgrade/Migration');
    isPackOrSpecial = true;
  } else if (pTypeDetail && !/^(subscription|cloud subscription|standard)$/i.test(pTypeDetail)) {
    badges.push(pTypeDetail);
  }

  // 2. Packs, MOQ, Créditos e Assets
  const packMatch = add.match(/\b((\d+)\s*Pack)\b/i);
  if (packMatch) {
    badges.push(packMatch[1]);
    isPackOrSpecial = true;
    const packNum = parseInt(packMatch[2], 10);
    if (!isNaN(packNum) && packNum > moq) moq = packNum;
  }

  const moqMatch = add.match(/\b((?:High Growth Offer\s*)?(\d+)\s*MOQ)\b/i);
  if (moqMatch) {
    badges.push(moqMatch[1]);
    isPackOrSpecial = true;
    const moqNum = parseInt(moqMatch[2], 10);
    if (!isNaN(moqNum) && moqNum > moq) moq = moqNum;
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

  // 3. Qualquer outro texto relevante em additional_detail ainda não capturado
  if (add) {
    const cleanAdd = add
      .replace(/\b(\d+)\s*Pack\b/gi, '')
      .replace(/\b(?:High Growth Offer\s*)?(\d+)\s*MOQ\b/gi, '')
      .replace(/\b\d+[K]?\s*(?:CREDIT PACK|Credits)\b/gi, '')
      .replace(/\b(?:Team\s+)?\d+\s*assets\s*per\s*month\b/gi, '')
      .replace(/\b(MICROSOFT AZURE|AWS|Feature Restricted)\b/gi, '')
      .replace(/^[\s\-|,;•]+|[\s\-|,;•]+$/g, '')
      .trim();
    if (cleanAdd && !badges.some(b => b.toLowerCase() === cleanAdd.toLowerCase())) {
      badges.push(cleanAdd);
      isPackOrSpecial = true;
    }
  }

  // 4. Idioma (diferencia PT-BR, LATAM, North American, European e ALL/MUL)
  if (lang) {
    if (/brazil|portuguese|pt[\s\-_]?br/i.test(lang)) badges.push('PT-BR');
    else if (/latin|latam/i.test(lang)) badges.push('LATAM');
    else if (/north\s*america|\bna\b/i.test(lang)) badges.push('North America');
    else if (/europ|\beu\b/i.test(lang)) badges.push('European');
    else if (/spanish|\bes\b/i.test(lang)) badges.push('ES');
    else if (/english|\ben\b/i.test(lang) && !/multi|all/i.test(lang)) badges.push('EN');
    else if (/all|mul|multiple/i.test(lang)) badges.push('Multi-Idioma (ALL)');
    else badges.push(lang);
  }

  // 5. Plataforma / OS, Versão, Duração ou Segmento não-comercial
  if (os && !/^(multiple platforms|mlp|all|multi|cross platform|-)$/i.test(os)) {
    badges.push(os);
  }
  if (ver && !/^(all|dc|cc|-)$/i.test(ver)) {
    badges.push(`v.${ver}`);
  }
  if (dur && !/^(1 year|12 months|annual|anual|-)$/i.test(dur)) {
    badges.push(dur);
  }
  if (seg && !/^(commercial|comercial|corporate|-)$/i.test(seg)) {
    badges.push(seg);
    isPackOrSpecial = true;
  }
  if (metric && !/^(per user|user|named user|1|-)$/i.test(metric) && !badges.includes(metric)) {
    badges.push(metric);
  }

  const uniqueBadges = Array.from(new Set(badges.filter(Boolean)));
  const fullParts = [pTypeDetail, add, lang, os, dur, metric, seg].filter(Boolean);

  return {
    badges: uniqueBadges,
    fullDetail: fullParts.join(' | '),
    isPackOrSpecial,
    moq
  };
}

// Garante que se 2+ SKUs do mesmo produto e level ainda tiverem os mesmos badges,
// qualquer coluna divergente no banco (ou o final do PN) seja exibida para diferenciá-los.
function enriquecerDiferencasIrmaosAdobe(rows) {
  const grupos = new Map();
  rows.forEach(r => {
    const qual = extrairQualificadorAdobe(r);
    r._qualCache = qual;
    const key = `${(r.product_family || '').trim().toLowerCase()}__${(r.level_detail || '').trim().toLowerCase()}__${qual.badges.join('|').toLowerCase()}`;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(r);
  });

  const colsCandidatas = [
    { col: 'product_type_detail', label: '' },
    { col: 'additional_detail', label: '' },
    { col: 'language', label: 'Idioma: ' },
    { col: 'product_type', label: 'Tipo: ' },
    { col: 'duration', label: 'Duração: ' },
    { col: 'operating_system', label: 'OS: ' },
    { col: 'version', label: 'Ver: ' },
    { col: 'metric', label: 'Métrica: ' },
    { col: 'users', label: 'Users: ' },
    { col: 'pool', label: 'Pool: ' },
    { col: 'segment', label: 'Seg: ' },
    { col: 'channel', label: 'Canal: ' },
    { col: 'acd_description', label: '' }
  ];

  grupos.forEach(lista => {
    if (lista.length <= 1) return;
    const colsDiferentes = colsCandidatas.filter(({ col }) => {
      const vals = new Set(lista.map(r => String(r[col] || '').trim().toLowerCase()));
      return vals.size > 1;
    });

    lista.forEach(r => {
      const extras = [];
      colsDiferentes.forEach(({ col, label }) => {
        const val = String(r[col] || '').trim();
        if (val) extras.push(`${label}${val}`);
      });
      r._diffExtras = extras;
    });
  });
}

function calcularLevelPorSomaAdobe(somaQtd) {
  if (somaQtd >= 100) return '4';
  if (somaQtd >= 50) return '3';
  if (somaQtd >= 10) return '2';
  return '1';
}

function renderizarCelulaQtdAdobe(core, qty, moq, fullDetail) {
  const baseInputHTML = core.renderQtyInput(qty);
  if (!moq || moq <= 1) return `<td>${baseInputHTML}</td>`;

  const numQty = Number(qty);
  const abaixoMoq = qty === '-' || qty === null || qty === '' || isNaN(numQty) || numQty < moq;
  const detalheMsg = core.escapeHTML(fullDetail || `Mínimo exigido: ${moq}`);

  return `<td class=" adobe-qty-cell" data-moq="${moq}" oninput="
    const val = parseFloat(event.target.value);
    const warn = this.querySelector('.moq-warning');
    if (warn) {
      const invalido = isNaN(val) || val < ${moq};
      warn.classList.toggle('hidden', !invalido);
    }
  ">
    <div class="flex flex-col items-start gap-1">
      ${baseInputHTML}
      <span class="moq-warning ${abaixoMoq ? '' : 'hidden'} inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 whitespace-nowrap" title="Quantidade abaixo do MOQ exigido (${detalheMsg})">
        ⚠️ MOQ mín: ${moq}
      </span>
    </div>
  </td>`;
}

// Auxiliar para não descartar "Acrobat Sign Solutions for business" nem "Elements 2026"
function pertenceAoSegmentoAdobe(prodFamily, seg, totalSegmentosAtivos) {
  const pf = String(prodFamily || '').toLowerCase();
  if (pf.includes(seg)) return true;
  const semSegmentoExplicito = !pf.includes('teams') && !pf.includes('enterprise');
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

      // 1. Busca os dados elegíveis de cada item primeiro (sem filtrar por level ainda)
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
          const preco = core.parsePrice(r.partner_price);
          if (preco <= 0) return false;

          const infoLvl = obterInfoLevelAdobe(r.level_detail);

          // Se chk-adobe-hide-3y estiver marcado, oculta 3Y Commit e os níveis VIP Select (Level 12/13/14)
          if (flags.hide3YCommit && (infoLvl.is3Y || infoLvl.isVipSelectLevel)) {
            return false;
          }

          if (!flags.showAdobeStock && !buscouStockExplicito && prodName.includes('with adobe stock')) {
            return false;
          }

          return true;
        });

        return { item, data };
      });

      const resultadosBrutos = await Promise.all(promessas);

      // 2. Calcula a faixa ("Automático pela Soma") usando APENAS os itens Adobe válidos encontrados
      const itensAdobeValidos = resultadosBrutos
        .filter(({ data }) => data.length > 0)
        .map(({ item }) => item);

      let effectiveLevel = flags.targetLevel || 'all';

      if (flags.levelSelect === 'auto') {
        const algumValidoSemQuantidade = itensAdobeValidos.some(
          it => it.qty === '-' || it.qty === null || it.qty === '' || isNaN(Number(it.qty)) || Number(it.qty) <= 0
        );

        if (itensAdobeValidos.length === 0 || algumValidoSemQuantidade) {
          effectiveLevel = 'all';
        } else {
          const somaQtdAdobeValidos = itensAdobeValidos.reduce((acc, it) => acc + Number(it.qty), 0);
          effectiveLevel = calcularLevelPorSomaAdobe(somaQtdAdobeValidos);
        }
      }

      // 3. Aplica o filtro de Level (suportando separação entre 2/3/4 e 12/13/14)
      const resultados = resultadosBrutos.map(({ item, data }) => {
        if (effectiveLevel === 'all') return { item, data };

        const target = String(effectiveLevel);
        const isTargetVipSelect = ['12', '13', '14'].includes(target);

        const filtradosPorLevel = data.filter(r => {
          const infoLvl = obterInfoLevelAdobe(r.level_detail);
          if (isTargetVipSelect) {
            return infoLvl.exactCode === target;
          }
          return infoLvl.groupCode === target;
        });

        return { item, data: filtradosPorLevel };
      });

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

            enriquecerDiferencasIrmaosAdobe(filtrados);

            filtrados.forEach(r => {
              matchedItemIndices.add(item.itemIndex);
              const usd = core.parsePrice(r.partner_price);
              const brl = usd * flags.taxaDolar;
              const pn = r.part_number;
              const fmtUSD = `US$ ${core.formatUSD(usd)}`;
              const fmtBRL = `R$ ${core.formatBRL(brl)}`;
              const nomeBase = (r.product_family || '').trim();
              const infoLvl = obterInfoLevelAdobe(r.level_detail);
              const qual = r._qualCache || extrairQualificadorAdobe(r);

              // Mescla os badges extraídos com eventuais colunas divergentes entre SKUs irmãos
              const todosBadges = [...qual.badges];
              if (Array.isArray(r._diffExtras)) {
                r._diffExtras.forEach(ext => {
                  if (!todosBadges.some(b => ext.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(ext.toLowerCase()))) {
                    todosBadges.push(ext);
                  }
                });
              }
              if (todosBadges.length === 0 && filtrados.length > 1 && pn) {
                todosBadges.push(`SKU ${pn.slice(-4)}`);
              }

              const sufixoQual = todosBadges.length > 0 ? ` [${todosBadges.join(' • ')}]` : '';
              const nomeComLevel = infoLvl.label ? `${nomeBase}${sufixoQual} - ${infoLvl.label}` : `${nomeBase}${sufixoQual}`;

              const prodKey = `${nomeBase}${sufixoQual}`
                .toLowerCase()
                .replace(/\bfor\s+(teams|enterprise)\b/gi, '')
                .replace(/\s+/g, ' ')
                .trim();

              const badgesHTML = todosBadges
                .map(b => `<span onclick="Cotador.core.copiarElemento(event, this)" data-copy="${core.escapeHTML(b)}" data-label="Detalhe SKU" title="${core.escapeHTML(qual.fullDetail || b)}" class="copy-link sec-detail ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">${core.escapeHTML(b)}</span>`)
                .join('');

              const produtoDisplayHTML = `<span onclick="Cotador.core.copiarElemento(event, this)" data-copy="${core.escapeHTML(nomeComLevel)}" data-label="Produto" title="Clique para copiar produto com level" class="copy-link copy-link-product"><span>${core.escapeHTML(nomeBase)}</span>${infoLvl.label ? ` <span class="theme-text font-semibold">- ${core.escapeHTML(infoLvl.label)}</span>` : ''}</span>${badgesHTML}`;

              const celulaQtdHTML = renderizarCelulaQtdAdobe(core, item.qty, qual.moq, qual.fullDetail);

              rowsHTML += `<tr data-unit-price="${usd}" data-unit-price-brl="${brl}" data-currency="USD" data-pn="${core.escapeHTML(pn)}" data-prod-key="${core.escapeHTML(prodKey)}">
                <td class="font-medium text-slate-800">${produtoDisplayHTML}</td>
                ${celulaQtdHTML}
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

      return { matchedItemIndices };
    }
  };
}

window.Cotador.tables.adobe_base = criarModuloAdobe('adobe_base', 'Adobe Base (Padrão)');
window.Cotador.tables.adobe_promo = criarModuloAdobe('adobe_promo', 'Adobe Promo (Novos Clientes)');