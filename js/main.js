// js/main.js
import { AppState } from './state.js';
import { UI } from './ui.js';
import { Actions } from './actions.js';
import { Utils } from './utils.js';

// Expondo para o HTML (onClick, etc)
window.UI = UI;
window.Actions = Actions;
window.AppState = AppState;
window.Utils = Utils;

// Inicializando o app
(async () => {
    await AppState.init(); 
    UI.init();
})();