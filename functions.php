<?php
// functions.php

require_once 'config.php';

function getDbConnection() {
    try {
        $db = new PDO(DB_DSN, DB_USER, DB_PASS);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $db;
    } catch (PDOException $e) {
        error_log("FALHA NA CONEXÃO COM O BANCO DE DADOS: " . $e->getMessage());
        return null;
    }
}

function getApiToken(PDO $db): ?string {
    try {
        $stmt = $db->query("SELECT TOP 1 api_key FROM config_api");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result['api_key'] ?? null;
    } catch (PDOException $e) {
        error_log("ERRO AO BUSCAR API KEY: " . $e->getMessage());
        return null;
    }
}

function getAllowedCnpjs(PDO $db): array {
    try {
        $stmt = $db->query("SELECT cpf_cnpj, nome_fantasia FROM empresas_plugnotas ORDER BY nome_fantasia ASC");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        error_log("ERRO CRÍTICO AO BUSCAR CNPJs: " . $e->getMessage());
        return [];
    }
}

/**
 * **CORRIGIDO:** A função agora trunca os dados longos antes de inseri-los no banco
 * para evitar o erro "String or binary data would be truncated".
 */
function logApiError(PDO $db, array $details): void {
    $sql = "INSERT INTO historico_envios (nr_rps, serie, cnpj_prestador, id_integracao, protocol, situacao, mensagem, payload, resposta, data_envio, usuario) VALUES (:nr_rps, :serie, :cnpj_prestador, :id_integracao, :protocol, :situacao, :mensagem, :payload, :resposta, :data_envio, :usuario)";
    try {
        // Define um limite seguro para as colunas. Ajuste se suas colunas forem maiores.
        $max_length_msg = 4000;
        $max_length_payload = 8000; // Payloads e respostas podem ser maiores
        $max_length_resposta = 8000;

        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':nr_rps' => $details['nr_rps'] ?? null,
            ':serie' => $details['serie'] ?? null,
            ':cnpj_prestador' => $details['cnpj_prestador'] ?? null,
            ':id_integracao' => $details['id_integracao'] ?? null,
            ':protocol' => $details['protocol'] ?? null,
            ':situacao' => substr($details['situacao'] ?? 'ERRO', 0, 50), // Também é bom truncar campos menores por segurança
            
            // **AQUI ESTÁ A CORREÇÃO:** Usando substr() para cortar os dados se eles excederem o limite
            ':mensagem' => substr($details['mensagem'] ?? 'Erro desconhecido', 0, $max_length_msg),
            ':payload' => substr($details['payload'] ?? null, 0, $max_length_payload),
            ':resposta' => substr($details['resposta'] ?? null, 0, $max_length_resposta),
            
            ':data_envio' => date('Y-m-d H:i:s'),
            ':usuario' => substr($details['usuario'] ?? 'sistema', 0, 50)
        ]);
    } catch (PDOException $e) {
        // Se a falha persistir, registra no log de erros do PHP para não entrar em loop.
        error_log("FALHA CRÍTICA AO LOGAR ERRO NO BANCO (APÓS TRUNCAMENTO): " . $e->getMessage());
    }
}


function getNotesFromDb(PDO $db, $statusFilter, $startDate, $endDate, $includedCnpjs = []) {
    if (empty($includedCnpjs) || !is_array($includedCnpjs)) {
        return [];
    }
    
    $allAllowedCnpjsData = getAllowedCnpjs($db);
    $cnpjsPermitidos = array_column($allAllowedCnpjsData, 'cpf_cnpj');
    $cnpjsToQuery = array_intersect($includedCnpjs, $cnpjsPermitidos);

    if (empty($cnpjsToQuery)) {
        return [];
    }
    
    $cnpjsPlaceholders = implode(',', array_fill(0, count($cnpjsToQuery), '?'));
    
    $statusClause = '';
    if ($statusFilter === 'pending') {
        $statusClause = "AND rps_tmp.flg_importado = 'N' AND rps_tmp.st_extracao IS NULL";
    } elseif ($statusFilter === 'sent') {
        $statusClause = "AND rps_tmp.st_extracao = '1' AND (rps_tmp.flg_importado = 'A' OR rps_tmp.flg_importado = 'S')";
    }
    
    // A consulta está correta e não precisa de alterações.
    $sqlNotas = "
    SELECT
        rps_tmp.nr_rps, rps_tmp.serie, rps_tmp.cnpj_prestador,
        rps_tmp.dt_emissao, rps_tmp.vl_total, rps_tmp.desc_servico,
        rps_tmp.flg_importado, rps_tmp.st_extracao, rps_tmp.num_seq_tmp
    FROM rps_tmp
    WHERE rps_tmp.dt_emissao >= ?
      AND rps_tmp.dt_emissao <= ?
      AND rps_tmp.cnpj_prestador IN ($cnpjsPlaceholders)
      AND rps_tmp.cd_servico IN (
          '030307','040205','040208','041201','041601','060404','060406','060411',
          '080102','080204','080210','080214','090101','090202','120101','120202',
          '120301','120502','120701','120703','120705','120902','120903','121101',
          '121201','121301','121609','121701'
      )
      $statusClause
    ORDER BY rps_tmp.dt_emissao DESC, rps_tmp.nr_rps DESC
    ";

    $queryParams = [$startDate, $endDate];
    $queryParams = array_merge($queryParams, array_values($cnpjsToQuery));

    try {
        $stmt = $db->prepare($sqlNotas);
        $stmt->execute($queryParams);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        error_log("ERRO AO EXECUTAR A CONSULTA getNotesFromDb: " . $e->getMessage() . " | SQL: " . $sqlNotas);
        return [];
    }
}