<?php
// functions.php

require_once 'config.php';

/**
 * Establishes a PDO database connection.
 * @return PDO|null The PDO object on success, null on failure.
 */
function getDbConnection() {
    try {
        $db = new PDO(DB_DSN, DB_USER, DB_PASS);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $db;
    } catch (PDOException $e) {
        error_log("Erro na conexão com o banco de dados: " . $e->getMessage());
        return null;
    }
}

/**
 * Logs messages to a specified file.
 * @param string $message The message to log.
 * @param string $logFile The path to the log file.
 */
function writeLog($message, $logFile) {
    file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] " . $message . "\n", FILE_APPEND);
}

/**
 * Registers or updates a series in the PlugNotas API.
 * @param PDO $db PDO database connection object.
 * @param string $cnpj_prestador CNPJ of the service provider.
 * @param string $serie The series to register.
 * @param int $numero_inicial The initial number for the series.
 * @return bool True on success, false on failure.
 */
function cadastrarSerie($db, $cnpj_prestador, $serie, $numero_inicial) {
    $payload_serie = [
        "prestador" => $cnpj_prestador,
        "serie" => $serie,
        "numeroInicial" => (int)$numero_inicial,
        "tipo" => "RPS"
    ];

    $ch_serie = curl_init(PLUGNOTAS_API_URL_SERIE);
    curl_setopt($ch_serie, CURLOPT_HTTPHEADER, [
        "Content-Type: application/json",
        "X-API-Key: " . PLUGNOTAS_API_TOKEN
    ]);
    curl_setopt($ch_serie, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch_serie, CURLOPT_POST, true);
    curl_setopt($ch_serie, CURLOPT_POSTFIELDS, json_encode($payload_serie));
    $response_serie = curl_exec($ch_serie);
    $httpCode_serie = curl_getinfo($ch_serie, CURLINFO_HTTP_CODE);
    $responseUtf8_serie = mb_convert_encoding($response_serie, 'UTF-8', 'auto');
    curl_close($ch_serie);

    $log = "CADASTRO DE SÉRIE: CNPJ: $cnpj_prestador, Série: $serie, Número Inicial: $numero_inicial\n";
    $log .= "HTTP $httpCode_serie\nResposta: $responseUtf8_serie\n\n";
    writeLog($log, LOG_FILE);

    if ($httpCode_serie >= 200 && $httpCode_serie < 300) {
        return true;
    } elseif ($httpCode_serie === 409) {
        $resposta_serie = json_decode($responseUtf8_serie, true);
        if (isset($resposta_serie['error']['message']) && strpos($resposta_serie['error']['message'], "já existe") !== false) {
            return true;
        }
    }
    error_log("ERRO ao cadastrar série '$serie' para CNPJ '$cnpj_prestador': HTTP $httpCode_serie - $responseUtf8_serie");
    return false;
}

/**
 * Queries the database for NFSe records.
 * @param PDO $db PDO database connection object.
 * @param string $statusFilter 'pending' for st_extracao IS NULL AND flg_importado = 'N',
 * 'sent' for st_extracao = '1' AND (flg_importado = 'A' OR flg_importado = 'S').
 * @param string $startDate Start date for the query (YYYY-MM-DD).
 * @param string $endDate End date for the query (YYYY-MM-DD).
 * @return array Array of fetched records.
 */
