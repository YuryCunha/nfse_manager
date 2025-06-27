<?php
// nfse_manager/Components/Consulta/get_api_notes.php
// Proxy seguro para a API da PlugNotas

header('Content-Type: application/json');
require_once '../../config.php';
require_once '../../functions.php';

// Validação dos parâmetros recebidos
$cpfCnpj = $_GET['cpfCnpj'] ?? null;
if (!$cpfCnpj) {
    http_response_code(400);
    echo json_encode(['error' => ['message' => 'O parâmetro cpfCnpj é obrigatório.']]);
    exit;
}

$db = getDbConnection();
if (!$db) {
    http_response_code(500);
    echo json_encode(['error' => ['message' => 'Não foi possível conectar ao banco de dados interno.']]);
    exit;
}

$apiKey = getApiToken($db);
if (!$apiKey) {
    http_response_code(500);
    echo json_encode(['error' => ['message' => 'Não foi possível obter a chave da API do banco de dados.']]);
    exit;
}

// Monta a URL da API com os parâmetros
$queryParams = [
    'cpfCnpj' => $cpfCnpj,
    'dataInicial' => $_GET['dataInicial'] ?? null,
    'dataFinal' => $_GET['dataFinal'] ?? null,
    'hashProximaPagina' => $_GET['hashProximaPagina'] ?? null,
];

// Remove parâmetros nulos para não enviar à API
$queryParams = array_filter($queryParams); 

$apiUrl = PLUGNOTAS_API_URL_NFSE . '/consultar/periodo?' . http_build_query($queryParams);

// Faz a chamada cURL
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'x-api-key: ' . $apiKey,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($httpCode);

echo $response;
?>