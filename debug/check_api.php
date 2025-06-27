<?php
// nfse_manager/debug/check_api.php
// Script de Diagnóstico de Conexão com a API PlugNotas

header('Content-Type: text/html; charset=utf-8');

// --- Inclusão dos arquivos de configuração ---
require_once '../Components/Config/config.php';
require_once '../Components/Config/functions.php';

// --- INÍCIO DO TEMPLATE HTML ---
?>
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diagnóstico da API PlugNotas</title>
    <link href="../src/bootstrap/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="../src/bootstrap/bootstrap-icons.min.css">
    <link rel="stylesheet" href="../src/css/custom.css">
    <style>
        .card-header .bi {
            font-size: 1.5rem;
        }

        .payload-details {
            max-height: 400px;
            overflow-y: auto;
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
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
                    <img src="../src/img/logo.svg" alt="SESC RJ Logo" height="40">
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
                <h1 class="h3 mb-0">Diagnóstico da API PlugNotas</h1>
                <p class="mb-0 text-muted">Verifica a configuração de produção e realiza um teste de envio no ambiente
                    Sandbox.</p>
            </div>
            <div class="card-body">
                <?php
                function render_result_box($title, $status, $messages = [])
                {
                    $status_map = [
                        'success' => ['icon' => 'bi-check-circle-fill', 'color' => 'success'],
                        'failure' => ['icon' => 'bi-x-circle-fill', 'color' => 'danger'],
                        'conflict' => ['icon' => 'bi-patch-check-fill', 'color' => 'primary'],
                        'info' => ['icon' => 'bi-info-circle-fill', 'color' => 'info'],
                        'warning' => ['icon' => 'bi-exclamation-triangle-fill', 'color' => 'warning']
                    ];
                    $icon = $status_map[$status]['icon'] ?? 'bi-question-circle-fill';
                    $color = $status_map[$status]['color'] ?? 'secondary';
                    $accordion_id = "accordion-" . preg_replace('/[^a-zA-Z0-9]/', '', $title) . rand();

                    echo "<div class=\"alert alert-{$color} mb-4\">
                            <div class=\"d-flex align-items-center\">
                                <i class=\"bi $icon me-3\" style=\"font-size: 1.5rem;\"></i>
                                <div><h5 class=\"alert-heading mb-0\">$title</h5></div>
                            </div>
                            <hr>";
                    foreach ($messages as $type => $content) {
                        if ($type === 'details' || $type === 'payload' || $type === 'response') {
                            echo "<div class=\"accordion\" id=\"$accordion_id\">
                                    <div class=\"accordion-item\">
                                        <h2 class=\"accordion-header\">
                                            <button class=\"accordion-button collapsed\" type=\"button\" data-bs-toggle=\"collapse\" data-bs-target=\"#{$accordion_id}-collapse\">
                                                Ver Detalhes Técnicos ($type)
                                            </button>
                                        </h2>
                                        <div id=\"{$accordion_id}-collapse\" class=\"accordion-collapse collapse\" data-bs-parent=\"#$accordion_id\">
                                            <div class=\"accordion-body payload-details\"><pre>" . htmlspecialchars($content) . "</pre></div>
                                        </div>
                                    </div>
                                  </div>";
                        } else {
                            echo "<p class=\"mb-1\"><strong>$type:</strong> " . nl2br(htmlspecialchars($content)) . "</p>";
                        }
                    }
                    echo "</div>";
                }

                // ... (O restante da sua lógica de teste PHP permanece aqui, intacta) ...
                
                // PASSO 1: OBTENÇÃO DO TOKEN
                $db = getDbConnection();
                if (!$db) {
                    render_result_box('[PASSO 1] Conexão com Banco', 'failure', ['Erro Crítico' => 'Não foi possível conectar ao banco de dados.']);
                    echo '</div></div></main></body></html>';
                    exit;
                }

                render_result_box('[PASSO 1] Conexão com Banco', 'success', ['Status' => 'Conexão com o banco de dados para obter o token foi bem-sucedida.']);

                $apiTokenProducao = getApiToken($db);
                if ($apiTokenProducao) {
                    render_result_box('[PASSO 2] Obter Token de Produção', 'success', ['Status' => 'Token da API de Produção foi lido do banco de dados.']);
                } else {
                    render_result_box('[PASSO 2] Obter Token de Produção', 'failure', ['Erro Crítico' => 'Não foi possível obter o token da API de Produção do banco.']);
                    echo '</div></div></main></body></html>';
                    exit;
                }

                // PASSO 2: AUTENTICAÇÃO NO AMBIENTE DE PRODUÇÃO
                $ch_prod = curl_init(PLUGNOTAS_API_URL . '/empresa');
                curl_setopt_array($ch_prod, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => ['x-api-key: ' . $apiTokenProducao]]);
                $response_prod = curl_exec($ch_prod);
                $httpCode_prod = curl_getinfo($ch_prod, CURLINFO_HTTP_CODE);
                $respostaApiProd = json_decode($response_prod, true);
                curl_close($ch_prod);

                if ($httpCode_prod == 200) {
                    $razaoSocial = $respostaApiProd[0]['razaoSocial'] ?? 'Não informado';
                    $cnpj = $respostaApiProd[0]['cpfCnpj'] ?? 'Não informado';
                    render_result_box('[PASSO 3] Autenticação na Produção', 'success', [
                        'Status' => "Autenticação no ambiente de PRODUÇÃO bem-sucedida (HTTP $httpCode_prod).",
                        'Razão Social' => $razaoSocial,
                        'CNPJ Vinculado ao Token' => $cnpj
                    ]);
                } else {
                    $errorMessage = $respostaApiProd['error']['message'] ?? 'Resposta inesperada.';
                    render_result_box('[PASSO 3] Autenticação na Produção', 'failure', ['Status' => "Falha ao autenticar na PRODUÇÃO (HTTP $httpCode_prod).", 'Mensagem da API' => $errorMessage]);
                    echo '</div></div></main></body></html>';
                    exit;
                }

                // PASSO 3: ENVIO PARA O AMBIENTE SANDBOX
                $sandbox_url = 'https://api.sandbox.plugnotas.com.br/nfse';
                $sandbox_token = '2da392a6-79d2-4304-a8b7-959572c7e44d';
                $sandboxPayload = [
                    "idIntegracao" => "SESCRJ-DIAG-" . time(),
                    "prestador" => ["cpfCnpj" => "08187168000160"],
                    "tomador" => ["cpfCnpj" => "99999999999999", "razaoSocial" => "Empresa de Teste LTDA", "email" => "teste@plugnotas.com.br", "endereco" => ["logradouro" => "Barao do rio branco", "numero" => "1001", "bairro" => "Centro", "codigoCidade" => "4115200", "estado" => "PR", "cep" => "87020100"]],
                    "servico" => [["codigo" => "14.10", "discriminacao" => "Diagnostico de API. Esta nota e um teste de sandbox.", "cnae" => "7490104", "iss" => ["tipoTributacao" => 1, "exigibilidade" => 1, "aliquota" => 3], "valor" => ["servico" => 1.00]]]
                ];

                render_result_box('[PASSO 4] Envio para Sandbox', 'info', ['Endpoint' => $sandbox_url, 'Token Utilizado' => $sandbox_token, 'payload' => json_encode($sandboxPayload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]);

                $ch_sandbox = curl_init($sandbox_url);
                curl_setopt_array($ch_sandbox, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode([$sandboxPayload]), CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-api-key: ' . $sandbox_token]]);
                $response_sandbox = curl_exec($ch_sandbox);
                $httpCode_sandbox = curl_getinfo($ch_sandbox, CURLINFO_HTTP_CODE);
                $respostaApiSandbox = json_decode($response_sandbox, true);
                curl_close($ch_sandbox);

                switch ($httpCode_sandbox) {
                    case 200:
                        $message = $respostaApiSandbox['message'] ?? 'Resposta inesperada.';
                        $protocol = $respostaApiSandbox['protocol'] ?? 'N/A';
                        render_result_box('Resultado do Envio', 'success', ['Status' => "SUCESSO (HTTP 200): A API de Sandbox aceitou a nota!", 'Mensagem da API' => $message, 'Protocolo' => $protocol, 'response' => json_encode($respostaApiSandbox, JSON_PRETTY_PRINT)]);
                        break;
                    case 409:
                        $message = $respostaApiSandbox['error']['message'] ?? 'Nota duplicada.';
                        render_result_box('Resultado do Envio', 'conflict', ['Status' => "SUCESSO DE VALIDAÇÃO (HTTP 409 - Conflito).", 'Explicação' => 'A API informou que a nota já existe, o que prova que a comunicação e a estrutura do payload estão corretas.', 'Mensagem da API' => $message]);
                        break;
                    default:
                        $message = $respostaApiSandbox['error']['message'] ?? 'Verifique os detalhes técnicos.';
                        render_result_box('Resultado do Envio', 'failure', ['Status' => "FALHA (HTTP $httpCode_sandbox).", 'Mensagem da API' => $message, 'response' => $response_sandbox]);
                        break;
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