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

function logApiError(PDO $db, array $details): void {
    $sql = "INSERT INTO historico_envios (nr_rps, serie, cnpj_prestador, id_integracao, protocol, situacao, mensagem, payload, resposta, data_envio, usuario) VALUES (:nr_rps, :serie, :cnpj_prestador, :id_integracao, :protocol, :situacao, :mensagem, :payload, :resposta, :data_envio, :usuario)";
    try {
        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':nr_rps' => $details['nr_rps'] ?? null,
            ':serie' => $details['serie'] ?? null,
            ':cnpj_prestador' => $details['cnpj_prestador'] ?? null,
            ':id_integracao' => $details['id_integracao'] ?? null,
            ':protocol' => $details['protocol'] ?? null,
            ':situacao' => $details['situacao'] ?? 'ERRO',
            ':mensagem' => $details['mensagem'] ?? 'Erro desconhecido',
            ':payload' => $details['payload'] ?? null,
            ':resposta' => $details['resposta'] ?? null,
            ':data_envio' => date('Y-m-d H:i:s'),
            ':usuario' => $details['usuario'] ?? 'sistema'
        ]);
    } catch (PDOException $e) {
        error_log("FALHA AO LOGAR ERRO NO BANCO: " . $e->getMessage());
    }
}

/**
 * Consulta o banco de dados para registros de NFSe com base nos filtros.
 * @param PDO $db Objeto de conexão PDO.
 * @param string $statusFilter 'pending' ou 'sent'.
 * @param string $startDate Data de início (YYYY-MM-DD).
 * @param string $endDate Data de fim (YYYY-MM-DD).
 * @param array $includedCnpjs Uma lista de CNPJs para INCLUIR na consulta.
 * @return array Lista de registros encontrados.
 */
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
    
    // Define a parte da cláusula WHERE que lida com o status
    $statusClause = '';
    if ($statusFilter === 'pending') {
        // CORREÇÃO DEFINITIVA: Aplica a lógica exata e robusta para notas pendentes.
        $statusClause = "AND rps_tmp.flg_importado = 'N' AND rps_tmp.st_extracao IS NULL";
    } elseif ($statusFilter === 'sent') {
        $statusClause = "AND rps_tmp.st_extracao = '1' AND (rps_tmp.flg_importado = 'A' OR rps_tmp.flg_importado = 'S')";
    }
    
    // Consulta SQL limpa que incorpora a cláusula de status
    $sqlNotas = "
    SELECT
        rps_tmp.nr_rps,
        rps_tmp.serie,
        rps_tmp.cnpj_prestador,
        rps_tmp.dt_emissao,
        rps_tmp.vl_total,
        rps_tmp.desc_servico,
        rps_tmp.flg_importado,
        rps_tmp.st_extracao,
        rps_tmp.num_seq_tmp,
        rps_tmp.cd_servico
    FROM rps_tmp
    WHERE rps_tmp.dt_emissao >= ?
      AND rps_tmp.dt_emissao <= ?
        AND rps_tmp.cd_servico IN (
      '030307','040205','040208','041201','041601','060404','060406','060411',
      '080102','080204','080210','080214','090101','090202','120101','120202',
      '120301','120502','120701','120703','120705','120902','120903','121101',
      '121201','121301','121609','121701'
    )
      AND rps_tmp.cnpj_prestador IN ($cnpjsPlaceholders)
      $statusClause
    ORDER BY rps_tmp.dt_emissao DESC
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