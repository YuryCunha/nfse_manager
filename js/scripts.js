document.addEventListener('DOMContentLoaded', function() {
    // Referências aos elementos da interface
    const btnConsult = document.getElementById('btnConsult');
    const btnSendAllPending = document.getElementById('btnSendAllPending');
    const cnpjInclusionCheckboxes = document.querySelectorAll('.cnpj-include-checkbox');
    const includedCountSpan = document.getElementById('includedCount');
    const btnSelectAll = document.getElementById('btnSelectAllCnpjs');
    const btnClearAll = document.getElementById('btnClearAllCnpjs');
    const notesTableBody = document.getElementById('notesTableBody');
    const notesListTitle = document.getElementById('notesListTitle');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const messageArea = document.getElementById('messageArea');
    const notesCount = document.getElementById('notesCount');
    const paginationControls = document.getElementById('paginationControls');
    const resultsCard = document.getElementById('resultsCard');
    const rpsFilterInput = document.getElementById('rpsFilter');
    const serieFilterInput = document.getElementById('serieFilter');

    // --- Variáveis de estado ---
    let currentPage = 1;
    const notesPerPage = 15;
    let completeNoteList = []; 
    let currentStatus = 'pending'; 
    const CNPJ_STORAGE_KEY = 'nfseManagerSelectedCnpjs';

    // --- LÓGICA DE PERSISTÊNCIA DE CNPJS ---
    function saveSelectedCnpjs() {
        const selected = getIncludedCnpjs();
        sessionStorage.setItem(CNPJ_STORAGE_KEY, JSON.stringify(selected));
    }

    function loadSelectedCnpjs() {
        const saved = JSON.parse(sessionStorage.getItem(CNPJ_STORAGE_KEY) || '[]');
        if (saved.length > 0) {
            cnpjInclusionCheckboxes.forEach(checkbox => {
                if (saved.includes(checkbox.value)) {
                    checkbox.checked = true;
                }
            });
        }
    }

    function updateIncludedCount() {
        if(includedCountSpan) {
            const count = document.querySelectorAll('.cnpj-include-checkbox:checked').length;
            includedCountSpan.textContent = count;
        }
        saveSelectedCnpjs();
    }

    if (btnSelectAll) btnSelectAll.addEventListener('click', () => {
        cnpjInclusionCheckboxes.forEach(checkbox => checkbox.checked = true);
        updateIncludedCount();
    });

    if (btnClearAll) btnClearAll.addEventListener('click', () => {
        cnpjInclusionCheckboxes.forEach(checkbox => checkbox.checked = false);
        updateIncludedCount();
    });

    cnpjInclusionCheckboxes.forEach(checkbox => checkbox.addEventListener('change', updateIncludedCount));
    
    loadSelectedCnpjs();
    updateIncludedCount();

    // --- Event Listeners Principais ---
    if (btnConsult) btnConsult.addEventListener('click', () => {
        currentStatus = document.getElementById('statusFilter').value;
        fetchNotesFromServer();
    });

    if (rpsFilterInput) rpsFilterInput.addEventListener('input', () => {
        currentPage = 1;
        renderPage();
    });
    if (serieFilterInput) serieFilterInput.addEventListener('input', () => {
        currentPage = 1;
        renderPage();
    });

    if (btnSendAllPending) btnSendAllPending.addEventListener('click', sendAllPendingNotes);
    
    // --- Funções de Lógica e Comunicação ---
    function getIncludedCnpjs() {
        return Array.from(document.querySelectorAll('.cnpj-include-checkbox:checked')).map(cb => cb.value);
    }

    function fetchNotesFromServer() {
        showLoading(true);
        showMessage('Carregando notas do servidor...', 'info');
        resultsCard.classList.add('d-none');
        completeNoteList = []; 
        rpsFilterInput.value = ''; 
        serieFilterInput.value = '';

        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const includedCnpjs = getIncludedCnpjs();

        if (includedCnpjs.length === 0) {
            showMessage('Por favor, selecione pelo menos um CNPJ para consultar.', 'warning');
            showLoading(false);
            return;
        }

        const statusText = currentStatus === 'pending' ? 'Pendentes' : 'Enviadas';
        notesListTitle.textContent = `Notas Fiscais ${statusText}`;

        const fetchUrl = `get_notes.php?status=${currentStatus}&startDate=${startDate}&endDate=${endDate}&included_cnpjs=${JSON.stringify(includedCnpjs)}`;

        fetch(fetchUrl)
            .then(response => {
                if (!response.ok) throw new Error(`Falha na requisição: ${response.statusText}`);
                return response.json();
            })
            .then(data => {
                if (data.error) throw new Error(data.error);
                
                completeNoteList = data.notes || [];
                showMessage(`Consulta concluída. ${completeNoteList.length} notas carregadas.`, 'success');
                renderPage();
            })
            .catch(error => {
                console.error('Erro ao buscar notas:', error);
                showMessage(`Erro ao buscar notas: ${error.message}`, 'danger');
                renderPage();
            })
            .finally(() => {
                showLoading(false);
            });
    }

    function sendAllPendingNotes() {
        const cnpjsToProcess = getIncludedCnpjs();
        if (cnpjsToProcess.length === 0) {
            alert('Por favor, selecione os CNPJs para os quais deseja enviar as notas.');
            return;
        }

        if (!confirm(`Tem certeza que deseja executar o envio em massa para os ${cnpjsToProcess.length} CNPJ(s) selecionado(s)?`)) {
            return;
        }

        showLoading(true);
        showMessage('Enviando notas pendentes. Este processo pode levar alguns minutos...', 'info');
        
        fetch('send_all_notes.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ included_cnpjs: cnpjsToProcess })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) throw new Error(data.error);

            let reportMessage = `<strong>Relatório de Envio:</strong><br>Sucesso: ${data.successCount}, Falhas: ${data.errorCount}`;
            if (data.errorDetails && data.errorDetails.length > 0) {
                reportMessage += `<ul>`;
                data.errorDetails.forEach(err => reportMessage += `<li>RPS ${escapeHtml(err.rps)}: ${escapeHtml(err.error)}</li>`);
                reportMessage += `</ul>`;
            }
            showMessage(reportMessage, data.errorCount > 0 ? 'warning' : 'success');
            fetchNotesFromServer();
        })
        .catch(error => {
            console.error('Erro fatal ao enviar notas:', error);
            showMessage(`Ocorreu um erro crítico durante o envio: ${error.message}.`, 'danger');
        })
        .finally(() => {
            showLoading(false);
        });
    }

    // --- Funções de Renderização e Interface ---
    function renderPage() {
        const rpsFilter = rpsFilterInput.value.toLowerCase().trim();
        const serieFilter = serieFilterInput.value.toLowerCase().trim();

        const filteredNotes = completeNoteList.filter(note => {
            const rpsMatch = rpsFilter === '' || note.nr_rps.toLowerCase().includes(rpsFilter);
            const serieMatch = serieFilter === '' || note.serie.toLowerCase().includes(serieFilter);
            return rpsMatch && serieMatch;
        });

        notesCount.textContent = `Exibindo ${filteredNotes.length} de ${completeNoteList.length} nota(s)`;

        if (completeNoteList.length > 0) {
            resultsCard.classList.remove('d-none');
        } else {
            resultsCard.classList.add('d-none');
        }

        const offset = (currentPage - 1) * notesPerPage;
        const paginatedItems = filteredNotes.slice(offset, offset + notesPerPage);
        
        displayNotesOnTable(paginatedItems);
        updatePagination(filteredNotes.length);
    }
    
    function displayNotesOnTable(notes) {
        notesTableBody.innerHTML = '';
        if (!notes || notes.length === 0) {
            const message = completeNoteList.length > 0 ? 'Nenhuma nota encontrada com os filtros aplicados.' : 'Nenhuma nota encontrada para os critérios de busca.';
            notesTableBody.innerHTML = `<tr><td colspan="8" class="text-center">${message}</td></tr>`;
            return;
        }

        notes.forEach(note => {
            const row = document.createElement('tr');
            let actionsHtml = '';
            if (currentStatus === 'pending') {
                actionsHtml = `<button class="btn btn-sm btn-primary" onclick="transmitSingleNote(${note.num_seq_tmp}, event)" title="Transmitir esta nota">Transmitir</button>`;
            }

            row.innerHTML = `
                <td>${escapeHtml(note.nr_rps)}</td>
                <td>${escapeHtml(note.serie)}</td>
                <td>${escapeHtml(note.cnpj_prestador)}</td>
                <td>${formatDate(note.dt_emissao)}</td>
                <td>${formatCurrency(note.vl_total)}</td>
                <td class="description-truncate" title="${escapeHtml(note.desc_servico)}">${escapeHtml(note.desc_servico)}</td>
                <td>${getStatusBadge(note.flg_importado, note.st_extracao)}</td>
                <td><div class="btn-group">${actionsHtml}</div></td>
            `;
            notesTableBody.appendChild(row);
        });
    }
    
    window.transmitSingleNote = function(noteId, event) {
        if (!confirm(`Tem certeza que deseja TRANSMITIR a nota de ID ${noteId} para a prefeitura?`)) return;
        
        const button = event.target;
        button.disabled = true;
        showMessage(`Transmitindo nota ${noteId}...`, 'info');

        fetch('send_single_note.php', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ noteId }) 
        })
        .then(res => res.json().then(data => ({ ok: res.ok, status: res.status, body: data })))
        .then(res => {
            if (!res.ok) {
                 const errorMsg = res.body.error || `Erro HTTP ${res.status}. Resposta não é um JSON válido.`;
                 throw new Error(errorMsg);
            }
            showMessage(res.body.message, 'success');
            fetchNotesFromServer(); 
        })
        .catch(err => {
            showMessage(`Falha na transmissão: ${err.message}`, 'danger');
            button.disabled = false;
        });
    };

    function updatePagination(totalNotes) {
        paginationControls.innerHTML = '';
        const pageCount = Math.ceil(totalNotes / notesPerPage);
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
                    currentPage = page;
                    renderPage();
                });
            }
            li.appendChild(a);
            return li;
        };
        
        const maxPageNumbers = 6;
        paginationControls.appendChild(createPageLink(currentPage - 1, 'Anterior', currentPage === 1));
        let startPage, endPage;
        if (pageCount <= maxPageNumbers) {
            startPage = 1; endPage = pageCount;
        } else {
            const half = Math.floor((maxPageNumbers - 2) / 2);
            startPage = currentPage - half; endPage = currentPage + half;
            if (currentPage < maxPageNumbers / 2) { startPage = 1; endPage = maxPageNumbers - 1; }
            if (currentPage > pageCount - maxPageNumbers / 2) { startPage = pageCount - maxPageNumbers + 2; endPage = pageCount; }
        }
        if (startPage > 1) {
            paginationControls.appendChild(createPageLink(1, '1'));
            if (startPage > 2) paginationControls.appendChild(createPageLink(0, '...', true));
        }
        for (let i = startPage; i <= endPage; i++) if (i > 0 && i <= pageCount) paginationControls.appendChild(createPageLink(i, i, false, i === currentPage));
        if (endPage < pageCount) {
            if (endPage < pageCount - 1) paginationControls.appendChild(createPageLink(0, '...', true));
            paginationControls.appendChild(createPageLink(pageCount, pageCount));
        }
        paginationControls.appendChild(createPageLink(currentPage + 1, 'Próxima', currentPage === pageCount));
    }
    
    function getStatusBadge(flg, st) {
        if (st === '1' && (flg === 'A' || flg === 'S')) return '<span class="badge bg-success">Enviada</span>';
        if (flg === 'N' && st === null) return '<span class="badge bg-warning text-dark">Pendente</span>';
        return `<span class="badge bg-secondary">Outro</span>`;
    }
    function showLoading(isLoading) {
        if(loadingIndicator) loadingIndicator.classList.toggle('d-none', !isLoading);
    }
    function showMessage(message, type = 'info') {
        if(messageArea) {
            messageArea.innerHTML = message;
            messageArea.className = `alert alert-${type} mt-3`;
            messageArea.classList.remove('d-none');
            if (type === 'success' || type === 'info') {
                setTimeout(() => { if (messageArea.innerHTML === message) messageArea.classList.add('d-none'); }, 8000);
            }
        }
    }
    function formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        const offset = date.getTimezoneOffset();
        const adjustedDate = new Date(date.getTime() + (offset * 60 * 1000));
        return adjustedDate.toLocaleDateString('pt-BR');
    }
    function formatCurrency(value) {
        const num = parseFloat(value);
        if (isNaN(num)) return 'N/A';
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    function escapeHtml(unsafe) {
        if (unsafe === null || typeof unsafe === 'undefined') return '';
        return unsafe.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
});