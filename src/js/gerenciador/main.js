// src/js/gerenciador/main.js
import { initUI, showMessage, renderPage } from './ui.js';
import { fetchNotesFromDb, sendAllPendingNotes } from './services.js';
import { state } from './state.js';

let ui; // para armazenar as referências da UI

export function setLoadingState(loading, message = 'Carregando...') {
    ui.loadingIndicator.classList.toggle('d-none', !loading);
    document.querySelectorAll('#filterFieldset button, #filterFieldset select, #filterFieldset input').forEach(el => el.disabled = loading);
    if (loading) {
        ui.loadingIndicator.querySelector('p').textContent = message;
    }
}

export async function handleFetchFromDb() {
    setLoadingState(true, 'Consultando banco de dados...');
    ui.resultsCard.classList.add('d-none');
    
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const status = document.getElementById('statusFilter').value;
    const cnpjs = Array.from(document.querySelectorAll('.cnpj-include-checkbox'))
                       .filter(cb => cb.checked)
                       .map(cb => cb.value);

    if (cnpjs.length === 0) {
        showMessage('Por favor, selecione pelo menos um CNPJ.', 'warning');
        setLoadingState(false);
        return;
    }

    try {
        const data = await fetchNotesFromDb(status, startDate, endDate, cnpjs);
        state.allNotesFromDb = data.notes || [];
        
        if (state.allNotesFromDb.length > 0) {
            ui.resultsCard.classList.remove('d-none');
            showMessage(`Consulta concluída. ${state.allNotesFromDb.length} notas encontradas.`, 'success');
        } else {
            showMessage('Nenhuma nota encontrada para os filtros.', 'info');
        }
        state.currentPage = 1;
        renderPage();
    } catch (error) {
        showMessage(`Erro ao buscar notas: ${error.message}`, 'danger');
    } finally {
        setLoadingState(false);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    ui = initUI();
    
    ui.btnConsult.addEventListener('click', handleFetchFromDb);
    ui.btnSendAllPending.addEventListener('click', async () => {
        const cnpjs = Array.from(ui.cnpjInclusionCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
        if (cnpjs.length === 0 || !confirm(`Enviar pendentes para ${cnpjs.length} CNPJ(s)?`)) return;

        setLoadingState(true, 'Enviando notas...');
        try {
            const result = await sendAllPendingNotes(cnpjs);
            let reportMessage = `<strong>Relatório:</strong><br>Sucesso: ${result.successCount}, Falhas: ${result.errorCount}`;
            if (result.errorDetails?.length > 0) {
                reportMessage += `<ul>${result.errorDetails.map(err => `<li>RPS ${err.rps}: ${err.error}</li>`).join('')}</ul>`;
            }
            showMessage(reportMessage, result.errorCount > 0 ? 'warning' : 'success');
            await handleFetchFromDb(); // Atualiza a lista
        } catch (error) {
            showMessage(`Erro crítico no envio: ${error.message}`, 'danger');
        } finally {
            setLoadingState(false);
        }
    });
});