// ============================================================================
// MÓDULO DE TABELAS: MICROSOFT (Scan, Solo, Perpétuo, MPSA) - v5.9
// Arquivo: js/tables/microsoft.js
// ============================================================================

const MS_SECONDARY_RULES = [
  {
    key: 'frontline',
    checkboxId: 'chk-show-frontline',
    flagProp: 'showFrontline',
    label: 'Frontline (F1/F3)',
    queryRegex: /\b(frontline|kiosk|f1|f3|flw)\b/i,
    productRegex: /\b(frontline|kiosk|f1|f3|flw)\b/i
  },
  {
    key: 'noteams',
    checkboxId: 'chk-show-noteams',
    flagProp: 'showNoTeams',
    label: 'Sem Teams',
    queryRegex: /\b(no\s*teams|sem\s*teams|without\s*teams|s\/\s*teams)\b/i,
    testProduct: (nome) => {
        return /\b(no|sem|without|w\/o)\s*teams\b/i.test(nome);
    }
  },
  {
    key: 'copilot',
    checkboxId: 'chk-show-copilot',
    flagProp: 'showCopilot',
    label: 'Bundles Copilot',
    queryRegex: /\b(with\s+copilot|copilot)\b/i,
    testProduct: (nome) => {
        const isCopilotBundle = /\b(?:with|w\/|and)\s+(?:microsoft\s+)?(?:365\s+)?copilot\b/i.test(nome);
        const isNativeCopilot = !isCopilotBundle && (
            /^(?:microsoft\s+)?(?:365\s+)?copilot\b/i.test(nome) ||
            /\bcopilot\s+(?:studio|for\s+sales|for\s+service|for\s+security|business)\b/i.test(nome)
        );
        return isCopilotBundle;
    }
  },
  {
    key: 'trial',
    checkboxId: 'chk-show-trial',
    flagProp: 'showTrial',
    label: 'Trial / Promo',
    queryRegex: /\b(trial|free|gratuito|promo)\b/i,
    productRegex: /\b(trial|free|gratuito|promo)\b/i
  },
  {
    key: 'phone',
    checkboxId: 'chk-ms-show-phone',
    flagProp: 'showPhone',
    label: 'Teams Phone / Voz',
    queryRegex: /\b(phone|voice|voz|calling|audio|conferencing|rooms|discagem|direct\s*routing|operator)\b/i,
    productRegex: /\b(teams\s+phone|phone\s+standard|phone\s+resource|calling\s+plan|audio\s+conferencing|communication\s+credits|teams\s+rooms|teams\s+shared\s+devices|operator\s+connect)\b/i
  },
  {
    key: 'dynamics',
    checkboxId: 'chk-ms-show-dynamics',
    flagProp: 'showDynamics',
    label: 'Dynamics / PowerApps',
    queryRegex: /\b(dynamics|dyn365|d365|power\s*apps|power\s*automate|power\s*pages|power\s*virtual|dataverse|business\s+central|finance|supply\s+chain|customer\s+service|field\s+service|sandbox|operations)\b/i,
    productRegex: /\b(dynamics\s*365|dyn365|power\s*apps|power\s*automate|power\s*pages|power\s*virtual\s*agents|dataverse|business\s+central|operations\s*-\s*sandbox)\b/i
  },
  {
    key: 'win365',
    checkboxId: 'chk-ms-show-win365',
    flagProp: 'showWin365',
    label: 'Windows 365 (Cloud PC)',
    queryRegex: /\b(windows\s*365|win\s*365|win365|cloud\s*pc|vcpu|gpu)\b/i,
    productRegex: /\b(windows\s*365|cloud\s*pc|\d+\s*vcpu)\b/i
  },
  {
    key: 'niche',
    checkboxId: 'chk-ms-show-niche',
    flagProp: 'showNiche',
    label: 'Clipchamp / Viva',
    queryRegex: /\b(clipchamp|viva|minecraft|hololens|bookings|scheduler|yammer|loop|sway|dragon)\b/i,
    productRegex: /\b(clipchamp|viva\b|minecraft|hololens|bookings|scheduler|yammer|dragon\s+copilot)\b/i
  },
  {
    key: 'extconnector',
    checkboxId: 'chk-ms-show-extconnector',
    flagProp: 'showExtConnector',
    label: 'External Connector',
    queryRegex: /\b(external|connector|ext\s*conn)\b/i,
    productRegex: /\b(external\s*connector|ext\s*conn)\b/i
  },
  {
    key: 'azurecloud',
    checkboxId: 'chk-ms-show-azurecloud',
    flagProp: 'showAzureCloud',
    label: 'Azure / Cloud Add-on',
    queryRegex: /\b(azure|arc)\b/i,
    productRegex: /\b(azure|azure\s+hybrid|azure\s+arc|cloud\s+add[\s\-]?on)\b/i
  }
];

