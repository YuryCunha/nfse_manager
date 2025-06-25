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
    const resultsCard = document.getElementById('resultsCard'); // O card que contém a tabela

    let currentPage = 1;
    const notesPerPage = 15;
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

    // --- Funções e Eventos para o Filtro de Inclusão ---
    function updateIncludedCount() {
        if(includedCountSpan) {
            const count = document.querySelectorAll('.cnpj-include-checkbox:checked').length;
            includedCountSpan.textContent = count;
        }
        saveSelectedCnpjs(); // Salva a seleção a cada mudança
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
    
    // Carrega CNPJs salvos e atualiza a contagem inicial
    loadSelectedCnpjs();
    updateIncludedCount();

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
        resultsCard.classList.add('d-none'); // Oculta a tabela antes da nova busca

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
                
                // Exibe o card de resultados apenas se houver notas
                if (data.totalNotes > 0) {
                    resultsCard.classList.remove('d-none');
                    displayNotes(data.notes, status);
                    updatePagination(data.totalNotes, status);
                    showMessage(`Consulta concluída. ${data.totalNotes} notas encontradas.`, 'success');
                } else {
                    showMessage('Nenhuma nota fiscal encontrada para os filtros selecionados.', 'info');
                    notesTableBody.innerHTML = ''; // Limpa qualquer conteúdo antigo
                }
                notesCount.textContent = `Total de notas: ${data.totalNotes}`;
            })
            .catch(error => {
                console.error('Erro ao buscar notas:', error);
                showMessage(`Erro ao buscar notas: ${error.message}`, 'danger');
                notesTableBody.innerHTML = '';
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
    function displayNotes(notes, status) {
        notesTableBody.innerHTML = ''; // Limpa a tabela
        if (!notes || notes.length === 0) {
            return; // A lógica de exibição do card já tratou a mensagem de "nenhuma nota"
        }

        notes.forEach(note => {
            const row = document.createElement('tr');
            
            // Define o botão de ação com base no status da consulta
            let actionButtonHtml = '';
            if (status === 'pending') {
                actionButtonHtml = `<button class="btn btn-sm btn-success" onclick="updateNoteStatus(${note.num_seq_tmp}, 'mark_sent')">Marcar Enviada</button>`;
            } else if (status === 'sent') {
                actionButtonHtml = `<button class="btn btn-sm btn-warning" onclick="updateNoteStatus(${note.num_seq_tmp}, 'mark_pending')">Marcar Pendente</button>`;
            }

            row.innerHTML = `
                <td>${escapeHtml(note.nr_rps)}</td>
                <td>${escapeHtml(note.serie)}</td>
                <td>${escapeHtml(note.cnpj_prestador)}</td>
                <td>${formatDate(note.dt_emissao)}</td>
                <td>${formatCurrency(note.vl_total)}</td>
                <td class="description-truncate" title="${escapeHtml(note.desc_servico)}">${escapeHtml(note.desc_servico)}</td>
                <td>${getStatusBadge(note.flg_importado, note.st_extracao)}</td>
                <td>${actionButtonHtml}</td>
            `;
            notesTableBody.appendChild(row);
        });
    }
    
    window.updateNoteStatus = function(noteId, action) {
        const actionText = action === 'mark_sent' ? 'marcar como ENVIADA' : 'marcar como PENDENTE';
        if (!confirm(`Tem certeza que deseja ${actionText} a nota de ID ${noteId}?`)) {
            return;
        }

        showLoading(true);
        showMessage('Atualizando status da nota...', 'info');

        fetch('update_note_status.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ noteId: noteId, action: action })
        })
        .then(response => {
            if (!response.ok) {
                 // Tenta ler o erro do JSON, senão usa o status da resposta
                 return response.json().then(err => { throw new Error(err.error || response.statusText); });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showMessage('Status da nota atualizado com sucesso!', 'success');
                // Recarrega a lista atual para refletir a mudança
                const currentStatus = document.getElementById('statusFilter').value;
                fetchNotes(currentStatus, currentPage);
            } else {
                throw new Error(data.message || 'Ocorreu um erro desconhecido.');
            }
        })
        .catch(error => {
            console.error('Erro ao atualizar nota:', error);
            showMessage(`Erro ao atualizar nota: ${error.message}`, 'danger');
        })
        .finally(() => {
            // O loading será desativado pelo fetchNotes que é chamado no sucesso
            showLoading(false);
        });
    };

    /**
     * ATUALIZADO: Lógica de paginação para exibir no máximo 6 números de página
     * e evitar transbordamento de layout (overflow).
     */
    function updatePagination(totalNotes, status) {
        paginationControls.innerHTML = '';
        const pageCount = Math.ceil(totalNotes / notesPerPage);
        if (pageCount <= 1) {
            return;
        }

        const maxPageNumbers = 6;

        const createPageLink = (page, text = null, isDisabled = false, isActive = false) => {
            const li = document.createElement('li');
            li.className = `page-item ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`;
            
            const a = document.createElement('a');
            a.className = 'page-link';
            a.href = '#';
            a.textContent = text || page;
            if (!isDisabled && page > 0) {
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    fetchNotes(status, page);
                });
            }
            li.appendChild(a);
            return li;
        };

        // Botão "Anterior"
        paginationControls.appendChild(createPageLink(currentPage - 1, 'Anterior', currentPage === 1));

        let startPage, endPage;
        if (pageCount <= maxPageNumbers) {
            // Se o total de páginas for menor ou igual ao limite, mostra todas
            startPage = 1;
            endPage = pageCount;
        } else {
            // Calcula o início e o fim da janela de páginas
            const half = Math.floor((maxPageNumbers - 2) / 2); // -2 para guardar espaço para '1...' e '...N'
            startPage = currentPage - half;
            endPage = currentPage + half;

            if (currentPage < maxPageNumbers / 2) {
                startPage = 1;
                endPage = maxPageNumbers -1;
            }
            
            if (currentPage > pageCount - maxPageNumbers / 2) {
                startPage = pageCount - maxPageNumbers + 2;
                endPage = pageCount;
            }
        }

        // Link para a primeira página e reticências (se necessário)
        if (startPage > 1) {
            paginationControls.appendChild(createPageLink(1, '1'));
            if (startPage > 2) {
                paginationControls.appendChild(createPageLink(0, '...', true));
            }
        }

        // Números de página na janela calculada
        for (let i = startPage; i <= endPage; i++) {
             if (i > 0 && i <= pageCount) {
                paginationControls.appendChild(createPageLink(i, i, false, i === currentPage));
             }
        }

        // Reticências e link para a última página (se necessário)
        if (endPage < pageCount) {
            if (endPage < pageCount - 1) {
                paginationControls.appendChild(createPageLink(0, '...', true));
            }
            paginationControls.appendChild(createPageLink(pageCount, pageCount));
        }

        // Botão "Próxima"
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
            // Não esconde automaticamente mensagens de erro ou aviso
            if (type === 'success' || type === 'info') {
                setTimeout(() => {
                    // Só esconde se a mensagem ainda for a mesma
                    if (messageArea.innerHTML === message) {
                        messageArea.classList.add('d-none');
                    }
                }, 8000);
            }
        }
    }

    function formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        // Corrige o problema de fuso horário que subtrai um dia
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
        return unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});