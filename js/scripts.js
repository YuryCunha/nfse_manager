// js/scripts.js

let allNotes = []; // To store all fetched notes for pagination
let currentPage = 1;
const notesPerPage = 10; // You can adjust this number

document.addEventListener('DOMContentLoaded', () => {
    const btnConsultPending = document.getElementById('btnConsultPending');
    const btnConsultSent = document.getElementById('btnConsultSent');
    const btnSendAllPending = document.getElementById('btnSendAllPending');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const notesTableBody = document.getElementById('notesTableBody');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const messageArea = document.getElementById('messageArea');
    const notesCountElement = document.getElementById('notesCount');
    const paginationControls = document.getElementById('paginationControls');

    btnConsultPending.addEventListener('click', () => fetchNotes('pending'));
    btnConsultSent.addEventListener('click', () => fetchNotes('sent'));
    btnSendAllPending.addEventListener('click', sendAllPendingNotes);

    async function fetchNotes(status) {
        loadingIndicator.classList.remove('d-none');
        messageArea.classList.add('d-none');
        notesTableBody.innerHTML = '<tr><td colspan="8" class="text-center">Carregando...</td></tr>';
        notesCountElement.textContent = 'Total de notas: 0';
        paginationControls.innerHTML = ''; // Clear existing pagination

        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        try {
            const response = await fetch(`api.php?action=get${status === 'pending' ? 'Pending' : 'Sent'}Notes&startDate=${startDate}&endDate=${endDate}`);
            const data = await response.json();

            if (data.status === 'success') {
                allNotes = data.notes; // Store all notes
                notesCountElement.textContent = `Total de notas: ${allNotes.length}`;
                currentPage = 1; // Reset to first page
                renderTable();
            } else {
                showMessage(data.message, 'alert-danger');
                notesTableBody.innerHTML = '<tr><td colspan="8" class="text-center">Erro ao carregar notas.</td></tr>';
            }
        } catch (error) {
            console.error('Fetch error:', error);
            showMessage('Erro de rede ao consultar notas.', 'alert-danger');
            notesTableBody.innerHTML = '<tr><td colspan="8" class="text-center">Erro ao carregar notas.</td></tr>';
        } finally {
            loadingIndicator.classList.add('d-none');
        }
    }

    function renderTable() {
        notesTableBody.innerHTML = ''; // Clear current table body

        if (allNotes.length === 0) {
            notesTableBody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhuma nota encontrada.</td></tr>';
            paginationControls.innerHTML = ''; // Hide pagination if no notes
            return;
        }

        const startIndex = (currentPage - 1) * notesPerPage;
        const endIndex = startIndex + notesPerPage;
        const notesToDisplay = allNotes.slice(startIndex, endIndex);

        notesToDisplay.forEach(note => {
            const row = `
                <tr>
                    <td>${note.nr_rps}</td>
                    <td>${note.serie}</td>
                    <td>${note.cnpj_prestador}</td>
                    <td>${new Date(note.dt_emissao).toLocaleDateString()}</td>
                    <td>R$ ${parseFloat(note.vl_total).toFixed(2)}</td>
                    <td><div class="description-truncate" title="${note.desc_servico}">${note.desc_servico}</div></td>
                    <td>${note.st_extracao === '1' ? 'Enviada' : 'Pendente'}</td>
                    <td>
                        <button class="btn btn-primary btn-sm btn-send-note" data-rps="${note.nr_rps}" data-serie="${note.serie}" data-cnpj="${note.cnpj_prestador}">Enviar</button>
                    </td>
                </tr>
            `;
            notesTableBody.innerHTML += row;
        });

        addSendButtonListeners(); // Re-attach listeners after rendering
        renderPagination();
    }

    function renderPagination() {
        paginationControls.innerHTML = '';
        const totalPages = Math.ceil(allNotes.length / notesPerPage);
        const maxPagesToShow = 5; // Define how many page numbers to show
    
        if (totalPages <= 1) {
            return; // No pagination needed for 1 or fewer pages
        }
    
        // Determine the start and end page numbers to display
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
        // Adjust startPage if we hit the end of the pages
        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
    
        // Previous button
        let prevClass = 'page-item';
        if (currentPage === 1) prevClass += ' disabled';
        paginationControls.innerHTML += `<li class="${prevClass}"><a class="page-link" href="#" data-page="${currentPage - 1}">Anterior</a></li>`;
    
        // First page link (if not within the displayed range)
        if (startPage > 1) {
            paginationControls.innerHTML += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
            if (startPage > 2) {
                paginationControls.innerHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
        }
    
        // Page numbers within the calculated range
        for (let i = startPage; i <= endPage; i++) {
            let pageClass = 'page-item';
            if (i === currentPage) pageClass += ' active';
            paginationControls.innerHTML += `<li class="${pageClass}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
        }
    
        // Last page link (if not within the displayed range)
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationControls.innerHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
            paginationControls.innerHTML += `<li class="page-item"><a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a></li>`;
        }
    
        // Next button
        let nextClass = 'page-item';
        if (currentPage === totalPages) nextClass += ' disabled';
        paginationControls.innerHTML += `<li class="${nextClass}"><a class="page-link" href="#" data-page="${currentPage + 1}">Próxima</a></li>`;
    
        // Add event listeners to pagination links
        paginationControls.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const newPage = parseInt(e.target.dataset.page);
                if (!isNaN(newPage) && newPage > 0 && newPage <= totalPages && newPage !== currentPage) {
                    currentPage = newPage;
                    renderTable();
                }
            });
        });
    }

    function addSendButtonListeners() {
        document.querySelectorAll('.btn-send-note').forEach(button => {
            button.addEventListener('click', async (e) => {
                const rps = e.target.dataset.rps;
                const serie = e.target.dataset.serie;
                const cnpj = e.target.dataset.cnpj;

                const noteToSend = allNotes.find(note => note.nr_rps == rps && note.serie == serie && note.cnpj_prestador == cnpj);

                if (!noteToSend) {
                    showMessage('Nota não encontrada para envio.', 'alert-warning');
                    return;
                }

                e.target.disabled = true; // Disable button during send
                e.target.textContent = 'Enviando...';

                try {
                    const response = await fetch('api.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ action: 'sendNFSe', note: noteToSend }),
                    });
                    const data = await response.json();

                    if (data.status === 'success' || data.status === 'serie_registered') {
                        showMessage(data.message, 'alert-success');
                        // Re-fetch notes to update status
                        const currentStatusFilter = document.getElementById('btnConsultPending').classList.contains('active') ? 'pending' : 'sent';
                        fetchNotes(currentStatusFilter);
                    } else {
                        showMessage(data.message, 'alert-danger');
                        e.target.disabled = false;
                        e.target.textContent = 'Enviar';
                    }
                } catch (error) {
                    console.error('Send error:', error);
                    showMessage('Erro de rede ao enviar nota.', 'alert-danger');
                    e.target.disabled = false;
                    e.target.textContent = 'Enviar';
                }
            });
        });
    }

    async function sendAllPendingNotes() {
        const pendingNotes = allNotes.filter(note => note.st_extracao !== '1'); // Assuming '1' means sent

        if (pendingNotes.length === 0) {
            showMessage('Não há notas pendentes para enviar.', 'alert-info');
            return;
        }

        if (!confirm(`Tem certeza que deseja enviar ${pendingNotes.length} notas pendentes?`)) {
            return;
        }

        btnSendAllPending.disabled = true;
        btnSendAllPending.textContent = 'Enviando todas...';
        showMessage('Iniciando envio de todas as notas pendentes...', 'alert-info');

        for (const note of pendingNotes) {
            // Find the corresponding button in the current view and disable it
            const button = document.querySelector(`.btn-send-note[data-rps="${note.nr_rps}"][data-serie="${note.serie}"][data-cnpj="${note.cnpj_prestador}"]`);
            if (button) {
                button.disabled = true;
                button.textContent = 'Enviando...';
            }

            try {
                const response = await fetch('api.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ action: 'sendNFSe', note: note }),
                });
                const data = await response.json();

                if (data.status === 'success' || data.status === 'serie_registered') {
                    // Update the status visually or re-fetch for accuracy
                    showMessage(`RPS ${note.nr_rps} enviado: ${data.message}`, 'alert-success');
                } else {
                    showMessage(`Erro ao enviar RPS ${note.nr_rps}: ${data.message}`, 'alert-warning');
                }
            } catch (error) {
                console.error(`Erro ao enviar RPS ${note.nr_rps}:`, error);
                showMessage(`Erro de rede ao enviar RPS ${note.nr_rps}.`, 'alert-danger');
            }
            // Add a small delay to avoid overwhelming the server or API
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        showMessage('Processo de envio de notas pendentes concluído.', 'alert-info');
        btnSendAllPending.disabled = false;
        btnSendAllPending.textContent = 'Enviar Todas as Pendentes';
        fetchNotes('pending'); // Re-fetch pending notes after batch send
    }

    function showMessage(message, type = 'alert-info') {
        messageArea.className = `alert mt-3 ${type}`;
        messageArea.textContent = message;
        messageArea.classList.remove('d-none');
    }

    // Initial load (optional, e.g., consult pending notes on page load)
    fetchNotes('pending');
});