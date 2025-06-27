<?php
// nfse_manager/Components/Consulta/requeue_note.php
// Reenfileira uma nota rejeitada, marcando-a como pendente novamente.

header('Content-Type: application/json');
require_once '../Config/config.php';
require_once '../Config/functions.php';

$input = json_decode(file_get_contents('php://input'), true);

// **CORRIGIDO: Recebendo os parâmetros corretos para a query**
$rps = $input['rps'] ?? null;
$serie = $input['serie'] ?? null;
$cnpj = $input['cnpj'] ?? null;

if (!$rps || !$serie || !$cnpj) {
  http_response_code(400);
  echo json_encode(['error' => 'Os parâmetros RPS, Série e CNPJ da nota são obrigatórios.']);
  exit;
}

$db = getDbConnection();
if (!$db) {
  http_response_code(500);
  echo json_encode(['error' => 'Não foi possível conectar ao banco de dados interno.']);
  exit;
}

// **CORRIGIDO: Utilizando a sua query, que é mais específica e segura.**
// Esta query garante que só vamos reenfileirar uma nota que estava marcada como enviada.
$sql = "UPDATE rps_tmp SET st_extracao = NULL, flg_importado = 'N' WHERE nr_rps = ? AND serie = ? AND cnpj_prestador = ? AND (rps_tmp.st_extracao = '1' OR rps_tmp.flg_importado != 'N')";

try {
  $stmt = $db->prepare($sql);
  $stmt->execute([$rps, $serie, $cnpj]);

  $rowCount = $stmt->rowCount();

  if ($rowCount > 0) {
    echo json_encode(['success' => true, 'message' => "Nota (RPS: $rps, Série: $serie) foi reenviada para a fila de pendentes com sucesso."]);
  } else {
    // Isso pode acontecer se a nota não for encontrada ou se o estado dela não permitir o reenvio.
    http_response_code(404);
    echo json_encode(['error' => "Nenhuma nota foi alterada. Verifique se o RPS, Série e CNPJ estão corretos e se o estado da nota permite o reenvio."]);
  }

} catch (PDOException $e) {
  http_response_code(500);
  error_log("Erro ao reenfileirar nota: " . $e->getMessage());
  echo json_encode(['error' => 'Ocorreu um erro no banco de dados ao tentar atualizar a nota.']);
}
?>