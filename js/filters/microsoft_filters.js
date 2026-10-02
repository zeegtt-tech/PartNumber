window.Cotador = window.Cotador || {};
window.Cotador.filters = window.Cotador.filters || {};

window.Cotador.filters.microsoft = {
  MS_ALIASES: {
    "business-standard": ["microsoft 365 business standard", "business standard", "business standard (no teams)", "business standard with copilot", "m365 business standard", "o365 business standard", "standard", "std"],
    "business-basic": ["microsoft 365 business basic", "business basic", "business basic (no teams)", "m365 business basic", "o365 business basic", "basic"],
    "business-premium": ["microsoft 365 business premium", "business premium", "business premium (no teams)", "m365 business premium", "premium"],
    "apps-for-business": ["microsoft 365 apps for business", "apps for business"],
    "apps-for-enterprise": ["microsoft 365 apps for enterprise", "apps for enterprise", "office 365 proplus"],
    "e1": ["office 365 e1", "o365 e1"],
    "e3": ["microsoft 365 e3", "office 365 e3", "m365 e3", "o365 e3"],
    "e5": ["microsoft 365 e5", "office 365 e5", "m365 e5", "o365 e5"],
    "f1": ["microsoft 365 f1", "m365 f1", "frontline f1"],
    "f3": ["microsoft 365 f3", "office 365 f3", "m365 f3", "o365 f3"],
    "exchange-plan-1": ["exchange online (plan 1)", "exchange online plan 1", "exchange plan 1", "exchange p1"],
    "exchange-plan-2": ["exchange online (plan 2)", "exchange online plan 2", "exchange plan 2", "exchange p2"],
    "power-bi-pro": ["power bi pro", "powerbi pro", "pbi pro"],
    "power-bi-premium-user": ["power bi premium per user", "power bi ppu", "pbi ppu"],
    "copilot-m365": ["microsoft 365 copilot", "copilot business", "m365 copilot"],
    "teams-essentials": ["microsoft teams essentials", "teams essentials"],
    "defender-business": ["microsoft defender for business", "defender business", "defender for business"],
    "windows-server": ["windows server", "win server", "ws"],
    "sql-server": ["sql server", "sql"],
    "exchange-server": ["exchange server"],
    "sharepoint-server": ["sharepoint server"],
    "visual-studio": ["visual studio", "vs pro", "vs enterprise"]
  },

  classificarProduto(nomeRaw) {
    const nomeLimpo = String(nomeRaw || '').toLowerCase().replace(/\s+/g, ' ').trim();
    let produto_base = 'desconhecido';
    let familia_produto = 'outros';
    let tipo_produto = 'principal';

    for (const [base, aliases] of Object.entries(this.MS_ALIASES)) {
      if (aliases.some(alias => nomeLimpo.includes(alias))) {
        produto_base = base;
        break;
      }
    }

    if (produto_base.includes('business')) familia_produto = 'business';
    else if (['e1', 'e3', 'e5', 'f1', 'f3', 'apps-for-enterprise'].includes(produto_base)) familia_produto = 'enterprise';
    else if (produto_base.includes('exchange')) familia_produto = 'exchange';
    else if (produto_base.includes('power-bi')) familia_produto = 'powerbi';
    else if (produto_base.includes('copilot')) familia_produto = 'copilot';
    else if (produto_base.includes('defender')) familia_produto = 'security';
    else if (produto_base.includes('teams')) familia_produto = 'teams';
    else if (produto_base.includes('windows-server') || produto_base.includes('sql-server')) familia_produto = 'infrastructure';
    else if (produto_base.includes('visual-studio')) familia_produto = 'developer';

    if (/\b(no teams|sem teams|without teams|w\/o teams)\b/.test(nomeLimpo)) tipo_produto = 'sem_teams';
    else if (/\b(with copilot|\+ copilot)\b/.test(nomeLimpo)) tipo_produto = 'copilot_bundle';
    else if (/\b(add-on|addon|attach)\b/.test(nomeLimpo)) tipo_produto = 'addon';
    else if (/\b(trial|promo|gratuito|free)\b/.test(nomeLimpo)) tipo_produto = 'trial';
    else if (/\b(faculty|student|academic)\b/.test(nomeLimpo)) tipo_produto = 'education';

    return { produto_base, familia_produto, tipo_produto };
  },

  sanitizarTitulo(rawTitle) {
    return String(rawTitle || '').trim();
  },

  passaFiltrosSecundarios(nomeOriginal, itemSearchRaw, flags, facetTracker, tabelaOrigem, familia, tipo) {
    const nome = this.sanitizarTitulo(nomeOriginal).toLowerCase();
    const query = String(itemSearchRaw || '').toLowerCase();

    const buscouNoTeams = /(no\s+teams|sem\s+teams|without\s+teams)/i.test(query.replace(/[()]/g, ' '));
    const buscouCopilot = /\bcopilot\b/i.test(query);
    const buscouPhone = /\b(phone|rooms|calling|audio|voice|conferencing)\b/i.test(query);
    const buscouNiche = /\b(addon|add-on|attach|unattended)\b/i.test(query);
    const buscouTrial = /\b(trial|promo|gratuito|free)\b/i.test(query);
    const buscouDynamics = /\b(dynamics|dyn365|d365)\b/i.test(query);
    const buscouDefender = /\b(defender|purview|security)\b/i.test(query);

    const isDynamicsItem = familia === 'dynamics' || /\b(dynamics|dyn365|d365)\b/i.test(nome);
    if (isDynamicsItem && !buscouDynamics) return false;
    
    const isDefenderItem = familia === 'security' || /\b(defender|purview)\b/i.test(nome);
    if (isDefenderItem && !buscouDefender) return false;

    const isTrialItem = tipo === 'trial' || /\b(trial|promo|gratuito|free)\b/i.test(nome);
    if (isTrialItem && !buscouTrial && !flags.showTrial) {
        if (facetTracker) facetTracker['chk-show-trial'] = (facetTracker['chk-show-trial'] || 0) + 1;
        return false;
    }
    const isNoTeamsItem = tipo === 'sem_teams' || /\b(no\s+teams|sem\s+teams|without\s+teams|w\/o\s+teams)\b/i.test(nome);
    if (isNoTeamsItem && !buscouNoTeams && !flags.showNoTeams) {
        if (facetTracker) facetTracker['chk-show-noteams'] = (facetTracker['chk-show-noteams'] || 0) + 1;
        return false;
    }
    const isCopilotItem = tipo === 'copilot_bundle' || /\b(with\s+copilot|\+\s*copilot)\b/i.test(nome);
    if (isCopilotItem && !buscouCopilot && !flags.showCopilot) {
        if (facetTracker) facetTracker['chk-show-copilot'] = (facetTracker['chk-show-copilot'] || 0) + 1;
        return false;
    }
    
    const isPhoneItem = (familia === 'teams' && (tipo === 'addon' || tipo === 'attach')) || /\b(phone|calling|audio|resource|conferencing)\b/i.test(nome);
    if (isPhoneItem && !buscouPhone && !flags.showPhone) {
        if (facetTracker) facetTracker['chk-ms-show-phone'] = (facetTracker['chk-ms-show-phone'] || 0) + 1;
        return false;
    }
    
    const isNicheItem = (tipo === 'addon' || tipo === 'attach' || tipo === 'unattended' || /\b(addon|add-on|attach|unattended)\b/i.test(nome)) && familia !== 'teams' && familia !== 'infrastructure';
    if (isNicheItem && !buscouNiche && !flags.showNiche) {
        if (facetTracker) facetTracker['chk-ms-show-niche'] = (facetTracker['chk-ms-show-niche'] || 0) + 1;
        return false;
    }
    
    return true; 
  }
};