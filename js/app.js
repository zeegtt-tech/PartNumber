/**
 * ============================================================================
 * CONTROLADOR DA APLICAÇÃO (APP) - COTADOR v5.5 ENTERPRISE
 * Arquivo: js/app.js
 * ----------------------------------------------------------------------------
 * CONTRATO DE CONTEXTO PARA IA (GEMINI PRO):
 * Este módulo gerencia os eventos de UI, lê os filtros do DOM (`index.html`) e
 * despacha o processamento para os módulos registrados em `window.Cotador.tables`:
 * - Microsoft: `ms_scan`, `ms_solo`, `ms_perpetuo`, `ms_mpsa` (em `js/tables/microsoft.js`)
 * - Adobe: `adobe_base`, `adobe_promo` (em `js/tables/adobe.js`)
 * - Kaspersky: `kaspersky` (em `js/tables/kaspersky.js`)
 * 
 * Após processar qualquer tabela, chama obrigatoriamente `window.Cotador.core.recalcularSubtotais()`.
 * ============================================================================
 */

window.Cotador.app = {
  currentVendor: 'microsoft',
  parsedItems: [],
  totalLicenses: 0,
  
  init() {
    document.getElementById('input-itens').addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.gerarCotacao();
      }
    });
    this.preencherExemplo();
  },
  
  setVendor(vendor) {
    this.currentVendor = vendor;
    document.body.setAttribute('data-vendor', vendor);
    
    ['microsoft', 'adobe', 'kaspersky'].forEach(v => {
      document.getElementById(`btn-vendor-${v}`).classList.toggle('active', v === vendor);
      document.getElementById(`filtros-${v}`).classList.toggle('hidden', v !== vendor);
    });

    document.getElementById('resultado-container').innerHTML = `
      <div class="text-center py-24 text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
        Fabricante alterado para <span class="theme-text font-semibold uppercase">${vendor}</span>.<br>
        Insira os itens no painel esquerdo e clique em <span class="theme-text font-medium">Buscar e Montar Tabelas</span>.
      </div>`;
    document.getElementById('markdown-output').textContent = '';
    this.analisarInput();
  },

  setMsModalidade(mod) {
    document.getElementById('ms-modalidade').value = mod;
    ['scan', 'solo', 'perpetuo', 'mpsa'].forEach(m => {
      const btn = document.getElementById(`btn-ms-mod-${m}`);
      if (btn) btn.classList.toggle('active', m === mod);
    });

    const isSubscription = (mod === 'scan' || mod === 'solo');
    document.getElementById('ms-box-contratos').style.display = isSubscription ? 'block' : 'none';
    document.getElementById('ms-box-flags').style.display = (mod === 'perpetuo') ? 'none' : 'block';
    document.getElementById('ms-flags-csp').style.display = isSubscription ? 'block' : 'none';
    document.getElementById('ms-flags-mpsa').style.display = (mod === 'mpsa') ? 'block' : 'none';

    document.getElementById('resultado-container').innerHTML = `
      <div class="text-center py-24 text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
        Modalidade alterada para <span class="theme-text font-semibold uppercase">${mod}</span>.<br>
        Clique em <span class="theme-text font-medium">Buscar e Montar Tabelas</span> para consultar.
      </div>`;
    document.getElementById('markdown-output').textContent = '';
    this.analisarInput();
  },

  setAdobeSegmento(seg) {
    document.getElementById('adobe-segmento').value = seg;
    ['teams', 'enterprise'].forEach(s => {
      const btn = document.getElementById(`btn-adobe-seg-${s}`);
      if (btn) btn.classList.toggle('active', s === seg);
    });

    const labelSeg = seg === 'enterprise' ? 'For Enterprise' : 'For Teams';
    document.getElementById('resultado-container').innerHTML = `
      <div class="text-center py-24 text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
        Segmento Adobe alterado para <span class="theme-text font-semibold uppercase">${labelSeg}</span>.<br>
        Clique em <span class="theme-text font-medium">Buscar e Montar Tabelas</span> para consultar.
      </div>`;
    document.getElementById('markdown-output').textContent = '';
    this.analisarInput();
  },

  setKaspTipo(tipo) {
    document.getElementById('kasp-tipo').value = tipo;
    document.getElementById('btn-kasp-tipo-base').classList.toggle('active', tipo === 'Base');
    document.getElementById('btn-kasp-tipo-renewal').classList.toggle('active', tipo === 'Renewal');

    const labelTipo = tipo === 'Renewal' ? 'Renew' : 'Base';
    document.getElementById('resultado-container').innerHTML = `
      <div class="text-center py-24 text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
        Tipo de licença Kaspersky alterado para <span class="theme-text font-semibold uppercase">${labelTipo}</span>.<br>
        Clique em <span class="theme-text font-medium">Buscar e Montar Tabelas</span> para consultar.
      </div>`;
    document.getElementById('markdown-output').textContent = '';
    this.analisarInput();
  },
  
  limparInput() {
    document.getElementById('input-itens').value = '';
    this.analisarInput();
    document.getElementById('input-itens').focus();
  },
  
  preencherExemplo() {
    const area = document.getElementById('input-itens');
    if (this.currentVendor === 'microsoft') {
      area.value = "business basic 10\nbusiness standard 26\nExchange plan 1 80";
    } else if (this.currentVendor === 'adobe') {
      area.value = "Illustrator 2\nphotoshop 6\nCreative Cloud Pro 3";
    } else {
      area.value = "Foundations 120";
    }
    this.analisarInput();
  },
  
  getAdobeAutoLevel(sum) {
    if (sum <= 9) return '1';
    if (sum <= 49) return '2';
    if (sum <= 99) return '3';
    return '4';
  },
  
  getKaspAutoBanda(sum) {
    if (sum <= 9) return '5-9';
    if (sum <= 14) return '10-14';
    if (sum <= 19) return '15-19';
    if (sum <= 24) return '20-24';
    if (sum <= 49) return '25-49';
    if (sum <= 99) return '50-99';
    if (sum <= 149) return '100-149';
    if (sum <= 249) return '150-249';
    if (sum <= 499) return '250-499';
    if (sum <= 999) return '500-999';
    if (sum <= 1499) return '1000-1499';
    return '1500-2499';
  },
  
  analisarInput() {
    const raw = document.getElementById('input-itens').value;
    const { items, sumLicenses } = window.Cotador.core.parseInputLines(raw);
    this.parsedItems = items;
    this.totalLicenses = sumLicenses;
  },
  
  async gerarCotacao() {
    this.analisarInput();
    if (this.parsedItems.length === 0) {
      alert('Digite pelo menos um produto na lista!');
      return;
    }
    
    const btn = document.getElementById('btn-buscar');
    const container = document.getElementById('resultado-container');
    btn.disabled = true;
    btn.innerHTML = '<span>Consultando SKUs e montando propostas...</span>';
    container.innerHTML = '<div class="text-center py-20 text-slate-400 text-xs font-normal animate-pulse bg-slate-50/60 rounded-xl border border-slate-200">Consultando banco de dados corporativo...</div>';
    
    try {
      if (this.currentVendor === 'microsoft') {
        const target = document.getElementById('ms-modalidade').value || 'scan';
        const contratos = [];
        
        if (document.getElementById('chk-anual-anual').checked) contratos.push({ id: 'aa', label: 'Anual / Anual', scanTempo: 'Anual', scanCiclo: 'Anual', soloTermo: 'P1Y', soloPlano: 'Annual' });
        if (document.getElementById('chk-anual-mensal').checked) contratos.push({ id: 'am', label: 'Anual / Mensal', scanTempo: 'Anual', scanCiclo: 'Mensal', soloTermo: 'P1Y', soloPlano: 'Monthly' });
        if (document.getElementById('chk-mensal-mensal').checked) contratos.push({ id: 'mm', label: 'Mensal / Mensal', scanTempo: 'Mensal', scanCiclo: 'Mensal', soloTermo: 'P1M', soloPlano: 'Monthly' });
        
        const flags = {
          contratos,
          onlyCommercial: true,
          hideNoTeams: document.getElementById('chk-hide-noteams').checked,
          hideCopilot: document.getElementById('chk-hide-copilot').checked,
          hideSA: document.getElementById('chk-mpsa-hide-sa').checked
        };
        await window.Cotador.tables[`ms_${target}`].processar(this.parsedItems, flags);
        
      } else if (this.currentVendor === 'adobe') {
        const usarPromo = document.getElementById('chk-adobe-promo').checked;
        const tabela = usarPromo ? 'adobe_promo' : 'adobe_base';
        const lvlSelect = document.getElementById('adobe-level').value;
        const flags = {
          segmento: document.getElementById('adobe-segmento').value || 'teams',
          targetLevel: (lvlSelect === 'auto') ? this.getAdobeAutoLevel(this.totalLicenses) : lvlSelect,
          taxaDolar: parseFloat(document.getElementById('adobe-dolar').value) || 4.80,
          hide3YCommit: document.getElementById('chk-adobe-hide-3y').checked
        };
        await window.Cotador.tables[tabela].processar(this.parsedItems, flags);
        
      } else {
        const periodos = [];
        if (document.getElementById('chk-kasp-p1').checked) periodos.push({ id: '1a', label: '1 ANO', match: '1 ANO' });
        if (document.getElementById('chk-kasp-p2').checked) periodos.push({ id: '2a', label: '2 ANOS', match: '2 ANOS' });
        if (document.getElementById('chk-kasp-p3').checked) periodos.push({ id: '3a', label: '3 ANOS', match: '3 ANOS' });
        if (document.getElementById('chk-kasp-p4').checked) periodos.push({ id: '4a', label: '4 ANOS', match: '4 ANOS' });
        if (document.getElementById('chk-kasp-p5').checked) periodos.push({ id: '5a', label: '5 ANOS', match: '5 ANOS' });

        if (periodos.length === 0) {
          alert('Selecione pelo menos um período para a Kaspersky (1 a 5 Anos)!');
          btn.disabled = false;
          btn.innerHTML = '<span>Buscar e Montar Tabelas</span>';
          return;
        }

        const bandaSelect = document.getElementById('kasp-banda').value;
        const roMode = document.getElementById('kasp-ro-mode').value;
        
        const flags = {
          periodos,
          targetBanda: (bandaSelect === 'auto') ? this.getKaspAutoBanda(this.totalLicenses) : bandaSelect,
          edrFilter: document.getElementById('kasp-edr-filter').value,
          tipo: document.getElementById('kasp-tipo').value || 'Base',
          mostrarRO: roMode === 'always' || (roMode === 'auto' && this.totalLicenses >= 100),
          ignoreSuccessive: document.getElementById('chk-kasp-ignore-successive').checked,
          ignorePublic: document.getElementById('chk-kasp-ignore-public').checked
        };
        await window.Cotador.tables.kaspersky.processar(this.parsedItems, flags);
      }
      
      window.Cotador.core.recalcularSubtotais();
    } catch (err) {
      container.innerHTML = `<div class="p-4 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs">
        <b>Erro na consulta:</b> ${err.message}
      </div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Buscar e Montar Tabelas</span>';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => window.Cotador.app.init());