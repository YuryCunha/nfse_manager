<?php
// send_all_notes.php

header('Content-Type: application/json');
require_once 'config.php';
require_once 'functions.php';

ini_set('max_execution_time', 300); // 5 minutos de tempo de execução

$requestBody = json_decode(file_get_contents('php://input'), true);
$includedCnpjs = $requestBody['included_cnpjs'] ?? [];

if (!is_array($includedCnpjs) || empty($includedCnpjs)) {
    http_response_code(400);
    echo json_encode(['error' => 'Nenhum CNPJ foi selecionado para o envio.']);
    exit;
}

$db = getDbConnection();
$apiToken = $db ? getApiToken($db) : null;

if (!$db || !$apiToken) {
    http_response_code(500);
    echo json_encode(['error' => 'Falha crítica: Não foi possível conectar ao DB ou obter o Token da API.']);
    exit;
}

$pendingNotes = getNotesFromDb($db, 'pending', '1900-01-01', date('Y-m-d'), $includedCnpjs);

if (empty($pendingNotes)) {
    echo json_encode([
        'successCount' => 0,
        'errorCount' => 0,
        'errorDetails' => [],
        'message' => 'Nenhuma nota fiscal pendente encontrada para os CNPJs selecionados.'
    ]);
    exit;
}

$successCount = 0;
$errorCount = 0;
$errorDetails = [];

foreach ($pendingNotes as $note) {
    // ATENÇÃO: Ajuste este payload para corresponder exatamente ao que a API PlugNotas espera.
    $payload = [
        'idIntegracao' => 'RPS_' . $note['num_seq_tmp'],
        'prestador' => ['cnpj' => $note['cnpj_prestador']],
        'servico' => [[
            'codigo' => $note['cd_servico'],
            'discriminacao' => $note['desc_servico'],
            'valor' => ['servico' => $note['vl_total']]
        ]],
        // Adicione aqui todos os outros campos necessários do array $note...
    ];
    $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE);

    $ch = curl_init(PLUGNOTAS_API_URL_NFSE);
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => ["Content-Type: application/json", "X-API-Key: " . $apiToken],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payloadJson
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode >= 200 && $httpCode < 300) {
        try {
            $stmt = $db->prepare("UPDATE rps_tmp SET st_extracao = '1', flg_importado = 'S' WHERE num_seq_tmp = ?");
            $stmt->execute([$note['num_seq_tmp']]);
            $successCount++;
        } catch (PDOException $e) {
            $errorCount++;
            $errorMessage = 'Falha ao ATUALIZAR status no banco após envio com sucesso.';
            $errorDetails[] = ['rps' => $note['nr_rps'], 'error' => $errorMessage];
            logApiError($db, ['nr_rps' => $note['nr_rps'], 'serie' => $note['serie'], 'cnpj_prestador' => $note['cnpj_prestador'], 'mensagem' => $errorMessage, 'payload' => $payloadJson, 'resposta' => $response]);
        }
    } else {
        $errorCount++;
        $responseDecoded = json_decode($response, true);
        $errorMessage = $responseDecoded['error']['message'] ?? 'Erro desconhecido retornado pela API.';
        $errorDetails[] = ['rps' => $note['nr_rps'], 'error' => $errorMessage];
        logApiError($db, ['nr_rps' => $note['nr_rps'], 'serie' => $note['serie'], 'cnpj_prestador' => $note['cnpj_prestador'], 'id_integracao' => 'RPS_' . $note['num_seq_tmp'], 'situacao' => 'ERRO_API', 'mensagem' => $errorMessage, 'payload' => $payloadJson, 'resposta' => $response]);
    }
}

echo json_encode([
    'successCount' => $successCount,
    'errorCount' => $errorCount,
    'errorDetails' => $errorDetails
]);