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
    ['microsoft', 'adobe', 'kaspersky'].forEach(v => {
      const btn = document.getElementById(`btn-vendor-${v}`);
      const box = document.getElementById(`filtros-${v}`);
      btn.classList.toggle('active', v === vendor);
      box.classList.toggle('hidden', v !== vendor);
    });
    this.analisarInput();
  },

  toggleMsUI() {
    const mod = document.getElementById('ms-modalidade').value;
    const box = document.getElementById('ms-box-contratos');
    box.style.display = (mod === 'perpetuo' || mod === 'mpsa') ? 'none' : 'block';
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
      area.value = "business basic 10\nbusiness standard 26\nExchange plan 1 80\nplanner 10";
    } else if (this.currentVendor === 'adobe') {
      area.value = "Illustrator - 02 unidades\nphothosop - 06 unidades\nCreative cloud Pro - 03 unidades";
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

    const badge = document.getElementById('valor-soma');
    if (this.currentVendor === 'microsoft') {
      const mod = document.getElementById('ms-modalidade').value;
      const rota = mod === 'auto'
        ? (sumLicenses >= 35 ? 'ms_solo (≥35)' : 'ms_scan (≤34)')
        : `ms_${mod}`;
      badge.textContent = `${sumLicenses} licenças • Arquivo: ${rota}.js`;
    } else if (this.currentVendor === 'adobe') {
      const tab = document.getElementById('adobe-tabela').value;
      const lvl = this.getAdobeAutoLevel(sumLicenses);
      badge.textContent = `${sumLicenses} licenças • Level ${lvl} (${tab}.js)`;
    } else {
      const banda = this.getKaspAutoBanda(sumLicenses);
      badge.textContent = `${sumLicenses} licenças • Banda ${banda} (kaspersky.js)`;
    }
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
    btn.innerHTML = '<span>⏳ Consultando tabela no Supabase...</span>';
    container.innerHTML = '<div class="text-center py-20 text-slate-400 animate-pulse">Processando regras da tabela selecionada...</div>';

    try {
      if (this.currentVendor === 'microsoft') {
        const modSelect = document.getElementById('ms-modalidade').value;
        const target = (modSelect === 'auto') ? (this.totalLicenses >= 35 ? 'solo' : 'scan') : modSelect;

        const contratos = [];
        if (document.getElementById('chk-anual-anual').checked) {
          contratos.push({ id: 'aa', label: 'Anual / Anual', scanTempo: 'Anual', scanCiclo: 'Anual', soloTermo: 'P1Y', soloPlano: 'Annual' });
        }
        if (document.getElementById('chk-anual-mensal').checked) {
          contratos.push({ id: 'am', label: 'Anual / Mensal', scanTempo: 'Anual', scanCiclo: 'Mensal', soloTermo: 'P1Y', soloPlano: 'Monthly' });
        }
        if (document.getElementById('chk-mensal-mensal').checked) {
          contratos.push({ id: 'mm', label: 'Mensal / Mensal', scanTempo: 'Mensal', scanCiclo: 'Mensal', soloTermo: 'P1M', soloPlano: 'Monthly' });
        }

        const flags = {
          contratos,
          onlyCommercial: document.getElementById('chk-ms-commercial').checked,
          hideNoTeams: document.getElementById('chk-hide-noteams').checked,
          hideCopilot: document.getElementById('chk-hide-copilot').checked
        };

        await window.Cotador.tables[`ms_${target}`].processar(this.parsedItems, flags);

      } else if (this.currentVendor === 'adobe') {
        const tabela = document.getElementById('adobe-tabela').value;
        const lvlSelect = document.getElementById('adobe-level').value;
        const flags = {
          segmento: document.getElementById('adobe-segmento').value,
          targetLevel: (lvlSelect === 'auto') ? this.getAdobeAutoLevel(this.totalLicenses) : lvlSelect,
          taxaDolar: parseFloat(document.getElementById('adobe-dolar').value) || 4.80,
          hide3YCommit: document.getElementById('chk-adobe-hide-3y').checked
        };

        await window.Cotador.tables[tabela].processar(this.parsedItems, flags);

      } else {
        const bandaSelect = document.getElementById('kasp-banda').value;
        const roMode = document.getElementById('kasp-ro-mode').value;
        const flags = {
          targetBanda: (bandaSelect === 'auto') ? this.getKaspAutoBanda(this.totalLicenses) : bandaSelect,
          periodo: document.getElementById('kasp-periodo').value,
          tipo: document.getElementById('kasp-tipo').value,
          mostrarRO: roMode === 'always' || (roMode === 'auto' && this.totalLicenses >= 100)
        };

        await window.Cotador.tables.kaspersky.processar(this.parsedItems, flags);
      }

      window.Cotador.core.recalcularSubtotais();
    } catch (err) {
      container.innerHTML = `<div class="p-4 rounded-lg bg-red-950/70 border border-red-700 text-red-300 text-sm">
        <b>Erro na consulta:</b> ${err.message}
      </div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>🔍 Gerar Cotação Refinada</span>';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => window.Cotador.app.init());