function getNotesFromDb($db, $statusFilter, $startDate, $endDate) {
    $cnpjsPlaceholders = implode(',', array_fill(0, count($GLOBALS['PRESTADOR_CNPJS_PERMITIDOS']), '?'));
    $servicosPlaceholders = implode(',', array_fill(0, count($GLOBALS['SERVICO_CODIGOS_PERMITIDOS']), '?'));

    $sqlNotas = "
    SELECT
        rps_tmp.nr_rps,
        rps_tmp.serie,
        rps_tmp.nr_lote,
        rps_tmp.dt_emissao,
        rps_tmp.cd_prestador,
        rps_tmp.cd_tomador,
        rps_tmp.desc_servico,
        rps_tmp.cd_servico,
        rps_tmp.cidade_servico,
        rps_tmp.vl_total,
        rps_tmp.nat_operacao,
        rps_tmp.cd_ibge,
        rps_tmp.is_inscricao_municipal,
        rps_tmp.aliq_iss,
        rps_tmp.cnpj_prestador,
        rps_tmp.flg_importado,
        rps_tmp.num_seq_tmp,
        rps_tmp.st_extracao,
        rps_tmp.cd_tributacao_mun,
        rps_tmp.DataInsert,
        1 AS tipoRps,
        1 AS status,
        CASE WHEN rps_tmp.iss_retido = 0 THEN 2 ELSE 1 END AS iss_retido,
        emitente.cd_municipio_ibge,
        rps_tmp.vl_iss,
        rps_tmp.vl_iss_retido,
        rps_tmp.base_calculo,
        rps_tmp.vl_total AS valor_liquido_nfse,
        emitente.insc_municipal,
        'SERVICO SOCIAL DO COMERCIO - SESC ADMINISTRACAO REGIONAL DO RIO DE JANEIRO' AS razaoSocialPrestador,
        emitente.nm_emitente,
        emitente.endereco,
        emitente.numero,
        emitente.complemento,
        emitente.bairro,
        emitente.cd_municipio_ibge AS prest_municipio_ibge,
        emitente.cidade,
        emitente.cd_estado,
        emitente.CEP,
        emitente_tmp.cd_inscricao,
        emitente_tmp.nm_emitente AS tomador_razao_social,
        emitente_tmp.insc_estadual,
        emitente_tmp.endereco AS tomador_endereco,
        emitente_tmp.numero AS tomador_numero,
        emitente_tmp.complemento AS tomador_complemento,
        emitente_tmp.bairro AS tomador_bairro,
        emitente_tmp.cd_municipio_ibge AS tomador_municipio_ibge,
        emitente_tmp.cidade AS tomador_cidade,
        emitente_tmp.cd_estado AS tomador_uf,
        emitente_tmp.CEP AS tomador_cep,
        emitente_tmp.telefone,
        rps_tmp.cd_verificacao,
        serv.item_lista_servico AS itemListaServico,
        serv.cd_cnae AS codCnae,
        serv.cd_servico_municipal AS codTribMun
    FROM rps_tmp
    INNER JOIN emitente
        ON rps_tmp.cnpj_prestador = emitente.cd_inscricao
        AND emitente.tipo_pessoa = 1
        AND emitente.cd_emitente IN (1,2,3,4,5,6,7,21175,21177,21183)

    OUTER APPLY (
        SELECT TOP 1 *
        FROM emitente_tmp et
        WHERE rps_tmp.cd_tomador = CAST(et.cd_inscricao AS BIGINT)
        ORDER BY et.cd_emitente
    ) emitente_tmp

    OUTER APPLY (
        SELECT TOP 1 *
        FROM servico_municipal s
        WHERE s.cd_servico = rps_tmp.cd_servico
    ) serv
    WHERE rps_tmp.dt_emissao >= ?
    AND rps_tmp.dt_emissao <= ?
    AND rps_tmp.cnpj_prestador IN ($cnpjsPlaceholders)
    AND rps_tmp.cd_servico IN ($servicosPlaceholders)
    ";

    $queryParams = [$startDate, $endDate];
    $queryParams = array_merge($queryParams, $GLOBALS['PRESTADOR_CNPJS_PERMITIDOS'], $GLOBALS['SERVICO_CODIGOS_PERMITIDOS']);

    if ($statusFilter === 'pending') {
        $sqlNotas .= " AND rps_tmp.st_extracao IS NULL AND rps_tmp.flg_importado = 'N'";
    } elseif ($statusFilter === 'sent') {
        $sqlNotas .= " AND rps_tmp.st_extracao = '1' AND (rps_tmp.flg_importado = 'A' OR rps_tmp.flg_importado = 'S')";
    }

    try {
        $stmt = $db->prepare($sqlNotas);
        $stmt->execute($queryParams);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        error_log("Erro ao buscar notas do DB: " . $e->getMessage());
        return [];
    }
}