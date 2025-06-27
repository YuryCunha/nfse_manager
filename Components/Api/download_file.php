<?php
// nfse_manager/Components/Consulta/download_file.php
// Proxy seguro para download de PDF, XML e Recibo Provisório (RPS)

require_once '../Config/config.php';
require_once '../Config/functions.php';

// Validação dos parâmetros
$idNota = $_GET['id'] ?? null;
$type = $_GET['type'] ?? null; // 'pdf', 'xml', ou 'rps'

// **ALTERADO: Adicionado 'rps' aos tipos permitidos**
if (!$idNota || !in_array($type, ['pdf', 'xml', 'rps'])) {
  http_response_code(400);
  die("Parâmetros inválidos. É necessário 'id' da nota e 'type' (pdf, xml ou rps).");
}

$db = getDbConnection();
if (!$db) {
  http_response_code(500);
  die("Erro interno: Não foi possível conectar ao banco de dados.");
}

$apiKey = getApiToken($db);
if (!$apiKey) {
  http_response_code(500);
  die("Erro interno: Não foi possível obter a chave da API.");
}

// **ALTERADO: Monta a URL da API dinamicamente com base no tipo**
$endpoint = '';
$filename_prefix = 'NFSe';
switch ($type) {
  case 'pdf':
    $endpoint = "/pdf/$idNota";
    break;
  case 'xml':
    $endpoint = "/xml/$idNota";
    break;
  case 'rps':
    $endpoint = "/rps/pdf/$idNota";
    $filename_prefix = 'RPS';
    break;
}
$apiUrl = PLUGNOTAS_API_URL_NFSE . $endpoint;

// Inicia a chamada cURL
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['x-api-key: ' . $apiKey]);

$response_body = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$content_type = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
curl_close($ch);

if ($httpCode !== 200) {
  http_response_code($httpCode);
  $error_data = json_decode($response_body, true);
  $error_message = $error_data['error']['message'] ?? ($error_data['message'] ?? 'Não foi possível obter o arquivo da API.');
  die("Erro $httpCode: $error_message");
}

// Prepara os headers para forçar o download no navegador
header("Content-Type: $content_type");
$filename = "{$filename_prefix}-{$idNota}.pdf"; // O RPS também é um PDF
if ($type === 'xml') {
  $filename = "{$filename_prefix}-{$idNota}.xml";
}
header("Content-Disposition: inline; filename=\"$filename\"");

// Entrega o conteúdo do arquivo para o navegador
echo $response_body;
exit;
?>