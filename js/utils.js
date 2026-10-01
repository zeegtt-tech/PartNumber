// js/utils.js
export const TagConfig = {
    // Categorias Originais (Sem 'pessoal' e 'urgente', pois agora teremos o botão Importante)
    trabalho: { bg: '#3B82F6', label: 'Trabalho', icon: 'fa-briefcase', emoji: '💼' },
    estudos: { bg: '#8B5CF6', label: 'Estudos', icon: 'fa-book-open', emoji: '📚' },
    financeiro: { bg: '#F59E0B', label: 'Financeiro', icon: 'fa-sack-dollar', emoji: '💰' },
    
    // Coleções (Inbox 2.0 - com ícones e emojis distintos)
    filmes: { bg: '#EAB308', label: 'Filmes', icon: 'fa-film', emoji: '🍿' },
    series: { bg: '#F43F5E', label: 'Séries', icon: 'fa-tv', emoji: '📺' },
    livros: { bg: '#8B5CF6', label: 'Livros', icon: 'fa-book', emoji: '📖' },
    receitas: { bg: '#F97316', label: 'Receitas', icon: 'fa-utensils', emoji: '🍳' },
    lugares: { bg: '#06B6D4', label: 'Lugares', icon: 'fa-map-location-dot', emoji: '🗺️' },
    compras: { bg: '#14B8A6', label: 'Lista de Compras', icon: 'fa-cart-shopping', emoji: '🛒' }
};

export const Utils = {
    escapeHTML: (str) => String(str || '').replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t])),
    getTodayString: () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; },
    formatDateBR: (dateStr) => { if (!dateStr) return 'Sem Data'; const p = dateStr.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; },
    timeToMinutes: (timeStr) => { if(!timeStr) return 0; const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; },
    minutesToTime: (mins) => `${String(Math.floor(mins / 60) % 24).padStart(2,'0')}:${String(mins % 60).padStart(2,'0')}`,
    formatCurrency: (val) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    },
    maskCurrency: (el) => {
        let value = el.value.replace(/\D/g, "");
        if (value === "") { el.value = ""; return; }
        value = (Number(value) / 100).toFixed(2).replace(".", ",");
        el.value = "R$ " + value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    },
    getStartOfWeek: (dateStr) => { 
        const [y, m, d] = dateStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        dateObj.setDate(dateObj.getDate() - dateObj.getDay()); 
        return `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
    },
    addDays: (dateStr, days) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        dateObj.setDate(dateObj.getDate() + days);
        return `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
    }
};