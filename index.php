<?php
// index.php
require_once 'Components/Config/config.php';
require_once 'Components/Config/functions.php';

$db = getDbConnection();
$cnpjs_data = $db ? getAllowedCnpjs($db) : [];
?>
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gerenciador de NFSe - SESC RJ</title>
    <link href="src/bootstrap/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="../src/bootstrap/bootstrap-icons.min.css">
    <link rel="stylesheet" href="src/css/custom.css">
    <style>
        .description-truncate {
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        body {
            padding-bottom: 80px;
        }
    </style>
</head>

<body>
    <header class="p-3 mb-3 border-bottom">
        <div class="container">
            <div class="d-flex flex-wrap align-items-center justify-content-between">
                <a href="index.php" class="d-flex align-items-center mb-2 mb-lg-0 text-dark text-decoration-none">
                    <img src="src/img/logo.svg" alt="SESC RJ Logo" height="40">
                </a>
                <div class="d-flex flex-wrap align-items-center justify-content-center gap-2">
                    <a href="Components/Views/consulta_api.php" class="btn btn-primary">
                        <i class="bi bi-cloud-arrow-down me-1"></i> Consulta via API
                    </a>
                    <a href="debug/check_db.php" class="btn btn-outline-secondary">
                        <i class="bi bi-hdd-stack"></i> Teste de Banco
                    </a>
                    <a href="debug/check_api.php" class="btn btn-outline-secondary">
                        <i class="bi bi-cloud-check"></i> Teste de API
                    </a>
                </div>
            </div>
        </div>
    </header>

    <main class="container py-4">
        <div class="card mb-4 shadow-sm rounded-4">
            <div class="card-header bg-primary text-white rounded-4">
                <h2 class="card-title h5 mb-0"><i class="bi bi-database me-2"></i>Consultar Notas Fiscais (Banco de
                    Dados Local)</h2>
            </div>
            <div class="card-body">
                <div class="row g-3 align-items-end">
                    <div class="col-md-4">
                        <label for="startDate" class="form-label">Data Início:</label>
                        <input type="date" class="form-control" id="startDate" value="<?php echo date('Y-m-01'); ?>">
                    </div>
                    <div class="col-md-4">
                        <label for="endDate" class="form-label">Data Fim:</label>
                        <input type="date" class="form-control" id="endDate" value="<?php echo date('Y-m-d'); ?>">
                    </div>
                    <div class="col-md-4">
                        <label for="statusFilter" class="form-label">Status:</label>
                        <select id="statusFilter" class="form-select">
                            <option value="pending">Pendentes de Envio</option>
                            <option value="sent">Já Enviadas</option>
                        </select>
                    </div>
                </div>

                <div class="accordion mt-3" id="inclusionAccordion">
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="headingInclusion">
                            <button class="accordion-button" type="button" data-bs-toggle="collapse"
                                data-bs-target="#collapseInclusion" aria-expanded="true"
                                aria-controls="collapseInclusion">
                                Seleção de CNPJs (<span id="includedCount">0</span> selecionados)
                            </button>
                        </h2>
                        <div id="collapseInclusion" class="accordion-collapse collapse show"
                            aria-labelledby="headingInclusion">
                            <div class="accordion-body">
                                <div class="d-flex justify-content-end mb-2">
                                    <button class="btn btn-sm btn-outline-primary me-2" id="btnSelectAllCnpjs">Marcar
                                        Todos</button>
                                    <button class="btn btn-sm btn-outline-secondary" id="btnClearAllCnpjs">Limpar
                                        Seleção</button>
                                </div>
                                <div id="cnpjInclusionList"
                                    style="max-height: 200px; overflow-y: auto; border: 1px solid #dee2e6; padding: 10px; border-radius: .25rem;">
                                    <?php if (!empty($cnpjs_data)): ?>
                                        <?php foreach ($cnpjs_data as $empresa): ?>
                                            <div class="form-check">
                                                <input class="form-check-input cnpj-include-checkbox" type="checkbox"
                                                    value="<?php echo htmlspecialchars($empresa['cpf_cnpj']); ?>"
                                                    id="include-<?php echo htmlspecialchars($empresa['cpf_cnpj']); ?>">
                                                <label class="form-check-label"
                                                    for="include-<?php echo htmlspecialchars($empresa['cpf_cnpj']); ?>">
                                                    <?php echo htmlspecialchars($empresa['nome_fantasia']); ?>
                                                </label>
                                            </div>
                                        <?php endforeach; ?>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="row g-3 mt-3">
                    <div class="col-md-8">
                        <button type="button" class="btn btn-primary w-100" id="btnConsult">Consultar Banco</button>
                    </div>
                    <div class="col-md-4">
                        <button type="button" class="btn btn-warning w-100" id="btnSendAllPending">Enviar
                            Pendentes</button>
                    </div>
                </div>
                <div id="loadingIndicator" class="text-center mt-3 d-none">
                    <div class="spinner-border text-primary" role="status"><span
                            class="visually-hidden">Carregando...</span></div>
                    <p class="mt-2">Carregando notas...</p>
                </div>
                <div id="messageArea" class="alert mt-3 d-none" role="alert"></div>
            </div>
        </div>
        <div class="card shadow-sm rounded-4 d-none" id="resultsCard">
            <div class="card-header bg-light rounded-4">
                <div class="row align-items-center">
                    <div class="col-md-4">
                        <h3 class="card-title h5 mb-0" id="notesListTitle">Notas Fiscais</h3>
                    </div>
                    <div class="col-md-4"><input type="text" class="form-control form-control-sm" id="rpsFilter"
                            placeholder="Filtrar por RPS..."></div>
                    <div class="col-md-4"><input type="text" class="form-control form-control-sm" id="serieFilter"
                            placeholder="Filtrar por Série..."></div>
                </div>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped table-hover table-sm">
                        <thead>
                            <tr>
                                <th>RPS</th>
                                <th>Série</th>
                                <th>CNPJ Prestador</th>
                                <th>Data Emissão</th>
                                <th>Valor Total</th>
                                <th style="width: 25%;">Serviço</th>
                                <th>Status</th>
                                <th style="width: 15%;">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="notesTableBody"></tbody>
                    </table>
                </div>
                <p class="text-muted mt-3" id="notesCount">Total de notas: 0</p>
                <nav aria-label="Page navigation" class="mt-3">
                    <ul class="pagination justify-content-center" id="paginationControls"></ul>
                </nav>
            </div>
        </div>
    </main>
    <footer class="py-3 mt-4">
        <div class="container text-center">
            <p class="mb-0 text-muted">&copy; <?php echo date('Y'); ?> SESC RJ. Todos os direitos reservados.</p>
        </div>
    </footer>

    <script src="src/bootstrap/js/bootstrap.bundle.min.js"></script>
    <script type="module" src="src/js/gerenciador/main.js"></script>
</body>

</html>