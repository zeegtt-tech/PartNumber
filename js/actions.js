// js/actions.js
import { AppState } from './state.js';
import { UI } from './ui.js';
import { Utils } from './utils.js';
import { supabaseClient } from './api.js';
import { TaskRepository, TagRepository } from './repositories.js';
import { TaskService } from './services.js';

export const Actions = {
    async createTask(dados) {
        
        const result = TaskService.validateNewTask(dados, AppState.tasks);

        if (!result.success) {
            if (result.message) alert(result.message);
            return;
        }

        const { text, desc, date, isInbox, isImportant, start, end, tag } = result.data;

        let datesToCreate = new Set();
        if (date && !isInbox) {
            datesToCreate.add(date);
        }

        if (dados.isRecurring && !isInbox) {
            AppState.tempRecDates.forEach(d => datesToCreate.add(d));
        }

        if (datesToCreate.size === 0 && !isInbox) {
            alert("Por favor, selecione ao menos uma data.");
            return;
        }

        // --- NOVA VERIFICAÇÃO ABRANGENTE DE DUPLICATAS (Criação) ---
        if (!isInbox) {
            let duplicateDates = [];
            datesToCreate.forEach(d => {
                const hasDup = AppState.tasks.some(t =>
                    t.date === d &&
                    !t.deleted &&
                    !t.archived &&
                    t.text.toLowerCase().trim() === text.toLowerCase().trim()
                );
                if (hasDup) duplicateDates.push(d);
            });

            if (duplicateDates.length > 0) {
                // Formata as datas para o padrão BR (DD/MM/YYYY) para exibir no alerta
                const formattedDates = duplicateDates.slice(0, 3).map(d => Utils.formatDateBR(d)).join(', ');
                const suffix = duplicateDates.length > 3 ? ' e outras' : '';
                
                if (!confirm(`Atenção: Já existe uma atividade chamada "${text}" nas seguintes datas: ${formattedDates}${suffix}.\n\nDeseja criar essas duplicatas mesmo assim?`)) {
                    return; // Interrompe o processo se o usuário cancelar
                }
            }
        }
        // ---------------------------------------------------------

        let newlyCreatedTasks = []; 
        const isRecurringGroup = datesToCreate.size > 1;
        const groupId = isRecurringGroup ? 'grp_' + Date.now() + Math.floor(Math.random()*1000) : null;

        if (isInbox) {
            const newTask = {
                id: Date.now(), 
                groupId: null, 
                text, 
                description: desc || null,
                date: null,
                startTime: null,
                endTime: null, 
                status: 'pending', 
                completed: false, 
                deleted: false, 
                archived: false, 
                inbox: true,
                important: isImportant,
                tag: tag || null,
                costs: [...AppState.tempCosts],
                subtasks: [...AppState.tempSubtasks]
            };
            AppState.tasks.push(newTask);
            newlyCreatedTasks.push(newTask);
        } else {
            datesToCreate.forEach(d => {
                const deepSubtasks = AppState.tempSubtasks.map(st => ({...st, id: Date.now() + Math.floor(Math.random()*10000)}));
                const deepCosts = AppState.tempCosts.map(c => ({...c, id: Date.now() + Math.floor(Math.random()*10000)}));

                const newTask = {
                    id: Date.now() + Math.floor(Math.random() * 100000), 
                    groupId: groupId || null, 
                    text, 
                    description: desc || null, 
                    date: d || null, 
                    startTime: start || null,
                    endTime: end || null,
                    status: 'pending', 
                    completed: false, 
                    deleted: false, 
                    archived: false, 
                    inbox: false,
                    important: isImportant,
                    tag: tag || null,
                    costs: deepCosts,
                    subtasks: deepSubtasks
                };
                AppState.tasks.push(newTask);
                newlyCreatedTasks.push(newTask);
            });
        }
        
        await AppState.save(newlyCreatedTasks);
        
        document.getElementById('todo-input').value = ''; 
        document.getElementById('todo-desc').value = '';
        document.getElementById('todo-start-time').value = ''; 
        document.getElementById('todo-end-time').value = '';
        document.getElementById('todo-tag').value = '';
        
        ['time-ui', 'ui-checklist', 'ui-costs', 'ui-category', 'ui-recurring'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        
        ['has-time', 'is-inbox', 'is-important', 'toggle-checklist', 'toggle-costs', 'toggle-category', 'toggle-recurring'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.checked = false;
                el.disabled = false;
            }
        });

        document.getElementById('date-picker').disabled = false;
        document.getElementById('date-picker').classList.remove('opacity-50', 'bg-gray-100');
        
        const btnTime = document.getElementById('has-time').nextElementSibling;
        const btnRec = document.getElementById('toggle-recurring').nextElementSibling;
        if (btnTime) btnTime.classList.remove('opacity-40', 'bg-gray-100', 'cursor-not-allowed', 'border-red-300');
        if (btnRec) btnRec.classList.remove('opacity-40', 'bg-gray-100', 'cursor-not-allowed', 'border-red-300');

        AppState.tempSubtasks = []; 
        AppState.tempCosts = []; 
        AppState.tempRecDates.clear();
        AppState.recMonthOffset = 0;

        UI.renderTempSubtasks(); 
        UI.renderTempCosts();
        UI.renderRecurrenceCalendar();
        UI.render();
    },
    
    async createCustomTag() {
        const label = prompt("Qual o nome da sua nova Coleção / Tag? (ex: Presentes)");
        if (!label) return;
        
        const emoji = prompt("Digite um emoji para representá-la:") || "📌";
        const key = 'custom_' + Date.now();
        const colors = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#14B8A6', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899'];
        const bg = colors[Math.floor(Math.random() * colors.length)];

        const { data: { session } } = await supabaseClient.auth.getSession();
        if(!session) return;

        const newTag = { user_id: session.user.id, key, label, emoji, bg };
        const { error } = await TagRepository.createTags([newTag]);
        if (error) {
            alert("Erro ao criar coleção.");
            return;
        }

        AppState.customTags[key] = { bg, label, emoji };
        UI.populateTagSelects();
        UI.render();
    },

    toggleRecDate(dateStr) {
        if(AppState.tempRecDates.has(dateStr)) {
            AppState.tempRecDates.delete(dateStr);
        } else {
            AppState.tempRecDates.add(dateStr);
        }
        UI.renderRecurrenceCalendar();
    },

    toggleEditRecDate(dateStr, currentTaskDate) {
        if (dateStr === currentTaskDate) {
            alert("Esta já é a data atual da tarefa.");
            return;
        }
        if(AppState.tempRecDates.has(dateStr)) {
            AppState.tempRecDates.delete(dateStr);
        } else {
            AppState.tempRecDates.add(dateStr);
        }
        UI.renderEditRecurrenceCalendar(currentTaskDate);
    },
    
    addTempSubtask() {
        const input = document.getElementById('temp-subtask-input');
        const val = input.value.trim();
        if (val) {
            if (AppState.tempSubtasks.some(st => st.text.toLowerCase() === val.toLowerCase())) {
                if (!confirm(`Já existe uma minitarefa chamada "${val}". Deseja adicionar outra igual?`)) {
                    return;
                }
            }
            AppState.tempSubtasks.push({ id: Date.now(), text: val, completed: false }); 
            input.value = ''; 
            UI.renderTempSubtasks(); 
        }
    },
    removeTempSubtask(id) { AppState.tempSubtasks = AppState.tempSubtasks.filter(st => st.id !== id); UI.renderTempSubtasks(); },
    
    addTempCost() {
        const descInput = document.getElementById('temp-cost-desc');
        const valInput = document.getElementById('temp-cost-val');
        const desc = descInput.value.trim();
        const val = Number(valInput.value.replace(/\D/g, "")) / 100;

        if (desc && val > 0) {
            AppState.tempCosts.push({ id: Date.now(), text: desc, value: val, completed: false });
            descInput.value = '';
            valInput.value = '';
            UI.renderTempCosts();
        }
    },
    removeTempCost(id) { AppState.tempCosts = AppState.tempCosts.filter(c => c.id !== id); UI.renderTempCosts(); },

    addSubtaskToExisting(taskId, inputId) {
        const input = document.getElementById(inputId || `new-st-input-${taskId}`);
        if (!input) return;
        const val = input.value.trim();
        if (val) {
            const task = AppState.tasks.find(t => t.id === taskId);
            if(task) {
                if (task.subtasks && task.subtasks.some(st => st.text.toLowerCase() === val.toLowerCase())) {
                    if (!confirm(`Esta tarefa já possui uma subtarefa chamada "${val}". Deseja adicionar outra igual?`)) {
                        return;
                    }
                }
                const st = task.subtasks || [];
                task.subtasks = [...st, { id: Date.now(), text: val, completed: false }];
                task.status = task.status === 'done' ? 'doing' : task.status;
                task.completed = false;
                AppState.save(task); 
                input.value = '';
                UI.render();
            }
        }
    },

    addCostToExisting(taskId, descId, valId) {
        const descInput = document.getElementById(descId || `new-cost-desc-${taskId}`);
        const valInput = document.getElementById(valId || `new-cost-val-${taskId}`);
        if(!descInput || !valInput) return;
        
        const desc = descInput.value.trim();
        const val = Number(valInput.value.replace(/\D/g, "")) / 100;
        
        if (desc && val > 0) {
            const task = AppState.tasks.find(t => t.id === taskId);
            if (task) {
                const costs = task.costs || [];
                task.costs = [...costs, { id: Date.now(), text: desc, value: val, completed: false }];
                AppState.save(task);
                descInput.value = '';
                valInput.value = '';
                UI.render();
            }
        }
    },

    duplicateTask(taskId) {
        const task = AppState.tasks.find(t => t.id === taskId);
        if (task) {
            if(!confirm(`Deseja criar uma cópia independente de "${task.text}" para a mesma data?`)) {
                return;
            }

            const newTask = JSON.parse(JSON.stringify(task));
            newTask.id = Date.now() + Math.floor(Math.random() * 100000);
            newTask.text = task.text + " (Cópia)";
            newTask.groupId = null; // Cópia independente não tem grupo!
            newTask.status = 'pending';
            newTask.completed = false;
            
            if(newTask.subtasks) {
                newTask.subtasks.forEach(st => { 
                    st.id = Date.now() + Math.floor(Math.random()*10000); 
                    st.completed = false; 
                });
            }
            if(newTask.costs) {
                newTask.costs.forEach(c => { 
                    c.id = Date.now() + Math.floor(Math.random()*10000); 
                    c.completed = false; 
                });
            }
            
            AppState.tasks.push(newTask);
            AppState.save(newTask);
            UI.closeTaskModal();
            UI.render();
        }
    },

    toggleSubtask(taskId, stId) {
        const task = AppState.tasks.find(t => t.id === taskId);
        if(task) {
            const st = task.subtasks.find(s => s.id === stId);
            if(st) st.completed = !st.completed;
            
            const allDone = task.subtasks.length > 0 && task.subtasks.every(s => s.completed);
            const anyDone = task.subtasks.some(s => s.completed);
            
            if (allDone) task.status = 'done';
            else if (anyDone) task.status = 'doing';
            else task.status = 'pending';
            
            task.completed = (task.status === 'done');
            AppState.save(task); 
            UI.render();
        }
    },

    toggleCost(taskId, costId) {
        const task = AppState.tasks.find(t => t.id === taskId);
        if(task) {
            const cost = task.costs.find(c => c.id === costId);
            if(cost) cost.completed = !cost.completed;
            AppState.save(task); UI.render();
        }
    },

    deleteSubtask(taskId, stId) {
        if(confirm("Deseja excluir esta subtarefa?")) {
            const task = AppState.tasks.find(t => t.id === taskId);
            if(task) {
                task.subtasks = task.subtasks.filter(s => s.id !== stId);
                
                const allDone = task.subtasks.length > 0 && task.subtasks.every(s => s.completed);
                const anyDone = task.subtasks.some(s => s.completed);
                
                if (task.subtasks.length === 0) task.status = 'pending'; 
                else if (allDone) task.status = 'done';
                else if (anyDone) task.status = 'doing';
                else task.status = 'pending';

                task.completed = (task.status === 'done');
                AppState.save(task); 
                UI.render();
            }
        }
    },

    deleteCost(taskId, costId) {
        if(confirm("Deseja excluir este custo?")) {
            const task = AppState.tasks.find(t => t.id === taskId);
            if(task) {
                task.costs = task.costs.filter(c => c.id !== costId);
                AppState.save(task); UI.render();
            }
        }
    },

    moveCost(taskId, costId, direction) {
        const task = AppState.tasks.find(t => t.id === taskId);
        if(task && task.costs) {
            const index = task.costs.findIndex(c => c.id === costId);
            if (index < 0) return;
            const newIndex = index + direction;
            if (newIndex >= 0 && newIndex < task.costs.length) {
                const temp = task.costs[index];
                task.costs[index] = task.costs[newIndex];
                task.costs[newIndex] = temp;
                AppState.save(task); UI.render();
            }
        }
    },

    moveSubtask(taskId, stId, direction) {
        const task = AppState.tasks.find(t => t.id === taskId);
        if(task && task.subtasks) {
            const index = task.subtasks.findIndex(s => s.id === stId);
            if (index < 0) return;
            const newIndex = index + direction;
            if (newIndex >= 0 && newIndex < task.subtasks.length) {
                const temp = task.subtasks[index];
                task.subtasks[index] = task.subtasks[newIndex];
                task.subtasks[newIndex] = temp;
                AppState.save(task); UI.render();
            }
        }
    },

    toggleSelect(id) {
        const idx = AppState.selectedTaskIds.indexOf(id);
        if (idx > -1) AppState.selectedTaskIds.splice(idx, 1); else AppState.selectedTaskIds.push(id);
        UI.updateBulkToolbar(); UI.render();
    },
    selectAll() {
        const visibleIds = Array.from(UI.els.list.children).map(li => Number(li.dataset.id));
        AppState.selectedTaskIds = [...new Set([...AppState.selectedTaskIds, ...visibleIds])];
        UI.updateBulkToolbar(); UI.render();
    },
    deselectAll() { AppState.clearSelection(); UI.render(); },

    bulkStatus(id, subid, btn) { 
        const status = btn.dataset.status; 
        AppState.tasks.forEach(t => { 
            if(AppState.selectedTaskIds.includes(t.id)) { 
                t.status = status; 
                t.completed = (status === 'done');
                
                if (status === 'done' && t.subtasks) {
                    t.subtasks.forEach(st => st.completed = true);
                }
            } 
        }); 
        AppState.save(); 
        AppState.clearSelection(); 
        UI.render(); 
    },

    bulkArchive() { AppState.tasks.forEach(t => { if(AppState.selectedTaskIds.includes(t.id)) { t.archived = true; t.deleted = false; } }); AppState.save(); AppState.clearSelection(); UI.render(); },
    
    async bulkDelete() { 
        if (AppState.viewingMode === 'trash') {
            if (confirm("Deseja realmente excluir permanentemente os itens selecionados?")) {
                
                const { error } = await TaskRepository.deleteTasks(AppState.selectedTaskIds);

                if (error) {
                    console.error("Erro ao excluir tarefas em lote:", error);
                    alert("Erro ao excluir as tarefas definitivamente do banco de dados.");
                    return;
                }

                AppState.tasks = AppState.tasks.filter(t => !AppState.selectedTaskIds.includes(t.id));
                AppState.save(); 
                AppState.clearSelection(); 
                UI.render(); 
            }
        } else {
            AppState.tasks.forEach(t => { 
                if(AppState.selectedTaskIds.includes(t.id)) { 
                    t.deleted = true; 
                    t.archived = false; 
                }
            }); 
            AppState.save(); 
            AppState.clearSelection(); 
            UI.render(); 
        }
    },

    bulkRestore() { 
        AppState.tasks.forEach(t => { 
            if(AppState.selectedTaskIds.includes(t.id)) { 
                t.deleted = false; 
                t.archived = false; 
            } 
        }); 
        AppState.save(); 
        AppState.clearSelection(); 
        UI.render(); 
    },
    
    setStatus(id, _, el) { 
        const t = AppState.tasks.find(x=>x.id===id); 
        if(t) { 
            t.status = t.status==='done' ? 'pending' : 'done'; 
            t.completed = (t.status==='done'); 
            AppState.save(t); 
            UI.render(); 
        } 
    },
    setDoing(id) { const t = AppState.tasks.find(x=>x.id===id); if(t) { t.status = t.status==='doing' ? 'pending' : 'doing'; t.completed = false; AppState.save(t); UI.render(); } },
    
    delete(id) { const t = AppState.tasks.find(x=>x.id===id); if(t) { t.deleted = true; AppState.save(t); UI.render(); } },
    archive(id) { const t = AppState.tasks.find(x=>x.id===id); if(t) { t.archived = true; AppState.save(t); UI.render(); } },
    unarchive(id) { const t = AppState.tasks.find(x=>x.id===id); if(t) { t.archived = false; AppState.save(t); UI.render(); } },
    restore(id) { const t = AppState.tasks.find(x=>x.id===id); if(t) { t.deleted = false; AppState.save(t); UI.render(); } },
    
    async hardDelete(id) { 
        if(confirm("Excluir definitivamente?")) { 
            
            const { error } = await TaskRepository.deleteTask(id);

            if (error) {
                console.error("Erro ao excluir a tarefa:", error);
                alert("Erro ao excluir a tarefa definitivamente do banco de dados.");
                return;
            }

            AppState.tasks = AppState.tasks.filter(x => x.id !== id); 
            AppState.save(); 
            UI.render(); 
        } 
    },

    saveTaskEdit(id) {
        const task = AppState.tasks.find(t => t.id === id);
        if(!task) return;
        
        const newText = document.getElementById('edit-task-text').value.trim();
        const newDesc = document.getElementById('edit-task-desc').value.trim();
        let isInbox = document.getElementById('edit-task-inbox').checked;
        const isImportant = document.getElementById('edit-task-important').checked;
        let newDate = document.getElementById('edit-task-date').value;
        const newStart = document.getElementById('edit-start-time').value;
        const newEnd = document.getElementById('edit-end-time').value;
        const newTag = document.getElementById('edit-task-tag').value;
        
        const extraDates = Array.from(AppState.tempRecDates);

        if (task.inbox && newDate) {
            isInbox = false; 
            const inboxCheckbox = document.getElementById('edit-task-inbox');
            if (inboxCheckbox) inboxCheckbox.checked = false; 
        }

        if (!newDate && !isInbox) {
            alert("A data da tarefa é obrigatória ou marque como Inbox (Sem Data).");
            return;
        }
        if (isInbox) newDate = ''; 
        
        // --- NOVA VERIFICAÇÃO ABRANGENTE DE DUPLICATAS (Edição) ---
        let allEditDates = new Set();
        if (!isInbox && newDate) allEditDates.add(newDate);
        if (!isInbox) extraDates.forEach(d => allEditDates.add(d));

        if (allEditDates.size > 0) {
            let duplicateDates = [];
            allEditDates.forEach(d => {
                const hasDup = AppState.tasks.some(t =>
                    t.id !== id && // Ignora a própria tarefa que está sendo editada
                    t.date === d &&
                    !t.deleted &&
                    !t.archived &&
                    t.text.toLowerCase().trim() === newText.toLowerCase().trim()
                );
                if (hasDup) duplicateDates.push(d);
            });

            if (duplicateDates.length > 0) {
                const formattedDates = duplicateDates.slice(0, 3).map(d => Utils.formatDateBR(d)).join(', ');
                const suffix = duplicateDates.length > 3 ? ' e outras' : '';
                if (!confirm(`Atenção: Já existe uma atividade com o nome "${newText}" nas datas: ${formattedDates}${suffix}.\n\nDeseja prosseguir com a gravação mesmo assim?`)) {
                    return; // Interrompe se o usuário cancelar
                }
            }
        }
        // ----------------------------------------------------------

        if (newStart && newEnd && Utils.timeToMinutes(newStart) >= Utils.timeToMinutes(newEnd)) { 
            alert("O término deve ser depois do início."); 
            return; 
        }

        const subtaskItems = document.querySelectorAll('.edit-subtask-item');
        const updatedSubtasks = [];
        const seenTexts = new Set();
        let hasDuplicate = false;
        
        subtaskItems.forEach(item => {
            const stIdRaw = item.dataset.id;
            const input = item.querySelector('.edit-subtask-input');
            const text = input.value.trim();
            
            if (text) {
                const lowerText = text.toLowerCase();
                if(seenTexts.has(lowerText)) hasDuplicate = true;
                seenTexts.add(lowerText);
                
                let isCompleted = false;
                if (!stIdRaw.startsWith('new_')) {
                    const oldSt = task.subtasks.find(s => s.id === Number(stIdRaw));
                    if (oldSt) isCompleted = oldSt.completed;
                }
                
                updatedSubtasks.push({
                    id: stIdRaw.startsWith('new_') ? Date.now() + Math.floor(Math.random()*1000) : Number(stIdRaw),
                    text: text,
                    completed: isCompleted
                });
            }
        });

        if (hasDuplicate) {
            if (!confirm("Você inseriu subtarefas com nomes idênticos. Deseja salvar mesmo assim?")) {
                return;
            }
        }

        const costItems = document.querySelectorAll('.edit-cost-item');
        const updatedCosts = [];
        costItems.forEach(item => {
            const cIdRaw = item.dataset.id;
            const descInput = item.querySelector('.edit-cost-input');
            const valInput = item.querySelector('.edit-cost-value');
            
            const desc = descInput.value.trim();
            const val = Number(valInput.value.replace(/\D/g, "")) / 100;

            if (desc && val > 0) {
                let isCompleted = false;
                if (!cIdRaw.startsWith('new_')) {
                    const oldCost = task.costs.find(c => c.id === Number(cIdRaw));
                    if(oldCost) isCompleted = oldCost.completed;
                }

                updatedCosts.push({
                    id: cIdRaw.startsWith('new_') ? Date.now() + Math.floor(Math.random()*1000) : Number(cIdRaw),
                    text: desc,
                    value: val,
                    completed: isCompleted
                });
            }
        });

        if (newText) task.text = newText;
        task.description = newDesc || null;
        task.date = newDate || null;
        task.startTime = newStart || null; 
        task.endTime = newEnd || null;
        
        task.inbox = isInbox;
        task.important = isImportant;
        task.tag = newTag || null;
        task.subtasks = updatedSubtasks;
        task.costs = updatedCosts;
        
        if (task.subtasks.length > 0) {
            const allDone = task.subtasks.every(s => s.completed);
            const anyDone = task.subtasks.some(s => s.completed);
            if (allDone) task.status = 'done';
            else if (anyDone) task.status = 'doing';
            else task.status = 'pending';
            
            task.completed = (task.status === 'done');
        } else if (task.subtasks.length === 0 && (task.status === 'done' || task.status === 'doing')) {
            // Mantém status se não mexeu nas minitarefas
        }
        
        let tasksToSave = [task];
        let newlyCreatedIds = [];

        // 1. Processar a criação de novas datas (Transformação/Expansão da recorrência)
        if (extraDates.length > 0) {
            if (!task.groupId) {
                task.groupId = 'grp_' + Date.now() + Math.floor(Math.random() * 1000);
            }

            extraDates.forEach(d => {
                const newId = Date.now() + Math.floor(Math.random() * 100000);
                newlyCreatedIds.push(newId);
                const newTask = {
                    ...task,
                    id: newId,
                    date: d,
                    status: 'pending',
                    completed: false,
                    subtasks: task.subtasks.map(st => ({...st, id: Date.now() + Math.floor(Math.random()*10000), completed: false})),
                    costs: task.costs.map(c => ({...c, id: Date.now() + Math.floor(Math.random()*10000), completed: false}))
                };
                AppState.tasks.push(newTask);
                tasksToSave.push(newTask);
            });
        }

        // 2. Processar a atualização de irmãs JÁ EXISTENTES
        if (task.groupId) {
            const futureSiblings = AppState.tasks.filter(t => 
                t.groupId === task.groupId && 
                t.id !== task.id && 
                !newlyCreatedIds.includes(t.id) &&
                t.date >= task.date && 
                !t.deleted && !t.archived
            );

            if (futureSiblings.length > 0) {
                const updateAll = confirm("Esta é uma tarefa recorrente. Deseja aplicar as edições de texto, horário e checklists a todas as repetições futuras?\n\n[OK] Sim, alterar futuras\n[Cancelar] Não, apenas esta data");
                
                if (updateAll) {
                    futureSiblings.forEach(sibling => {
                        sibling.text = task.text;
                        sibling.description = task.description;
                        sibling.startTime = task.startTime;
                        sibling.endTime = task.endTime;
                        sibling.important = task.important;
                        sibling.tag = task.tag;
                        
                        sibling.subtasks = task.subtasks.map(st => ({...st, id: Date.now() + Math.floor(Math.random()*10000)}));
                        sibling.costs = task.costs.map(c => ({...c, id: Date.now() + Math.floor(Math.random()*10000)}));
                        
                        sibling.status = task.status;
                        sibling.completed = task.completed;
                        
                        tasksToSave.push(sibling);
                    });
                }
            }
        }

        AppState.save(tasksToSave);
        UI.render();
        UI.openTaskModal(id);
    },
    
    async logout() {
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    }
};