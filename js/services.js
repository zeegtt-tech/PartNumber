// js/services.js
import { Utils } from './utils.js';

export const TaskService = {
    validateNewTask(dadosRaw, currentTasks) {
        let { text, desc, date, isInbox, isImportant, hasTime, start, end, tag, isRecurring } = dadosRaw;

        if (!text) {
            return { success: false, message: "Por favor, digite o nome da tarefa!" };
        }

        if (!date && !isInbox) {
            if (confirm("Você não definiu uma data. Deseja salvar esta tarefa no seu Inbox (Sem Data)?")) {
                date = null; 
                isInbox = true; 
            } else {
                return { success: false }; 
            }
        }

        const todayStr = Utils.getTodayString();
        if (date && date < todayStr && !isInbox) {
            if (!confirm("Você está a agendar uma tarefa para uma data no passado. Deseja continuar?")) {
                return { success: false };
            }
        }

        if (start && !end) {
            if (confirm("Definiu o início mas não o término. Deseja que o sistema reserve 30 minutos automaticamente para esta atividade?")) {
                end = Utils.minutesToTime(Utils.timeToMinutes(start) + 30);
            } else {
                return { success: false };
            }
        }

        if (!start && end) {
            return { success: false, message: "Para definir horário, preencha o Início." };
        }
        if (start && end && Utils.timeToMinutes(start) >= Utils.timeToMinutes(end)) {
            return { success: false, message: "O término deve ser depois do início." };
        }

        if (start && end && !isInbox) {
            const activeT = currentTasks.filter(t => t.date === date && !t.deleted && !t.archived && t.startTime);
            const sMin = Utils.timeToMinutes(start);
            const eMin = Utils.timeToMinutes(end);
            
            const conflict = activeT.find(t => Utils.timeToMinutes(t.startTime) < eMin && Utils.timeToMinutes(t.endTime) > sMin);

            if (conflict) {
                if (!confirm(`Atenção: Este horário entra em conflito com "${conflict.text}". Deseja agendar mesmo assim?`)) {
                    return { success: false };
                }
            }
        }

        return {
            success: true,
            data: { text, desc, date, isInbox, isImportant, hasTime, start, end, tag, isRecurring }
        };
    }
};