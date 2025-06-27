<?php
// nfse_manager/Components/Consulta/consulta_api.php
require_once '../../config.php';
require_once '../../functions.php';

$db = getDbConnection();
$cnpjs_data = $db ? getAllowedCnpjs($db) : [];
?>
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Consulta de NFSe via API - SESC RJ</title>
    <link href="../../src/bootstrap/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <link rel="stylesheet" href="../../css/custom.css">
    <style>
        body {
            padding-bottom: 80px;
        }

        .table-responsive {
            max-height: 70vh;
        }

        .situacao-badge {
            font-size: 0.85em;
        }

        #loadingOverlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(255, 255, 255, 0.8);
            z-index: 1050;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
        }
    </style>
</head>

<body>
    <header class="p-3 mb-3 border-bottom">
        <div class="container">
            <div class="d-flex flex-wrap align-items-center justify-content-between">
                <a href="../../index.php" class="d-flex align-items-center mb-2 mb-lg-0 text-dark text-decoration-none">
                    <img src="https://www.sescrio.org.br/wp-content/themes/theme-default/assets/images/logo.svg"
                        alt="SESC RJ Logo" height="40">
                </a>
                <a href="../../index.php" class="btn btn-outline-primary">
                    <i class="bi bi-arrow-left-circle me-2"></i>Voltar ao Gerenciador
                </a>
            </div>
        </div>
    </header>

    <main class="container py-4">
        <div class="card shadow-sm rounded-4 mb-4">
            <div class="card-header bg-primary text-white rounded-4">
                <h2 class="card-title h5 mb-0"><i class="bi bi-search me-2"></i>Consultar Notas por Período (API)</h2>
            </div>
            <div class="card-body">
                <div class="row g-3 align-items-end">
                    <div class="col-md-5">
                        <label for="cnpjFilter" class="form-label">Prestador (CNPJ):</label>
                        <select id="cnpjFilter" class="form-select">
                            <option value="">Selecione um CNPJ</option>
                            <option value="all" class="fw-bold">Buscar Todos os CNPJs</option>
                            <?php if (!empty($cnpjs_data)): ?>
                                <?php foreach ($cnpjs_data as $empresa): ?>
                                    <option value="<?php echo htmlspecialchars($empresa['cpf_cnpj']); ?>"
                                        data-nome-fantasia="<?php echo htmlspecialchars($empresa['nome_fantasia']); ?>">
                                        <?php echo htmlspecialchars($empresa['nome_fantasia']) . ' (' . htmlspecialchars($empresa['cpf_cnpj']) . ')'; ?>
                                    </option>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label for="dataInicial" class="form-label">Data Início:</label>
                        <input type="date" class="form-control" id="dataInicial"
                            value="<?php echo date('Y-m-d', strtotime('-30 days')); ?>">
                    </div>
                    <div class="col-md-3">
                        <label for="dataFinal" class="form-label">Data Fim:</label>
                        <input type="date" class="form-control" id="dataFinal" value="<?php echo date('Y-m-d'); ?>">
                    </div>
                    <div class="col-md-1">
                        <button type="button" class="btn btn-primary w-100" id="btnConsultarApi" title="Consultar"><i
                                class="bi bi-search"></i></button>
                    </div>
                </div>
                <div id="apiMessageArea" class="alert mt-3 d-none" role="alert"></div>
            </div>
        </div>

        <div class="card shadow-sm rounded-4 d-none" id="resultsCardApi">
            <div class="card-header bg-light">
                <h3 class="card-title h5 mb-0" id="apiNotesListTitle">Notas Fiscais Encontradas</h3>
            </div>
            <div class="card-body">
                <div class="row g-3 mb-3">
                    <div class="col-md-8">
                        <input type="text" class="form-control" id="apiSearchFilter"
                            placeholder="Buscar por RPS, CNPJ, Valor ou ID Integração...">
                    </div>
                    <div class="col-md-4">
                        <select id="apiSituacaoFilter" class="form-select">
                            <option value="">Todos os Status</option>
                            <option value="CONCLUIDO">Concluído</option>
                            <option value="PROCESSANDO">Processando</option>
                            <option value="REJEITADO">Rejeitado</option>
                            <option value="CANCELADO">Cancelado</option>
                            <option value="DENEGADO">Denegado</option>
                            <option value="SUBSTITUIDO">Substituído</option>
                        </select>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table table-striped table-hover table-sm align-middle">
                        <thead>
                            <tr>
                                <th>Situação</th>
                                <th>Emissão</th>
                                <th>Prestador</th>
                                <th>Nº RPS / NFSe</th>
                                <th>Tomador</th>
                                <th>Valor</th>
                                <th class="text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="apiNotesTableBody"></tbody>
                    </table>
                </div>

                <nav aria-label="Navegação de páginas de resultados">
                    <ul class="pagination justify-content-center" id="paginationControls">
                    </ul>
                </nav>

            </div>
        </div>
    </main>

    <div id="loadingOverlay" class="d-none">
        <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status"></div>
        <p class="mt-3 fs-5 text-primary">Consultando notas, por favor aguarde...</p>
    </div>

    <footer class="pt-3 mt-4">
        <p class="text-center text-muted">&copy; <?php echo date('Y'); ?> SESC RJ.</p>
    </footer>

    <script src="../../src/bootstrap/js/bootstrap.bundle.min.js"></script>
    <script src="../../js/consulta_api.js"></script>
</body>

</html>