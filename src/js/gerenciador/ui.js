// src/js/gerenciador/ui.js
import { state } from './state.js';
import { updateNoteStatus } from './services.js';
import { handleFetchFromDb, setLoadingState } from './main.js';

let uiElements;

export function initUI() {
    uiElements = {
        btnConsult: document.getElementById('btnConsult'),
        btnSendAllPending: document.getElementById('btnSendAllPending'),
        cnpjInclusionCheckboxes: document.querySelectorAll('.cnpj-include-checkbox'),
        includedCountSpan: document.getElementById('includedCount'),
        btnSelectAllCnpjs: document.getElementById('btnSelectAllCnpjs'),
        btnClearAllCnpjs: document.getElementById('btnClearAllCnpjs'),
        notesTableBody: document.getElementById('notesTableBody'),
        notesListTitle: document.getElementById('notesListTitle'),
        loadingIndicator: document.getElementById('loadingIndicator'),
        messageArea: document.getElementById('messageArea'),
        notesCount: document.getElementById('notesCount'),
        paginationControls: document.getElementById('paginationControls'),
        resultsCard: document.getElementById('resultsCard'),
        filterControls: document.querySelector('.card-body'),
        rpsFilterInput: document.getElementById('rpsFilter'),
        serieFilterInput: document.getElementById('serieFilter'),
        statusFilter: document.getElementById('statusFilter'),
    };
    
    // Inicializa a persistência de CNPJs
    loadSelectedCnpjs();
    updateIncludedCount();

    // Adiciona os event listeners
    uiElements.btnSelectAllCnpjs.addEventListener('click', () => {
        uiElements.cnpjInclusionCheckboxes.forEach(checkbox => checkbox.checked = true);
        updateIncludedCount();
    });

    uiElements.btnClearAllCnpjs.addEventListener('click', () => {
        uiElements.cnpjInclusionCheckboxes.forEach(checkbox => checkbox.checked = false);
        updateIncludedCount();
    });

    uiElements.cnpjInclusionCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateIncludedCount);
    });

    uiElements.rpsFilterInput.addEventListener('input', () => { state.currentPage = 1; renderPage(); });
    uiElements.serieFilterInput.addEventListener('input', () => { state.currentPage = 1; renderPage(); });

    return uiElements;
}

export const showMessage = (message, type = 'info', hide = false) => {
    uiElements.messageArea.innerHTML = message;
    uiElements.messageArea.className = `alert alert-${type} mt-3`;
    uiElements.messageArea.classList.toggle('d-none', hide || !message);
};

export const renderPage = () => {
    const rpsFilter = uiElements.rpsFilterInput.value.toLowerCase().trim();
    const serieFilter = uiElements.serieFilterInput.value.toLowerCase().trim();
    
    let filteredNotes = state.allNotesFromDb;

    if (rpsFilter) {
        filteredNotes = filteredNotes.filter(note => note.nr_rps.toLowerCase().includes(rpsFilter));
    }
    if (serieFilter) {
        filteredNotes = filteredNotes.filter(note => note.serie.toLowerCase().includes(serieFilter));
    }
    
    uiElements.notesCount.textContent = `Exibindo ${filteredNotes.length} de ${state.allNotesFromDb.length} nota(s)`;
    updatePagination(filteredNotes);
    displayNotes(filteredNotes);
};

