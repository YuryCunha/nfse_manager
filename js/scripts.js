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

    let currentPage = 1;
    const notesPerPage = 15;

    // --- Funções e Eventos para o Filtro de Inclusão ---
    function updateIncludedCount() {
        if(includedCountSpan) {
            const count = document.querySelectorAll('.cnpj-include-checkbox:checked').length;
            includedCountSpan.textContent = count;
        }
    }

    if (btnSelectAll) {
        btnSelectAll.addEventListener('click', () => {
            cnpjInclusionCheckboxes.forEach(checkbox => checkbox.checked = true);
            updateIncludedCount();
        });
    }

    if (btnClearAll) {
        btnClearAll.addEventListener('click', () => {
            cnpjInclusionCheckboxes.forEach(checkbox => checkbox.checked = false);
            updateIncludedCount();
        });
    }

    cnpjInclusionCheckboxes.forEach(checkbox => checkbox.addEventListener('change', updateIncludedCount));
    updateIncludedCount(); // Inicializa a contagem

    // --- Event Listeners Principais ---
    if (btnConsult) {
        btnConsult.addEventListener('click', () => {
            const status = document.getElementById('statusFilter').value;
            fetchNotes(status, 1);
        });
    }

    if (btnSendAllPending) {
        btnSendAllPending.addEventListener('click', sendAllPendingNotes);
    }
    
    // --- Funções Principais ---
    function getIncludedCnpjs() {
        return Array.from(document.querySelectorAll('.cnpj-include-checkbox:checked')).map(cb => cb.value);
    }

    function fetchNotes(status, page = 1) {
        currentPage = page;
        showLoading(true);
        showMessage('Carregando notas...', 'info');

        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const includedCnpjs = getIncludedCnpjs();

        if (includedCnpjs.length === 0) {
            showMessage('Por favor, selecione pelo menos um CNPJ para consultar.', 'warning');
            showLoading(false);
            return;
        }

        const statusText = status === 'pending' ? 'Pendentes' : 'Enviadas';
        notesListTitle.textContent = `Notas Fiscais ${statusText}`;

        const fetchUrl = `get_notes.php?status=${status}&startDate=${startDate}&endDate=${endDate}&page=${currentPage}&limit=${notesPerPage}&included_cnpjs=${JSON.stringify(includedCnpjs)}`;
        
        fetch(fetchUrl)
            .then(response => {
                if (!response.ok) throw new Error(`Falha na requisição: ${response.statusText}`);
                return response.json();
            })
            .then(data => {
                if (data.error) throw new Error(data.error);
                displayNotes(data.notes);
                updatePagination(data.totalNotes, status);
                notesCount.textContent = `Total de notas: ${data.totalNotes}`;
                showMessage(`Consulta concluída. ${data.totalNotes} notas encontradas.`, 'success');
            })
            .catch(error => {
                console.error('Erro ao buscar notas:', error);
                showMessage(`Erro ao buscar notas: ${error.message}`, 'danger');
                notesTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Falha ao carregar notas. Verifique o console.</td></tr>`;
                notesCount.textContent = 'Total de notas: 0';
                updatePagination(0, status);
            })
            .finally(() => {
                showLoading(false);
            });
    }

    function sendAllPendingNotes() {
        const includedCnpjs = getIncludedCnpjs();
        if (includedCnpjs.length === 0) {
            alert('Por favor, selecione os CNPJs para os quais deseja enviar as notas.');
            return;
        }
        if (!confirm(`Tem certeza que deseja enviar as notas pendentes para os ${includedCnpjs.length} CNPJ(s) selecionado(s)?`)) {
            return;
        }

        showLoading(true);
        showMessage('Enviando notas pendentes. Este processo pode levar alguns minutos...', 'info');
        
        fetch('send_all_notes.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ included_cnpjs: includedCnpjs })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) throw new Error(data.error);

            let reportMessage = `<strong>Relatório de Envio:</strong><br>Sucesso: ${data.successCount}, Falhas: ${data.errorCount}`;
            if (data.errorDetails && data.errorDetails.length > 0) {
                reportMessage += `<ul>`;
                data.errorDetails.forEach(err => {
                    reportMessage += `<li>RPS ${escapeHtml(err.rps)}: ${escapeHtml(err.error)}</li>`;
                });
                reportMessage += `</ul>`;
            }
            showMessage(reportMessage, data.errorCount > 0 ? 'warning' : 'success');
            fetchNotes('pending'); // Atualiza a lista de pendentes
        })
        .catch(error => {
            console.error('Erro fatal ao enviar notas:', error);
            showMessage(`Ocorreu um erro crítico durante o envio: ${error.message}.`, 'danger');
        })
        .finally(() => {
            showLoading(false);
        });
    }

    // --- Funções Auxiliares da Interface ---
    function displayNotes(notes) {
        notesTableBody.innerHTML = '';
        if (!notes || notes.length === 0) {
            notesTableBody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhuma nota fiscal encontrada para os filtros selecionados.</td></tr>';
            return;
        }

        notes.forEach(note => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${escapeHtml(note.nr_rps)}</td>
                <td>${escapeHtml(note.serie)}</td>
                <td>${escapeHtml(note.cnpj_prestador)}</td>
                <td>${formatDate(note.dt_emissao)}</td>
                <td>${formatCurrency(note.vl_total)}</td>
                <td class="description-truncate" title="${escapeHtml(note.desc_servico)}">${escapeHtml(note.desc_servico)}</td>
                <td>${getStatusBadge(note.flg_importado, note.st_extracao)}</td>
                <td><button class="btn btn-sm btn-primary" onclick="viewNoteDetails(${note.num_seq_tmp})">Detalhes</button></td>
            `;
            notesTableBody.appendChild(row);
        });
    }

    function updatePagination(totalNotes, status) {
        paginationControls.innerHTML = '';
        const pageCount = Math.ceil(totalNotes / notesPerPage);
        if (pageCount <= 1) return;

        for (let i = 1; i <= pageCount; i++) {
            const li = document.createElement('li');
            li.className = `page-item ${i === currentPage ? 'active' : ''}`;
            const a = document.createElement('a');
            a.className = 'page-link';
            a.href = '#';
            a.textContent = i;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                fetchNotes(status, i);
            });
            li.appendChild(a);
            paginationControls.appendChild(li);
        }
    }

    function getStatusBadge(flg, st) {
        if (st === '1' && (flg === 'A' || flg === 'S')) return '<span class="badge bg-success">Enviada</span>';
        if (flg === 'N') return '<span class="badge bg-warning text-dark">Pendente</span>';
        return `<span class="badge bg-secondary">Desconhecido</span>`;
    }

    function showLoading(isLoading) {
        if(loadingIndicator) loadingIndicator.classList.toggle('d-none', !isLoading);
    }

    function showMessage(message, type = 'info') {
        if(messageArea) {
            messageArea.innerHTML = message;
            messageArea.className = `alert alert-${type} mt-3`;
            messageArea.classList.remove('d-none');
            if (type !== 'danger' && type !== 'warning') {
                setTimeout(() => messageArea.classList.add('d-none'), 10000);
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

function viewNoteDetails(noteId) {
    alert(`Exibir detalhes da nota com ID Sequencial (num_seq_tmp): ${noteId}\n\n(Funcionalidade a ser implementada)`);
}