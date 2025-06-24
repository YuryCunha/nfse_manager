<?php
// index.php
require_once 'config.php';
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gerenciador de NFSe - SESC RJ</title>
    <link href="src/bootstrap/css/bootstrap.min.css" rel="stylesheet" >
    <link rel="stylesheet" href="css/custom.css">
    <style>
        /* Custom CSS for description truncation */
        .description-truncate {
            display: -webkit-box;
            -webkit-line-clamp: 3; /* Limit to 3 lines */
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    </style>
</head>
<body>
    <header class="p-3 mb-3 border-bottom">
        <div class="container">
            <div class="d-flex flex-wrap align-items-center justify-content-center justify-content-lg-start">
                <a href="" class="d-flex align-items-center mb-2 mb-lg-0 text-dark text-decoration-none">
                    <img src="https://www.sescrio.org.br/wp-content/themes/theme-default/assets/images/logo.svg" alt="SESC RJ Logo" height="40">
                </a>
            </div>
        </div>
    </header>

    <main class="container py-4">

        <div class="card mb-4 shadow-sm rounded-4">
            <div class="card-header bg-primary text-white rounded-4">
                <h2 class="card-title h5 mb-0">Consultar Notas Fiscais</h2>
            </div>
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-md-4">
                        <label for="startDate" class="form-label">Data Início:</label>
                        <input type="date" class="form-control" id="startDate" value="<?php echo date('Y-m-01'); ?>">
                    </div>
                    <div class="col-md-4">
                        <label for="endDate" class="form-label">Data Fim:</label>
                        <input type="date" class="form-control" id="endDate" value="<?php echo date('Y-m-d'); ?>">
                    </div>
                    <div class="col-md-4 d-flex align-items-end">
                        <button type="button" class="btn btn-info w-100 me-2 rounded-4" id="btnConsultPending">Consultar Pendentes</button>
                        <button type="button" class="btn btn-success w-100 rounded-4" id="btnConsultSent">Consultar Enviadas</button>
                    </div>
                </div>
                <div class="mt-3">
                    <button type="button" class="btn btn-warning w-100 rounded-4" id="btnSendAllPending">Enviar Todas as Pendentes</button>
                </div>
                <div id="loadingIndicator" class="text-center mt-3 d-none">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Carregando...</span>
                    </div>
                    <p class="mt-2">Carregando notas...</p>
                </div>
                <div id="messageArea" class="alert alert-info mt-3 d-none" role="alert"></div>
            </div>
        </div>

        <div class="card shadow-sm rounded-4">
            <div class="card-header bg-light rounded-4">
                <h3 class="card-title h5 mb-0" id="notesListTitle">Notas Fiscais</h3>
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
                                <th>Serviço</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody id="notesTableBody">
                            <tr><td colspan="8" class="text-center">Use os filtros para consultar notas.</td></tr>
                        </tbody>
                    </table>
                </div>
                <p class="text-muted mt-3" id="notesCount">Total de notas: 0</p>
                <nav aria-label="Page navigation" class="mt-3">
                    <ul class="pagination justify-content-center" id="paginationControls">
                        </ul>
                </nav>
            </div>
        </div>
    </main>

    <footer class="pt-3 mt-4">
        <p class="text-center text-muted">&copy; <?php echo date('Y'); ?> SESC RJ. Todos os direitos reservados.</p>
    </footer>

    <script src="src/bootstrap/js/bootstrap.bundle.min.js" ></script>
    <script src="js/scripts.js"></script>
</body>
</html>