<?php
// api.php

header('Content-Type: application/json');
require_once 'Components/Config/functions.php';
require_once 'Components/Config/config.php';

$db = getDbConnection();

if (!$db) {
    echo json_encode(['status' => 'error', 'message' => 'Erro ao conectar ao banco de dados.']);
    exit;
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    case 'getPendingNotes':
        $startDate = $_GET['startDate'] ?? date('Y-m-d', strtotime('-1 year')); // Default to last year
        $endDate = $_GET['endDate'] ?? date('Y-m-d'); // Default to today
        $notes = getNotesFromDb($db, 'pending', $startDate, $endDate);
        echo json_encode(['status' => 'success', 'notes' => $notes]);
        break;

    case 'getSentNotes':
        $startDate = $_GET['startDate'] ?? date('Y-m-d', strtotime('-1 year')); // Default to last year
        $endDate = $_GET['endDate'] ?? date('Y-m-d'); // Default to today
        $notes = getNotesFromDb($db, 'sent', $startDate, $endDate);
        echo json_encode(['status' => 'success', 'notes' => $notes]);
        break;

    case 'sendNFSe':
        $data = json_decode(file_get_contents('php://input'), true);
        $note = $data['note'] ?? null;

        if (!$note) {
            echo json_encode(['status' => 'error', 'message' => 'Nenhuma nota fornecida para envio.']);
            exit;
        }

        // --- Start of NFSe Payload Construction (from your original script) ---
        $tomadorTelefoneNumero = null;
        $tomadorTelefoneDDD = null;
        if (!empty($note['telefone'])) {
            if (preg_match('/^\(?(\d{2})\)?\s?(\d{4,5}-?\d{4})$/', $note['telefone'], $matches)) {
                $tomadorTelefoneDDD = $matches[1];
                $tomadorTelefoneNumero = str_replace('-', '', $matches[2]);
            } elseif (preg_match('/^(\d{2})(\d{8,9})$/', $note['telefone'], $matches)) {
                $tomadorTelefoneDDD = $matches[1];
                $tomadorTelefoneNumero = $matches[2];
            } else {
                $tomadorTelefoneNumero = preg_replace('/\D/', '', $note['telefone']);
            }
        }

        $serieNota = $note['serie'];
        $cnaeNota = (string) $note['codCnae'];
        $ServicoCodigoNota = (string) $note['itemListaServico'];
        $ServicoCodTribNota = (string) $note['codTribMun'];
        $simplesNacionalPrestador = false; // Default value

        // Specific logic for '03621867002520' (Serviço)
        if ($note['cnpj_prestador'] === '03621867002520') {
            $serieNota = '1';
            $cnaeNota = '8630504';
            $ServicoCodigoNota = '412';
            $ServicoCodTribNota = '412';
            $simplesNacionalPrestador = true;
        }

        $codigoCidade = $note['tomador_municipio_ibge'];
        $descricaoCidade = $note['tomador_cidade'];
        $codigoCidadeIBGE = $note['cd_municipio_ibge'];
        $codigoCidadePrestacao = $note['cd_ibge'];
        $descricaoCidadePrestacao = $note['cidade_servico'];

        // Specific logic for '03621867000900' (CIDADE DE PRESTAÇÃO)
        if ($note['cnpj_prestador'] === '03621867000900') {
            $codigoCidade = '3301009'; // IBGE de CAMPOS DOS GOYTACAZES
            $codigoCidadePrestacao = '3301009';
            $codigoCidadeIBGE = '3301009';
            $descricaoCidade = 'CAMPOS DOS GOYTACAZES';
            $descricaoCidadePrestacao = 'CAMPOS DOS GOYTACAZES';
            $ServicoCodTribNota = (string) $note['itemListaServico'];
        }

        $tomadorData = null;
        if (!empty($note['cd_inscricao']) && preg_replace('/[^0-9]/', '', $note['cd_inscricao']) !== '00000000000') {
            $tomadorData = [
                "cpfCnpj" => $note['cd_inscricao'],
                "razaoSocial" => $note['tomador_razao_social'],
                "inscricaoEstadual" => $note['insc_estadual'],
                "endereco" => [
                    "logradouro" => $note['tomador_endereco'],
                    "numero" => $note['tomador_numero'],
                    "complemento" => $note['tomador_complemento'],
                    "bairro" => $note['tomador_bairro'],
                    "codigoCidade" => $codigoCidade,
                    "descricaoCidade" => $descricaoCidade,
                    "estado" => $note['tomador_uf'],
                    "cep" => preg_replace('/\D/', '', $note['tomador_cep'])
                ],
                "telefone" => [
                    "numero" => $tomadorTelefoneNumero,
                    "ddd" => $tomadorTelefoneDDD
                ]
            ];
        }

        $notaParaEnvio = [
            "idIntegracao" => "NFSE_" . $note['nr_rps'],
            "enviarEmail" => false,
            "rps" => [
                "numero" => (int) $note['nr_rps'],
                "serie" => $serieNota,
                "tipo" => 1,
                "dataEmissao" => date('c', strtotime($note['dt_emissao']))
            ],
            "cidadePrestacao" => [
                "codigo" => $codigoCidadePrestacao,
                "descricao" => $descricaoCidadePrestacao
            ],
            "camposPrefeitura" => [
                "naturezaTributacao" => $note['nat_operacao'],
            ],
            "prestador" => [
                "cpfCnpj" => $note['cnpj_prestador'],
                "inscricaoMunicipal" => $note['insc_municipal'],
                "razaoSocial" => 'SERVICO SOCIAL DO COMERCIO - SESC ADMINISTRACAO REGIONAL DO RIO DE JANEIRO',
                "nomeFantasia" => $note['nm_emitente'],
                "simplesNacional" => $simplesNacionalPrestador,
                "endereco" => [
                    "logradouro" => $note['endereco'],
                    "numero" => $note['numero'],
                    "complemento" => $note['complemento'],
                    "bairro" => $note['bairro'],
                    "codigoCidade" => $codigoCidadeIBGE,
                    "descricaoCidade" => $note['cidade'],
                    "estado" => $note['cd_estado'],
                    "cep" => preg_replace('/\D/', '', $note['CEP'])
                ]
            ],
            "tomador" => $tomadorData,
            "servico" => [
                [
                    "codigo" => $ServicoCodigoNota,
                    "codigoTributacao" => $ServicoCodTribNota,
                    "discriminacao" => $note['desc_servico'],
                    "cnae" => $cnaeNota,
                    "iss" => [
                        "tipoTributacao" => (int) $note['iss_retido'],
                        "exigibilidade" => 1,
                        "aliquota" => (float) $note['aliq_iss'],
                        "retido" => ((int) $note['iss_retido'] === 1)
                    ],
                    "valor" => [
                        "servico" => (float) $note['vl_total'],
                        "baseCalculo" => (float) $note['base_calculo'],
                        "deducoes" => 0.0,
                        "descontoCondicionado" => 0.0,
                        "descontoIncondicionado" => 0.0,
                        "issRetido" => (float) $note['vl_iss_retido']
                    ]
                ]
            ]
        ];
        // --- End of NFSe Payload Construction ---

        $ch = curl_init(PLUGNOTAS_API_URL_NFSE);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Content-Type: application/json",
            "X-API-Key: " . PLUGNOTAS_API_TOKEN
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([$notaParaEnvio]));
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $responseUtf8 = mb_convert_encoding($response, 'UTF-8', 'auto');
        curl_close($ch);

        $log = "ENVIO DE NOTA: RPS: " . $note['nr_rps'] . ", Série: " . $note['serie'] . ", CNPJ: " . $note['cnpj_prestador'] . "\n";
        $log .= "HTTP $httpCode\nResposta: $responseUtf8\n\n";
        writeLog($log, LOG_FILE);

        $updateSql = "UPDATE rps_tmp SET st_extracao = '1', flg_importado = 'A' WHERE nr_rps = ? AND serie = ? AND cnpj_prestador = ?";
        $updateStmt = $db->prepare($updateSql);

        if ($httpCode === 200) {
            $resposta = json_decode($responseUtf8, true);
            if (
                (isset($resposta['documents'][0]['status']) && $resposta['documents'][0]['status'] === 'success') ||
                (isset($resposta['message']) && $resposta['message'] === 'Nota(as) em processamento')
            ) {
                $updateStmt->execute([$note['nr_rps'], $note['serie'], $note['cnpj_prestador']]);
                echo json_encode(['status' => 'success', 'message' => 'Nota enviada e atualizada no DB.']);
            } else {
                $errorMessage = "Erro inesperado em HTTP 200 para RPS " . $note['nr_rps'] . ": " . ($responseUtf8 ?? 'Detalhes não disponíveis.');
                writeLog("ERRO REPORT: " . $errorMessage, ERROR_REPORT_FILE);
                echo json_encode(['status' => 'error', 'message' => $errorMessage]);
            }
        } elseif ($httpCode === 409) {
            $resposta = json_decode($responseUtf8, true);
            if (isset($resposta['error']['message']) && strpos($resposta['error']['message'], "Já existe uma NFSe com os parâmetros informados") !== false) {
                $updateStmt->execute([$note['nr_rps'], $note['serie'], $note['cnpj_prestador']]);
                echo json_encode(['status' => 'success', 'message' => 'Conflito (409): RPS já existe. Atualizado no DB.']);
            } else {
                $errorMessage = "Erro HTTP 409 inesperado para RPS " . $note['nr_rps'] . ": " . ($resposta['error']['message'] ?? 'Detalhes não disponíveis.');
                writeLog("ERRO REPORT: " . $errorMessage, ERROR_REPORT_FILE);
                echo json_encode(['status' => 'error', 'message' => $errorMessage]);
            }
        } elseif ($httpCode === 400) {
            $resposta = json_decode($responseUtf8, true);
            if (isset($resposta['error']['message']) && strpos($resposta['error']['message'], "Serie inválida ou não cadastrada") !== false) {
                $cadastro_sucesso = cadastrarSerie($db, $note['cnpj_prestador'], $serieNota, (int) $note['nr_rps']);
                if ($cadastro_sucesso) {
                    echo json_encode(['status' => 'serie_registered', 'message' => 'Série cadastrada com sucesso. Tente reenviar a nota.']);
                } else {
                    $errorMessage = "Falha ao cadastrar a série '" . $serieNota . "' para CNPJ '" . $note['cnpj_prestador'] . "'.\n" . $responseUtf8;
                    writeLog("ERRO REPORT: " . $errorMessage, ERROR_REPORT_FILE);
                    echo json_encode(['status' => 'error', 'message' => $errorMessage]);
                }
            } else {
                $errorMessage = "Erro HTTP 400 inesperado para RPS " . $note['nr_rps'] . ": " . ($resposta['error']['message'] ?? 'Detalhes não disponíveis.');
                writeLog("ERRO REPORT: " . $errorMessage, ERROR_REPORT_FILE);
                echo json_encode(['status' => 'error', 'message' => $errorMessage]);
            }
        } else {
            $errorMessage = "Erro HTTP $httpCode para RPS " . $note['nr_rps'] . ": " . $responseUtf8;
            writeLog("ERRO REPORT: " . $errorMessage, ERROR_REPORT_FILE);
            echo json_encode(['status' => 'error', 'message' => $errorMessage]);
        }
        break;

    default:
        echo json_encode(['status' => 'error', 'message' => 'Ação inválida.']);
        break;
}