function passaFiltroSecundarioMicrosoft(nomeProdutoRaw, itemSearchRaw, flags = {}, facetTracker = null) {
  const nome = String(nomeProdutoRaw || '').toLowerCase();
  const query = String(itemSearchRaw || '').toLowerCase();
  const buscouSemTeams = /\b(no\s*teams|sem\s*teams|without\s*teams|s\/\s*teams)\b/i.test(query);
  const isProdSemTeams = /\b(no|sem|without|w\/o)\s*teams\b/i.test(nome);
  if (buscouSemTeams && !isProdSemTeams) {
    return false;
  }
  let permitido = true;
  for (const rule of MS_SECONDARY_RULES) {
    const buscouExplicito = rule.queryRegex.test(query);
    const isSecProduct = rule.testProduct ? rule.testProduct(nome) : rule.productRegex.test(nome);

    if (isSecProduct && !buscouExplicito) {
      if (facetTracker) {
        facetTracker[rule.checkboxId] = (facetTracker[rule.checkboxId] || 0) + 1;
      }
      if (!flags[rule.flagProp]) {
        permitido = false;
      }
    }
  }

  return permitido;
}

// Ordena resultados colocando os produtos Core mais vendidos no topo
function calcularScoreRelevanciaMS(nomeProdutoRaw, itemSearchRaw) {
  const nome = String(nomeProdutoRaw || '').toLowerCase().trim();
  const query = String(itemSearchRaw || '').toLowerCase().trim();
  let score = 100;
  
  // Match exato ou muito próximo ganha prioridade máxima
  if (nome === query || nome === `microsoft 365 ${query}` || nome === `microsoft 365 business ${query}`) score -= 80;
  
  // Prioridade para famílias Core B2B SMB (removido o '$' do final para aceitar sufixos como 'No Teams')
  if (/^microsoft 365 business (basic|standard|premium)/i.test(nome)) score -= 60;
  else if (/^microsoft 365 (e3|e5|apps for business|apps for enterprise)/i.test(nome)) score -= 50;
  else if (/^office 365 (e1|e3|e5)/i.test(nome)) score -= 45;
  else if (/^exchange online (plan 1|plan 2|archiving)/i.test(nome)) score -= 45;
  else if (/^power bi pro$/i.test(nome)) score -= 48;
  else if (/^power bi premium per user$/i.test(nome)) score -= 40;
  else if (/^(project|visio|intune|defender|entra)/i.test(nome)) score -= 35;
  else if (/^(windows server|sql server)/i.test(nome)) score -= 35;
  
  // Penaliza nomes muito longos (geralmente add-ons específicos ou SKUs de nicho)
  score += Math.min(25, Math.floor(nome.length / 8));
  
  return score;
}

window.Cotador.tables.ms_scan = {
  async processar(parsedItems, flags = {}) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    if (!flags.append && !flags.returnHTML) container.innerHTML = '';

    const domScanInput = document.getElementById('ms-scan-discount') || document.getElementById('scan-discount-pct');
    const rawScanPct = (flags.scanDiscountPct !== undefined && flags.scanDiscountPct !== null && flags.scanDiscountPct !== '')
      ? Number(flags.scanDiscountPct)
      : (domScanInput && domScanInput.value !== '' ? Number(domScanInput.value) : 7);

    const descontoScan = Number.isFinite(rawScanPct) ? Math.min(100, Math.max(0, rawScanPct)) : 7;
    const fmtDescPct = Number.isInteger(descontoScan) ? String(descontoScan) : String(descontoScan).replace('.', ',');
    const thScanLabel = descontoScan > 0 ? `Custo Final (-${fmtDescPct}%)` : `Custo Base`;
    const segOrFilter = core.construirFiltroPostgrestSegmento('segmento', flags.segmentos);

    const promessas = parsedItems.map(async item => {
      const params = [['select', '*'], ['limit', '1000']];
      const isPnQuery = item.keywords.length === 1 && /^[0-9A-Z\-]{5,22}$/i.test(item.keywords[0]) && /\d/.test(item.keywords[0]);

      if (isPnQuery) {
        const term = item.keywords[0];
        params.push(['or', `(sku.ilike.*${term}*,offer_display_name.ilike.*${term}*)`]);
      } else {
        const andClauses = item.keywords.map(kw => `offer_display_name.ilike.*${kw}*`).join(',');
        if (andClauses) params.push(['and', `(${andClauses})`]);
      }
      if (segOrFilter) params.push(['or', segOrFilter]);
      let data = [];
      try {
        data = await core.fetchSupabase('microsoft_scan', params);
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
        const fallback = [['select', '*'], ['limit', '1000']];
        const andClausesFb = item.keywords.map(kw => `offer_display_name.ilike.*${kw}*`).join(',');
        if (andClausesFb) fallback.push(['and', `(${andClausesFb})`]);
        data = await core.fetchSupabase('microsoft_scan', fallback);
      }

      data = data.filter(r => {
        const nome = r.offer_display_name || r.titulo_sku || '';
        const preco = core.parsePrice(r.preco_unitario);
        if (preco <= 0) return false;
        if (!core.isItemSegmentoValido(nome, r, flags.segmentos, preco)) return false;
        return passaFiltroSecundarioMicrosoft(nome, item.rawSearch, flags, flags.facetTracker);
      });

      data.sort((a, b) => {
        const nomeA = a.offer_display_name || a.titulo_sku || '';
        const nomeB = b.offer_display_name || b.titulo_sku || '';
        return calcularScoreRelevanciaMS(nomeA, item.rawSearch) - calcularScoreRelevanciaMS(nomeB, item.rawSearch);
      });

      return { item, data };
    });

    const resultadosPorItem = await Promise.all(promessas);
    let blocksHTML = '';
    const matchedItemIndices = new Set();

    for (const c of (flags.contratos || [])) {
      let rowsHTML = '';

      for (const { item, data } of resultadosPorItem) {
        const filtrados = data.filter(r => {
          const termo = (r.tempo_contrato || '').trim().toUpperCase();
          const plano = (r.ciclo_pagamento || '').trim().toUpperCase();
          return (c.scanTempo.toUpperCase() === termo) && (c.scanCiclo.toUpperCase() === plano);
        });

        filtrados.forEach(r => {
          matchedItemIndices.add(item.itemIndex);
          const tabela = core.parsePrice(r.preco_unitario);
          const finalDesc = tabela * (1 - (descontoScan / 100));
          const pn = r.sku;
          const fmtTabela = `R$ ${core.formatBRL(tabela)}`;
          const fmtFinal = `R$ ${core.formatBRL(finalDesc)}`;
          const segBadge = core.renderSegmentBadge(r.offer_display_name, r, flags.segmentos);
          const prodKey = core.normalizarChaveProdutoMS(r.offer_display_name, item.itemIndex);
          const detalhesScanCusto = core.renderDetalhesScanCSP(c.id, finalDesc, 1);

          rowsHTML += `<tr data-row-kind="ms_scan" data-contract-id="${c.id}" data-base-price-tabela="${tabela}" data-unit-price="${finalDesc}" data-pn="${core.escapeHTML(pn)}" data-prod-key="${core.escapeHTML(prodKey)}">
            <td class="font-medium text-[#323130]">${core.renderCopyLink(r.offer_display_name, r.offer_display_name, 'Produto')}${segBadge}</td>
            <td>${core.renderQtyInput(item.qty)}</td>
            <td class="col-pn">${core.renderPnBadge(pn)}</td>
            <td class="col-secondary col-internal-cost text-gray-500 font-normal whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtTabela, fmtTabela, 'Custo Tabela')}</td>
            <td class="col-cost-normal font-medium text-[#323130] whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtFinal, fmtFinal, thScanLabel)}${detalhesScanCusto}</td>
            <td class="col-margin-price font-semibold text-[#323130] whitespace-nowrap tabular-nums">-</td>
            <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
            <td class="text-right">${core.renderRowActions()}</td>
          </tr>`;
        });
      }

      if (!rowsHTML) continue;
      const bId = `blk-scan-${c.id}`;
      const headerTitle = `Contrato: ${c.label} (Faturamento: Scansource)`;
      blocksHTML += `<div id="${bId}" class="quote-block quote-block-scan" data-title="### ${headerTitle}">${core.renderBlockHeader(headerTitle, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b border border-[#edebe9]"><table><thead><tr><th>Produto</th><th>Qtd</th><th class="col-pn">PN (SKU)</th><th class="col-secondary col-internal-cost">Custo Tabela</th><th class="col-cost-normal">${thScanLabel}</th><th class="col-margin-price">Valor c/ Margem</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`;
    }

    if (!flags.returnHTML && blocksHTML) {
      container.insertAdjacentHTML('beforeend', blocksHTML);
    }

    return { html: blocksHTML, matchedItemIndices };
  }
};

