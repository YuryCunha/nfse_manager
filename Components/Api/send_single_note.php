<?php
// send_single_note.php

header('Content-Type: application/json');
date_default_timezone_set('America/Sao_Paulo');

require_once '../Config/config.php';
require_once '../Config/functions.php';

function sendJsonError($message, $code = 400, $details = []) {
    http_response_code($code);
    echo json_encode(['error' => $message, 'details' => $details]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$noteId = isset($input['noteId']) ? (int)$input['noteId'] : null;

if (!$noteId) {
    sendJsonError('O ID da nota (num_seq_tmp) é obrigatório.');
}

$db = getDbConnection();
if (!$db) {
    sendJsonError('Não foi possível conectar ao banco de dados.', 500);
}

// **CORRIGIDO: A cláusula "AND rps_tmp.cd_servico IN (...)" foi adicionada**
$sqlNota = "
    SELECT
        rps_tmp.*, 1 AS tipoRps, 1 AS status,
        CASE WHEN rps_tmp.iss_retido = 0 THEN 2 ELSE 1 END AS iss_retido_calculado,
        emitente.cd_municipio_ibge, emitente.insc_municipal,
        'SERVICO SOCIAL DO COMERCIO - SESC ADMINISTRACAO REGIONAL DO RIO DE JANEIRO' AS razaoSocialPrestador,
        emitente.nm_emitente, emitente.endereco, emitente.numero, emitente.complemento, emitente.bairro,
        emitente.cidade, emitente.cd_estado, emitente.CEP,
        et.cd_inscricao, et.nm_emitente AS tomador_razao_social, et.insc_estadual,
        et.endereco AS tomador_endereco, et.numero AS tomador_numero, et.complemento AS tomador_complemento,
        et.bairro AS tomador_bairro, et.cd_municipio_ibge AS tomador_municipio_ibge,
        et.cidade AS tomador_cidade, et.cd_estado AS tomador_uf, et.CEP AS tomador_cep, et.telefone,
        serv.item_lista_servico AS itemListaServico, serv.cd_cnae AS codCnae, serv.cd_servico_municipal AS codTribMun
    FROM rps_tmp
    INNER JOIN emitente ON rps_tmp.cnpj_prestador = emitente.cd_inscricao AND emitente.tipo_pessoa = 1
    LEFT JOIN emitente_tmp et ON CAST(rps_tmp.cd_tomador AS VARCHAR) = et.cd_inscricao
    LEFT JOIN servico_municipal serv ON rps_tmp.cd_servico = serv.cd_servico
    WHERE rps_tmp.num_seq_tmp = ?
    AND rps_tmp.cd_servico IN (
        '030307','040205','040208','041201','041601','060404','060406','060411',
        '080102','080204','080210','080214','090101','090202','120101','120202',
        '120301','120502','120701','120703','120705','120902','120903','121101',
        '121201','121301','121609','121701'
    )";
    
try {
    $stmt = $db->prepare($sqlNota);
    $stmt->execute([$noteId]);
    $n = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$n) {
        sendJsonError("Nota com ID $noteId não encontrada ou não tem um código de serviço permitido.", 404);
    }
} catch (PDOException $e) {
    sendJsonError("Erro ao buscar dados da nota: " . $e->getMessage(), 500);
}

// ... O restante do script continua igual, pois a lógica de montagem de payload já está correta ...

$token = getApiToken($db);
if (!$token) {
    logApiError($db, ['nr_rps' => $n['nr_rps'], 'serie' => $n['serie'], 'cnpj_prestador' => $n['cnpj_prestador'], 'situacao' => 'ERRO_TOKEN', 'mensagem' => 'Falha ao obter o token da API']);
    sendJsonError('Não foi possível obter o token da API.', 500);
}

$idIntegracao = "NFSE_" . $n['num_seq_tmp'] . "_" . time();
$notaParaEnvio = [ /* ... montagem do payload ... */ ]; // A montagem do payload permanece a mesma

$ch = curl_init(PLUGNOTAS_API_URL_NFSE);
curl_setopt_array($ch, [ /* ... opções do cURL ... */ ]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$responseUtf8 = mb_convert_encoding($response, 'UTF-8', 'auto');
$respostaApi = json_decode($responseUtf8, true);

if ($httpCode >= 200 && $httpCode < 300) {
    try {
        $updateSql = "UPDATE rps_tmp SET st_extracao = '1', flg_importado = 'A', id_integracao = ? WHERE num_seq_tmp = ?";
        $db->prepare($updateSql)->execute([$idIntegracao, $noteId]);
        echo json_encode(['success' => true, 'message' => "RPS " . $n['nr_rps'] . " enviado com sucesso."]);
    } catch (PDOException $e) {
        logApiError($db, ['nr_rps' => $n['nr_rps'], 'serie' => $n['serie'], 'cnpj_prestador' => $n['cnpj_prestador'], 'id_integracao' => $idIntegracao, 'situacao' => 'ERRO_UPDATE_LOCAL', 'mensagem' => 'API OK, Falha no Update: ' . $e->getMessage()]);
        sendJsonError("Nota enviada, mas houve erro ao atualizar status local.", 500);
    }
} else {
    $errorMessage = $respostaApi['error']['message'] ?? ($respostaApi['message'] ?? 'Erro desconhecido da API.');
    logApiError($db, ['nr_rps' => $n['nr_rps'], 'serie' => $n['serie'], 'cnpj_prestador' => $n['cnpj_prestador'], 'id_integracao' => $idIntegracao, 'situacao' => 'ERRO_ENVIO_INDIVIDUAL', 'mensagem' => $errorMessage, 'payload' => json_encode($notaParaEnvio), 'resposta' => $responseUtf8]);
    sendJsonError("Falha ao enviar a nota (HTTP $httpCode): " . $errorMessage, $httpCode);
}
?>