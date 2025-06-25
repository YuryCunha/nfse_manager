<?php
// check_db.php - Script de Diagnóstico de Conexão e Consulta

header('Content-Type: text/html; charset=utf-8');
echo '<!DOCTYPE html><html lang="pt-BR"><head><title>Diagnóstico de Banco de Dados</title>';
echo '<link href="src/bootstrap/css/bootstrap.min.css" rel="stylesheet"></head>';
echo '<body class="container mt-4"><pre>';

echo "<h1>Teste de Diagnóstico do Sistema</h1>";

// Inclui o arquivo de configuração
require_once 'config.php';

// --- PASSO 1: TESTE DE CONEXÃO COM O BANCO DE DADOS ---
echo "<h2>[PASSO 1] Testando Conexão com o Banco de Dados...</h2>";
try {
    $db = new PDO(DB_DSN, DB_USER, DB_PASS);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "<strong style='color:green;'>SUCESSO:</strong> Conexão com o banco de dados foi bem-sucedida!<br>";
    echo "Servidor: " . DB_SERVER . "<br>";
    echo "Banco: " . DB_NAME . "<br>";
} catch (PDOException $e) {
    echo "<strong style='color:red;'>FALHA CRÍTICA:</strong> Não foi possível conectar ao banco de dados.<br>";
    echo "<strong>Mensagem de Erro:</strong> " . $e->getMessage() . "<br>";
    echo "<strong>Verifique:</strong> As credenciais (servidor, banco, usuário, senha) no arquivo 'config.php' estão corretas? O servidor de banco de dados está acessível?<br>";
    echo '</pre></body></html>';
    exit; // Interrompe o script se a conexão falhar
}
echo "<hr>";


// --- PASSO 2: TESTE DE BUSCA DO TOKEN DA API ---
echo "<h2>[PASSO 2] Testando busca do Token da API...</h2>";
try {
    $stmt = $db->query("SELECT TOP 1 api_key FROM config_api");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!empty($result['api_key'])) {
        echo "<strong style='color:green;'>SUCESSO:</strong> Token da API encontrado na tabela 'config_api'.<br>";
    } else {
        echo "<strong style='color:orange;'>AVISO:</strong> A consulta à tabela 'config_api' funcionou, mas nenhum 'api_key' foi retornado. A tabela pode estar vazia.<br>";
    }
} catch (PDOException $e) {
    echo "<strong style='color:red;'>FALHA:</strong> A consulta à tabela 'config_api' falhou.<br>";
    echo "<strong>Mensagem de Erro:</strong> " . $e->getMessage() . "<br>";
    echo "<strong>Verifique:</strong> A tabela 'config_api' e a coluna 'api_key' existem? O usuário do banco tem permissão de leitura?<br>";
}
echo "<hr>";


// --- PASSO 3: TESTE DE BUSCA DA LISTA DE CNPJS ---
echo "<h2>[PASSO 3] Testando busca da Lista de CNPJs...</h2>";
$sql_empresas = "SELECT cpf_cnpj, nome_fantasia FROM empresas_plugnotas ORDER BY nome_fantasia ASC";
echo "Executando a seguinte consulta SQL:<br><em>" . $sql_empresas . "</em><br><br>";

try {
    $stmt = $db->query($sql_empresas);
    $empresas = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if ($stmt->rowCount() > 0) {
        echo "<strong style='color:green;'>SUCESSO:</strong> A consulta encontrou " . count($empresas) . " empresa(s).<br><br>";
        echo "<strong>Lista de Empresas Encontradas:</strong><br>";
        print_r($empresas);
    } else {
        echo "<strong style='color:orange;'>AVISO:</strong> A consulta foi bem-sucedida, mas a tabela 'empresas_plugnotas' está vazia ou não retornou nenhum resultado.<br>";
    }

} catch (PDOException $e) {
    echo "<strong style='color:red;'>FALHA CRÍTICA:</strong> A consulta à tabela 'empresas_plugnotas' falhou.<br>";
    echo "<strong>Mensagem de Erro:</strong> " . $e->getMessage() . "<br>";
    echo "<strong>Verifique:</strong> O nome da tabela ('empresas_plugnotas') e das colunas ('cpf_cnpj', 'nome_fantasia') estão exatamente corretos? O usuário do banco tem permissão de leitura nesta tabela?<br>";
}

echo "<hr>";
echo "<h3>Diagnóstico Concluído.</h3>";
echo '</pre></body></html>';