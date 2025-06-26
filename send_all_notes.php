<?php
// send_all_notes.php

header('Content-Type: application/json');
date_default_timezone_set('America/Sao_Paulo');

require_once 'config.php';
require_once 'functions.php';

function sendJsonError($message, $code = 400, $details = []) { /* ... */ }

$input = json_decode(file_get_contents('php://input'), true);
$included_cnpjs = $input['included_cnpjs'] ?? [];

if (empty($included_cnpjs)) {
    sendJsonError('Nenhum CNPJ foi selecionado para o envio em massa.');
}

$db = getDbConnection();
if (!$db) { /* ... */ }

$token = getApiToken($db);
if (!$token) { /* ... */ }

// **CORRIGIDO: Adicionada a cláusula "AND cd_servico IN (...)" na busca inicial**
$placeholders = implode(',', array_fill(0, count($included_cnpjs), '?'));
$sqlBusca = "
    SELECT num_seq_tmp FROM rps_tmp 
    WHERE flg_importado = 'N' AND st_extracao IS NULL 
    AND cnpj_prestador IN ($placeholders)
    AND cd_servico IN (
        '030307','040205','040208','041201','041601','060404','060406','060411',
        '080102','080204','080210','080214','090101','090202','120101','120202',
        '120301','120502','120701','120703','120705','120902','120903','121101',
        '121201','121301','121609','121701'
    )";

$stmtBusca = $db->prepare($sqlBusca);
$stmtBusca->execute($included_cnpjs);
$notes_to_process = $stmtBusca->fetchAll(PDO::FETCH_COLUMN);

if (empty($notes_to_process)) {
    echo json_encode(['success' => true, 'message' => 'Nenhuma nota pendente com serviço permitido foi encontrada para os CNPJs selecionados.', 'successCount' => 0, 'errorCount' => 0, 'errorDetails' => []]);
    exit;
}

$successCount = 0;
$errorCount = 0;
$errorDetails = [];

foreach ($notes_to_process as $noteId) {
    // A query detalhada aqui dentro também deve ter o filtro para segurança, embora a busca inicial já tenha feito.
    $sqlNota = "SELECT * FROM rps_tmp ... WHERE rps_tmp.num_seq_tmp = ? AND rps_tmp.cd_servico IN (...)"; // Query completa com o filtro
    $stmtNota = $db->prepare($sqlNota);
    $stmtNota->execute([$noteId]);
    $n = $stmtNota->fetch(PDO::FETCH_ASSOC);

    if (!$n) {
        $errorCount++;
        $errorDetails[] = ['rps' => "ID: $noteId", 'error' => 'Nota não encontrada ou com serviço inválido.'];
        logApiError($db, ['nr_rps' => null, 'serie' => null, 'cnpj_prestador' => null, 'situacao' => 'ERRO_BUSCA_MASSA', 'mensagem' => "Nota com ID $noteId não foi encontrada para processamento."]);
        continue;
    }

    // ... O restante do loop de envio e tratamento de erro continua o mesmo ...
    // A lógica de log já usa os dados da variável $n, então está segura.
}

echo json_encode([
    'success' => true,
    'message' => 'Processo de envio em massa concluído.',
    'successCount' => $successCount,
    'errorCount' => $errorCount,
    'errorDetails' => $errorDetails
]);
?>