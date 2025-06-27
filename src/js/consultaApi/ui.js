// src/js/consultaApi/ui.js
import { state } from './state.js';

let uiElements;
let onPageChangeCallback; // Callback para a paginação

export function initUI(pageChangeCallback) {
    uiElements = {
        btnConsultar: document.getElementById('btnConsultarApi'),
        tableBody: document.getElementById('apiNotesTableBody'),
        resultsCard: document.getElementById('resultsCardApi'),
        summaryCard: document.getElementById('summaryCard'),
        messageArea: document.getElementById('apiMessageArea'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        loadingText: document.getElementById('loadingText'),
        paginationControls: document.getElementById('paginationControls'),
        filterFieldset: document.getElementById('filterFieldset'),
        cnpjFilter: document.getElementById('cnpjFilter'),
        dataInicialInput: document.getElementById('dataInicial'),
        dataFinalInput: document.getElementById('dataFinal'),
        apiSearchFilter: document.getElementById('apiSearchFilter'),
        apiSituacaoFilter: document.getElementById('apiSituacaoFilter'),
        totalNotesCount: document.getElementById('totalNotesCount'),
        totalNotesValue: document.getElementById('totalNotesValue'),
    };
    onPageChangeCallback = pageChangeCallback; // Armazena a função de callback
    return uiElements;
}

export function showMessage(message, type = 'info', hide = false) {
    uiElements.messageArea.className = `alert alert-${type} mt-3`;
    uiElements.messageArea.innerHTML = message;
    uiElements.messageArea.classList.toggle('d-none', hide || !message);
}

export function setLoadingState(loading, text = 'Carregando...') {
    state.isFetching = loading;
    uiElements.loadingOverlay.classList.toggle('d-none', !loading);
    uiElements.filterFieldset.disabled = loading;
    uiElements.loadingText.textContent = text;
}

export function resetStateUI() {
    state.completeNoteList = [];
    state.currentPage = 1;
    uiElements.apiSearchFilter.value = '';
    uiElements.apiSituacaoFilter.innerHTML = '<option value="">Todos os Status</option>';
    uiElements.tableBody.innerHTML = '';
    uiElements.paginationControls.innerHTML = '';
    uiElements.resultsCard.classList.add('d-none');
    uiElements.summaryCard.classList.add('d-none');
}

export function renderNotesTable(notes) {
    uiElements.tableBody.innerHTML = '';
    const startIndex = (state.currentPage - 1) * state.notesPerPage;
    const endIndex = startIndex + state.notesPerPage;
    const paginatedNotes = notes.slice(startIndex, endIndex);

    if (paginatedNotes.length === 0) {
        const message = state.completeNoteList.length > 0 ? 'Nenhuma nota encontrada com os filtros aplicados.' : 'Nenhuma nota encontrada para o período selecionado.';
        uiElements.tableBody.innerHTML = `<tr><td colspan="7" class="text-center">${message}</td></tr>`;
        return;
    }

    paginatedNotes.forEach(nota => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${getSituacaoBadge(nota.situacao)}</td>
            <td>${nota.emissao || 'N/A'}</td>
            <td><span class="d-block">${nota.nomeFantasia || 'N/A'}</span><small class="text-muted">${nota.prestadorCnpj || ''}</small></td>
            <td><span class="d-block"><strong>RPS: ${nota.numero || 'N/A'}</strong></span><small class="text-muted">NFSe: ${nota.numeroNfse || 'Aguardando'}</small></td>
            <td><span class="d-block">${nota.tomadorRazaoSocial || 'Não informado'}</span><small class="text-muted">${nota.tomador || 'N/A'}</small></td>
            <td>${formatCurrency(nota.valorServico)}</td>
            <td class="text-center">${getActionButtons(nota)}</td>
        `;
        uiElements.tableBody.appendChild(row);
    });
}

export function updatePagination(filteredNotes) {
    const pageCount = Math.ceil(filteredNotes.length / state.notesPerPage);
    uiElements.paginationControls.innerHTML = '';
    if (pageCount <= 1) return;

    const createPageLink = (page, text, isDisabled, isActive) => {
        const li = document.createElement('li');
        li.className = `page-item ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`;
        const a = document.createElement('a');
        a.className = 'page-link';
        a.href = '#';
        a.textContent = text || page;
        if (!isDisabled) {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                state.currentPage = page;
                onPageChangeCallback(); // Chama a função de renderização do main.js
            });
        }
        li.appendChild(a);
        return li;
    };
    
    uiElements.paginationControls.appendChild(createPageLink(state.currentPage - 1, 'Anterior', state.currentPage === 1));
        
    let startPage, endPage;
    if (pageCount <= 6) {
        startPage = 1; endPage = pageCount;
    } else {
        if (state.currentPage <= 4) { startPage = 1; endPage = 5; } 
        else if (state.currentPage + 2 >= pageCount) { startPage = pageCount - 4; endPage = pageCount; } 
        else { startPage = state.currentPage - 2; endPage = state.currentPage + 2; }
    }
    
    if (startPage > 1) {
        uiElements.paginationControls.appendChild(createPageLink(1, 1));
        if (startPage > 2) uiElements.paginationControls.appendChild(createPageLink(0, '...', true));
    }

    for (let i = startPage; i <= endPage; i++) {
        uiElements.paginationControls.appendChild(createPageLink(i, i, false, i === state.currentPage));
    }

    if (endPage < pageCount) {
        if (endPage < pageCount - 1) uiElements.paginationControls.appendChild(createPageLink(0, '...', true));
        uiElements.paginationControls.appendChild(createPageLink(pageCount, pageCount));
    }
    
    uiElements.paginationControls.appendChild(createPageLink(state.currentPage + 1, 'Próxima', state.currentPage === pageCount));
}


export function populateSituacaoFilter(notes) {
    const uniqueSituacoes = [...new Set(notes.map(note => note.situacao))].sort();
    const currentSelection = uiElements.apiSituacaoFilter.value;
    uiElements.apiSituacaoFilter.innerHTML = '<option value="">Todos os Status</option>';
    uniqueSituacoes.forEach(s => {
        const option = new Option(s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(), s);
        uiElements.apiSituacaoFilter.add(option);
    });
    uiElements.apiSituacaoFilter.value = currentSelection;
}

export function updateSummary(notes) {
    uiElements.totalNotesCount.textContent = notes.length;
    const totalValue = notes.reduce((sum, note) => sum + (note.valorServico || 0), 0);
    uiElements.totalNotesValue.textContent = formatCurrency(totalValue);
}

function getActionButtons(nota) {
    if (nota.situacao === 'REJEITADO' && nota.idIntegracao) {
        return `<button onclick="window.handleRequeueNote('${nota.numero}', '${nota.serie}', '${nota.prestadorCnpj}')" class="btn btn-sm btn-outline-primary" title="Coloca a nota de volta na fila de pendentes"><i class="bi bi-arrow-clockwise"></i> Reenviar</button>`;
    } else if (nota.situacao === 'PROCESSANDO') {
        return `<a href="../API/download_file.php?id=${nota.id}&type=rps" target="_blank" class="btn btn-sm btn-info" title="Baixar Recibo Provisório"><i class="bi bi-file-earmark-text"></i> Recibo</a>`;
    } else if (nota.situacao === 'CONCLUIDO' || nota.situacao === 'CANCELADO') {
        return `<div class="btn-group">
            <a href="../API/download_file.php?id=${nota.id}&type=pdf" target="_blank" class="btn btn-sm btn-danger" title="Baixar PDF"><i class="bi bi-file-earmark-pdf"></i></a>
            <a href="../API/download_file.php?id=${nota.id}&type=xml" target="_blank" class="btn btn-sm btn-secondary" title="Baixar XML"><i class="bi bi-filetype-xml"></i></a>
        </div>`;
    }
    return '';
}

function getSituacaoBadge(situacao) {
    const config = {
        CONCLUIDO: { color: 'success', icon: 'bi-check-circle' },
        CANCELADO: { color: 'danger', icon: 'bi-x-circle' },
        PROCESSANDO: { color: 'primary', icon: 'bi-arrow-repeat' },
        REJEITADO: { color: 'warning', icon: 'bi-exclamation-triangle' },
        DENEGADO: { color: 'warning', icon: 'bi-exclamation-triangle' },
        SUBSTITUIDO: { color: 'info', icon: 'bi-arrow-left-right' }
    };
    const { color = 'secondary', icon = 'bi-question-circle' } = config[situacao] || {};
    return `<span class="badge rounded-pill text-bg-${color} situacao-badge d-flex align-items-center"><i class="bi ${icon} me-1"></i> ${situacao || 'DESCONHECIDO'}</span>`;
}

function formatCurrency(value) {
    if (typeof value !== 'number') return 'N/A';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}