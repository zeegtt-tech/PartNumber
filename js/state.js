// js/state.js
import { supabaseClient } from './api.js'; 
import { TaskRepository, TagRepository } from './repositories.js';
import { UI } from './ui.js';

export const AppState = {
    tasks: [], 
    customTags: {},
    tempSubtasks: [],
    tempCosts: [], 
    
    tempRecDates: new Set(),
    recMonthOffset: 0,
    
    viewingMode: 'list',
    currentTagFilter: null,
    selectedTaskIds: [],  
    expandedTaskIds: new Set(), 
    currentCalDate: new Date(), 
    sortableInstance: null,

    async init() {
        try {
            // Verifica se o usuário está logado
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) {
                window.location.href = 'login.html';
                return;
            }

            const { data: tagsData, error: tagsError } = await TagRepository.getTags(session.user.id);
            
            // LÓGICA DE SEED: Se o usuário não tiver tags, criamos as padrão do SyncTask V2
            if (tagsData && tagsData.length > 0) {
                tagsData.forEach(t => {
                    this.customTags[t.key] = { bg: t.bg, label: t.label, emoji: t.emoji };
                });
            } else if (!tagsError) {
                // Seed Default Tags
                const defaultTags = [
                    { key: 'tag_work', label: 'Trabalho', emoji: '💼', bg: '#3B82F6' },
                    { key: 'tag_movies', label: 'Filmes', emoji: '🍿', bg: '#EF4444' },
                    { key: 'tag_series', label: 'Séries', emoji: '📺', bg: '#F97316' },
                    { key: 'tag_books', label: 'Livros', emoji: '📚', bg: '#8B5CF6' },
                    { key: 'tag_recipes', label: 'Receitas', emoji: '🍳', bg: '#F59E0B' },
                    { key: 'tag_places', label: 'Lugares', emoji: '🗺️', bg: '#10B981' },
                    { key: 'tag_shopping', label: 'Compras', emoji: '🛒', bg: '#EC4899' }
                ];

                const tagsToInsert = defaultTags.map(tag => ({
                    ...tag,
                    user_id: session.user.id
                }));

                const { error: seedError } = await TagRepository.createTags(tagsToInsert);
                
                if (!seedError) {
                    tagsToInsert.forEach(t => {
                        this.customTags[t.key] = { bg: t.bg, label: t.label, emoji: t.emoji };
                    });
                } else {
                    console.error("Erro ao gerar coleções padrão:", seedError);
                }
            }

            const { data, error } = await TaskRepository.getTasks(session.user.id);
            
            if (error) throw error;

            this.tasks = (data || []).map(t => ({
                ...t, 
                archived: t.archived || false, 
                deleted: t.deleted || false, 
                subtasks: t.subtasks || [],
                inbox: t.inbox || false,
                important: t.important || false,
                tag: t.tag || '',
                costs: t.costs || [],
            }));
        } catch (err) {
            console.error("Erro ao buscar tarefas do Supabase:", err);
            this.tasks = (await localforage.getItem('calendar_tasks') || []);
        }
    },
    async save(modifiedData = null) { 
        // 1. Salva TUDO localmente sempre
        await localforage.setItem('calendar_tasks', this.tasks); 
        
        // 2. Prepara sincronização com a Nuvem
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return; 

        // 3. Define o alvo da sincronização
        let itemsToSync = [];
        if (modifiedData) {
            itemsToSync = Array.isArray(modifiedData) ? modifiedData : [modifiedData];
        } else {
            itemsToSync = this.tasks;
        }

        const tasksToSave = itemsToSync.map(t => ({
            ...t,
            user_id: session.user.id
        }));

        if (tasksToSave.length > 0) {
            const chunkSize = 50;
            let hasError = false;
            let errorMessage = "";

            for (let i = 0; i < tasksToSave.length; i += chunkSize) {
                const chunk = tasksToSave.slice(i, i + chunkSize);
                
                // CORREÇÃO: Utilizando a camada de Repository adequadamente
                const { error } = await TaskRepository.upsertTasks(chunk);
                
                if (error) {
                    console.error(`Erro ao salvar no Supabase (Lote ${i/chunkSize + 1}):`, error);
                    hasError = true;
                    errorMessage = error.message;
                }
            }

            // CORREÇÃO: Alerta o usuário se a sincronização com a nuvem falhar
            if (hasError) {
                alert(`Aviso: Falha ao sincronizar com a nuvem. Tarefas salvas apenas localmente.\n\nDetalhe do erro: ${errorMessage}`);
            }
        }
    },
    clearSelection() { 
        this.selectedTaskIds = []; 
        UI.updateBulkToolbar(); 
    }
};