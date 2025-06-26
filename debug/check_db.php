<?php
// nfse_manager/debug/check_db.php
// Script de Diagnóstico de Conexão com o Banco de Dados

header('Content-Type: text/html; charset=utf-8');

// --- Inclusão dos arquivos de configuração ---
require_once '../config.php';
require_once '../functions.php';

// --- INÍCIO DO TEMPLATE HTML ---
?>
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diagnóstico do Banco de Dados</title>
    <link href="../src/bootstrap/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <link rel="stylesheet" href="../css/custom.css">
    <style>
        .error-details {
            max-height: 200px;
            overflow-y: auto;
            background-color: #f8d7da;
            color: #58151c;
            border-radius: 5px;
            padding: 15px;
            font-family: monospace;
            white-space: pre-wrap;
        }

        body {
            padding-bottom: 70px;
        }
    </style>
</head>

<body>
    <header class="p-3 mb-3 border-bottom">
        <div class="container">
            <div class="d-flex flex-wrap align-items-center justify-content-between">
                <a href="../index.php" class="d-flex align-items-center mb-2 mb-lg-0 text-dark text-decoration-none">
                    <img src="https://www.sescrio.org.br/wp-content/themes/theme-default/assets/images/logo.svg"
                        alt="SESC RJ Logo" height="40">
                </a>
                <a href="../index.php" class="btn btn-outline-primary">
                    <i class="bi bi-arrow-left-circle me-2"></i>Voltar ao Início
                </a>
            </div>
        </div>
    </header>

    <main class="container py-4">
        <div class="card shadow-sm rounded-4">
            <div class="card-header bg-light">
                <h1 class="h3 mb-0">Diagnóstico do Banco de Dados</h1>
                <p class="mb-0 text-muted">Verificação da conexão com o SQL Server e permissões de leitura.</p>
            </div>
            <div class="card-body">
                <?php
                function render_result_box($title, $status, $messages = [])
                {
                    $status_map = [
                        'success' => ['icon' => 'bi-check-circle-fill', 'color' => 'success'],
                        'failure' => ['icon' => 'bi-x-circle-fill', 'color' => 'danger']
                    ];
                    $icon = $status_map[$status]['icon'] ?? 'bi-question-circle-fill';
                    $color = $status_map[$status]['color'] ?? 'secondary';

                    echo "<div class=\"alert alert-$color d-flex align-items-center\">
                            <i class=\"bi $icon me-3\" style=\"font-size: 1.5rem;\"></i>
                            <div>
                                <h5 class=\"alert-heading\">$title</h5>";
                    foreach ($messages as $type => $content) {
                        if ($type === 'details') {
                            echo "<hr><p class='mb-1'><strong>Detalhes do Erro:</strong></p><div class='error-details'><pre>" . htmlspecialchars($content) . "</pre></div>";
                        } else {
                            echo "<p class='mb-0'><strong>$type:</strong> " . htmlspecialchars($content) . "</p>";
                        }
                    }
                    echo "  </div>
                          </div>";
                }

                try {
                    $db = getDbConnection();
                    render_result_box('[PASSO 1] Conexão com o Banco', 'success', [
                        'Status' => 'Conexão com o SQL Server foi estabelecida com sucesso!',
                        'Servidor' => DB_SERVER,
                        'Banco de Dados' => DB_NAME
                    ]);

                    try {
                        $stmt = $db->query("SELECT TOP 1 nome_fantasia FROM empresas_plugnotas");
                        $result = $stmt->fetch(PDO::FETCH_ASSOC);

                        if ($result) {
                            render_result_box('[PASSO 2] Teste de Consulta', 'success', [
                                'Status' => 'A consulta de teste foi executada com sucesso.',
                                'Permissões' => 'O usuário do banco tem permissão para ler tabelas (SELECT).',
                                'Dado de Exemplo' => 'Primeira empresa encontrada: ' . $result['nome_fantasia']
                            ]);
                        } else {
                            render_result_box('[PASSO 2] Teste de Consulta', 'failure', [
                                'Erro' => 'A consulta foi executada, mas não retornou resultados.',
                                'Ação Sugerida' => 'Verifique se a tabela `empresas_plugnotas` não está vazia.'
                            ]);
                        }
                    } catch (PDOException $e) {
                        render_result_box('[PASSO 2] Teste de Consulta', 'failure', [
                            'Erro Crítico' => 'A conexão foi bem-sucedida, mas a consulta de teste falhou.',
                            'Ação Sugerida' => 'Verifique se o usuário do banco tem permissão de SELECT na tabela `empresas_plugnotas` e se a tabela existe.',
                            'details' => $e->getMessage()
                        ]);
                    }
                } catch (PDOException $e) {
                    render_result_box('[PASSO 1] Conexão com o Banco', 'failure', [
                        'Erro Crítico' => 'Falha ao conectar com o SQL Server.',
                        'Ação Sugerida' => 'Verifique as credenciais em config.php e as regras de firewall.',
                        'details' => $e->getMessage()
                    ]);
                }
                ?>
            </div>
        </div>
    </main>

    <footer class="pt-3 mt-4">
        <p class="text-center text-muted">&copy; <?php echo date('Y'); ?> SESC RJ. Todos os direitos reservados.</p>
    </footer>

    <script src="../src/bootstrap/js/bootstrap.bundle.min.js"></script>
</body>

</html>