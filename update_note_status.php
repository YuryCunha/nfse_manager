<?php
// nfse_manager/update_note_status.php

header('Content-Type: application/json');
require_once 'config.php';
require_once 'functions.php';

// Função para enviar resposta de erro em JSON
function sendJsonError($message, $code = 400) {
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

// Pega o corpo da requisição POST
$input = json_decode(file_get_contents('php://input'), true);

$noteId = $input['noteId'] ?? null;
$action = $input['action'] ?? null;

if (!$noteId || !$action) {
    sendJsonError('ID da nota e ação são obrigatórios.');
}

$db = getDbConnection();
if (!$db) {
    sendJsonError('Não foi possível conectar ao banco de dados.', 500);
}

// Prepara o SQL baseado na ação
$sql = '';
if ($action === 'mark_sent') {
    // De: Pendente (N, NULL) -> Para: Enviada (A, 1)
    $sql = "UPDATE rps_tmp SET st_extracao = '1', flg_importado = 'A' WHERE num_seq_tmp = ?";
} elseif ($action === 'mark_pending') {
    // De: Enviada (A, 1) -> Para: Pendente (N, NULL)
    $sql = "UPDATE rps_tmp SET st_extracao = NULL, flg_importado = 'N' WHERE num_seq_tmp = ?";
} else {
    sendJsonError('Ação desconhecida.');
}

try {
    $stmt = $db->prepare($sql);
    $stmt->execute([$noteId]);
    
    // Verifica se alguma linha foi de fato alterada
    $rowCount = $stmt->rowCount();
    if ($rowCount > 0) {
        echo json_encode(['success' => true, 'message' => "Nota atualizada com sucesso. Linhas afetadas: $rowCount"]);
    } else {
        // Isso pode acontecer se a nota não for encontrada ou se o estado dela já for o desejado
        sendJsonError('Nenhuma nota foi alterada. Verifique o estado atual da nota.', 404);
    }

} catch (PDOException $e) {
    error_log("Erro em update_note_status.php: " . $e->getMessage());
    sendJsonError('Ocorreu um erro interno ao atualizar a nota.', 500);
}