import { AppState } from './state.js';
import { Actions } from './actions.js';
import { Utils, TagConfig } from './utils.js';

export const UI = {
    els: {
        form: document.getElementById('todo-form'), 
        date: document.getElementById('date-picker'), 
        search: document.getElementById('search-input'),
        list: document.getElementById('view-list'), 
        day: document.getElementById('view-day'),
        week: document.getElementById('view-week'), 
        month: document.getElementById('view-month'),
        filterUnscheduled: document.getElementById('filter-unscheduled'), 
        filterContainer: document.getElementById('filter-container')
    },
            
    populateTagSelects() {
        const selectSide = document.getElementById('todo-tag');
        const tagFilterList = document.getElementById('dropdown-tags-list');
        const allTags = { ...TagConfig, ...AppState.customTags };
        
        const uniqueTags = {};
        for (const [key, tag] of Object.entries(allTags)) {
            const isDuplicate = Object.values(uniqueTags).some(t => t.label === tag.label);
            if (!isDuplicate) {
                uniqueTags[key] = tag;
            }
        }
        
        let html = '<option value="">Sem Categoria</option>';
        let filterHtml = ''; 

        for (const [key, tag] of Object.entries(uniqueTags)) {
            html += `<option value="${key}">${tag.emoji} ${tag.label}</option>`;
            filterHtml += `<button data-view="tag" data-tag="${key}" class="text-left text-gray-700 hover:bg-gray-50 text-[11px] font-semibold px-3 py-2 transition-all flex items-center w-full"><span class="w-4 text-center mr-1">${tag.emoji}</span> ${tag.label}</button>`;
        }
        
        if (selectSide) selectSide.innerHTML = html;
        if (tagFilterList) tagFilterList.innerHTML = filterHtml;
    },

    init() {
        this.populateTagSelects();        
        this.els.date.value = Utils.getTodayString();
        this.bindEvents();
        this.initSortable();
        this.generateTimelineRulers();
        this.renderRecurrenceCalendar();
        this.render();
    },

    // ==========================================
    // CALENDÁRIO DE RECORRÊNCIA (CRIAÇÃO)
    // ==========================================
    renderRecurrenceCalendar() {
        const y = new Date().getFullYear();
        const m = new Date().getMonth() + AppState.recMonthOffset;
        const calDate = new Date(y, m, 1);
        
        const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
        const monthLabel = document.getElementById('rec-month-label');
        if (monthLabel) monthLabel.textContent = `${monthNames[calDate.getMonth()]} ${calDate.getFullYear()}`;
        
        const daysInMonth = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 0).getDate();
        const firstDay = calDate.getDay();
        
        let html = '';
        for (let i = 0; i < firstDay; i++) {
            html += `<div></div>`;
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${calDate.getFullYear()}-${String(calDate.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const isSelected = AppState.tempRecDates.has(dateStr);
            const isBaseDate = document.getElementById('date-picker').value === dateStr;
            
            let cls = 'w-8 h-8 mx-auto flex items-center justify-center rounded-md border text-[11px] font-bold cursor-pointer transition-all ';
            if (isSelected || isBaseDate) {
                cls += 'bg-[#10B981] text-white border-[#10B981] shadow-sm';
            } else {
                cls += 'bg-white text-gray-600 border-gray-200 hover:bg-emerald-50 hover:text-emerald-600';
            }
            
            html += `<button type="button" onclick="Actions.toggleRecDate('${dateStr}')" class="${cls}">${day}</button>`;
        }
        
        const recCalDays = document.getElementById('rec-cal-days');
        if (recCalDays) recCalDays.innerHTML = html;

        let actionsContainer = document.getElementById('rec-actions-container');
        if (!actionsContainer && recCalDays) {
            actionsContainer = document.createElement('div');
            actionsContainer.id = 'rec-actions-container';
            recCalDays.parentElement.appendChild(actionsContainer);
        }

        if (actionsContainer) {
            actionsContainer.className = 'mt-4 pt-3 border-t border-gray-100 flex justify-between items-center';
            const selectedCount = AppState.tempRecDates.size;
            actionsContainer.innerHTML = `
                <span class="text-xs font-medium text-gray-500">${selectedCount} data(s) extra(s)</span>
                <button type="button" onclick="UI.collapseRecurrenceCalendar()" class="px-3 py-1.5 bg-[#10B981] text-white text-xs font-bold rounded-lg hover:bg-[#059669] transition-all shadow-sm">
                    Concluir a criação de repetição
                </button>
            `;
        }
    },

    collapseRecurrenceCalendar() {
        const daysGrid = document.getElementById('rec-cal-days');
        const monthLabel = document.getElementById('rec-month-label');
        const monthHeader = monthLabel ? monthLabel.parentElement : null;

        if (daysGrid) daysGrid.classList.add('hidden');
        if (monthHeader) monthHeader.classList.add('hidden');

        const actionsContainer = document.getElementById('rec-actions-container');
        if (actionsContainer) {
            const selectedCount = AppState.tempRecDates.size;
            actionsContainer.className = 'mt-2 flex justify-between items-center bg-emerald-50 p-2.5 rounded-lg border border-emerald-100 transition-all';
            actionsContainer.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-arrows-rotate text-[#10B981]"></i>
                    <span class="text-xs font-bold text-emerald-800">Repetição ativa (${selectedCount} datas adicionais)</span>
                </div>
                <button type="button" onclick="UI.expandRecurrenceCalendar()" class="text-xs font-bold text-[#10B981] hover:text-[#059669] underline bg-transparent border-none cursor-pointer">
                    Editar
                </button>
            `;
        }
    },

    expandRecurrenceCalendar() {
        const daysGrid = document.getElementById('rec-cal-days');
        const monthLabel = document.getElementById('rec-month-label');
        const monthHeader = monthLabel ? monthLabel.parentElement : null;

        if (daysGrid) daysGrid.classList.remove('hidden');
        if (monthHeader) monthHeader.classList.remove('hidden');

        this.renderRecurrenceCalendar();
    },

    // ==========================================
    // CALENDÁRIO DE RECORRÊNCIA (EDIÇÃO)
    // ==========================================
    renderEditRecurrenceCalendar(currentTaskDate) {
        const y = new Date().getFullYear();
        const m = new Date().getMonth() + AppState.recMonthOffset;
        const calDate = new Date(y, m, 1);
        
        const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
        const label = document.getElementById('edit-rec-month-label');
        if(label) label.textContent = `${monthNames[calDate.getMonth()]} ${calDate.getFullYear()}`;
        
        const daysInMonth = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 0).getDate();
        const firstDay = calDate.getDay();
        
        let html = '';
        for (let i = 0; i < firstDay; i++) {
            html += `<div></div>`;
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${calDate.getFullYear()}-${String(calDate.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const isSelected = AppState.tempRecDates.has(dateStr);
            const isBaseDate = currentTaskDate === dateStr;
            
            let cls = 'w-8 h-8 mx-auto flex items-center justify-center rounded-md border text-[11px] font-bold cursor-pointer transition-all ';
            
            if (isSelected || isBaseDate) {
                cls += 'bg-[#10B981] text-white border-[#10B981] shadow-sm';
            } else {
                cls += 'bg-white text-gray-600 border-gray-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200';
            }
            
            html += `<button type="button" onclick="Actions.toggleEditRecDate('${dateStr}', '${currentTaskDate}')" class="${cls}">${day}</button>`;
        }
        
        const container = document.getElementById('edit-rec-cal-days');
        if(container) container.innerHTML = html;

        let actionsContainer = document.getElementById('edit-rec-actions-container');
        if (!actionsContainer && container) {
            actionsContainer = document.createElement('div');
            actionsContainer.id = 'edit-rec-actions-container';
            container.parentElement.appendChild(actionsContainer);
        }

        if (actionsContainer) {
            actionsContainer.className = 'mt-3 pt-3 border-t border-gray-200 flex justify-between items-center w-full max-w-[280px] mx-auto';
            const selectedCount = AppState.tempRecDates.size;
            actionsContainer.innerHTML = `
                <span class="text-[10px] font-medium text-gray-500">${selectedCount} data(s) extra(s)</span>
                <button type="button" onclick="UI.collapseEditRecurrenceCalendar()" class="px-3 py-1.5 bg-[#10B981] text-white text-[11px] font-bold rounded-lg hover:bg-[#059669] transition-all shadow-sm">
                    Concluir seleção
                </button>
            `;
        }
    },

    collapseEditRecurrenceCalendar() {
        const container = document.getElementById('edit-rec-container');
        if(!container) return;
        
        Array.from(container.children).forEach(child => {
            if(child.id !== 'edit-rec-actions-container') {
                child.classList.add('hidden');
            }
        });

        const actionsContainer = document.getElementById('edit-rec-actions-container');
        if (actionsContainer) {
            const selectedCount = AppState.tempRecDates.size;
            actionsContainer.className = 'w-full flex justify-between items-center bg-emerald-50 p-2.5 rounded-lg border border-emerald-100 transition-all';
            actionsContainer.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-arrows-rotate text-[#10B981]"></i>
                    <span class="text-xs font-bold text-emerald-800">Repetição ativa (${selectedCount} datas)</span>
                </div>
                <button type="button" onclick="UI.expandEditRecurrenceCalendar()" class="text-xs font-bold text-[#10B981] hover:text-[#059669] underline bg-transparent border-none cursor-pointer">
                    Editar
                </button>
            `;
        }
    },

    expandEditRecurrenceCalendar() {
        const container = document.getElementById('edit-rec-container');
        if(container) {
            Array.from(container.children).forEach(child => {
                child.classList.remove('hidden');
            });
        }
        
        const currentTaskDate = document.getElementById('edit-task-date').value;
        this.renderEditRecurrenceCalendar(currentTaskDate);
    },

    // ==========================================
    // BIND DE EVENTOS GERAIS E INICIALIZAÇÃO
    // ==========================================
    bindEvents() {
        document.getElementById('todo-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { 
                e.preventDefault();
                document.getElementById('todo-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
        });
        
        document.getElementById('todo-desc').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                document.getElementById('todo-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
        });

        document.addEventListener('click', (e) => {
            const tempoOpts = document.getElementById('tempo-opts');
            const listasOpts = document.getElementById('listas-opts');
            const btnTempo = e.target.closest('#btn-lista-tempo');
            const btnListas = e.target.closest('#btn-listas');
            
            if (tempoOpts && !btnTempo && !e.target.closest('#tempo-opts')) tempoOpts.classList.add('hidden');
            if (listasOpts && !btnListas && !e.target.closest('#listas-opts')) listasOpts.classList.add('hidden');

            const viewBtn = e.target.closest('[data-view]');
            if (viewBtn) {
                AppState.viewingMode = viewBtn.dataset.view;
                if (viewBtn.dataset.view === 'tag') {
                    AppState.currentTagFilter = viewBtn.dataset.tag;
                }
                AppState.clearSelection();
                if (tempoOpts) tempoOpts.classList.add('hidden');
                if (listasOpts) listasOpts.classList.add('hidden');
                this.render();
            }
        });

        document.getElementById('btn-today').addEventListener('click', () => {
            this.els.date.value = Utils.getTodayString();
            AppState.viewingMode = 'list';
            AppState.clearSelection(); 
            this.render();
            this.renderRecurrenceCalendar();
        });

        this.els.date.addEventListener('change', () => { 
            AppState.viewingMode = 'list';
            AppState.clearSelection(); 
            this.render(); 
            this.renderRecurrenceCalendar();
        });
        
        let searchTimeout;
        this.els.search.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.render(), 300);
        });

        this.els.filterUnscheduled.addEventListener('change', () => this.render());

        const toggles = [
            { id: 'has-time', target: 'time-ui' },
            { id: 'toggle-checklist', target: 'ui-checklist' },
            { id: 'toggle-costs', target: 'ui-costs' },
            { id: 'toggle-category', target: 'ui-category' },
            { id: 'toggle-recurring', target: 'ui-recurring' }
        ];
        
        toggles.forEach(t => {
            const checkEl = document.getElementById(t.id);
            if(checkEl) {
                checkEl.addEventListener('change', (e) => {
                    document.getElementById(t.target).classList.toggle('hidden', !e.target.checked);
                });
            }
        });

        document.getElementById('is-inbox').addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const datePicker = document.getElementById('date-picker');
            
            const hasTime = document.getElementById('has-time');
            const toggleRec = document.getElementById('toggle-recurring');
            
            const btnTime = hasTime.nextElementSibling;
            const btnRec = toggleRec.nextElementSibling;

            if(isChecked) {
                datePicker.disabled = true;
                datePicker.classList.add('opacity-50', 'bg-gray-100');
                
                hasTime.checked = false;
                hasTime.disabled = true;
                document.getElementById('time-ui').classList.add('hidden');
                btnTime.classList.add('opacity-40', 'bg-gray-100', 'cursor-not-allowed', 'border-red-300');
                
                toggleRec.checked = false;
                toggleRec.disabled = true;
                document.getElementById('ui-recurring').classList.add('hidden');
                btnRec.classList.add('opacity-40', 'bg-gray-100', 'cursor-not-allowed', 'border-red-300');
            } else {
                datePicker.disabled = false;
                datePicker.classList.remove('opacity-50', 'bg-gray-100');
                
                hasTime.disabled = false;
                btnTime.classList.remove('opacity-40', 'bg-gray-100', 'cursor-not-allowed', 'border-red-300');
                
                toggleRec.disabled = false;
                btnRec.classList.remove('opacity-40', 'bg-gray-100', 'cursor-not-allowed', 'border-red-300');
            }
        });

        document.getElementById('btn-add-temp-subtask').addEventListener('click', Actions.addTempSubtask);
        document.getElementById('temp-subtask-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); Actions.addTempSubtask(); }
        });

        document.getElementById('btn-add-temp-cost').addEventListener('click', Actions.addTempCost);
        document.getElementById('temp-cost-desc').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); Actions.addTempCost(); }
        });
        document.getElementById('temp-cost-val').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); Actions.addTempCost(); }
        });

        this.els.form.addEventListener('submit', async (e) => {

            e.preventDefault(); 
            
            const novaTarefaDados = {
                text: document.getElementById('todo-input').value.trim(),
                desc: document.getElementById('todo-desc').value.trim(),
                date: document.getElementById('date-picker').value,
                isInbox: document.getElementById('is-inbox').checked,
                isImportant: document.getElementById('is-important').checked,
                hasTime: document.getElementById('has-time').checked,
                start: document.getElementById('has-time').checked ? document.getElementById('todo-start-time').value : "",
                end: document.getElementById('has-time').checked ? document.getElementById('todo-end-time').value : "",
                tag: document.getElementById('todo-tag').value,
                isRecurring: document.getElementById('toggle-recurring').checked
            };

            await Actions.createTask(novaTarefaDados);
        
        });
        
        document.querySelector('main').addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                const action = actionBtn.dataset.action;
                if (Actions[action]) Actions[action](Number(actionBtn.dataset.id), Number(actionBtn.dataset.subid), actionBtn);
            } else {
                const card = e.target.closest('.task-card-header');
                if (card && !e.target.closest('input, button, .drag-handle, [data-no-expand], label')) {
                    const id = Number(card.dataset.id);
                    AppState.expandedTaskIds.has(id) ? AppState.expandedTaskIds.delete(id) : AppState.expandedTaskIds.add(id);
                    this.render();
                }
            }
        });
    },

    initSortable() {
        AppState.sortableInstance = new Sortable(this.els.list, {
            animation: 150, handle: '.drag-handle', ghostClass: 'opacity-50',
            onEnd: () => {
                if (AppState.viewingMode !== 'list') return;
                const displayedIds = Array.from(this.els.list.children).map(li => Number(li.dataset.id));
                const displayedMap = new Map(AppState.tasks.filter(t => displayedIds.includes(t.id)).map(t => [t.id, t]));
                const undisturbed = AppState.tasks.filter(t => !displayedIds.includes(t.id));
                const reordered = displayedIds.map(id => displayedMap.get(id)).filter(Boolean);
                AppState.tasks = [...undisturbed, ...reordered];
                AppState.save();
            }
        });
    },

    generateTimelineRulers() {
        let html = '';
        for(let i=0; i<24; i++) {
            html += `<div class="h-[60px] text-[10px] font-semibold text-gray-400 text-right pr-2 relative"><span class="-top-2 absolute right-2">${String(i).padStart(2,'0')}:00</span></div>`;
        }
        document.getElementById('day-hours-ruler').innerHTML = html;
        document.getElementById('week-hours-ruler').innerHTML = html;
    },

    updateBulkToolbar() {
        const tb = document.getElementById('bulk-toolbar');
        const actionsContainer = document.getElementById('bulk-standard-actions');

        if (AppState.selectedTaskIds.length > 0) { 
            tb.classList.remove('hidden'); 
            tb.classList.add('flex'); 
            document.getElementById('selected-count').textContent = AppState.selectedTaskIds.length; 
            
            if (AppState.viewingMode === 'trash' || AppState.viewingMode === 'archive') {
                actionsContainer.innerHTML = `
                    <button data-action="bulkRestore" class="text-xs px-3 py-1.5 rounded-lg border border-emerald-500 bg-emerald-500/20 text-white font-medium hover:bg-emerald-500/30 transition-all"><i class="fa-solid fa-arrow-rotate-left mr-1"></i> Restaurar</button>
                    <button data-action="bulkDelete" class="text-xs px-3 py-1.5 rounded-lg border border-[#10B981] bg-[#10B981]/20 text-white font-medium hover:bg-[#10B981]/30 transition-all"><i class="fa-solid fa-trash-can mr-1"></i> Excluir</button>
                `;
            } else {
                actionsContainer.innerHTML = `
                    <button data-action="bulkStatus" data-status="doing" class="text-xs px-3 py-1.5 rounded-lg border border-amber-600/50 text-amber-400 font-medium">Em Andamento</button>
                    <button data-action="bulkStatus" data-status="done" class="text-xs px-3 py-1.5 rounded-lg border border-emerald-600/50 text-emerald-400 font-medium">Concluir</button>
                    <button data-action="bulkArchive" class="text-xs px-3 py-1.5 rounded-lg border border-orange-500 bg-orange-500/20 text-white font-medium">Arquivar</button>
                    <button data-action="bulkDelete" class="text-xs px-3 py-1.5 rounded-lg border border-[#10B981] bg-[#10B981]/20 text-white font-medium">Excluir</button>
                `;
            }
        }
        else { 
            tb.classList.add('hidden'); 
            tb.classList.remove('flex'); 
        }
    },

    renderTempSubtasks() {
        document.getElementById('temp-subtasks-list').innerHTML = AppState.tempSubtasks.map(st => `
            <li class="flex items-center justify-between gap-2 bg-white px-3 py-1.5 rounded border shadow-sm">
                <span class="text-xs truncate text-gray-700 font-medium">${Utils.escapeHTML(st.text)}</span>
                <button type="button" aria-label="Remover minitarefa temporária" onclick="Actions.removeTempSubtask(${st.id})" class="text-red-500 hover:text-red-700 transition-colors"><i class="fa-solid fa-trash"></i></button>
            </li>`).join('');
    },

    renderTempCosts() {
        document.getElementById('temp-costs-list').innerHTML = AppState.tempCosts.map(cost => `
            <li class="flex items-center justify-between gap-2 bg-white px-3 py-1.5 rounded border shadow-sm">
                <span class="text-xs truncate text-gray-700 font-medium">${Utils.escapeHTML(cost.text)}</span>
                <span class="text-xs font-bold text-[#10B981]">${Utils.formatCurrency(cost.value)}</span>
                <button type="button" aria-label="Remover custo temporário" onclick="Actions.removeTempCost(${cost.id})" class="text-red-500 hover:text-red-700 transition-colors"><i class="fa-solid fa-trash"></i></button>
            </li>`).join('');
    },

    // ==========================================
    // RENDERIZAÇÃO GERAL E TIMELINES
    // ==========================================
    render() {
        const views = ['list', 'day', 'week', 'month'];
        views.forEach(v => {
            const btn = document.querySelector(`button[data-view="${v}"]`);
            if(btn) {
                if(AppState.viewingMode === v) { btn.classList.add('bg-white', 'shadow-sm', 'text-[#10B981]'); btn.classList.remove('text-[#757575]'); }
                else { btn.classList.remove('bg-white', 'shadow-sm', 'text-[#10B981]'); btn.classList.add('text-[#757575]'); }
            }
            this.els[v].classList.add('hidden'); this.els[v].classList.remove('flex');
        });

        document.getElementById('task-counter').classList.remove('hidden');
        
        if(['list', 'day', 'today-list', 'future', 'past', 'inbox', 'important', 'tag'].includes(AppState.viewingMode)) {
            this.els.filterContainer.classList.remove('hidden');
        } else {
            this.els.filterContainer.classList.add('hidden');
        }
        
        const selDate = this.els.date.value;
        const [y, m, d] = selDate.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        let dataFormatada = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        dataFormatada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
        
        const todayStr = Utils.getTodayString();
        
        if (['archive', 'trash', 'future', 'past', 'inbox', 'important', 'tag'].includes(AppState.viewingMode)) {
            document.getElementById('panel-subtitle').textContent = "Visualização de todas as datas";
        } else if (AppState.viewingMode === 'today-list') {
            const [ty, tm, td] = todayStr.split('-').map(Number);
            const dataF = new Date(ty, tm - 1, td).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
            document.getElementById('panel-subtitle').textContent = dataF.charAt(0).toUpperCase() + dataF.slice(1);
        } else {
            document.getElementById('panel-subtitle').textContent = dataFormatada;
        }
        
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();

        AppState.tasks.forEach(t => {
            if (t.startTime && t.endTime && !t.deleted && !t.archived && !t.inbox && t.status !== 'done') {
                if (t.date === todayStr) {
                    const sMin = Utils.timeToMinutes(t.startTime);
                    const eMin = Utils.timeToMinutes(t.endTime);
                    if (nowMin >= sMin && nowMin <= eMin) {
                        t.status = 'doing'; t.completed = false; 
                    } else if (nowMin > eMin) {
                        t.status = 'pending'; t.completed = false; 
                    } else {
                        t.status = 'pending'; t.completed = false;
                    }
                }
            }
        });
        
        const activeT = AppState.tasks.filter(t => !t.deleted && !t.archived);
        const search = this.els.search.value.toLowerCase();
        const onlyUnscheduled = this.els.filterUnscheduled.checked;
        let filtered = [];

        if (AppState.viewingMode === 'list') {
            this.els.list.classList.remove('hidden'); this.els.list.classList.add('flex');
            document.getElementById('panel-title').textContent = selDate === todayStr ? "Tarefas de Hoje" : "Visão do Dia";
            
            let baseTasks = activeT.filter(t => t.date === selDate && !t.inbox);
            if(selDate === todayStr) {
                const overdue = activeT.filter(t => t.date < selDate && t.status !== 'done' && !t.inbox);
                baseTasks = [...overdue, ...baseTasks];
            }
            filtered = baseTasks.sort((a,b) => {
                if(a.startTime && b.startTime) return Utils.timeToMinutes(a.startTime) - Utils.timeToMinutes(b.startTime);
                if(a.startTime) return -1; if(b.startTime) return 1; return 0;
            });
            
        } else if (AppState.viewingMode === 'day') {
            this.els.day.classList.remove('hidden'); this.els.day.classList.add('flex');
            document.getElementById('panel-title').textContent = "Agenda Diária";
            filtered = activeT.filter(t => t.date === selDate && !t.inbox);
            this.renderDayTimeline(filtered);
        } else if (AppState.viewingMode === 'week') {
            this.els.week.classList.remove('hidden'); this.els.week.classList.add('flex');
            document.getElementById('panel-title').textContent = "Agenda Semanal";
            const startOfWeek = Utils.getStartOfWeek(selDate);
            const endOfWeek = Utils.addDays(startOfWeek, 6);
            filtered = activeT.filter(t => t.date >= startOfWeek && t.date <= endOfWeek && !t.inbox);
            this.renderWeekTimeline(filtered, startOfWeek);
        } else if (AppState.viewingMode === 'month') {
            this.els.month.classList.remove('hidden'); this.els.month.classList.add('flex');
            document.getElementById('panel-title').textContent = "Visão Mensal";
            document.getElementById('task-counter').classList.add('hidden');
            this.renderMonth(); return;
        } else if (AppState.viewingMode === 'future') {
            this.els.list.classList.remove('hidden'); this.els.list.classList.add('flex');
            document.getElementById('panel-title').textContent = "Eventos Futuros";
            document.getElementById('task-counter').classList.add('hidden');
            filtered = activeT.filter(t => t.date > todayStr && !t.inbox);
            filtered.sort((a, b) => {
                const dateCmp = a.date.localeCompare(b.date);
                if (dateCmp !== 0) return dateCmp;
                if(a.startTime && b.startTime) return Utils.timeToMinutes(a.startTime) - Utils.timeToMinutes(b.startTime);
                return 0;
            });
        } else if (AppState.viewingMode === 'past') {
            this.els.list.classList.remove('hidden'); this.els.list.classList.add('flex');
            document.getElementById('panel-title').textContent = "Eventos Passados";
            document.getElementById('task-counter').classList.add('hidden');
            filtered = activeT.filter(t => t.date < todayStr && !t.inbox);
            filtered.sort((a, b) => {
                const dateCmp = b.date.localeCompare(a.date);
                if (dateCmp !== 0) return dateCmp;
                if(a.startTime && b.startTime) return Utils.timeToMinutes(b.startTime) - Utils.timeToMinutes(a.startTime);
                return 0;
            });
        } else if (AppState.viewingMode === 'today-list') {
            this.els.list.classList.remove('hidden'); this.els.list.classList.add('flex');
            document.getElementById('panel-title').textContent = "Lista Completa de Hoje";
            document.getElementById('task-counter').classList.add('hidden');
            filtered = activeT.filter(t => t.date === todayStr && !t.inbox);
            filtered.sort((a, b) => {
                if(a.startTime && b.startTime) return Utils.timeToMinutes(a.startTime) - Utils.timeToMinutes(b.startTime);
                if(a.startTime) return -1; if(b.startTime) return 1; return 0;
            });
        } else if (AppState.viewingMode === 'inbox') {
            this.els.list.classList.remove('hidden'); this.els.list.classList.add('flex');
            document.getElementById('panel-title').textContent = "Tarefas Sem Data (Inbox)";
            document.getElementById('task-counter').classList.remove('hidden');
            filtered = activeT.filter(t => t.inbox);
        } else if (AppState.viewingMode === 'important') {
            this.els.list.classList.remove('hidden'); this.els.list.classList.add('flex');
            document.getElementById('panel-title').textContent = "Tarefas Importantes";
            document.getElementById('task-counter').classList.remove('hidden');
            filtered = activeT.filter(t => t.important);
        } else if (AppState.viewingMode === 'tag') {
            this.els.list.classList.remove('hidden'); this.els.list.classList.add('flex');
            const tagObj = { ...TagConfig, ...AppState.customTags }[AppState.currentTagFilter];
            document.getElementById('panel-title').textContent = `Lista: ${tagObj ? tagObj.label : 'Desconhecida'}`;
            document.getElementById('task-counter').classList.remove('hidden');
            filtered = activeT.filter(t => t.tag === AppState.currentTagFilter);
        } else if (AppState.viewingMode === 'archive') {
            this.els.list.classList.remove('hidden'); this.els.list.classList.add('flex');
            document.getElementById('panel-title').textContent = "Arquivo Seguro";
            filtered = AppState.tasks.filter(t => t.archived && !t.deleted).sort((a,b)=>b.date.localeCompare(a.date));
        } else if (AppState.viewingMode === 'trash') {
            this.els.list.classList.remove('hidden'); this.els.list.classList.add('flex');
            document.getElementById('panel-title').textContent = "Lixeira";
            filtered = AppState.tasks.filter(t => t.deleted);
        }

        if (onlyUnscheduled) {
            filtered = filtered.filter(t => !t.startTime);
        }

        if (search && ['list','archive','trash','future','past','today-list','inbox','important','tag'].includes(AppState.viewingMode)) {
            filtered = filtered.filter(t => (t.text||'').toLowerCase().includes(search) || (t.description||'').toLowerCase().includes(search));
        }

        if (['list', 'day', 'week', 'archive', 'trash', 'future', 'past', 'today-list', 'inbox', 'important', 'tag'].includes(AppState.viewingMode)) {
            const total = filtered.length;
            const done = filtered.filter(t => t.status === 'done' || t.completed).length;
            const doing = filtered.filter(t => t.status === 'doing').length;
            const overdue = filtered.filter(t => !t.inbox && t.date < todayStr && t.status !== 'done' && !t.deleted && !t.archived).length;

            let counterHTML = `<span class="font-bold text-gray-700">${done}/${total}</span> <span class="ml-1">tarefas concluídas</span>`;
            if (doing > 0) counterHTML += ` <span class="text-amber-400 font-bold ml-1.5" title="Em Andamento">${doing} em andamento</span>`;
            if (overdue > 0) counterHTML += ` <span class="text-red-500 font-bold ml-1.5" title="Atrasadas">${overdue} atrasadas</span>`;
            
            document.getElementById('task-counter').innerHTML = counterHTML;
        }

        if(['list','archive','trash','future','past','today-list','inbox','important','tag'].includes(AppState.viewingMode)) {
            this.updateEmptyState(filtered.length);
            this.els.list.innerHTML = filtered.map(t => this.createTaskHTML(t)).join('');
            
            if(AppState.sortableInstance) {
                const hasActiveFilters = (search !== '') || onlyUnscheduled;
                const canDrag = (AppState.viewingMode === 'list') && !hasActiveFilters;
                AppState.sortableInstance.option("disabled", !canDrag);
            }
        } else {
            this.updateEmptyState(1);
        }
    },

    renderDayTimeline(tasks) {
        const timedT = tasks.filter(t => t.startTime && t.endTime);
        const grid = document.getElementById('day-agenda-grid');
        grid.innerHTML = this.generateTimeBlocks(timedT) + this.getCurrentTimeLine();
        setTimeout(() => {
            const scrollC = document.getElementById('day-timeline-scroll');
            const nowMin = new Date().getHours() * 60;
            scrollC.scrollTop = Math.max(0, nowMin - 120); 
        }, 10);
    },

    renderWeekTimeline(tasks, startOfWeek) {
        const headerC = document.getElementById('week-headers');
        const gridC = document.getElementById('week-agenda-grid');
        const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const today = Utils.getTodayString();
        
        let headersHtml = '<div class="w-12 shrink-0"></div>';
        let colsHtml = '';

        for(let i=0; i<7; i++) {
            const colDate = Utils.addDays(startOfWeek, i);
            const isToday = colDate === today;
            const [cy, cm, cd] = colDate.split('-').map(Number);
            const dateObj = new Date(cy, cm - 1, cd);
            
            headersHtml += `
                <div class="flex-1 text-center py-2 border-r border-gray-200 ${isToday?'bg-[#10B981]/10 text-[#10B981]':'text-gray-500'}">
                    <div class="text-[10px] uppercase font-bold">${days[i]}</div>
                    <div class="text-xl font-black ${isToday?'':'text-[#1E2024]'}">${dateObj.getDate()}</div>
                </div>`;
            
            const colTasks = tasks.filter(t => t.date === colDate && t.startTime);
            
            colsHtml += `
                <div class="flex-1 border-r border-gray-200 relative min-w-[100px] h-[1440px]">
                    ${this.generateTimeBlocks(colTasks)}
                    ${isToday ? this.getCurrentTimeLine() : ''}
                </div>`;
        }

        headerC.innerHTML = headersHtml;
        gridC.innerHTML = colsHtml;
        setTimeout(() => document.getElementById('week-timeline-scroll').scrollTop = Math.max(0, (new Date().getHours() * 60) - 120), 10);
    },

    generateTimeBlocks(tasks) {
        tasks.sort((a, b) => Utils.timeToMinutes(a.startTime) - Utils.timeToMinutes(b.startTime));
        
        const columns = [];
        tasks.forEach(task => {
            const startMin = Utils.timeToMinutes(task.startTime);
            const endMin = Utils.timeToMinutes(task.endTime);
            let placed = false;
            for (let i = 0; i < columns.length; i++) {
                if (!columns[i].some(t => Utils.timeToMinutes(t.startTime) < endMin && Utils.timeToMinutes(t.endTime) > startMin)) {
                    columns[i].push(task);
                    task._col = i; placed = true; break;
                }
            }
            if (!placed) { task._col = columns.length; columns.push([task]); }
        });

        return tasks.map(t => {
            const s = Utils.timeToMinutes(t.startTime);
            const e = Utils.timeToMinutes(t.endTime);
            const h = Math.max(20, e - s);
            
            let groupMaxCols = 1;
            tasks.forEach(other => {
                if (Utils.timeToMinutes(other.startTime) < e && Utils.timeToMinutes(other.endTime) > s) {
                    groupMaxCols = Math.max(groupMaxCols, other._col + 1);
                }
            });
            
            const w = 100 / groupMaxCols;
            const l = w * t._col;
            const isDone = t.status === 'done';
            
            const cardCls = isDone ? 'bg-emerald-50 border-emerald-300 text-emerald-800 opacity-70' : 
                            (t.status === 'doing' ? 'bg-amber-100 border-amber-400 text-amber-900 shadow-md' : 'bg-blue-50 border-blue-300 text-blue-900 shadow-sm');
            
            const conflictIcon = groupMaxCols > 1 && !isDone ? `<i class="fa-solid fa-bolt text-orange-500 absolute top-1 right-1 text-[10px]" title="Conflito de Horário"></i>` : '';

            return `
            <div class="absolute border-l-4 rounded p-1.5 overflow-hidden text-xs cursor-pointer transition-all hover:z-30 hover:shadow-lg ${cardCls}"
                 style="top: ${s}px; height: ${h}px; left: ${l}%; width: ${w}%;"
                 onclick="UI.openTaskModal(${t.id})">
                 ${conflictIcon}
                 <div class="font-bold truncate ${isDone?'line-through':''}">${Utils.escapeHTML(t.text)}</div>
                 <div class="text-[10px] opacity-75 truncate">${t.startTime} - ${t.endTime}</div>
            </div>`;
        }).join('');
    },

    // ==========================================
    // MODAIS DE VISUALIZAÇÃO E EDIÇÃO
    // ==========================================
    openTaskModal(id) {
        document.body.classList.add('overflow-hidden');

        const task = AppState.tasks.find(t => t.id === id);
        if (!task) return;

        const modal = document.getElementById('task-modal');
        const content = document.getElementById('task-modal-content');
        const actions = document.getElementById('task-modal-actions');
        const status = task.status || (task.completed ? 'done' : 'pending');
        
        const isDone = status === 'done' || task.completed;
        const isDoing = status === 'doing';
        const isOverdue = !task.inbox && task.date < Utils.getTodayString() && !isDone && !task.deleted && !task.archived;

        let dotColor = 'bg-blue-500';
        let statusBadge = '';

        if (isDone) {
            dotColor = 'bg-emerald-500';
            statusBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md uppercase tracking-wide border border-emerald-200"><i class="fa-solid fa-check"></i> Concluída</span>`;
        } else if (isOverdue) {
            dotColor = 'bg-red-500';
            statusBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-md uppercase tracking-wide border border-red-200"><i class="fa-solid fa-calendar-xmark"></i> Atrasada</span>`;
        } else if (isDoing) {
            dotColor = 'bg-amber-500';
            statusBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md uppercase tracking-wide border border-amber-200"><i class="fa-solid fa-hourglass-half"></i> Em Andamento</span>`;
        } else if (task.inbox) {
            dotColor = 'bg-purple-500';
            statusBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md uppercase tracking-wide border border-purple-200"><i class="fa-solid fa-inbox"></i> Inbox</span>`;
        } else {
            dotColor = 'bg-blue-500';
            statusBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md uppercase tracking-wide border border-blue-200"><i class="fa-solid fa-clock"></i> Pendente</span>`;
        }

        document.getElementById('modal-status-dot').className = `w-3 h-3 rounded-full flex-shrink-0 shadow-sm border border-black/10 ${dotColor}`;
        document.getElementById('modal-header-title').innerHTML = `${Utils.escapeHTML(task.text)} <span class="ml-2 align-middle">${statusBadge}</span>`;

        let subtasksHtml = '';
        if (task.subtasks && task.subtasks.length > 0) {
            subtasksHtml = `
                <div class="mt-5 border-t border-gray-100 pt-4">
                    <h4 class="text-xs font-bold text-gray-500 uppercase mb-2"><i class="fa-solid fa-list-check mr-1"></i> Checklist</h4>
                    <ul class="space-y-2 bg-[#F5F6F8] p-3 rounded-xl border border-gray-200">
                        ${task.subtasks.map((st, index) => `
                            <li class="flex items-center gap-2 text-sm group">
                                <input type="checkbox" aria-label="Marcar minitarefa" ${st.completed ? 'checked' : ''} 
                                       onchange="Actions.toggleSubtask(${task.id}, ${st.id}); UI.openTaskModal(${task.id})" 
                                       class="accent-[#10B981] w-4 h-4 rounded cursor-pointer shrink-0">
                                <span class="flex-1 ${st.completed ? 'line-through text-gray-400' : 'text-gray-700'}">${Utils.escapeHTML(st.text)}</span>
                                <div class="hidden group-hover:flex items-center gap-1.5 shrink-0">
                                    <button type="button" onclick="Actions.moveSubtask(${task.id}, ${st.id}, -1); UI.openTaskModal(${task.id})" class="text-gray-400 hover:text-blue-500 p-0.5"><i class="fa-solid fa-arrow-up text-[10px]"></i></button>
                                    <button type="button" onclick="Actions.moveSubtask(${task.id}, ${st.id}, 1); UI.openTaskModal(${task.id})" class="text-gray-400 hover:text-blue-500 p-0.5"><i class="fa-solid fa-arrow-down text-[10px]"></i></button>
                                    <button type="button" onclick="Actions.deleteSubtask(${task.id}, ${st.id}); UI.openTaskModal(${task.id})" class="text-red-400 hover:text-red-600 p-0.5"><i class="fa-solid fa-trash text-[10px]"></i></button>
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        } else {
            subtasksHtml = `<div class="mt-5 border-t border-gray-100 pt-4"><h4 class="text-xs font-bold text-gray-500 uppercase mb-2"><i class="fa-solid fa-list-check mr-1"></i> Checklist</h4></div>`;
        }
        
        const inlineSubtaskAdd = (!task.archived && !task.deleted) ? `
            <div class="flex gap-2 mt-2">
                <input type="text" id="modal-new-st-${task.id}" placeholder="Nova minitarefa..." class="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#10B981]">
                <button type="button" onclick="Actions.addSubtaskToExisting(${task.id}, 'modal-new-st-${task.id}'); UI.openTaskModal(${task.id});" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-sm transition-all">Adicionar</button>
            </div>` : '';

        let costsHtml = '';
        if (task.costs && task.costs.length > 0) {
            const totalPlanejado = task.costs.reduce((acc, curr) => acc + curr.value, 0);
            const totalRealizado = task.costs.filter(c => c.completed).reduce((acc, curr) => acc + curr.value, 0);
            const totalPendente = totalPlanejado - totalRealizado;

            costsHtml = `
                <div class="mt-5 border-t border-gray-100 pt-4">
                    <h4 class="text-xs font-bold text-gray-500 uppercase mb-2"><i class="fa-solid fa-hand-holding-dollar mr-1"></i> Custos e Despesas</h4>
                    
                    <div class="grid grid-cols-3 gap-2 mb-3 text-center">
                        <div class="bg-slate-100 border p-2 rounded-lg">
                            <div class="text-[9px] uppercase font-bold text-gray-500">Estimado</div>
                            <div class="text-xs font-bold text-gray-700">${Utils.formatCurrency(totalPlanejado)}</div>
                        </div>
                        <div class="bg-emerald-50 border border-emerald-100 p-2 rounded-lg">
                            <div class="text-[9px] uppercase font-bold text-emerald-600">Pago</div>
                            <div class="text-xs font-bold text-emerald-700">${Utils.formatCurrency(totalRealizado)}</div>
                        </div>
                        <div class="bg-amber-50 border border-amber-100 p-2 rounded-lg">
                            <div class="text-[9px] uppercase font-bold text-amber-600">Pendente</div>
                            <div class="text-xs font-bold text-amber-700">${Utils.formatCurrency(totalPendente)}</div>
                        </div>
                    </div>

                    <ul class="space-y-2 bg-[#F5F6F8] p-3 rounded-xl border border-gray-200">
                        ${task.costs.map((c, index) => `
                            <li class="flex items-center justify-between text-sm group">
                                <label class="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                                    <input type="checkbox" ${c.completed ? 'checked' : ''} 
                                           onchange="Actions.toggleCost(${task.id}, ${c.id}); UI.openTaskModal(${task.id})" 
                                           class="accent-[#10B981] w-4 h-4 rounded cursor-pointer shrink-0">
                                    <span class="${c.completed ? 'line-through text-gray-400' : 'text-gray-700'} truncate">${Utils.escapeHTML(c.text)}</span>
                                </label>
                                <div class="flex items-center gap-3 shrink-0">
                                    <span class="font-mono text-xs font-bold ${c.completed ? 'line-through text-emerald-600' : 'text-gray-700'}">${Utils.formatCurrency(c.value)}</span>
                                    <div class="hidden group-hover:flex items-center gap-1.5">
                                        <button type="button" onclick="Actions.moveCost(${task.id}, ${c.id}, -1); UI.openTaskModal(${task.id})" class="text-gray-400 hover:text-blue-500 p-0.5"><i class="fa-solid fa-arrow-up text-[10px]"></i></button>
                                        <button type="button" onclick="Actions.moveCost(${task.id}, ${c.id}, 1); UI.openTaskModal(${task.id})" class="text-gray-400 hover:text-blue-500 p-0.5"><i class="fa-solid fa-arrow-down text-[10px]"></i></button>
                                        <button type="button" onclick="Actions.deleteCost(${task.id}, ${c.id}); UI.openTaskModal(${task.id})" class="text-red-400 hover:text-red-600 p-0.5"><i class="fa-solid fa-trash text-[10px]"></i></button>
                                    </div>
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        } else {
            costsHtml = `<div class="mt-5 border-t border-gray-100 pt-4"><h4 class="text-xs font-bold text-gray-500 uppercase mb-2"><i class="fa-solid fa-hand-holding-dollar mr-1"></i> Custos e Despesas</h4></div>`;
        }

        const inlineCostAdd = (!task.archived && !task.deleted) ? `
            <div class="flex gap-2 mt-2">
                <input type="text" id="modal-new-cost-desc-${task.id}" placeholder="Nova despesa..." class="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#10B981]">
                <input type="text" id="modal-new-cost-val-${task.id}" placeholder="R$ 0,00" oninput="Utils.maskCurrency(this)" class="w-28 px-3 py-2 text-sm border border-gray-200 rounded-lg text-right focus:outline-none focus:border-[#10B981]">
                <button type="button" onclick="Actions.addCostToExisting(${task.id}, 'modal-new-cost-desc-${task.id}', 'modal-new-cost-val-${task.id}'); UI.openTaskModal(${task.id});" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-sm transition-all">Adicionar</button>
            </div>` : '';

        content.innerHTML = `
            <div class="flex items-center gap-3 mb-4 flex-wrap">
                <div class="flex items-center gap-1.5 text-sm font-semibold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                    <i class="fa-regular fa-calendar text-[#10B981]"></i> ${task.inbox ? 'Inbox (Sem Data)' : Utils.formatDateBR(task.date)}
                </div>
                ${task.startTime && !task.inbox ? `
                <div class="flex items-center gap-1.5 text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm">
                    <i class="fa-regular fa-clock"></i> ${task.startTime} às ${task.endTime}
                </div>` : ''}
                ${task.tag && TagConfig[task.tag] ? `
                <div class="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border shadow-sm" style="background-color: ${TagConfig[task.tag].bg}15; color: ${TagConfig[task.tag].bg}; border-color: ${TagConfig[task.tag].bg}30;">
                    <i class="fa-solid ${TagConfig[task.tag].icon}"></i> ${TagConfig[task.tag].label}
                </div>` : ''}
            </div>

            <div class="text-sm text-gray-600 bg-white border border-gray-100 p-4 rounded-xl shadow-sm whitespace-pre-wrap">
                ${Utils.escapeHTML(task.description) || '<span class="text-gray-400 italic">Nenhuma descrição adicionada para esta tarefa.</span>'}
            </div>

            ${subtasksHtml}
            ${inlineSubtaskAdd}
            
            ${costsHtml}
            ${inlineCostAdd}
        `;

        actions.innerHTML = `
            <div class="flex gap-2">
                <button onclick="Actions.setStatus(${task.id}); UI.openTaskModal(${task.id})" class="px-3 py-1.5 text-[11px] uppercase tracking-wide font-bold rounded-lg transition-all border flex items-center gap-1.5 ${isDone ? 'bg-emerald-100 text-emerald-700 border-emerald-300 shadow-sm' : 'bg-white text-gray-400 border-gray-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'}" title="Marcar como Concluído">
                    <i class="fa-solid fa-check"></i> Concluído
                </button>
                <button onclick="Actions.setDoing(${task.id}); UI.openTaskModal(${task.id})" class="px-3 py-1.5 text-[11px] uppercase tracking-wide font-bold rounded-lg transition-all border flex items-center gap-1.5 ${isDoing ? 'bg-amber-100 text-amber-700 border-amber-300 shadow-sm' : 'bg-white text-gray-400 border-gray-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200'}" title="Marcar em Andamento">
                    <i class="fa-solid fa-hourglass-half"></i> Em Andamento
                </button>
            </div>
            
            <div class="flex items-center gap-1">
                <button aria-label="Editar Tarefa" onclick="UI.openEditModal(${task.id})" class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="Editar">
                    <i class="fa-solid fa-pen text-sm"></i>
                </button>
                <button aria-label="Arquivar Tarefa" onclick="Actions.archive(${task.id}); UI.closeTaskModal()" class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all" title="Arquivar">
                    <i class="fa-solid fa-box-archive text-sm"></i>
                </button>
                <button aria-label="Excluir Tarefa" onclick="Actions.delete(${task.id}); UI.closeTaskModal()" class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Excluir">
                    <i class="fa-solid fa-trash-can text-sm"></i>
                </button>
                
                <div class="w-px h-6 bg-gray-200 mx-2"></div>
                
                <button onclick="UI.closeTaskModal()" class="px-4 py-2 text-sm font-bold text-white bg-[#1E2024] hover:bg-black rounded-xl transition-all shadow-md">
                    Fechar
                </button>
            </div>
        `;

        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            document.getElementById('task-modal-panel').classList.remove('scale-95');
        }, 10);
    },

    openEditModal(id) {
        document.body.classList.add('overflow-hidden');

        AppState.tempRecDates.clear();
        AppState.recMonthOffset = 0;

        const task = AppState.tasks.find(t => t.id === id);
        if(!task) return;
        
        const modal = document.getElementById('task-modal');
        const content = document.getElementById('task-modal-content');
        const actions = document.getElementById('task-modal-actions');
        
        document.getElementById('modal-header-title').innerHTML = `Editando Tarefa`;
        document.getElementById('modal-status-dot').className = `w-3 h-3 rounded-full flex-shrink-0 shadow-sm border border-black/10 bg-blue-500`;
        
        let stHtml = (task.subtasks || []).map(st => `
            <div class="flex items-center gap-2 mb-2 edit-subtask-item" data-id="${st.id}">
                <input aria-label="Editar texto da subtarefa" type="text" class="edit-subtask-input flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#10B981]" value="${Utils.escapeHTML(st.text)}">
                <button aria-label="Remover subtarefa" type="button" onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700 p-1"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('');

        let costsEditHtml = (task.costs || []).map(c => {
            const formatted = Utils.formatCurrency(c.value);
            return `
            <div class="flex flex-col gap-2 mb-3 edit-cost-item bg-gray-50 p-2 rounded-lg border border-gray-100" data-id="${c.id}">
                <input type="text" class="edit-cost-input w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg" value="${Utils.escapeHTML(c.text)}">
                <div class="flex items-center gap-2">
                    <input type="text" class="edit-cost-value flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg text-right" value="${formatted}" oninput="Utils.maskCurrency(this)">
                    <button type="button" onclick="this.parentElement.parentElement.remove()" class="text-red-500 hover:text-red-700 bg-white border border-gray-200 p-1.5 rounded-lg"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            `;
        }).join('');

        content.innerHTML = `
            <div class="space-y-4 pt-2">
                <div>
                    <label class="text-xs font-bold text-gray-500 uppercase mb-1 block">Nome da Tarefa</label>
                    <input aria-label="Nome da tarefa editada" type="text" id="edit-task-text" value="${Utils.escapeHTML(task.text)}" class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#10B981] text-sm">
                </div>
                <div>
                    <label class="text-xs font-bold text-gray-500 uppercase mb-1 block">Descrição</label>
                    <textarea aria-label="Descrição da tarefa editada" id="edit-task-desc" rows="3" class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#10B981] text-sm resize-none">${Utils.escapeHTML(task.description || '')}</textarea>
                </div>
                
                <div class="flex gap-4 items-center">
                    <div class="flex-1">
                        <label class="text-xs font-bold text-gray-500 uppercase mb-1 block">Data da Tarefa</label>
                        <input aria-label="Data da tarefa editada" type="date" id="edit-task-date" value="${task.date}" class="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-[#10B981] text-sm bg-white" onchange="if(this.value) document.getElementById('edit-task-inbox').checked = false;">
                    </div>
                    <div class="flex-1 mt-6 flex flex-col gap-2">
                        <label class="flex items-center text-xs font-semibold text-[#757575] cursor-pointer">
                            <input type="checkbox" id="edit-task-important" ${task.important ? 'checked' : ''} class="mr-2 rounded accent-amber-500 w-3.5 h-3.5 cursor-pointer">
                            <span class="text-amber-600"><i class="fa-solid fa-star"></i> Importante</span>
                        </label>
                        <label class="flex items-center text-xs font-semibold text-[#757575] cursor-pointer">
                            <input type="checkbox" id="edit-task-inbox" ${task.inbox ? 'checked' : ''} onchange="if(this.checked) document.getElementById('edit-task-date').value = '';" class="mr-2 rounded accent-[#10B981] w-3.5 h-3.5 cursor-pointer">
                            Salvar no Inbox (Sem Data)
                        </label>
                    </div>
                </div>

                <div class="flex gap-4">
                    <div class="flex-1">
                        <label class="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Início</label>
                        <input aria-label="Horário de início editado" type="time" id="edit-start-time" value="${task.startTime || ''}" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#10B981] bg-white">
                    </div>
                    <div class="flex-1">
                        <label class="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Fim</label>
                        <input aria-label="Horário de término editado" type="time" id="edit-end-time" value="${task.endTime || ''}" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#10B981] bg-white">
                    </div>
                </div>
                
                <div>
                    <label class="text-xs font-bold text-gray-500 uppercase mb-1 block border-t pt-4 border-gray-100">Categoria / Tag</label>
                    <div class="flex gap-2">
                        <select id="edit-task-tag" class="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm">
                            <option value="" ${task.tag === '' ? 'selected' : ''}>Sem Categoria</option>
                            ${(() => {
                                const allTags = { ...TagConfig, ...AppState.customTags };
                                const uniqueTags = {};
                                for (const [key, tag] of Object.entries(allTags)) {
                                    if (!Object.values(uniqueTags).some(t => t.label === tag.label)) {
                                        uniqueTags[key] = tag;
                                    }
                                }
                                return Object.entries(uniqueTags).map(([key, tag]) => `
                                    <option value="${key}" ${task.tag === key ? 'selected' : ''}>${tag.emoji} ${tag.label}</option>
                                `).join('');
                            })()}
                        </select>
                        <button type="button" onclick="Actions.createCustomTag()" class="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-sm transition-all" title="Nova Categoria">➕</button>
                    </div>
                </div>
                
                <div class="border-t pt-4 border-gray-100 mt-2">
                    <label class="flex items-center text-xs font-bold text-gray-500 uppercase cursor-pointer w-max transition-colors hover:text-gray-700 mb-2">
                        <input type="checkbox" onchange="document.getElementById('edit-rec-container').classList.toggle('hidden', !this.checked)" class="mr-2 rounded accent-[#10B981] w-4 h-4 cursor-pointer">
                        <i class="fa-solid fa-arrows-rotate mr-1.5"></i> Repetir Tarefa (Recorrência)
                    </label>
                    
                    <div id="edit-rec-container" class="hidden flex-col gap-2 bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-inner mt-3">
                        <div class="flex justify-between items-center mb-3">
                            <button type="button" onclick="AppState.recMonthOffset--; UI.renderEditRecurrenceCalendar('${task.date}')" class="px-3 py-1.5 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors shadow-sm"><i class="fa-solid fa-chevron-left text-xs text-gray-500"></i></button>
                            <span id="edit-rec-month-label" class="text-xs font-bold uppercase text-gray-700 tracking-wider"></span>
                            <button type="button" onclick="AppState.recMonthOffset++; UI.renderEditRecurrenceCalendar('${task.date}')" class="px-3 py-1.5 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors shadow-sm"><i class="fa-solid fa-chevron-right text-xs text-gray-500"></i></button>
                        </div>
                        
                        <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-400 mb-1 max-w-[280px] mx-auto w-full">
                            <div>D</div><div>S</div><div>T</div><div>Q</div><div>Q</div><div>S</div><div>S</div>
                        </div>
                        <div class="grid grid-cols-7 gap-1 max-w-[280px] mx-auto w-full" id="edit-rec-cal-days"></div>
                        
                        <p class="text-[10px] text-gray-400 text-center mt-3 font-medium">Selecione as datas adicionais para criar cópias repetidas desta tarefa.</p>
                    </div>
                </div>

                <div>
                    <label class="text-xs font-bold text-gray-500 uppercase mb-2 block border-t pt-4 border-gray-100">Subtarefas</label>
                    <div id="edit-subtasks-container">
                        ${stHtml}
                    </div>
                    <div class="flex gap-2 mt-2">
                        <input aria-label="Texto de nova subtarefa" type="text" id="edit-new-subtask" placeholder="Nova subtarefa..." class="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#10B981]">
                        <button type="button" onclick="UI.addEditSubtaskField()" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-all">Adicionar</button>
                    </div>
                </div>

                <div>
                    <label class="text-xs font-bold text-gray-500 uppercase mb-2 block border-t pt-4 border-gray-100">Custos / Despesas</label>
                    <div id="edit-costs-container">
                        ${costsEditHtml}
                    </div>
                    <div class="space-y-2 mt-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <input type="text" id="edit-new-cost-desc" placeholder="Nova despesa..." class="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg">
                        <div class="flex gap-2">
                            <input type="text" id="edit-new-cost-val" placeholder="R$ 0,00" class="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-right" oninput="Utils.maskCurrency(this)">
                            <button type="button" onclick="UI.addEditCostField()" class="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold transition-all">Adicionar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        actions.innerHTML = `
            <div class="flex justify-between items-center w-full">
                <button type="button" onclick="Actions.duplicateTask(${id})" class="px-3 py-2 text-sm font-bold text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded-lg transition-all flex items-center gap-1.5" title="Criar cópia independente na mesma data">
                    <i class="fa-regular fa-copy"></i> Duplicar
                </button>
                <div class="flex gap-2">
                    <button type="button" onclick="UI.closeTaskModal()" class="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 bg-gray-100 rounded-lg transition-all">Cancelar</button>
                    <button type="button" onclick="Actions.saveTaskEdit(${id})" class="px-4 py-2 text-sm font-bold text-white bg-[#10B981] hover:bg-[#059669] rounded-lg transition-all shadow-sm">
                        Salvar Alterações
                    </button>
                </div>
            </div>
        `;

        document.getElementById('edit-new-subtask').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); UI.addEditSubtaskField(); }
        });

        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            document.getElementById('task-modal-panel').classList.remove('scale-95');
            UI.renderEditRecurrenceCalendar(task.date);
        }, 10);
    },

    addEditSubtaskField() {
        const input = document.getElementById('edit-new-subtask');
        const val = input.value.trim();
        if (val) {
            const container = document.getElementById('edit-subtasks-container');
            const div = document.createElement('div');
            div.className = 'flex items-center gap-2 mb-2 edit-subtask-item';
            div.dataset.id = 'new_' + Date.now();
            div.innerHTML = `
                <input aria-label="Editar texto da subtarefa" type="text" class="edit-subtask-input flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#10B981]" value="${Utils.escapeHTML(val)}">
                <button aria-label="Remover subtarefa" type="button" onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700 p-1"><i class="fa-solid fa-trash"></i></button>
            `;
            container.appendChild(div);
            input.value = '';
        }
    },

    addEditCostField() {
        const descInput = document.getElementById('edit-new-cost-desc');
        const valInput = document.getElementById('edit-new-cost-val');
        const desc = descInput.value.trim();
        const val = Number(valInput.value.replace(/\D/g, "")) / 100;

        if(desc && val > 0) {
            const container = document.getElementById('edit-costs-container');
            const div = document.createElement('div');
            div.className = 'flex flex-col gap-2 mb-3 edit-cost-item bg-gray-50 p-2 rounded-lg border border-gray-100';
            div.dataset.id = 'new_' + Date.now();
            div.innerHTML = `
                <input type="text" class="edit-cost-input w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg" value="${Utils.escapeHTML(desc)}">
                <div class="flex items-center gap-2">
                    <input type="text" class="edit-cost-value flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg text-right" value="${Utils.formatCurrency(val)}" oninput="Utils.maskCurrency(this)">
                    <button type="button" onclick="this.parentElement.parentElement.remove()" class="text-red-500 hover:text-red-700 bg-white border border-gray-200 p-1.5 rounded-lg"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            container.appendChild(div);
            descInput.value = '';
            valInput.value = '';
        }
    },

    closeTaskModal() {
        document.body.classList.remove('overflow-hidden');

        const modal = document.getElementById('task-modal');
        const panel = document.getElementById('task-modal-panel');
        
        modal.classList.add('opacity-0');
        panel.classList.add('scale-95');
        
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    },
    
    getCurrentTimeLine() {
        const now = new Date();
        const mins = now.getHours() * 60 + now.getMinutes();
        return `<div class="absolute w-full h-[2px] bg-[#10B981] z-20 pointer-events-none" style="top: ${mins}px;">
                    <div class="absolute -left-1 -top-1 w-3 h-3 rounded-full bg-[#10B981]"></div>
                </div>`;
    },

    // ==========================================
    // RENDERIZAÇÃO DE TAREFA INDIVIDUAL
    // ==========================================
    createTaskHTML(task) {
        const importantBadge = task.important ? `<i class="fa-solid fa-star text-amber-400 text-xs ml-1" title="Importante"></i>` : '';
        const isSelected = AppState.selectedTaskIds.includes(task.id);
        const isTrash = AppState.viewingMode === 'trash';
        const isArchive = AppState.viewingMode === 'archive';
        const isExpanded = AppState.expandedTaskIds.has(task.id);
        const s = task.status || (task.completed ? 'done' : 'pending');
        const isOverdue = !task.inbox && task.date < Utils.getTodayString() && s !== 'done' && !task.deleted && !task.archived;
        
        const hasDesc = task.description && task.description.trim() !== '';
        const subtasks = task.subtasks || [];
        const hasSubtasks = subtasks.length > 0;
        const hasCosts = task.costs && task.costs.length > 0;
        
        const hasExtras = hasDesc || hasSubtasks || hasCosts || !isTrash;
        
        const allTags = { ...TagConfig, ...AppState.customTags };
        let tagInlineStyle = '';
        let tagDot = '';
        let tagExpandedBadge = '';

        if (task.tag && allTags[task.tag]) {
            const t = allTags[task.tag];
            tagInlineStyle = `border-left-width: 5px; border-left-color: ${t.bg};`;
            tagDot = `<span class="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-sm mr-1.5" style="background-color: ${t.bg};" title="${t.label}"></span>`;
            
            const iconOrEmoji = t.icon ? `<i class="fa-solid ${t.icon}"></i>` : t.emoji;
            tagExpandedBadge = `
                <div class="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border shadow-sm mb-3 w-fit" style="background-color: ${t.bg}15; color: ${t.bg}; border-color: ${t.bg}30;">
                    ${iconOrEmoji} ${t.label}
                </div>`;
        }

        let cardC = 'bg-white border-gray-200 text-[#1E2024] hover:shadow-md'; let txtC = 'text-[#1E2024]';
        
        if(isSelected) { cardC = 'bg-purple-50 border-purple-300 text-[#1E2024] shadow-md transition-colors duration-200'; }
        else if(isTrash) { cardC = 'bg-gray-50 opacity-80'; txtC = 'line-through text-gray-500'; }
        else if(isArchive) { cardC = 'bg-orange-50/60 border-orange-200 text-gray-700 shadow-sm'; txtC = 'text-gray-700'; }
        else if(s === 'done') { cardC = 'bg-emerald-50/60 opacity-90 border-emerald-200'; txtC = 'line-through text-gray-500'; }
        else if(isOverdue) { cardC = 'bg-red-50/80 border-red-200'; txtC = 'text-red-900 font-medium'; }
        else if(s === 'doing') { cardC = 'bg-amber-50/60 border-amber-300 shadow-sm'; txtC = 'text-amber-900 font-medium'; }
        else if(task.inbox) { cardC = 'bg-purple-50/40 border-purple-200 hover:shadow-md'; txtC = 'text-purple-900'; }
        
        const timeBadge = (task.startTime && task.endTime && s !== 'done' && !task.inbox) ? `<span class="ml-2 text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 font-mono flex items-center"><i class="fa-regular fa-clock mr-1"></i>${task.startTime}-${task.endTime}</span>` : '';
        const overdueBadge = isOverdue ? `<span class="ml-2 text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded border border-red-200 font-mono flex items-center" title="Data original: ${Utils.formatDateBR(task.date)}"><i class="fa-regular fa-calendar-xmark mr-1"></i>${Utils.formatDateBR(task.date)}</span>` : '';
        const inboxBadge = task.inbox ? `<span class="ml-2 text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 font-bold flex items-center"><i class="fa-solid fa-inbox mr-1"></i>Inbox</span>` : '';

        let costBadge = '';
        if(hasCosts) {
            const totalCost = task.costs.reduce((acc, curr) => acc + curr.value, 0);
            const paidCost = task.costs.filter(c => c.completed).reduce((acc, curr) => acc + curr.value, 0);
            const pendingCost = totalCost - paidCost;
            
            if (pendingCost > 0) {
                costBadge = `<span class="ml-2 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold" title="Valor Pendente"><i class="fa-solid fa-hand-holding-dollar mr-1"></i>${Utils.formatCurrency(pendingCost)}</span>`;
            }
        }

        const subtaskCounterBadge = hasSubtasks ? `<span class="ml-2 text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-bold">${subtasks.filter(st=>st.completed).length}/${subtasks.length}</span>` : '';
        const chevronIcon = hasExtras ? `<i class="fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-gray-400 text-[10px] ml-2"></i>` : '';

        let rightActions = '';
        if (isTrash) {
            rightActions = `
                <button type="button" aria-label="Restaurar tarefa" onclick="Actions.restore(${task.id})" data-no-expand="true" class="text-emerald-600 p-1.5 rounded hover:bg-emerald-50 transition-colors" title="Restaurar"><i class="fa-solid fa-arrow-rotate-left"></i></button>
                <button type="button" aria-label="Excluir Definitivamente" onclick="Actions.hardDelete(${task.id})" data-no-expand="true" class="text-[#10B981] p-1.5 rounded hover:bg-[#10B981]/10 transition-colors" title="Excluir Definitivamente"><i class="fa-solid fa-trash-can"></i></button>
            `;
        } else if (isArchive) {
            rightActions = `
                <button type="button" aria-label="Desarquivar tarefa" onclick="Actions.unarchive(${task.id})" data-no-expand="true" class="text-emerald-600 p-1.5 rounded hover:bg-emerald-50 transition-colors" title="Desarquivar"><i class="fa-solid fa-arrow-up-from-bracket"></i></button>
                <button type="button" aria-label="Mover tarefa para lixeira" onclick="Actions.delete(${task.id})" data-no-expand="true" class="text-gray-400 hover:text-[#10B981] p-1.5 rounded hover:bg-[#10B981]/10 transition-colors" title="Mover para lixeira"><i class="fa-regular fa-trash-can"></i></button>
            `;
        } else {
            rightActions = `
                <button type="button" aria-label="Editar Tarefa" onclick="UI.openEditModal(${task.id});" data-no-expand="true" class="text-gray-400 hover:text-blue-500 p-1.5 rounded-lg hover:bg-blue-50 transition-colors" title="Editar">
                    <i class="fa-solid fa-pen text-sm"></i>
                </button>
                <button type="button" aria-label="Arquivar Tarefa" onclick="Actions.archive(${task.id})" data-no-expand="true" class="text-gray-400 hover:text-orange-500 p-1.5 rounded-lg hover:bg-orange-50 transition-colors" title="Arquivar">
                    <i class="fa-solid fa-box-archive"></i>
                </button>
                <button type="button" aria-label="Excluir Tarefa" onclick="Actions.delete(${task.id})" data-no-expand="true" class="text-gray-400 hover:text-[#10B981] p-1.5 rounded-lg hover:bg-[#10B981]/10 transition-colors" title="Excluir">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            `;
        }

        let expandedHtml = '';
        if (isExpanded && hasExtras) {
            let stHtml = '';
            if (hasSubtasks) {
                stHtml = `<ul class="space-y-2 mt-3">` + subtasks.map((st, index) => `
                    <li class="flex items-center gap-2 text-sm bg-white p-2 rounded border shadow-sm group">
                        <input type="checkbox" aria-label="Marcar minitarefa" ${st.completed ? 'checked' : ''} onchange="Actions.toggleSubtask(${task.id}, ${st.id})" class="accent-[#10B981] w-4 h-4 rounded cursor-pointer shrink-0">
                        <span class="flex-1 ${st.completed ? 'line-through text-gray-400' : 'text-gray-700'} truncate">${Utils.escapeHTML(st.text)}</span>
                        <div class="hidden group-hover:flex items-center gap-1.5 border-l border-gray-100 pl-2 shrink-0">
                            <button type="button" aria-label="Mover subtarefa para cima" onclick="Actions.moveSubtask(${task.id}, ${st.id}, -1)" class="text-gray-400 hover:text-blue-500 transition-colors p-1"><i class="fa-solid fa-arrow-up text-[10px]"></i></button>
                            <button type="button" aria-label="Mover subtarefa para baixo" onclick="Actions.moveSubtask(${task.id}, ${st.id}, 1)" class="text-gray-400 hover:text-blue-500 transition-colors p-1"><i class="fa-solid fa-arrow-down text-[10px]"></i></button>
                            <button type="button" aria-label="Excluir minitarefa" onclick="Actions.deleteSubtask(${task.id}, ${st.id})" class="text-red-400 hover:text-red-600 transition-colors p-1"><i class="fa-solid fa-trash text-[10px]"></i></button>
                        </div>
                    </li>
                `).join('') + `</ul>`;
            }

            let addSubtaskUI = (!isTrash && !isArchive) ? `
                <div class="mt-2">
                    <label class="flex items-center text-[11px] font-bold text-gray-500 uppercase cursor-pointer w-max transition-colors hover:text-gray-700">
                        <input type="checkbox" onchange="document.getElementById('add-st-box-${task.id}').classList.toggle('hidden', !this.checked)" class="mr-1.5 rounded accent-[#10B981] w-3.5 h-3.5 cursor-pointer">
                        Adicionar nova subtarefa
                    </label>
                </div>
                <div id="add-st-box-${task.id}" class="hidden mt-2 flex gap-2 w-full max-w-sm pt-1">
                    <input type="text" aria-label="Nome da nova subtarefa" id="new-st-input-${task.id}" placeholder="Adicionar nova subtarefa..." class="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#10B981]">
                    <button type="button" onclick="Actions.addSubtaskToExisting(${task.id}, 'new-st-input-${task.id}')" class="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg text-xs cursor-pointer transition-all">Adicionar</button>
                </div>
            ` : '';

            let costsLayoutHtml = '';
            if(hasCosts) {
                const totalPl = task.costs.reduce((acc, curr) => acc + curr.value, 0);
                const totalRe = task.costs.filter(c => c.completed).reduce((acc, curr) => acc + curr.value, 0);
                const totalPe = totalPl - totalRe;

                costsLayoutHtml = `
                <div class="mt-4 border-t border-slate-100 pt-3">
                    <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <i class="fa-solid fa-hand-holding-dollar"></i> Custos do Projeto
                    </div>
                    
                    <div class="grid grid-cols-3 gap-2 mb-3 text-center">
                        <div class="bg-gray-50 border p-1 rounded">
                            <div class="text-[8px] uppercase font-bold text-gray-400">Total</div>
                            <div class="text-[10px] font-extrabold text-gray-600">${Utils.formatCurrency(totalPl)}</div>
                        </div>
                        <div class="bg-emerald-50/50 border border-emerald-100 p-1 rounded">
                            <div class="text-[8px] uppercase font-bold text-emerald-500">Pago</div>
                            <div class="text-[10px] font-extrabold text-emerald-700">${Utils.formatCurrency(totalRe)}</div>
                        </div>
                        <div class="bg-amber-50/50 border border-amber-100 p-1 rounded">
                            <div class="text-[8px] uppercase font-bold text-amber-500">Pendente</div>
                            <div class="text-[10px] font-extrabold text-amber-700">${Utils.formatCurrency(totalPe)}</div>
                        </div>
                    </div>

                    <ul class="space-y-1.5">
                        ${task.costs.map((c, index) => `
                            <li class="flex items-center justify-between text-xs bg-slate-50/50 border border-slate-100 p-2 rounded group">
                                <label class="flex items-center gap-1.5 cursor-pointer flex-1 min-w-0">
                                    <input type="checkbox" ${c.completed ? 'checked' : ''} onchange="Actions.toggleCost(${task.id}, ${c.id})" class="accent-[#10B981] w-3.5 h-3.5 rounded shrink-0">
                                    <span class="${c.completed ? 'line-through text-gray-400' : 'text-gray-700'} truncate">${Utils.escapeHTML(c.text)}</span>
                                </label>
                                <div class="flex items-center gap-2 shrink-0 ml-2">
                                    <span class="font-mono font-bold text-slate-600">${Utils.formatCurrency(c.value)}</span>
                                    <div class="hidden group-hover:flex items-center gap-1.5 border-l border-gray-200 pl-2">
                                        <button type="button" aria-label="Mover custo para cima" onclick="Actions.moveCost(${task.id}, ${c.id}, -1)" class="text-gray-400 hover:text-blue-500 transition-colors"><i class="fa-solid fa-arrow-up text-[10px]"></i></button>
                                        <button type="button" aria-label="Mover custo para baixo" onclick="Actions.moveCost(${task.id}, ${c.id}, 1)" class="text-gray-400 hover:text-blue-500 transition-colors"><i class="fa-solid fa-arrow-down text-[10px]"></i></button>
                                        <button type="button" aria-label="Excluir custo" onclick="Actions.deleteCost(${task.id}, ${c.id})" class="text-red-400 hover:text-red-600 transition-colors"><i class="fa-solid fa-trash text-[10px]"></i></button>
                                    </div>
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>
                `;
            }

            let addCostUI = (!isTrash && !isArchive) ? `
                <div class="mt-3 ${!hasCosts ? 'border-t border-slate-100 pt-3' : ''}">
                    <label class="flex items-center text-[11px] font-bold text-gray-500 uppercase cursor-pointer w-max transition-colors hover:text-gray-700">
                        <input type="checkbox" onchange="document.getElementById('add-cost-box-${task.id}').classList.toggle('hidden', !this.checked)" class="mr-1.5 rounded accent-[#10B981] w-3.5 h-3.5 cursor-pointer">
                        Adicionar novo custo
                    </label>
                    <div id="add-cost-box-${task.id}" class="hidden mt-2 flex gap-2 w-full max-w-sm pt-1">
                        <input type="text" id="new-cost-desc-${task.id}" placeholder="Descrição..." class="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#10B981]">
                        <input type="text" id="new-cost-val-${task.id}" placeholder="R$ 0,00" oninput="Utils.maskCurrency(this)" class="w-24 px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-right focus:outline-none focus:border-[#10B981]">
                        <button type="button" onclick="Actions.addCostToExisting(${task.id}, 'new-cost-desc-${task.id}', 'new-cost-val-${task.id}')" class="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg text-xs transition-all">Adicionar</button>
                    </div>
                </div>
            ` : '';

            expandedHtml = `
                <div class="border-t border-gray-100 bg-black/5 rounded-b-xl p-4 pl-12" onclick="event.stopPropagation()">
                    ${tagExpandedBadge}
                    <div class="text-sm text-gray-800 font-medium bg-white p-3 rounded-lg shadow-sm border border-gray-200 whitespace-pre-wrap mb-3">${hasDesc ? Utils.escapeHTML(task.description) : '<span class="italic text-gray-400 font-normal">Sem descrição...</span>'}</div>
                    ${stHtml}
                    ${addSubtaskUI}
                    ${costsLayoutHtml}
                    ${addCostUI}
                </div>
            `;
        }

        return `
        <li data-id="${task.id}" class="flex flex-col border rounded-xl transition-all ${cardC}" style="${tagInlineStyle}">
            <div class="task-card-header flex items-center gap-2 w-full p-2.5 ${hasExtras ? 'cursor-pointer hover:bg-black/5' : ''} rounded-t-xl" data-id="${task.id}">
                <input type="checkbox" aria-label="Selecionar tarefa em massa" data-action="toggleSelect" data-id="${task.id}" data-no-expand="true" class="w-4 h-4 accent-[#10B981] cursor-pointer" ${isSelected?'checked':''}>
                ${(AppState.viewingMode === 'list' || AppState.viewingMode === 'day' || AppState.viewingMode === 'inbox') ? `<div class="drag-handle text-gray-300 hover:text-red-500 py-1 pr-1 cursor-grab" data-no-expand="true"><i class="fa-solid fa-grip-vertical"></i></div>` : ''}
                
                ${(task.startTime && task.endTime && !task.inbox) ? `
                    <div class="w-5 h-5 rounded border flex items-center justify-center text-[10px] opacity-50 cursor-not-allowed ${s==='doing'?'bg-amber-500 text-white border-amber-500':'bg-gray-100 text-gray-400 border-gray-200'}" title="Automático (Agendado)"><i class="fa-solid fa-hourglass-half"></i></div>
                    <div class="w-5 h-5 rounded border flex items-center justify-center text-[10px] opacity-50 cursor-not-allowed ${s==='done'?'bg-emerald-600 text-white border-emerald-600':'bg-gray-100 text-gray-400 border-gray-200'}" title="Automático (Agendado)"><i class="fa-solid fa-check"></i></div>
                ` : `
                    <button aria-label="Definir em andamento" data-action="setDoing" data-id="${task.id}" data-no-expand="true" class="w-5 h-5 rounded border flex items-center justify-center text-[10px] ${s==='doing'?'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-200':'bg-white text-gray-400 hover:text-amber-500 hover:border-amber-400'}" title="Em Andamento"><i class="fa-solid fa-hourglass-half"></i></button>
                    <button aria-label="Concluir tarefa" data-action="setStatus" data-id="${task.id}" data-status="done" data-no-expand="true" class="w-5 h-5 rounded border flex items-center justify-center text-[10px] ${s==='done'?'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-200':'bg-white text-gray-400 hover:text-emerald-500 hover:border-emerald-400'}" title="Concluir"><i class="fa-solid fa-check"></i></button>
                `}
                
                <div class="flex-1 min-w-0 flex items-center flex-wrap gap-1">
                    ${tagDot}
                    <span class="font-bold truncate ${txtC}">${Utils.escapeHTML(task.text)}</span>
                    ${importantBadge}
                    ${subtaskCounterBadge}
                    ${costBadge}
                    ${timeBadge}
                    ${overdueBadge}
                    ${inboxBadge}
                    ${chevronIcon}
                </div>

                <div class="flex items-center shrink-0 ml-2 gap-1 border-l border-gray-200 pl-2">
                    ${rightActions}
                </div>
            </div>
            ${expandedHtml}
        </li>`;
    },

    // ==========================================
    // ESTADOS VAZIOS
    // ==========================================
    updateEmptyState(count) {
        const empty = document.getElementById('empty-state');
        const icon = document.getElementById('empty-icon');
        const title = document.getElementById('empty-title');
        const desc = document.getElementById('empty-desc');

        if (count === 0) { 
            empty.classList.remove('hidden'); 
            empty.classList.add('flex'); 

            if (AppState.viewingMode === 'archive') {
                icon.className = 'fa-solid fa-box-open text-5xl text-[#757575]/40';
                title.textContent = 'Arquivo vazio.';
                desc.textContent = 'Você não possui nenhuma tarefa arquivada no momento.';
            } else if (AppState.viewingMode === 'trash') {
                icon.className = 'fa-regular fa-trash-can text-5xl text-[#757575]/40';
                title.textContent = 'Lixeira vazia.';
                desc.textContent = 'Nenhuma tarefa foi excluída recentemente.';
            } else if (AppState.viewingMode === 'inbox') {
                icon.className = 'fa-solid fa-inbox text-5xl text-[#757575]/40';
                title.textContent = 'Inbox vazio.';
                desc.textContent = 'Sua caixa de entrada está limpa de atividades sem data.';
            } else if (AppState.viewingMode === 'important') {
                icon.className = 'fa-solid fa-star text-5xl text-[#757575]/40';
                title.textContent = 'Nenhuma tarefa importante.';
                desc.textContent = 'Você ainda não marcou nenhuma atividade como importante.';
            } else if (document.getElementById('search-input').value.trim() !== '') {
                icon.className = 'fa-solid fa-magnifying-glass text-5xl text-[#757575]/40';
                title.textContent = 'Nenhum resultado encontrado.';
                desc.textContent = 'Tente buscar utilizando outros termos.';
            } else {
                icon.className = 'fa-solid fa-mug-hot text-5xl text-[#757575]/40';
                title.textContent = 'Nenhuma tarefa por aqui.';
                desc.textContent = 'O seu dia está livre, ou você esqueceu de anotar algo.';
            }
        }
        else { 
            empty.classList.add('hidden'); 
            empty.classList.remove('flex'); 
        }
    },

    renderMonth() {
        const calView = document.getElementById('view-month');
        const y = AppState.currentCalDate.getFullYear(); const m = AppState.currentCalDate.getMonth();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const firstDay = new Date(y, m, 1).getDay();
        
        const todayStr = Utils.getTodayString(); 
        
        let html = `
            <div class="flex justify-between items-center mb-4 bg-[#F5F6F8] p-3 rounded-xl border">
                <button aria-label="Mês anterior" onclick="AppState.currentCalDate.setMonth(${m}-1); UI.renderMonth()" class="px-4 py-1.5 bg-white border rounded hover:bg-gray-50"><i class="fa-solid fa-chevron-left"></i></button>
                <h3 class="font-bold capitalize">${["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][m]} ${y}</h3>
                <button aria-label="Próximo mês" onclick="AppState.currentCalDate.setMonth(${m}+1); UI.renderMonth()" class="px-4 py-1.5 bg-white border rounded hover:bg-gray-50"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
            <div class="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-500 mb-1">
                <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
            </div><div class="grid grid-cols-7 gap-1">`;
        
        for (let i = 0; i < firstDay; i++) html += `<div class="bg-gray-50 border border-dashed min-h-[80px] rounded-lg"></div>`;
        
        const activeT = AppState.tasks.filter(t => !t.deleted && !t.archived);
        for (let day = 1; day <= daysInMonth; day++) {
            const dStr = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const count = activeT.filter(t => t.date === dStr && !t.inbox).length;
            
            const isToday = dStr === todayStr;
            const borderClass = isToday ? 'border-red-400 bg-red-50/10' : 'border-gray-200';
            
            let badgeClass = '';
            if (dStr < todayStr) {
                badgeClass = 'bg-gray-200 text-gray-600';
            } else if (isToday) {
                badgeClass = 'bg-emerald-100 text-emerald-800'; 
            } else {
                badgeClass = 'bg-blue-100 text-blue-800';
            }

            html += `
                <div onclick="document.getElementById('date-picker').value='${dStr}'; AppState.viewingMode='list'; UI.render()" 
                     class="bg-white border ${borderClass} rounded-lg p-1 cursor-pointer hover:border-red-500 min-h-[80px] flex flex-col items-center transition-colors">
                    <span class="text-xs font-bold ${isToday ? 'text-red-600' : 'text-gray-700'}">${day}</span>
                    ${count > 0 ? `<div class="mt-1 w-full ${badgeClass} text-[10px] font-bold py-0.5 rounded text-center">${count}</div>` : ''}
                </div>`;
        }
        calView.innerHTML = html + `</div>`;
    }
};