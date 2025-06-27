// src/js/scripts.js
document.addEventListener('DOMContentLoaded', function() {
    // --- Referências aos elementos da interface ---
    const ui = {
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
        filterControls: document.querySelector('.card-body'), // O contêiner dos filtros
    };

    // --- Variáveis de estado ---
    const state = {
        currentPage: 1,
        notesPerPage: 15,
        currentStatus: 'pending',
        allNotesFromDb: [],
    };

    const CNPJ_STORAGE_KEY = 'nfseManagerSelectedCnpjs';

    // --- LÓGICA DE PERSISTÊNCIA DE CNPJS ---
    const saveSelectedCnpjs = () => {
        const selected = getIncludedCnpjs();
        sessionStorage.setItem(CNPJ_STORAGE_KEY, JSON.stringify(selected));
    };

    const loadSelectedCnpjs = () => {
        const saved = JSON.parse(sessionStorage.getItem(CNPJ_STORAGE_KEY) || '[]');
        if (saved.length > 0) {
            ui.cnpjInclusionCheckboxes.forEach(checkbox => {
                checkbox.checked = saved.includes(checkbox.value);
            });
        }
    };

    const updateIncludedCount = () => {
        if(ui.includedCountSpan) {
            const count = document.querySelectorAll('.cnpj-include-checkbox:checked').length;
            ui.includedCountSpan.textContent = count;
        }
        saveSelectedCnpjs();
    };

    // --- Funções Principais ---
    
    const getIncludedCnpjs = () => {
        return Array.from(ui.cnpjInclusionCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
    };

    const fetchNotesFromDb = async () => {
        setLoadingState(true);
        resetResults();

        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const includedCnpjs = getIncludedCnpjs();
        state.currentStatus = document.getElementById('statusFilter').value;

        if (includedCnpjs.length === 0) {
            showMessage('Por favor, selecione pelo menos um CNPJ para consultar.', 'warning');
            setLoadingState(false);
            return;
        }
        
        const statusText = state.currentStatus === 'pending' ? 'Pendentes de Envio' : 'Já Enviadas';
        ui.notesListTitle.textContent = `Notas Fiscais ${statusText}`;

        try {
            // Caminho corrigido para a nova estrutura
            const response = await fetch(`Components/API/get_notes.php?status=${state.currentStatus}&startDate=${startDate}&endDate=${endDate}&included_cnpjs=${JSON.stringify(includedCnpjs)}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || `Erro HTTP ${response.status}`);
            
            state.allNotesFromDb = data.notes || [];
            
            if (state.allNotesFromDb.length > 0) {
                ui.resultsCard.classList.remove('d-none');
                showMessage(`Consulta concluída. ${state.allNotesFromDb.length} notas encontradas.`, 'success');
            } else {
                showMessage('Nenhuma nota fiscal encontrada para os filtros selecionados.', 'info');
            }
            renderPage();

        } catch (error) {
            showMessage(`Erro ao buscar notas: ${error.message}`, 'danger');
        } finally {
            setLoadingState(false);
        }
    };

    const sendAllPendingNotes = async () => {
        const includedCnpjs = getIncludedCnpjs();
        if (includedCnpjs.length === 0) {
            alert('Por favor, selecione os CNPJs para os quais deseja enviar as notas.');
            return;
        }
        if (!confirm(`Tem certeza que deseja enviar as notas pendentes para os ${includedCnpjs.length} CNPJ(s) selecionado(s)?`)) {
            return;
        }

        setLoadingState(true, 'Enviando notas pendentes...');
        
        try {
            // Caminho corrigido para a nova estrutura
            const response = await fetch('Components/Jobs/send_all_notes.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ included_cnpjs: includedCnpjs })
            });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Erro desconhecido no servidor.');
            
            let reportMessage = `<strong>Relatório de Envio:</strong><br>Sucesso: ${data.successCount}, Falhas: ${data.errorCount}`;
            if (data.errorDetails && data.errorDetails.length > 0) {
                reportMessage += `<ul>`;
                data.errorDetails.forEach(err => {
                    reportMessage += `<li>RPS ${escapeHtml(err.rps)}: ${escapeHtml(err.error)}</li>`;
                });
                reportMessage += `</ul>`;
            }
            showMessage(reportMessage, data.errorCount > 0 ? 'warning' : 'success');
            await fetchNotesFromDb(); // Atualiza a lista de pendentes

        } catch(error) {
            showMessage(`Ocorreu um erro crítico durante o envio: ${error.message}.`, 'danger');
        } finally {
            setLoadingState(false);
        }
    };

    // --- Funções de Renderização e UI ---

    const renderPage = () => {
        const rpsFilter = document.getElementById('rpsFilter').value.toLowerCase().trim();
        const serieFilter = document.getElementById('serieFilter').value.toLowerCase().trim();
        
        let filteredNotes = state.allNotesFromDb;

        if (rpsFilter) {
            filteredNotes = filteredNotes.filter(note => note.nr_rps.toLowerCase().includes(rpsFilter));
        }
        if (serieFilter) {
            filteredNotes = filteredNotes.filter(note => note.serie.toLowerCase().includes(serieFilter));
        }
        
        ui.notesCount.textContent = `Exibindo ${filteredNotes.length} de ${state.allNotesFromDb.length} nota(s)`;
        updatePagination(filteredNotes);
        displayNotes(filteredNotes);
    };

    const displayNotes = (notes) => {
        ui.notesTableBody.innerHTML = '';
        const startIndex = (state.currentPage - 1) * state.notesPerPage;
        const endIndex = startIndex + state.notesPerPage;
        const paginatedNotes = notes.slice(startIndex, endIndex);

        if (paginatedNotes.length === 0) {
            ui.notesTableBody.innerHTML = `<tr><td colspan="8" class="text-center">Nenhuma nota para exibir.</td></tr>`;
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
            ui.notesTableBody.appendChild(row);
        });
    };

    const updatePagination = (filteredNotes) => {
        const pageCount = Math.ceil(filteredNotes.length / state.notesPerPage);
        ui.paginationControls.innerHTML = '';
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
        
        // ... (lógica de paginação completa)
    };

    window.updateNoteStatus = async (noteId, action) => {
        const actionText = action === 'mark_sent' ? 'marcar como ENVIADA' : 'marcar como PENDENTE';
        if (!confirm(`Tem certeza que deseja ${actionText} a nota de ID ${noteId}?`)) return;

        setLoadingState(true, 'Atualizando status da nota...');
        try {
            const response = await fetch('Components/API/update_note_status.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ noteId, action })
            });
            const data = await response.json();
            if(!response.ok) throw new Error(data.error || 'Erro desconhecido');
            
            showMessage(data.message, 'success');
            await fetchNotesFromDb(); // Recarrega os dados

        } catch (error) {
            showMessage(`Erro ao atualizar nota: ${error.message}`, 'danger');
        } finally {
            setLoadingState(false);
        }
    };

    // --- Funções Auxiliares ---
    const resetResults = () => {
        state.allNotesFromDb = [];
        state.currentPage = 1;
        ui.resultsCard.classList.add('d-none');
        ui.notesTableBody.innerHTML = '';
        ui.paginationControls.innerHTML = '';
    };

    const setLoadingState = (loading, message = 'Carregando...') => {
        ui.loadingIndicator.classList.toggle('d-none', !loading);
        ui.filterControls.querySelectorAll('input, select, button').forEach(el => el.disabled = loading);
        if (loading) {
            ui.loadingIndicator.querySelector('p').textContent = message;
        }
    };
    
    const getActionButtons = (note) => {
        if (state.currentStatus === 'pending') {
            return `<button class="btn btn-sm btn-success" onclick="updateNoteStatus(${note.num_seq_tmp}, 'mark_sent')">Marcar Enviada</button>`;
        } else {
            return `<button class="btn btn-sm btn-warning" onclick="updateNoteStatus(${note.num_seq_tmp}, 'mark_pending')">Marcar Pendente</button>`;
        }
    };

    const getStatusBadge = (flg, st) => {
        if (st === '1' && (flg === 'A' || flg === 'S')) return '<span class="badge bg-success">Enviada</span>';
        if (flg === 'N' && st === null) return '<span class="badge bg-warning text-dark">Pendente</span>';
        return `<span class="badge bg-secondary">Outro</span>`;
    };

    const showMessage = (message, type = 'info', hide = false) => {
        ui.messageArea.innerHTML = message;
        ui.messageArea.className = `alert alert-${type} mt-3`;
        ui.messageArea.classList.toggle('d-none', hide || !message);
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

    // --- Inicialização e Event Listeners ---
    if (ui.btnConsult) ui.btnConsult.addEventListener('click', fetchNotesFromDb);
    if (ui.btnSendAllPending) ui.btnSendAllPending.addEventListener('click', sendAllPendingNotes);
    if (ui.btnSelectAllCnpjs) ui.btnSelectAllCnpjs.addEventListener('click', () => {
        ui.cnpjInclusionCheckboxes.forEach(checkbox => checkbox.checked = true);
        updateIncludedCount();
    });
    if (ui.btnClearAllCnpjs) ui.btnClearAllCnpjs.addEventListener('click', () => {
        ui.cnpjInclusionCheckboxes.forEach(checkbox => checkbox.checked = false);
        updateIncludedCount();
    });
    ui.cnpjInclusionCheckboxes.forEach(checkbox => checkbox.addEventListener('change', updateIncludedCount));
    document.getElementById('rpsFilter').addEventListener('input', () => { state.currentPage = 1; renderPage(); });
    document.getElementById('serieFilter').addEventListener('input', () => { state.currentPage = 1; renderPage(); });

    loadSelectedCnpjs();
    updateIncludedCount();
});