window.Cotador.tables.ms_solo = {
  async processar(parsedItems, flags = {}) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    if (!flags.append && !flags.returnHTML) container.innerHTML = '';

    const segOrFilter = core.construirFiltroPostgrestSegmento('segmento', flags.segmentos);
    const toggle = document.getElementById('chk-solo-service');
    const isSoloEnabled = !toggle || toggle.checked;
    const thSoloLabel = isSoloEnabled ? 'Valor com 5% Serviços' : 'Valor Base (Sem Adicional)';

    const promessas = parsedItems.map(async item => {
      const params = [['select', '*'], ['limit', '1500']];
      const isPnQuery = item.keywords.length === 1 && /^[0-9A-Z\-]{5,35}$/i.test(item.keywords[0]) && /\d/.test(item.keywords[0]);

      if (isPnQuery) {
        const term = item.keywords[0];
        const basePn = term.split('-')[0];
        params.push(['or', `(id_produto.ilike.*${basePn}*,titulo_sku.ilike.*${term}*)`]);
      } else {
        // Combina as palavras-chave com AND e usa OR internamente para buscar no título ou descrição
        const andClauses = item.keywords.map(kw => `or(titulo_sku.ilike.*${kw}*,descricao_produto.ilike.*${kw}*)`).join(',');
        if (andClauses) params.push(['and', `(${andClauses})`]);
      }
      if (segOrFilter) params.push(['or', segOrFilter]);

      let data = [];
      try {
        data = await core.fetchSupabase('microsoft_solo', params);
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
        const fallback = [['select', '*'], ['limit', '1500']];
        const andClausesFb = item.keywords.map(kw => `or(titulo_sku.ilike.*${kw}*,descricao_produto.ilike.*${kw}*)`).join(',');
        if (andClausesFb) fallback.push(['and', `(${andClausesFb})`]);
        if (segOrFilter) fallback.push(['or', segOrFilter]);
        data = await core.fetchSupabase('microsoft_solo', fallback);
      }

      data = data.filter(r => {
        const tags = String(r.tags || '').toLowerCase();
        if (!flags.showTrial && tags.includes('trial')) {
          return false; // Pula a renderização deste produto
        }

        const nome = r.offer_display_name || r.titulo_sku || '';
        const custoCom5Base = core.parsePrice(r.valor_5pct_servicos ?? r.valor_com_5_servicos ?? r['Valor com 5% serviços'] ?? r.fob_impostos);
        const rawFob = core.parsePrice(r.fob_impostos);
        const preco = isSoloEnabled ? custoCom5Base : rawFob;
        if (preco <= 0) return false;
        if (!core.isItemSegmentoValido(nome, r, flags.segmentos, preco)) return false;
        return passaFiltroSecundarioMicrosoft(nome, item.rawSearch, flags, flags.facetTracker);
      });

      data.sort((a, b) => {
        const nomeA = a.offer_display_name || a.titulo_sku || '';
        const nomeB = b.offer_display_name || b.titulo_sku || '';
        return calcularScoreRelevanciaMS(nomeA, item.rawSearch) - calcularScoreRelevanciaMS(nomeB, item.rawSearch);
      });

      return { item, data };
    });

    const resultadosPorItem = await Promise.all(promessas);
    let blocksHTML = '';
    const matchedItemIndices = new Set();

    for (const c of (flags.contratos || [])) {
      let rowsHTML = '';

      for (const { item, data } of resultadosPorItem) {
        const filtradosRaw = data.filter(r => {
          const termoBD = (r.termo_duracao || '').trim().toUpperCase();
          const planoBD = (r.plano_pagamento || '').trim().toLowerCase();
          
          const isP1Y = termoBD === 'P1Y' || termoBD === '1 YEAR' || termoBD === '1 ANO' || termoBD === 'ANUAL';
          const isP3Y = termoBD === 'P3Y' || termoBD === '3 YEARS' || termoBD === '3 ANOS' || termoBD === 'TRIENAL';
          const isP1M = termoBD === 'P1M' || termoBD === '1 MONTH' || termoBD === '1 MÊS' || termoBD === '1 MES' || termoBD === 'MENSAL';

          const isAnnual = planoBD === 'annual' || planoBD === 'anual' || planoBD === 'yearly';
          const isMonthly = planoBD === 'monthly' || planoBD === 'mensal';
          const isTriennial = planoBD === 'triennial' || planoBD === 'trienal';

          if (c.id === 'am') return isP1Y && (isAnnual || isMonthly);
          if (c.id === 'tm') return isP3Y && (isTriennial || isAnnual || isMonthly);

          const matchTermo = (c.soloTermo === 'P1Y' && isP1Y) || (c.soloTermo === 'P3Y' && isP3Y) || (c.soloTermo === 'P1M' && isP1M) || (termoBD === c.soloTermo);
          const matchPlano = (c.soloPlano.toLowerCase() === 'annual' && isAnnual) || 
                             (c.soloPlano.toLowerCase() === 'monthly' && isMonthly) || 
                             (c.soloPlano.toLowerCase() === 'triennial' && isTriennial) || 
                             (planoBD === c.soloPlano.toLowerCase());

          return matchTermo && matchPlano;
        });

        // ERRO FUTURO EVITADO: Remove duplicadas priorizando o plano mensal caso a tabela do Dynamics traga ambas as linhas para o mesmo produto
        const unicos = new Map();
        filtradosRaw.forEach(r => {
            const key = r.id_produto || r.titulo_sku;
            const strPlano = String(r.plano_pagamento || '').trim().toLowerCase();
            const isMonthly = strPlano === 'monthly' || strPlano === 'mensal';
            if (!unicos.has(key) || isMonthly) {
                unicos.set(key, r);
            }
        });

        unicos.forEach(r => {
          matchedItemIndices.add(item.itemIndex);
          const skuId = String(r.sku_id || '').padStart(4, '0');
          // For a a montagem do PN com o plano selecionado na tela (ex: P1Y-Monthly) ao inv s do que vem no banco
          const basePn = `${r.id_produto}-${skuId}-${c.soloTermo}-${c.soloPlano}`;
          const mods = core.obterModificadoresPnSolo ? core.obterModificadoresPnSolo() : { prefix: '', suffix: '' };
          const pn = `${mods.prefix}${basePn}${mods.suffix}`;
          const custoCom5Base = core.parsePrice(r.valor_5pct_servicos ?? r.valor_com_5_servicos ?? r['Valor com 5% servi os'] ?? r.fob_impostos);
          const rawFob = core.parsePrice(r.fob_impostos);
          const rawMensalAnual = core.parsePrice(r.termo_anual_pagamento_mensal);
          const planoPagamento = String(r.plano_pagamento || '').trim().toLowerCase();
          const isMonthly = planoPagamento === 'monthly' || planoPagamento === 'mensal';
          const divisor = c.id === 'ta' ? 3 : (c.id === 'tm' && !isMonthly ? 36 : 1);
          
          let custoFinal;
          let mensalSem5 = 0;
          let anualSem5 = 0;
          if (c.id === 'am') {
            if (isMonthly) {
                mensalSem5 = rawFob;
                anualSem5 = rawFob * 12;
                custoFinal = isSoloEnabled ? custoCom5Base : rawFob;
            } else {
                mensalSem5 = rawMensalAnual > 0 ? rawMensalAnual : (rawFob / 12);
                anualSem5 = rawFob;
                const mensalCom5Calc = (custoCom5Base > rawFob * 0.5 && rawFob > 0) ? (custoCom5Base / 12) : custoCom5Base;
                custoFinal = isSoloEnabled ? mensalCom5Calc : mensalSem5Calc;
            }
          } else if (c.id === 'tm') {
            if (isMonthly) {
                mensalSem5 = rawFob;
                anualSem5 = rawFob * 12;
                custoFinal = isSoloEnabled ? custoCom5Base : rawFob;
            } else {
                mensalSem5 = rawFob / 36;
                anualSem5 = (rawFob / 36) * 12;
                custoFinal = (isSoloEnabled ? custoCom5Base : rawFob) / 36;
            }
          } else {
            const rawTarget = isSoloEnabled ? custoCom5Base : rawFob;
            custoFinal = rawTarget / divisor;
            if (c.id === 'mm') {
                mensalSem5 = rawFob;
                anualSem5 = rawFob * 12;
            } else {
                anualSem5 = rawFob / divisor;
            }
          }
          const fmtCusto = `R$ ${core.formatBRL(custoFinal)}`;
          const infoMensal = core.renderDetalhesSoloCSP(c.id, custoFinal, mensalSem5, anualSem5, 1, false);
          const segBadge = core.renderSegmentBadge(r.titulo_sku, r, flags.segmentos);
          const prodKey = core.normalizarChaveProdutoMS(r.titulo_sku, item.itemIndex);

          rowsHTML += `<tr data-row-kind="ms_solo" data-contract-id="${c.id}" data-fob-impostos="${rawFob}" data-custo-com-5="${custoCom5Base}" data-termo-anual-mensal="${rawMensalAnual}" data-divisor="${divisor}" data-mensal-sem5="${mensalSem5}" data-anual-sem5="${anualSem5}" data-unit-price="${custoFinal}" data-pn="${core.escapeHTML(pn)}" data-base-pn="${core.escapeHTML(basePn)}" data-prod-key="${core.escapeHTML(prodKey)}">
            <td class="font-medium text-[#323130]">${core.renderCopyLink(r.titulo_sku, r.titulo_sku, 'Produto')}${segBadge}</td>
            <td>${core.renderQtyInput(item.qty)}</td>
            <td class="col-pn">${core.renderPnBadge(pn)}</td>
            <td class="col-cost-normal font-medium text-[#323130] whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtCusto, fmtCusto, thSoloLabel)}${infoMensal}</td>
            <td class="col-margin-price font-semibold text-[#323130] whitespace-nowrap tabular-nums">-</td>
            <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
            <td class="text-right">${core.renderRowActions()}</td>
          </tr>`;
        });
      }

      if (!rowsHTML) continue;
      const bId = `blk-solo-${c.id}`;
      const headerTitle = `Contrato: ${c.label} (Faturamento: Solo CSP)`;
      blocksHTML += `<div id="${bId}" class="quote-block" data-title="### ${headerTitle}">${core.renderBlockHeader(headerTitle, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b border border-[#edebe9]"><table><thead><tr><th>Produto</th><th>Qtd</th><th class="col-pn">PN (SKU)</th><th class="col-cost-normal">${thSoloLabel}</th><th class="col-margin-price">Valor c/ Margem</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`;
    }

    if (!flags.returnHTML && blocksHTML) {
      container.insertAdjacentHTML('beforeend', blocksHTML);
    }

    return { html: blocksHTML, matchedItemIndices };
  }
};

