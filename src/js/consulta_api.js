// src/js/consulta_api.js
document.addEventListener('DOMContentLoaded', function () {
    // --- Referências aos elementos da interface ---
    const ui = {
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

    // --- Variáveis de estado ---
    let state = {
        isFetching: false,
        completeNoteList: [],
        currentPage: 1,
        notesPerPage: 25,
    };

    // --- Funções Principais ---

    /**
     * Orquestra a busca de notas, decidindo entre busca única ou múltipla.
     */
    const handleFetch = async () => {
        if (state.isFetching) return;
        setLoadingState(true, 'Validando e iniciando consulta...');
        resetState();

        const selectedCnpj = ui.cnpjFilter.value;
        if (!validateInputs(selectedCnpj)) {
            setLoadingState(false);
            return;
        }

        if (selectedCnpj === 'all') {
            await fetchAllSequentially();
        } else {
            await fetchSingleCnpj(selectedCnpj);
        }
        
        setLoadingState(false);
    };

    /**
     * Busca todas as páginas de notas para um único CNPJ.
     */
    const fetchSingleCnpj = async (cpfCnpj) => {
        const option = ui.cnpjFilter.querySelector(`option[value="${cpfCnpj}"]`);
        const nomeFantasia = option ? option.dataset.nomeFantasia : cpfCnpj;
        setLoadingState(true, `Buscando notas para ${nomeFantasia}...`);

        try {
            state.completeNoteList = await fetchAllPagesForCnpj(cpfCnpj, nomeFantasia);
            showMessage(`Consulta concluída. ${state.completeNoteList.length} notas encontradas.`, 'success');
        } catch (error) {
            showMessage(`Erro ao consultar CNPJ ${cpfCnpj}: ${error.message}`, 'danger');
        } finally {
            sortAndRenderPage();
        }
    };
    
    /**
     * Busca todas as notas de todos os CNPJs de forma sequencial, página por página.
     */
    const fetchAllSequentially = async () => {
        const cnpjsToFetch = Array.from(ui.cnpjFilter.options)
            .map(opt => ({ value: opt.value, name: opt.dataset.nomeFantasia }))
            .filter(opt => opt.value && opt.value !== 'all' && opt.value !== '');
        
        for (let i = 0; i < cnpjsToFetch.length; i++) {
            const cnpjInfo = cnpjsToFetch[i];
            setLoadingState(true, `Buscando CNPJ ${i + 1} de ${cnpjsToFetch.length}: ${cnpjInfo.name}`);
            try {
                const notesForCnpj = await fetchAllPagesForCnpj(cnpjInfo.value, cnpjInfo.name);
                if (notesForCnpj.length > 0) {
                    state.completeNoteList.push(...notesForCnpj);
                }
            } catch (error) {
                console.warn(`Falha ao buscar notas para o CNPJ ${cnpjInfo.value}: ${error.message}`);
            }
        }
        
        showMessage(`Busca concluída! ${state.completeNoteList.length} notas encontradas em ${cnpjsToFetch.length} CNPJs.`, 'success');
        sortAndRenderPage();
    };

    /**
     * Loop que busca todas as páginas de um CNPJ usando o hash.
     */
    const fetchAllPagesForCnpj = async (cpfCnpj, nomeFantasia) => {
        let notesForCnpj = [];
        let currentHash = null;
        let keepFetching = true;
        let page = 1;

        while (keepFetching) {
            try {
                // Atualiza o status para o usuário, indicando a página
                setLoadingState(true, `Buscando ${nomeFantasia} (página ${page})...`);

                const data = await makeApiCall(buildApiUrl(cpfCnpj, currentHash));
                if (data.notas && data.notas.length > 0) {
                    data.notas.forEach(n => {
                        n.nomeFantasia = nomeFantasia;
                        n.prestadorCnpj = n.prestador;
                    });
                    notesForCnpj.push(...data.notas);
                }
                
                if (data.hashProximaPagina) {
                    currentHash = data.hashProximaPagina;
                    page++;
                    // Pausa de 1 segundo para não sobrecarregar a API
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    keepFetching = false;
                }
            } catch (error) {
                console.error(`Erro na paginação para ${cpfCnpj}:`, error);
                keepFetching = false; 
            }
        }
        return notesForCnpj;
    };

    // --- Funções de Renderização e UI ---

    const sortAndRenderPage = () => {
        state.completeNoteList.sort((a, b) => new Date(b.emissao.split('/').reverse().join('-')) - new Date(a.emissao.split('/').reverse().join('-')));
        state.currentPage = 1;
        renderPage();
    };

    const renderPage = () => {
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

        populateSituacaoFilter(state.completeNoteList);
        updateSummary(filteredNotes);
        updatePagination(filteredNotes);
        renderNotesTable(filteredNotes);
    };

    const renderNotesTable = (notes) => {
        ui.tableBody.innerHTML = '';
        const startIndex = (state.currentPage - 1) * state.notesPerPage;
        const endIndex = startIndex + state.notesPerPage;
        const paginatedNotes = notes.slice(startIndex, endIndex);

        if (paginatedNotes.length === 0) {
            const message = state.completeNoteList.length > 0 ? 'Nenhuma nota encontrada com os filtros aplicados.' : 'Nenhuma nota encontrada para o período selecionado.';
            ui.tableBody.innerHTML = `<tr><td colspan="7" class="text-center">${message}</td></tr>`;
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
            ui.tableBody.appendChild(row);
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
            a.className = 'page-link';
            a.href = '#';
            a.textContent = text || page;
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

        paginationControls.appendChild(createPageLink(state.currentPage - 1, 'Anterior', state.currentPage === 1));
        
        let startPage, endPage;
        if (pageCount <= 6) {
            startPage = 1; endPage = pageCount;
        } else {
            if (state.currentPage <= 4) { startPage = 1; endPage = 5; } 
            else if (state.currentPage + 2 >= pageCount) { startPage = pageCount - 4; endPage = pageCount; } 
            else { startPage = state.currentPage - 2; endPage = state.currentPage + 2; }
        }
        
        if (startPage > 1) {
            paginationControls.appendChild(createPageLink(1, 1));
            if (startPage > 2) paginationControls.appendChild(createPageLink(0, '...', true));
        }

        for (let i = startPage; i <= endPage; i++) {
             paginationControls.appendChild(createPageLink(i, i, false, i === state.currentPage));
        }

        if (endPage < pageCount) {
            if (endPage < pageCount - 1) paginationControls.appendChild(createPageLink(0, '...', true));
            paginationControls.appendChild(createPageLink(pageCount, pageCount));
        }
        
        paginationControls.appendChild(createPageLink(state.currentPage + 1, 'Próxima', state.currentPage === pageCount));
    };

    const populateSituacaoFilter = (notes) => {
        const uniqueSituacoes = [...new Set(notes.map(note => note.situacao))].sort();
        const currentSelection = ui.apiSituacaoFilter.value;
        ui.apiSituacaoFilter.innerHTML = '<option value="">Todos os Status</option>';
        uniqueSituacoes.forEach(s => {
            const option = new Option(s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(), s);
            ui.apiSituacaoFilter.add(option);
        });
        ui.apiSituacaoFilter.value = currentSelection;
    };

    const updateSummary = (notes) => {
        ui.totalNotesCount.textContent = notes.length;
        const totalValue = notes.reduce((sum, note) => sum + (note.valorServico || 0), 0);
        ui.totalNotesValue.textContent = formatCurrency(totalValue);
    };

    // --- Funções Auxiliares ---
    const resetState = () => {
        state.completeNoteList = [];
        state.currentPage = 1;
        ui.apiSearchFilter.value = '';
        ui.apiSituacaoFilter.innerHTML = '<option value="">Todos os Status</option>';
        ui.tableBody.innerHTML = '';
        ui.paginationControls.innerHTML = '';
        ui.resultsCard.classList.add('d-none');
        ui.summaryCard.classList.add('d-none');
    };

    const setLoadingState = (loading, text = 'Carregando...') => {
        state.isFetching = loading;
        ui.loadingOverlay.classList.toggle('d-none', !loading);
        ui.filterFieldset.disabled = loading;
        ui.loadingText.textContent = text;
    };

    window.requeueNote = async (rps, serie, cnpj) => {
        if (!confirm(`Tem certeza que deseja reenviar a nota (RPS: ${rps}, Série: ${serie}) para a fila de pendentes?`)) return;
        showMessage('Reenfileirando nota...', 'info');
        try {
            const response = await fetch('../Components/API/requeue_note.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rps, serie, cnpj })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Erro desconhecido');
            
            showMessage(data.message, 'success');
            state.completeNoteList = state.completeNoteList.filter(note => 
                !(note.numero == rps && note.serie == serie && note.prestadorCnpj == cnpj)
            );
            sortAndRenderPage();
        } catch (error) {
            showMessage(`Falha ao reenfileirar: ${error.message}`, 'danger');
        }
    };
    
    const getActionButtons = (nota) => {
        if (nota.situacao === 'REJEITADO') {
            return `<button onclick="requeueNote('${nota.numero}', '${nota.serie}', '${nota.prestadorCnpj}')" class="btn btn-sm btn-outline-primary" title="Coloca a nota de volta na fila de pendentes"><i class="bi bi-arrow-clockwise"></i> Reenviar</button>`;
        } else if (nota.situacao === 'PROCESSANDO') {
            return `<a href="../Components/API/download_file.php?id=${nota.id}&type=rps" target="_blank" class="btn btn-sm btn-info" title="Baixar Recibo Provisório"><i class="bi bi-file-earmark-text"></i> Recibo</a>`;
        } else if (nota.situacao === 'CONCLUIDO' || nota.situacao === 'CANCELADO') {
            return `<div class="btn-group">
                <a href="../Components/API/download_file.php?id=${nota.id}&type=pdf" target="_blank" class="btn btn-sm btn-danger" title="Baixar PDF"><i class="bi bi-file-earmark-pdf"></i></a>
                <a href="../Components/API/download_file.php?id=${nota.id}&type=xml" target="_blank" class="btn btn-sm btn-secondary" title="Baixar XML"><i class="bi bi-filetype-xml"></i></a>
            </div>`;
        }
        return '';
    };

    const getSituacaoBadge = (situacao) => {
        const config = {
            CONCLUIDO: { color: 'success', icon: 'bi-check-circle' }, CANCELADO: { color: 'danger', icon: 'bi-x-circle' },
            PROCESSANDO: { color: 'primary', icon: 'bi-arrow-repeat' }, REJEITADO: { color: 'warning', icon: 'bi-exclamation-triangle' },
            DENEGADO: { color: 'warning', icon: 'bi-exclamation-triangle' }, SUBSTITUIDO: { color: 'info', icon: 'bi-arrow-left-right' }
        };
        const { color = 'secondary', icon = 'bi-question-circle' } = config[situacao] || {};
        return `<span class="badge rounded-pill text-bg-${color} situacao-badge d-flex align-items-center"><i class="bi ${icon} me-1"></i> ${situacao || 'DESCONHECIDO'}</span>`;
    };

    const showMessage = (message, type = 'info', hide = false) => {
        ui.messageArea.className = `alert alert-${type} mt-3`;
        ui.messageArea.textContent = message;
        ui.messageArea.classList.toggle('d-none', hide || !message);
    };

    const formatCurrency = (value) => {
        if (typeof value !== 'number') return 'N/A';
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const makeApiCall = async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: `Erro HTTP ${response.status}` } }));
            throw new Error(errorData.error?.message || `Erro HTTP ${response.status}`);
        }
        return response.json();
    };
    
    const buildApiUrl = (cpfCnpj, hash = null) => {
        let url = `../Components/API/get_api_notes.php?cpfCnpj=${cpfCnpj}&dataInicial=${ui.dataInicialInput.value}&dataFinal=${ui.dataFinalInput.value}`;
        if (hash) url += `&hashProximaPagina=${hash}`;
        return url;
    };

    const validateInputs = (selectedCnpj) => {
        if (!selectedCnpj) {
            showMessage('Por favor, selecione um CNPJ ou a opção "Buscar Todos".', 'warning');
            return false;
        }
        const date1 = new Date(ui.dataInicialInput.value);
        const date2 = new Date(ui.dataFinalInput.value);
        if (Math.ceil(Math.abs(date2 - date1) / (1000 * 60 * 60 * 24)) > 31) {
            showMessage('O intervalo máximo de consulta é de 31 dias.', 'danger');
            return false;
        }
        return true;
    };
    
    // --- Event Listeners ---
    ui.btnConsultar.addEventListener('click', () => handleFetch());
    ui.apiSearchFilter.addEventListener('input', () => { state.currentPage = 1; renderPage(); });
    ui.apiSituacaoFilter.addEventListener('change', () => { state.currentPage = 1; renderPage(); });
});