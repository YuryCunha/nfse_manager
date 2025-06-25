<?php
// get_notes.php

ini_set('max_execution_time', 180);
header('Content-Type: application/json');
require_once 'config.php';
require_once 'functions.php';

function sendJsonError($message, $code = 400) {
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

$status = $_GET['status'] ?? null;
$startDate = $_GET['startDate'] ?? null;
$endDate = $_GET['endDate'] ?? null;
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 15;
$includedCnpjs = isset($_GET['included_cnpjs']) ? json_decode($_GET['included_cnpjs'], true) : [];

if (!$status || !$startDate || !$endDate) {
    sendJsonError('Parâmetros de data e status são obrigatórios.');
}
if (!is_array($includedCnpjs)) {
    sendJsonError('O filtro de CNPJs é inválido.');
}

$db = getDbConnection();
if (!$db) {
    sendJsonError('Não foi possível conectar ao banco de dados.', 500);
}

try {
    $allNotes = getNotesFromDb($db, $status, $startDate, $endDate, $includedCnpjs);
    $totalNotes = count($allNotes);

    $offset = ($page - 1) * $limit;
    $paginatedNotes = array_slice($allNotes, $offset, $limit);

    echo json_encode([
        'notes' => $paginatedNotes,
        'totalNotes' => $totalNotes,
        'currentPage' => $page
    ]);

} catch (Exception $e) {
    error_log("Erro em get_notes.php: " . $e->getMessage());
    sendJsonError('Ocorreu um erro interno ao processar sua solicitação.', 500);
}