window.Cotador.tables.ms_perpetuo = {
  async processar(parsedItems, flags = {}) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    if (!flags.append && !flags.returnHTML) container.innerHTML = '';

    let rowsHTML = '';
    const matchedItemIndices = new Set();
    const segOrFilter = core.construirFiltroPostgrestSegmento('segmento', flags.segmentos);

    const allowMensal = Boolean(flags.pmShowMensal);
    const allowAnual = Boolean(flags.pmShowAnual);
    const allowTrienal = Boolean(flags.pmShowTrienal);
    const allowQualquerTemporario = Boolean(flags.pmShowTemp || allowMensal || allowAnual || allowTrienal);

    const promessas = parsedItems.map(async item => {
      const params = [['select', '*'], ['limit', '1000']];
      const isPnQuery = item.keywords.length === 1 && /^[0-9A-Z\-]{5,25}$/i.test(item.keywords[0]) && /\d/.test(item.keywords[0]);

      if (isPnQuery) {
        const term = item.keywords[0];
        const basePn = term.split('-')[0];
        params.push(['or', `(product_id.ilike.*${basePn}*,nome_produto.ilike.*${term}*)`]);
      } else {
        const andClauses = item.keywords.map(kw => `nome_produto.ilike.*${kw}*`).join(',');
        if (andClauses) params.push(['and', `(${andClauses})`]);
      }

      if (segOrFilter) params.push(['or', segOrFilter]);

      let data = [];
      try {
        data = await core.fetchSupabase('microsoft_perpetuo', params);
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
        const fallbackParams = [['select', '*'], ['limit', '1000']];
        const andClausesFb = item.keywords.map(kw => `nome_produto.ilike.*${kw}*`).join(',');
        if (andClausesFb) fallbackParams.push(['and', `(${andClausesFb})`]);
        data = await core.fetchSupabase('microsoft_perpetuo', fallbackParams);
      }

      data = data.filter(r => {
        const nomeRaw = r.nome_produto || '';
        const nome = nomeRaw.toLowerCase();
        const plano = (r.plano_pagamento || '').trim().toLowerCase();
        const termo = (r.termo_duracao || '').trim().toUpperCase();
        const preco = core.parsePrice(r.fob_impostos || r.erp);

        if (preco <= 0) return false;
        if (!core.isItemSegmentoValido(nomeRaw, r, flags.segmentos, preco)) return false;

        // 1. Identificação precisa e mutuamente exclusiva de assinaturas de software / temporárias
        const isMensal = plano === 'monthly' || termo === 'P1M' || /\b(1\s*m|month|mensal|p1m)\b/i.test(nome);
        const isTrienal = !isMensal && (plano === 'triennial' || termo === 'P3Y' || /\b(3\s*y|3\s*year|3\s*anos|trienal|triennial|p3y)\b/i.test(nome));
        const isAnual = !isMensal && !isTrienal && (plano === 'annual' || termo === 'P1Y' || /\b(1\s*y|1\s*year|1\s*ano|p1y)\b/i.test(nome));
        const isSubscricao = isMensal || isTrienal || isAnual || /\b(subscription|assinatura|license pack \d+ year)\b/i.test(nome);

        if (isSubscricao) {
          if (!allowQualquerTemporario) return false;
          if (isMensal && !allowMensal) return false;
          if (isTrienal && !allowTrienal) return false;
          if (isAnual && !allowAnual) return false;
        }

        // 2. Step-up e CALs (com rastreamento no facetTracker)
        const isStepUp = /\b(step-up|step up|upgrade|migration)\b/i.test(nome);
        const isCal = /\b(cal|rds)\b/i.test(nome);

        if (isStepUp && flags.facetTracker) {
          flags.facetTracker['chk-pm-show-stepup'] = (flags.facetTracker['chk-pm-show-stepup'] || 0) + 1;
        }
        if (isCal && flags.facetTracker) {
          flags.facetTracker['chk-pm-show-cals'] = (flags.facetTracker['chk-pm-show-cals'] || 0) + 1;
        }

        // 3. Motor unificado de filtragem secundária
        const passaSecundario = passaFiltroSecundarioMicrosoft(nomeRaw, item.rawSearch, flags, flags.facetTracker);

        if (!flags.pmShowStepup && isStepUp) return false;
        if (!flags.pmShowCals && isCal) return false;

        return passaSecundario;
      });

      data.sort((a, b) => {
        const nomeA = a.nome_produto || '';
        const nomeB = b.nome_produto || '';
        return calcularScoreRelevanciaMS(nomeA, item.rawSearch) - calcularScoreRelevanciaMS(nomeB, item.rawSearch);
      });

      return { item, data };
    });

    const resultados = await Promise.all(promessas);

    resultados.forEach(({ item, data }) => {
      data.forEach(row => {
        matchedItemIndices.add(item.itemIndex);
        const skuId = String(row.sku_id || '').padStart(4, '0');
        const pn = `${row.product_id}-${skuId}`;
        const preco = core.parsePrice(row.fob_impostos || row.erp);
        const fmtPreco = `R$ ${core.formatBRL(preco)}`;
        const segBadge = core.renderSegmentBadge(row.nome_produto, row, flags.segmentos);
        const prodKey = core.normalizarChaveProdutoMS(row.nome_produto, item.itemIndex);

        const planoRaw = String(row.plano_pagamento || '').trim();
        const planoBadge = (planoRaw && planoRaw.toLowerCase() !== 'onetime')
          ? `<span class="sec-detail ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#eff6fc] text-[#0078d4] border border-[#c7e0f4]">Ciclo: ${core.escapeHTML(planoRaw)}</span>`
          : '';

        rowsHTML += `<tr data-unit-price="${preco}" data-pn="${core.escapeHTML(pn)}" data-prod-key="${core.escapeHTML(prodKey)}">
          <td class="font-medium text-[#323130]">${core.renderCopyLink(row.nome_produto, row.nome_produto, 'Produto')}${planoBadge}${segBadge}</td>
          <td>${core.renderQtyInput(item.qty)}</td>
          <td class="col-pn">${core.renderPnBadge(pn)}</td>
          <td class="col-cost-normal font-medium text-[#323130] whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtPreco, fmtPreco, 'Custo Final')}</td>
          <td class="col-margin-price font-semibold text-[#323130] whitespace-nowrap tabular-nums">-</td>
          <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
          <td class="text-right">${core.renderRowActions()}</td>
        </tr>`;
      });
    });

    if (!rowsHTML) return { html: '', matchedItemIndices };

    const bId = 'blk-perpetuo';
    const title = 'Microsoft CSP Perpétuo (Faturamento: Solo)';
    const blockHTML = `<div id="${bId}" class="quote-block" data-title="### ${title}">${core.renderBlockHeader(title, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b border border-[#edebe9]"><table><thead><tr><th>Produto</th><th>Qtd</th><th class="col-pn">PN (SKU)</th><th class="col-cost-normal">Custo Final (FOB+Impostos)</th><th class="col-margin-price">Valor c/ Margem</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`;

    if (!flags.returnHTML) {
      container.insertAdjacentHTML('beforeend', blockHTML);
    }

    return { html: blockHTML, matchedItemIndices };
  }
};

