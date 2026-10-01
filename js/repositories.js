// js/repositories.js
import { supabaseClient } from './api.js';

export const TagRepository = {
    async getTags(userId) {
        return await supabaseClient.from('custom_tags').select('*').eq('user_id', userId);
    },
    async createTags(tagsArray) {
        return await supabaseClient.from('custom_tags').insert(tagsArray);
    }
};

export const TaskRepository = {
    async getTasks(userId) {
        return await supabaseClient.from('tasks').select('*').eq('user_id', userId);
    },
    async upsertTasks(tasksArray) {
        return await supabaseClient.from('tasks').upsert(tasksArray);
    },
    async deleteTasks(taskIdsArray) {
        return await supabaseClient.from('tasks').delete().in('id', taskIdsArray);
    },
    async deleteTask(taskId) {
        return await supabaseClient.from('tasks').delete().eq('id', taskId);
    }
};