function displayNotes(notes) {
    uiElements.notesTableBody.innerHTML = '';
    const startIndex = (state.currentPage - 1) * state.notesPerPage;
    const endIndex = startIndex + state.notesPerPage;
    const paginatedNotes = notes.slice(startIndex, endIndex);

    if (paginatedNotes.length === 0) {
        uiElements.notesTableBody.innerHTML = `<tr><td colspan="8" class="text-center">Nenhuma nota para exibir.</td></tr>`;
        return;
    }

    paginatedNotes.forEach(note => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(note.nr_rps)}</td>
            <td>${escapeHtml(note.serie)}</td>
            <td>${escapeHtml(note.cnpj_prestador)}</td>
            <td>${formatDate(note.dt_emissao)}</td>
            <td>${formatCurrency(note.vl_total)}</td>
            <td class="description-truncate" title="${escapeHtml(note.desc_servico)}">${escapeHtml(note.desc_servico)}</td>
            <td>${getStatusBadge(note.flg_importado, note.st_extracao)}</td>
            <td class="text-center">${getActionButtons(note)}</td>
        `;
        uiElements.notesTableBody.appendChild(row);
    });
}

function updatePagination(filteredNotes) {
    const pageCount = Math.ceil(filteredNotes.length / state.notesPerPage);
    uiElements.paginationControls.innerHTML = '';
    if (pageCount <= 1) return;

    const createPageLink = (page, text, isDisabled, isActive) => {
        const li = document.createElement('li');
        li.className = `page-item ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`;
        const a = document.createElement('a');
        a.className = 'page-link'; a.href = '#'; a.textContent = text || page;
        if (!isDisabled) {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                state.currentPage = page;
                renderPage();
            });
        }
        li.appendChild(a);
        return li;
    };
    
    uiElements.paginationControls.appendChild(createPageLink(state.currentPage - 1, 'Anterior', state.currentPage === 1));
    // ... (lógica de exibição dos números de página)
    uiElements.paginationControls.appendChild(createPageLink(state.currentPage + 1, 'Próxima', state.currentPage === pageCount));
}

function getActionButtons(note) {
    state.currentStatus = uiElements.statusFilter.value;
    if (state.currentStatus === 'pending') {
        return `<button class="btn btn-sm btn-success" onclick="handleUpdateStatus(${note.num_seq_tmp}, 'mark_sent')">Marcar Enviada</button>`;
    } else {
        return `<button class="btn btn-sm btn-warning" onclick="handleUpdateStatus(${note.num_seq_tmp}, 'mark_pending')">Marcar Pendente</button>`;
    }
}

window.handleUpdateStatus = async (noteId, action) => {
    const actionText = action === 'mark_sent' ? 'marcar como ENVIADA' : 'marcar como PENDENTE';
    if (!confirm(`Tem certeza que deseja ${actionText} a nota de ID ${noteId}?`)) return;

    setLoadingState(true, 'Atualizando status da nota...');
    try {
        const data = await updateNoteStatus(noteId, action);
        showMessage(data.message, 'success');
        await handleFetchFromDb();
    } catch (error) {
        showMessage(`Erro ao atualizar nota: ${error.message}`, 'danger');
    } finally {
        setLoadingState(false);
    }
};

const loadSelectedCnpjs = () => {
    const CNPJ_STORAGE_KEY = 'nfseManagerSelectedCnpjs';
    const saved = JSON.parse(sessionStorage.getItem(CNPJ_STORAGE_KEY) || '[]');
    if (saved.length > 0) {
        uiElements.cnpjInclusionCheckboxes.forEach(checkbox => {
            checkbox.checked = saved.includes(checkbox.value);
        });
    }
};

const updateIncludedCount = () => {
    const CNPJ_STORAGE_KEY = 'nfseManagerSelectedCnpjs';
    const selected = Array.from(uiElements.cnpjInclusionCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
    if (uiElements.includedCountSpan) {
        uiElements.includedCountSpan.textContent = selected.length;
    }
    sessionStorage.setItem(CNPJ_STORAGE_KEY, JSON.stringify(selected));
};

const getStatusBadge = (flg, st) => {
    if (st === '1' && (flg === 'A' || flg === 'S')) return '<span class="badge bg-success">Enviada</span>';
    if (flg === 'N' && st === null) return '<span class="badge bg-warning text-dark">Pendente</span>';
    return `<span class="badge bg-secondary">Outro</span>`;
};

const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    const offset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() + (offset * 60 * 1000));
    return adjustedDate.toLocaleDateString('pt-BR');
};

const formatCurrency = (value) => {
    if (isNaN(parseFloat(value))) return 'N/A';
    return parseFloat(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const escapeHtml = (unsafe) => {
    if (unsafe === null || typeof unsafe === 'undefined') return '';
    return unsafe.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};