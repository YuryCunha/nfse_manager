// nfse_manager/js/consulta_api.js
document.addEventListener('DOMContentLoaded', function () {
    // --- Referências aos elementos da interface ---
    const btnConsultar = document.getElementById('btnConsultarApi');
    const tableBody = document.getElementById('apiNotesTableBody');
    const resultsCard = document.getElementById('resultsCardApi');
    const messageArea = document.getElementById('apiMessageArea');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.querySelector('#loadingOverlay p');
    const paginationControls = document.getElementById('paginationControls'); 

    const cnpjFilter = document.getElementById('cnpjFilter');
    const dataInicialInput = document.getElementById('dataInicial');
    const dataFinalInput = document.getElementById('dataFinal');
    const apiSearchFilter = document.getElementById('apiSearchFilter');
    const apiSituacaoFilter = document.getElementById('apiSituacaoFilter');

    // --- Variáveis de estado ---
    let isFetching = false;
    let completeNoteList = [];
    let currentPage = 1;
    const notesPerPage = 25;

    // --- Funções Principais ---
    const handleFetch = async () => {
        if (isFetching) return;
        setLoadingState(true, 'Consultando, por favor aguarde...');
        resetState();

        const selectedCnpj = cnpjFilter.value;
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

    const fetchSingleCnpj = async (cpfCnpj) => {
        const option = cnpjFilter.querySelector(`option[value="${cpfCnpj}"]`);
        const nomeFantasia = option ? option.dataset.nomeFantasia : cpfCnpj;
        setLoadingState(true, `Buscando notas para ${nomeFantasia}...`);

        try {
            completeNoteList = await fetchAllPagesForCnpj(cpfCnpj, nomeFantasia);
            showMessage(`Consulta concluída. ${completeNoteList.length} notas encontradas.`, 'success');
        } catch (error) {
            showMessage(`Erro ao consultar CNPJ ${cpfCnpj}: ${error.message}`, 'danger');
        } finally {
            sortAndRenderPage();
        }
    };
    
    const fetchAllSequentially = async () => {
        const cnpjsToFetch = Array.from(cnpjFilter.options)
            .map(opt => ({ value: opt.value, name: opt.dataset.nomeFantasia }))
            .filter(opt => opt.value && opt.value !== 'all' && opt.value !== '');
        
        let totalFetched = 0;
        
        for (let i = 0; i < cnpjsToFetch.length; i++) {
            const cnpjInfo = cnpjsToFetch[i];
            setLoadingState(true, `Buscando CNPJ ${i + 1} de ${cnpjsToFetch.length}: ${cnpjInfo.name}`);
            
            try {
                const notesForCnpj = await fetchAllPagesForCnpj(cnpjInfo.value, cnpjInfo.name);
                if (notesForCnpj.length > 0) {
                    completeNoteList.push(...notesForCnpj);
                    totalFetched += notesForCnpj.length;
                }
            } catch (error) {
                console.warn(`Falha ao buscar notas para o CNPJ ${cnpjInfo.value}: ${error.message}`);
            }
        }
        
        showMessage(`Busca concluída! ${totalFetched} notas encontradas em ${cnpjsToFetch.length} CNPJs.`, 'success');
        sortAndRenderPage();
    };

    const fetchAllPagesForCnpj = async (cpfCnpj, nomeFantasia) => {
        let notesForCnpj = [];
        let currentHash = null;
        let keepFetching = true;

        while (keepFetching) {
            try {
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
        completeNoteList.sort((a, b) => {
            const dateA = new Date(a.emissao.split('/').reverse().join('-') + 'T00:00:00').getTime();
            const dateB = new Date(b.emissao.split('/').reverse().join('-') + 'T00:00:00').getTime();
            return dateB - dateA;
        });
        currentPage = 1;
        renderPage();
    };

    const renderPage = () => {
        const searchValue = apiSearchFilter.value.toLowerCase().trim();
        const situacaoValue = apiSituacaoFilter.value;
        let filteredNotes = completeNoteList;

        if (situacaoValue) {
            filteredNotes = filteredNotes.filter(note => note.situacao === situacaoValue);
        }
        if (searchValue) {
            filteredNotes = filteredNotes.filter(note => 
                (note.numero && note.numero.toString().toLowerCase().includes(searchValue)) ||
                (note.prestadorCnpj && note.prestadorCnpj.toLowerCase().includes(searchValue)) ||
                (note.valorServico && note.valorServico.toString().includes(searchValue)) ||
                (note.idIntegracao && note.idIntegracao.toLowerCase().includes(searchValue))
            );
        }

        if (completeNoteList.length > 0) {
            resultsCard.classList.remove('d-none');
        } else {
             resultsCard.classList.add('d-none');
        }
        
        updatePagination(filteredNotes);
        renderNotesTable(filteredNotes);
    };

    const renderNotesTable = (notes) => {
        tableBody.innerHTML = '';
        const startIndex = (currentPage - 1) * notesPerPage;
        const endIndex = startIndex + notesPerPage;
        const paginatedNotes = notes.slice(startIndex, endIndex);

        if (paginatedNotes.length === 0) {
            const message = completeNoteList.length > 0 ? 'Nenhuma nota encontrada com os filtros aplicados.' : 'Nenhuma nota encontrada para o período selecionado.';
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center">${message}</td></tr>`;
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
            tableBody.appendChild(row);
        });
    };
    
    const updatePagination = (filteredNotes) => {
        const pageCount = Math.ceil(filteredNotes.length / notesPerPage);
        paginationControls.innerHTML = '';
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

        paginationControls.appendChild(createPageLink(currentPage - 1, 'Anterior', currentPage === 1));
        
        let startPage, endPage;
        if (pageCount <= 6) {
            startPage = 1; endPage = pageCount;
        } else {
            if (currentPage <= 4) { startPage = 1; endPage = 5; } 
            else if (currentPage + 2 >= pageCount) { startPage = pageCount - 4; endPage = pageCount; } 
            else { startPage = currentPage - 2; endPage = currentPage + 2; }
        }
        
        if (startPage > 1) {
            paginationControls.appendChild(createPageLink(1, 1));
            if (startPage > 2) paginationControls.appendChild(createPageLink(0, '...', true));
        }

        for (let i = startPage; i <= endPage; i++) {
             paginationControls.appendChild(createPageLink(i, i, false, i === currentPage));
        }

        if (endPage < pageCount) {
            if (endPage < pageCount - 1) paginationControls.appendChild(createPageLink(0, '...', true));
            paginationControls.appendChild(createPageLink(pageCount, pageCount));
        }
        
        paginationControls.appendChild(createPageLink(currentPage + 1, 'Próxima', currentPage === pageCount));
    };

    // --- Funções Auxiliares ---
    const resetState = () => {
        completeNoteList = [];
        currentPage = 1;
        apiSearchFilter.value = '';
        apiSituacaoFilter.value = '';
        tableBody.innerHTML = '';
        paginationControls.innerHTML = '';
        resultsCard.classList.add('d-none');
    };

    const setLoadingState = (loading, text = 'Carregando...') => {
        isFetching = loading;
        loadingOverlay.classList.toggle('d-none', !loading);
        loadingText.textContent = text;
    };

    // **CORRIGIDO: A função agora recebe rps, serie e cnpj**
    window.requeueNote = async (rps, serie, cnpj) => {
        if (!confirm(`Tem certeza que deseja reenviar a nota (RPS: ${rps}, Série: ${serie}) para a fila de pendentes?`)) return;
        
        showMessage('Reenfileirando nota...', 'info');
        try {
            const response = await fetch('requeue_note.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                // **CORRIGIDO: Enviando os parâmetros corretos para o backend**
                body: JSON.stringify({ rps, serie, cnpj })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Erro desconhecido');
            }
            
            showMessage(data.message, 'success');
            // Remove a nota da lista visual para evitar confusão.
            // A busca agora é pelo conjunto rps, serie, cnpj.
            completeNoteList = completeNoteList.filter(note => 
                !(note.numero == rps && note.serie == serie && note.prestadorCnpj == cnpj)
            );
            sortAndRenderPage();
        } catch (error) {
            showMessage(`Falha ao reenfileirar: ${error.message}`, 'danger');
        }
    };
    
    // **CORRIGIDO: Passa os parâmetros corretos para a função requeueNote**
    const getActionButtons = (nota) => {
        if (nota.situacao === 'REJEITADO') {
            return `<button onclick="requeueNote('${nota.numero}', '${nota.serie}', '${nota.prestadorCnpj}')" class="btn btn-sm btn-outline-primary" title="Coloca a nota de volta na fila de pendentes"><i class="bi bi-arrow-clockwise"></i> Reenviar</button>`;
        } else if (nota.situacao === 'PROCESSANDO') {
            return `<a href="download_file.php?id=${nota.id}&type=rps" target="_blank" class="btn btn-sm btn-info" title="Baixar Recibo Provisório"><i class="bi bi-file-earmark-text"></i> Recibo</a>`;
        } else if (nota.situacao === 'CONCLUIDO' || nota.situacao === 'CANCELADO') {
            return `<div class="btn-group">
                <a href="download_file.php?id=${nota.id}&type=pdf" target="_blank" class="btn btn-sm btn-danger" title="Baixar PDF"><i class="bi bi-file-earmark-pdf"></i></a>
                <a href="download_file.php?id=${nota.id}&type=xml" target="_blank" class="btn btn-sm btn-secondary" title="Baixar XML"><i class="bi bi-filetype-xml"></i></a>
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
        messageArea.className = `alert alert-${type} mt-3`;
        messageArea.textContent = message;
        messageArea.classList.toggle('d-none', hide || !message);
    };

    const formatCurrency = (value) => {
        if (typeof value !== 'number') return 'N/A';
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const makeApiCall = async (url) => {
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || `Erro HTTP ${response.status}`);
        return data;
    };
    
    const buildApiUrl = (cpfCnpj, hash = null) => {
        let url = `get_api_notes.php?cpfCnpj=${cpfCnpj}&dataInicial=${dataInicialInput.value}&dataFinal=${dataFinalInput.value}`;
        if (hash) url += `&hashProximaPagina=${hash}`;
        return url;
    };

    const validateInputs = (selectedCnpj) => {
        if (!selectedCnpj) {
            showMessage('Por favor, selecione um CNPJ ou a opção "Buscar Todos".', 'warning');
            return false;
        }
        const date1 = new Date(dataInicialInput.value);
        const date2 = new Date(dataFinalInput.value);
        if (Math.ceil(Math.abs(date2 - date1) / (1000 * 60 * 60 * 24)) > 31) {
            showMessage('O intervalo máximo de consulta é de 31 dias.', 'danger');
            return false;
        }
        return true;
    };
    
    // --- Event Listeners ---
    btnConsultar.addEventListener('click', () => handleFetch());
    apiSearchFilter.addEventListener('input', () => { currentPage = 1; renderPage(); });
    apiSituacaoFilter.addEventListener('change', () => { currentPage = 1; renderPage(); });
});