window.Cotador.tables.ms_mpsa = {
  gerarTermosAbreviadosMPSA(rawSearch, keywords) {
    const mpsaTokenMap = {
      'windows': 'Win',
      'standard': 'Std',
      'enterprise': 'Ent',
      'exchange online': 'ExchOnline',
      'exchange': 'Exch',
      'sharepoint': 'ShrPnt',
      'professional': 'Pro',
      'business': 'Bus',
      'plan 1': 'Plan1',
      'plan 2': 'Plan2',
      'plan 3': 'Plan3'
    };

    const mapped = keywords.map(kw => {
      const lowerKw = kw.toLowerCase().trim();
      return mpsaTokenMap[lowerKw] || kw;
    });

    const changed = mapped.some((m, i) => m.toLowerCase() !== keywords[i].toLowerCase());
    return changed ? mapped : [];
  },

  classificarItemMPSA(row) {
    const tipo = String(row.tipo_item || '').toLowerCase().trim();
    const nome = String(row.nome_curto_peca || '').toLowerCase().trim();
    const uso = String(row.uso_recurso || '').toLowerCase().trim();

    const isStepUp = tipo === 'transition' || tipo.startsWith('upgrade') || /\bfm\b/i.test(nome) || /\b(step-up|step up|upgrade|migration)\b/i.test(nome + ' ' + uso);
    const isSAOnly = tipo.endsWith(' sa') || tipo.includes('license sa') || /\b(sftsa|clasa|ecsa|upsa|sa only)\b/i.test(nome);
    const isLicSA = (tipo.endsWith(' lsa') || /\b(lsa|calsa|eclsa|mlsa|uplsa|lic\/sa|licsa)\b/i.test(nome)) && !isSAOnly;
    const isLicOnly = tipo.endsWith(' license') || /\b(sl|uplic)\b/i.test(nome);

    return { isStepUp, isSAOnly, isLicSA, isLicOnly };
  },

  async processar(parsedItems, flags = {}) {
    const core = window.Cotador.core;
    const container = document.getElementById('resultado-container');
    if (!flags.append && !flags.returnHTML) container.innerHTML = '';

    let rowsHTML = '';
    const matchedItemIndices = new Set();
    const segOrFilterMpsa = core.construirFiltroPostgrestSegmento('tipo_conta_compras', flags.segmentos);

    const promessas = parsedItems.map(async item => {
      const queries = [];
      const isPnQuery = item.keywords.length === 1 && /^[0-9A-Z\-]{5,22}$/i.test(item.keywords[0]) && /\d/.test(item.keywords[0]);

      const p1 = [['select', '*'], ['limit', '800']];
      if (isPnQuery) {
        const term = item.keywords[0];
        p1.push(['or', `(numero_item.ilike.*${term}*,nome_curto_peca.ilike.*${term}*)`]);
      } else {
        const andClauses = item.keywords.map(kw => `nome_curto_peca.ilike.*${kw}*`).join(',');
        if (andClauses) p1.push(['and', `(${andClauses})`]);
      }
      if (segOrFilterMpsa) p1.push(['or', segOrFilterMpsa]);
      p1.push(['order', 'categoria_precos.asc']);

      queries.push(
        core.fetchSupabase('microsoft_mpsa', p1).catch((err) => {
          if (err?.name === 'AbortError') throw err;
          const fallbackP1 = [['select', '*'], ['limit', '800']];
          const andClausesFb = item.keywords.map(kw => `nome_curto_peca.ilike.*${kw}*`).join(',');
          if (andClausesFb) fallbackP1.push(['and', `(${andClausesFb})`]);
          return core.fetchSupabase('microsoft_mpsa', fallbackP1);
        })
      );

      if (!isPnQuery) {
        const abrevTerms = this.gerarTermosAbreviadosMPSA(item.rawSearch, item.keywords);
        if (abrevTerms.length > 0) {
          const p2 = [['select', '*'], ['limit', '800']];
          const andClausesP2 = abrevTerms.map(kw => `nome_curto_peca.ilike.*${kw}*`).join(',');
          if (andClausesP2) p2.push(['and', `(${andClausesP2})`]);
          if (segOrFilterMpsa) p2.push(['or', segOrFilterMpsa]);
          p2.push(['order', 'categoria_precos.asc']);
          queries.push(
            core.fetchSupabase('microsoft_mpsa', p2).catch((err) => {
              if (err?.name === 'AbortError') throw err;
              const fallbackP2 = [['select', '*'], ['limit', '800']];
              const andClausesFb2 = abrevTerms.map(kw => `nome_curto_peca.ilike.*${kw}*`).join(',');
              if (andClausesFb2) fallbackP2.push(['and', `(${andClausesFb2})`]);
              return core.fetchSupabase('microsoft_mpsa', fallbackP2);
            })
          );
        }
      }

      const listas = await Promise.all(queries);
      const todasLinhas = listas.flat();
      const seen = new Set();
      let data = [];

      todasLinhas.forEach(r => {
        const key = `${r.numero_item || ''}_${r.nome_curto_peca || ''}_${r.uso_recurso || ''}_${r.duracao_compra || ''}_${r.tipo_conta_compras || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          data.push(r);
        }
      });

      const nenhumaFlagMpsaMarcada = !flags.showSA && !flags.showLicSA && !flags.showLicOnly;
      const permitirLicOnly = flags.showLicOnly || nenhumaFlagMpsaMarcada;

      data = data.filter(r => {
        const nomeRaw = r.nome_curto_peca || '';
        const nome = nomeRaw.toLowerCase();
        const uso = (r.uso_recurso || '').toLowerCase();
        const duracao = (r.duracao_compra || '').toLowerCase();
        const preco = core.parsePrice(r.custo_com_imposto || r.valor_preco_liquido_atual);

        if (preco <= 0) return false;
        if (!core.isItemSegmentoValido(nomeRaw, r, flags.segmentos, preco)) return false;

        const isShortTerm = duracao.includes('short-term') || /\b(1\s*m|month|mensal)\b/i.test(nome);
        const isAnual = /\b(1\s*y|1\s*year|1\s*ano|annual|anual)\b/i.test(nome);
        const isTrienal = duracao.includes('3 yr') || /\b(3\s*y|3\s*year|3\s*anos|trienal|triennial)\b/i.test(nome);

        if (!flags.pmShowMensal && isShortTerm) return false;
        if (!flags.pmShowAnual && isAnual) return false;
        if (!flags.pmShowTrienal && isTrienal && !flags.showLicSA) return false;

        const { isStepUp, isSAOnly, isLicSA, isLicOnly } = this.classificarItemMPSA(r);
        const isCal = /\b(cal|rds|clasa|calsa|ecl)\b/i.test(nome + ' ' + uso + ' ' + (r.tipo_item || ''));

        if (isStepUp && flags.facetTracker) {
          flags.facetTracker['chk-pm-show-stepup'] = (flags.facetTracker['chk-pm-show-stepup'] || 0) + 1;
        }
        if (isCal && flags.facetTracker) {
          flags.facetTracker['chk-pm-show-cals'] = (flags.facetTracker['chk-pm-show-cals'] || 0) + 1;
        }

        const passaSecundario = passaFiltroSecundarioMicrosoft(nomeRaw, item.rawSearch, flags, flags.facetTracker);

        if (!flags.pmShowStepup && isStepUp) return false;
        if (!flags.pmShowCals && isCal) return false;
        if (!flags.showSA && isSAOnly) return false;
        if (!flags.showLicSA && isLicSA) return false;
        if (!permitirLicOnly && isLicOnly) return false;

        return passaSecundario;
      });

      data.sort((a, b) => {
        const catA = String(a.categoria_precos || 'Z').trim().toUpperCase();
        const catB = String(b.categoria_precos || 'Z').trim().toUpperCase();
        if (catA !== catB) return catA.localeCompare(catB);

        const nomeA = a.nome_curto_peca || '';
        const nomeB = b.nome_curto_peca || '';
        return calcularScoreRelevanciaMS(nomeA, item.rawSearch) - calcularScoreRelevanciaMS(nomeB, item.rawSearch);
      });

      return { item, data };
    });

    const resultados = await Promise.all(promessas);

    resultados.forEach(({ item, data }) => {
      data.forEach(r => {
        matchedItemIndices.add(item.itemIndex);
        const pn = r.numero_item || '';
        const custoImp = core.parsePrice(r.custo_com_imposto || r.valor_preco_liquido_atual);
        const fmtCusto = `R$ ${core.formatBRL(custoImp)}`;
        const usoTxt = r.uso_recurso ? `(${r.uso_recurso})` : '';
        const usoLink = usoTxt ? core.renderCopyLink(usoTxt, r.uso_recurso, 'Uso do Recurso', 'sec-detail text-xs text-gray-500 font-normal ml-1') : '';
        const poolTxt = `Pool: ${r.pool || '-'} (Nível ${r.categoria_precos || 'A'})`;
        const segBadge = core.renderSegmentBadge(r.nome_curto_peca, r, flags.segmentos);
        const prodKey = core.normalizarChaveProdutoMS(r.nome_curto_peca, item.itemIndex);

        rowsHTML += `<tr data-unit-price="${custoImp}" data-pn="${core.escapeHTML(pn)}" data-prod-key="${core.escapeHTML(prodKey)}">
          <td class="font-medium text-[#323130]">${core.renderCopyLink(r.nome_curto_peca, r.nome_curto_peca, 'Produto')}${usoLink}${segBadge}</td>
          <td>${core.renderQtyInput(item.qty)}</td>
          <td class="col-pn">${core.renderPnBadge(pn)}</td>
          <td class="col-secondary text-xs text-gray-500 font-normal whitespace-nowrap">${core.renderCopyLink(poolTxt, poolTxt, 'Pool / Categoria')}</td>
          <td class="col-cost-normal font-medium text-[#323130] whitespace-nowrap tabular-nums">${core.renderCopyLink(fmtCusto, fmtCusto, 'Custo c/ Imposto')}</td>
          <td class="col-margin-price font-semibold text-[#323130] whitespace-nowrap tabular-nums">-</td>
          <td class="col-subtotal font-semibold theme-subtotal whitespace-nowrap tabular-nums">-</td>
          <td class="text-right">${core.renderRowActions()}</td>
        </tr>`;
      });
    });

    if (!rowsHTML) return { html: '', matchedItemIndices };

    const bId = 'blk-mpsa';
    const title = 'Microsoft MPSA (Faturamento: Solo)';
    const blockHTML = `<div id="${bId}" class="quote-block" data-title="### ${title}">${core.renderBlockHeader(title, bId)}<div class="block-table-wrapper overflow-x-auto rounded-b border border-[#edebe9]"><table><thead><tr><th>Produto</th><th>Qtd</th><th class="col-pn">PN (Item)</th><th class="col-secondary">Pool / Cat.</th><th class="col-cost-normal">Custo c/ Imposto</th><th class="col-margin-price">Valor c/ Margem</th><th class="col-subtotal">Subtotal</th><th></th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div>`;

    if (!flags.returnHTML) {
      container.insertAdjacentHTML('beforeend', blockHTML);
    }

    return { html: blockHTML, matchedItemIndices };
  }
};