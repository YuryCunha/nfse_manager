// src/js/consultaApi/main.js
import { initUI, showMessage, setLoadingState, resetStateUI, renderNotesTable, updatePagination, populateSituacaoFilter, updateSummary } from './ui.js';
import { fetchAllPagesForCnpj, requeueNote } from './services.js';
import { state } from './state.js';

let ui;

export function renderPage() {
    const searchValue = ui.apiSearchFilter.value.toLowerCase().trim();
    const situacaoValue = ui.apiSituacaoFilter.value;
    let filteredNotes = state.completeNoteList;

    if (situacaoValue) {
        filteredNotes = filteredNotes.filter(note => note.situacao === situacaoValue);
    }
    if (searchValue) {
        filteredNotes = filteredNotes.filter(note => 
            (note.numero?.toString().toLowerCase().includes(searchValue)) ||
            (note.prestadorCnpj?.toLowerCase().includes(searchValue)) ||
            (note.valorServico?.toString().includes(searchValue)) ||
            (note.idIntegracao?.toLowerCase().includes(searchValue))
        );
    }

    ui.resultsCard.classList.toggle('d-none', state.completeNoteList.length === 0);
    ui.summaryCard.classList.toggle('d-none', state.completeNoteList.length === 0);

    updateSummary(filteredNotes);
    updatePagination(filteredNotes);
    renderNotesTable(filteredNotes);
}

document.addEventListener('DOMContentLoaded', function() {
    ui = initUI(renderPage); // Passa a função de renderização para a UI
    
    const handleFetch = async () => {
        if (state.isFetching) return;
        setLoadingState(true, 'Validando e iniciando consulta...');
        resetStateUI();

        const selectedCnpj = ui.cnpjFilter.value;
        const dataInicial = ui.dataInicialInput.value;
        const dataFinal = ui.dataFinalInput.value;

        if (!validateInputs(selectedCnpj, dataInicial, dataFinal)) {
            setLoadingState(false);
            return;
        }

        try {
            if (selectedCnpj === 'all') {
                await fetchAllSequentially(dataInicial, dataFinal);
            } else {
                await fetchSingleCnpj(selectedCnpj, dataInicial, dataFinal);
            }
        } catch (error) {
            showMessage(`Erro geral na busca: ${error.message}`, 'danger');
        } finally {
            setLoadingState(false);
        }
    };

    const fetchSingleCnpj = async (cpfCnpj, dataInicial, dataFinal) => {
        const option = ui.cnpjFilter.querySelector(`option[value="${cpfCnpj}"]`);
        const nomeFantasia = option ? option.dataset.nomeFantasia : cpfCnpj;
        
        const notes = await fetchAllPagesForCnpj(cpfCnpj, dataInicial, dataFinal, nomeFantasia, (progressText) => {
            setLoadingState(true, progressText);
        });
        
        state.completeNoteList = notes;
        showMessage(`Consulta concluída. ${notes.length} notas encontradas.`, 'success');
        sortAndRenderPage();
    };

    const fetchAllSequentially = async (dataInicial, dataFinal) => {
        const cnpjsToFetch = Array.from(ui.cnpjFilter.options)
            .map(opt => ({ value: opt.value, name: opt.dataset.nomeFantasia }))
            .filter(opt => opt.value && opt.value !== 'all' && opt.value !== '');
        
        let allNotes = [];
        for (let i = 0; i < cnpjsToFetch.length; i++) {
            const cnpjInfo = cnpjsToFetch[i];
            try {
                const notesForCnpj = await fetchAllPagesForCnpj(cnpjInfo.value, dataInicial, dataFinal, cnpjInfo.name, (progressText) => {
                    setLoadingState(true, `(${i + 1}/${cnpjsToFetch.length}) ${progressText}`);
                });
                allNotes.push(...notesForCnpj);
            } catch (error) {
                console.warn(`Falha ao buscar notas para ${cnpjInfo.name}: ${error.message}`);
            }
        }
        
        state.completeNoteList = allNotes;
        showMessage(`Busca concluída! ${allNotes.length} notas encontradas em ${cnpjsToFetch.length} CNPJs.`, 'success');
        sortAndRenderPage();
    };

    const sortAndRenderPage = () => {
        state.completeNoteList.sort((a, b) => new Date(b.emissao.split('/').reverse().join('-')) - new Date(a.emissao.split('/').reverse().join('-')));
        state.currentPage = 1;
        populateSituacaoFilter(state.completeNoteList);
        renderPage();
    };
    
    const validateInputs = (selectedCnpj, dataInicial, dataFinal) => {
        if (!selectedCnpj) {
            showMessage('Por favor, selecione um CNPJ ou a opção "Buscar Todos".', 'warning');
            return false;
        }
        const date1 = new Date(dataInicial);
        const date2 = new Date(dataFinal);
        if (Math.ceil(Math.abs(date2 - date1) / (1000 * 60 * 60 * 24)) > 31) {
            showMessage('O intervalo máximo de consulta é de 31 dias.', 'danger');
            return false;
        }
        return true;
    };
    
    window.handleRequeueNote = async (rps, serie, cnpj) => {
        if (!confirm(`Tem certeza que deseja reenviar a nota (RPS: ${rps}, Série: ${serie})?`)) return;
        setLoadingState(true, 'Reenfileirando nota...');
        try {
            const result = await requeueNote(rps, serie, cnpj);
            showMessage(result.message, 'success');
            state.completeNoteList = state.completeNoteList.filter(note => 
                !(note.numero == rps && note.serie == serie && note.prestadorCnpj == cnpj)
            );
            sortAndRenderPage();
        } catch (error) {
            showMessage(`Falha ao reenfileirar: ${error.message}`, 'danger');
        } finally {
            setLoadingState(false);
        }
    };

    // Event Listeners
    ui.btnConsultar.addEventListener('click', handleFetch);
    ui.apiSearchFilter.addEventListener('input', () => { state.currentPage = 1; renderPage(); });
    ui.apiSituacaoFilter.addEventListener('change', () => { state.currentPage = 1; renderPage(); });
});