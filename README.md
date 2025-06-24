# NFSe Manager

O NFSe Manager é uma aplicação web baseada em PHP projetada para simplificar a gestão e o envio automatizado de Notas Fiscais de Serviço Eletrônicas (NFSe) para a API da PlugNotas. Ele oferece uma interface amigável para visualizar notas pendentes e enviadas, com funcionalidades para envio individual ou em lote.

## Sumário

- [Funcionalidades](#funcionalidades)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
  - [Configuração do Banco de Dados](#configuração-do-banco-de-dados)
  - [Configuração da Aplicação](#configuração-da-aplicação)
- [Uso](#uso)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Componentes Chave](#componentes-chave)
- [Integração com a API](#integração-com-a-api)
- [Registro de Logs e Tratamento de Erros](#registro-de-logs-e-tratamento-de-erros)
- [Considerações de Segurança](#considerações-de-segurança)
- [Solução de Problemas](#solução-de-problemas)
- [Contribuição](#contribuição)
- [Licença](#licença)

## Funcionalidades

- **Visualizar NFSe Pendentes:** Consulte e liste registros de NFSe que aguardam envio, com filtro por período.
- **Visualizar NFSe Enviadas:** Consulte e liste registros de NFSe que já foram enviados com sucesso, com filtro por período.
- **Envio Individual de NFSe:** Envie uma única NFSe para a API da PlugNotas diretamente da interface.
- **Envio em Lote de NFSe:** Envie todos os registros de NFSe pendentes em uma única operação.
- **Paginação Dinâmica:** Navegue eficientemente por grandes listas de registros de NFSe, exibindo no máximo 5 links de página por vez, com reticências para navegação.
- **Truncamento de Descrição:** As descrições de serviço são truncadas para 3 linhas para melhor legibilidade, com o texto completo disponível ao passar o mouse.
- **Integração com Banco de Dados:** Conecta-se a um banco de dados SQL Server para buscar dados de NFSe.
- **Integração com API PlugNotas:** Comunica-se com a API da PlugNotas para envio de NFSe e registro de séries.
- **Registro de Logs:** Registra atividades da aplicação e respostas da API para auditoria e depuração.
- **Relatório de Erros:** Captura e registra erros para facilitar a identificação de problemas.

## Pré-requisitos

Antes de configurar o NFSe Manager, certifique-se de ter o seguinte instalado:

- **Servidor Web:** Apache, Nginx ou similar.
- **PHP:** Versão 7.4 ou superior (recomendado).
  - **Extensões PHP:** `php_pdo_sqlsrv` (para conexão com SQL Server), `php_curl` (para chamadas de API), `php_mbstring` (para tratamento de codificação de caracteres).
- **Banco de Dados:** Microsoft SQL Server (conforme indicado pelo DSN `sqlsrv`).
- **Composer** (Opcional, mas recomendado para gerenciamento de dependências se você expandir o projeto).

## Instalação

### Configuração do Banco de Dados

1.  **Conexão com o Banco de Dados:** A aplicação se conecta a um banco de dados SQL Server. Certifique-se de que seu servidor de banco de dados esteja acessível de onde a aplicação está hospedada.
2.  **Tabela `rps_tmp`:** A aplicação consulta uma tabela chamada `rps_tmp` para dados de NFSe. Esta tabela é esperada para conter campos como `nr_rps`, `serie`, `dt_emissao`, `vl_total`, `cnpj_prestador`, `desc_servico`, `st_extracao`, `flg_importado`, entre outros.
3.  **Tabela `emitente`:** A aplicação faz um `INNER JOIN` com uma tabela `emitente` (apelidada como `emitente`) para detalhes do prestador de serviço.
4.  **Tabela `emitente_tmp`:** A aplicação realiza um `OUTER APPLY` com uma tabela `emitente_tmp` para detalhes do tomador (cliente).
5.  **Tabela `servico_municipal`:** A aplicação realiza um `OUTER APPLY` com uma tabela `servico_municipal` para detalhes do código de serviço.

    **Nota:** O esquema exato para essas tabelas não é fornecido, mas elas devem conter as colunas referenciadas na consulta `getNotesFromDb` em `functions.php` para que a aplicação funcione corretamente.

### Configuração da Aplicação

1.  **Renomeie `config.model.php`:** Duplique o arquivo `config.model.php` e renomeie-o para `config.php`.
2.  **Edite `config.php`:** Abra `config.php` e preencha as variáveis de configuração necessárias:

    ```php
    <?php
    // config.php

    // Configuração do Banco de Dados
    define('DB_SERVER', 'SEU_IP_OU_HOSTNAME_DO_SERVIDOR_BD'); // Ex: '192.168.0.76'
    define('DB_NAME', 'SEU_NOME_DO_BANCO_DE_DADOS');           // Ex: 'SESCNFSE_PRD'
    define('DB_USER', 'SEU_USUARIO_DO_BD');           // Ex: 'usr_consulta_nfe'
    define('DB_PASS', 'SUA_SENHA_DO_BD');           // !!! IMPORTANTE: Armazene isso de forma segura em produção
    define('DB_DSN', "sqlsrv:Server=" . DB_SERVER . ";Database=" . DB_NAME . ";TrustServerCertificate=1");

    // Configuração da API PlugNotas
    define('PLUGNOTAS_API_URL_NFSE', "[https://api.plugnotas.com.br/nfse](https://api.plugnotas.com.br/nfse)");
    define('PLUGNOTAS_API_URL_SERIE', "[https://api.plugnotas.com.br/nfse/serie](https://api.plugnotas.com.br/nfse/serie)");
    define('PLUGNOTAS_API_TOKEN', "SEU_TOKEN_DA_API_PLUGNOTAS"); // !!! IMPORTANTE: Armazene isso de forma segura

    // Arquivos de Log
    define('LOG_FILE', 'log_envio_nfse.txt');
    define('ERROR_REPORT_FILE', 'relatorio_erros_nfse.txt');

    // CNPJs Permitidos do Prestador de Serviço
    $GLOBALS['PRESTADOR_CNPJS_PERMITIDOS'] = [
        // Liste seus CNPJs permitidos aqui
        '03621867002449', // SESC GINASTICO
        // ...
    ];

    // Códigos de Serviço Permitidos
    $GLOBALS['SERVICO_CODIGOS_PERMITIDOS'] = [
        // Liste seus códigos de serviço permitidos aqui
        '030307','040205', // ...
    ];

    date_default_timezone_set('America/Sao_Paulo');

    // --- CONFIGURAÇÕES DE DEPURAÇÃO ---
    ini_set('display_errors', 1);       // Desligar em produção
    ini_set('display_startup_errors', 1); // Desligar em produção
    error_reporting(E_ALL);
    ini_set('log_errors', 1);
    ini_set('error_log', 'php_errors.log'); // Certifique-se de que este arquivo seja gravável
    // --- FIM DAS CONFIGURAÇÕES DE DEPURAÇÃO ---
    ```

3.  **Permissões de Arquivo:** Certifique-se de que seu servidor web tenha permissões de gravação para os arquivos `log_envio_nfse.txt`, `relatorio_erros_nfse.txt` e `php_errors.log` (ou para o diretório onde eles estão). Crie esses arquivos se eles não existirem.
4.  **Localização dos Arquivos:** Faça o upload de todos os arquivos do projeto (`index.php`, `api.php`, `functions.php`, `config.php`, `css/`, `js/`, `src/`) para a raiz do documento do seu servidor web ou para um subdiretório.

## Uso

1.  **Acesse a Aplicação:** Abra seu navegador web e navegue até a URL onde você implantou o arquivo `index.php` (ex: `http://localhost/nfse_manager/` ou `http://seudominio.com/nfse_manager/`).
2.  **Consultar Notas:**
    - Selecione uma "Data Início" e "Data Fim".
    - Clique em "Consultar Pendentes" para visualizar os registros de NFSe aguardando envio.
    - Clique em "Consultar Enviadas" para visualizar os registros de NFSe que já foram enviados.
3.  **Enviar NFSe Individual:** Na tabela "Notas Fiscais", localize uma NFSe pendente e clique no botão "Enviar" em sua linha.
4.  **Enviar Todas as NFSe Pendentes:** Clique no botão "Enviar Todas as Pendentes" para tentar enviar todos os registros de NFSe pendentes atualmente exibidos.
5.  **Paginação:** Use os controles de paginação na parte inferior da tabela para navegar entre as várias páginas de resultados.

## Estrutura do Projeto

Markdown

# NFSe Manager

O NFSe Manager é uma aplicação web baseada em PHP projetada para simplificar a gestão e o envio automatizado de Notas Fiscais de Serviço Eletrônicas (NFSe) para a API da PlugNotas. Ele oferece uma interface amigável para visualizar notas pendentes e enviadas, com funcionalidades para envio individual ou em lote.

## Sumário

- [Funcionalidades](#funcionalidades)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
  - [Configuração do Banco de Dados](#configuração-do-banco-de-dados)
  - [Configuração da Aplicação](#configuração-da-aplicação)
- [Uso](#uso)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Componentes Chave](#componentes-chave)
- [Integração com a API](#integração-com-a-api)
- [Registro de Logs e Tratamento de Erros](#registro-de-logs-e-tratamento-de-erros)
- [Considerações de Segurança](#considerações-de-segurança)
- [Solução de Problemas](#solução-de-problemas)
- [Contribuição](#contribuição)
- [Licença](#licença)

## Funcionalidades

- **Visualizar NFSe Pendentes:** Consulte e liste registros de NFSe que aguardam envio, com filtro por período.
- **Visualizar NFSe Enviadas:** Consulte e liste registros de NFSe que já foram enviados com sucesso, com filtro por período.
- **Envio Individual de NFSe:** Envie uma única NFSe para a API da PlugNotas diretamente da interface.
- **Envio em Lote de NFSe:** Envie todos os registros de NFSe pendentes em uma única operação.
- **Paginação Dinâmica:** Navegue eficientemente por grandes listas de registros de NFSe, exibindo no máximo 5 links de página por vez, com reticências para navegação.
- **Truncamento de Descrição:** As descrições de serviço são truncadas para 3 linhas para melhor legibilidade, com o texto completo disponível ao passar o mouse.
- **Integração com Banco de Dados:** Conecta-se a um banco de dados SQL Server para buscar dados de NFSe.
- **Integração com API PlugNotas:** Comunica-se com a API da PlugNotas para envio de NFSe e registro de séries.
- **Registro de Logs:** Registra atividades da aplicação e respostas da API para auditoria e depuração.
- **Relatório de Erros:** Captura e registra erros para facilitar a identificação de problemas.

## Pré-requisitos

Antes de configurar o NFSe Manager, certifique-se de ter o seguinte instalado:

- **Servidor Web:** Apache, Nginx ou similar.
- **PHP:** Versão 7.4 ou superior (recomendado).
  - **Extensões PHP:** `php_pdo_sqlsrv` (para conexão com SQL Server), `php_curl` (para chamadas de API), `php_mbstring` (para tratamento de codificação de caracteres).
- **Banco de Dados:** Microsoft SQL Server (conforme indicado pelo DSN `sqlsrv`).
- **Composer** (Opcional, mas recomendado para gerenciamento de dependências se você expandir o projeto).

## Instalação

### Configuração do Banco de Dados

1.  **Conexão com o Banco de Dados:** A aplicação se conecta a um banco de dados SQL Server. Certifique-se de que seu servidor de banco de dados esteja acessível de onde a aplicação está hospedada.
2.  **Tabela `rps_tmp`:** A aplicação consulta uma tabela chamada `rps_tmp` para dados de NFSe. Esta tabela é esperada para conter campos como `nr_rps`, `serie`, `dt_emissao`, `vl_total`, `cnpj_prestador`, `desc_servico`, `st_extracao`, `flg_importado`, entre outros.
3.  **Tabela `emitente`:** A aplicação faz um `INNER JOIN` com uma tabela `emitente` (apelidada como `emitente`) para detalhes do prestador de serviço.
4.  **Tabela `emitente_tmp`:** A aplicação realiza um `OUTER APPLY` com uma tabela `emitente_tmp` para detalhes do tomador (cliente).
5.  **Tabela `servico_municipal`:** A aplicação realiza um `OUTER APPLY` com uma tabela `servico_municipal` para detalhes do código de serviço.

    **Nota:** O esquema exato para essas tabelas não é fornecido, mas elas devem conter as colunas referenciadas na consulta `getNotesFromDb` em `functions.php` para que a aplicação funcione corretamente.

### Configuração da Aplicação

1.  **Renomeie `config.model.php`:** Duplique o arquivo `config.model.php` e renomeie-o para `config.php`.
2.  **Edite `config.php`:** Abra `config.php` e preencha as variáveis de configuração necessárias
3.  **Permissões de Arquivo:** Certifique-se de que seu servidor web tenha permissões de gravação para os arquivos `log_envio_nfse.txt`, `relatorio_erros_nfse.txt` e `php_errors.log` (ou para o diretório onde eles estão). Crie esses arquivos se eles não existirem.
4.  **Localização dos Arquivos:** Faça o upload de todos os arquivos do projeto (`index.php`, `api.php`, `functions.php`, `config.php`, `css/`, `js/`, `src/`) para a raiz do documento do seu servidor web ou para um subdiretório.

## Uso

1.  **Acesse a Aplicação:** Abra seu navegador web e navegue até a URL onde você implantou o arquivo `index.php` (ex: `http://localhost/nfse_manager/` ou `http://seudominio.com/nfse_manager/`).
2.  **Consultar Notas:**
    - Selecione uma "Data Início" e "Data Fim".
    - Clique em "Consultar Pendentes" para visualizar os registros de NFSe aguardando envio.
    - Clique em "Consultar Enviadas" para visualizar os registros de NFSe que já foram enviados.
3.  **Enviar NFSe Individual:** Na tabela "Notas Fiscais", localize uma NFSe pendente e clique no botão "Enviar" em sua linha.
4.  **Enviar Todas as NFSe Pendentes:** Clique no botão "Enviar Todas as Pendentes" para tentar enviar todos os registros de NFSe pendentes atualmente exibidos.
5.  **Paginação:** Use os controles de paginação na parte inferior da tabela para navegar entre as várias páginas de resultados.

## Estrutura do Projeto

nfse_manager/
├── api.php # Lida com as requisições da API do frontend (busca, envio)
├── config.model.php # Modelo para as configurações (renomeie para config.php)
├── config.php # Configuração da aplicação (banco de dados, chaves de API, CNPJs permitidos, etc.)
├── functions.php # Contém funções auxiliares (conexão BD, log, registro de série na API, consultas BD)
├── index.php # Interface principal do frontend (HTML, CSS, inclusões JS)
├── css/
│ └── custom.css # Estilos CSS personalizados, incluindo o truncamento de descrição
├── js/
│ └── scripts.js # JavaScript do frontend para interatividade, chamadas de API, renderização da tabela e paginação
└── src/
├── bootstrap/ # Arquivos do framework Bootstrap
│ ├── css/
│ │ └── bootstrap.min.css
│ └── js/
│ └── bootstrap.bundle.min.js
└── ... # Outros ativos potenciais

## Componentes Chave

- **`config.php`**: Arquivo de configuração centralizado para credenciais do banco de dados, chaves da API PlugNotas, caminhos de arquivos de log e arrays de CNPJs e códigos de serviço permitidos.
- **`functions.php`**:
  - `getDbConnection()`: Estabelece uma conexão PDO com o banco de dados SQL Server.
  - `writeLog()`: Função utilitária para escrever mensagens em arquivos de log especificados.
  - `cadastrarSerie()`: Lida com o registro ou atualização de séries de NFSe na API da PlugNotas. Isso é acionado quando um erro "Serie inválida ou não cadastrada" é encontrado durante o envio da NFSe.
  - `getNotesFromDb()`: Consulta a tabela `rps_tmp` e tabelas relacionadas para recuperar registros de NFSe pendentes ou enviadas com base em filtros.
- **`api.php`**: Atua como o endpoint da API de backend. Ele lida com diferentes ações como `getPendingNotes`, `getSentNotes` e `sendNFSe` com base nas requisições recebidas.
  - Constrói o payload da NFSe de acordo com as especificações da API PlugNotas, com lógica específica para certos CNPJs (ex: `'03621867002520'` e `'03621867000900'`) afetando série, CNAE, códigos de serviço e informações da cidade.
  - Utiliza cURL para interagir com a API PlugNotas.
  - Atualiza o status da tabela `rps_tmp` (`st_extracao`, `flg_importado`) após respostas bem-sucedidas ou conflitantes da API.
- **`index.php`**: A interface principal do usuário, fornecendo formulários para seleção de período, botões para ações e uma tabela para exibir os registros de NFSe. Inclui Bootstrap para estilização e `scripts.js` para comportamento dinâmico.
- **`js/scripts.js`**: Gerencia as interações do frontend, incluindo:
  - Busca assíncrona de notas de `api.php`.
  - Preenchimento da tabela de NFSe.
  - Implementação de paginação do lado do cliente com controles para exibir 5 páginas por vez, incluindo reticências para navegação.
  - Aplicação de CSS para truncamento de texto nas descrições de serviço.
  - Tratamento dos cliques dos botões "Enviar" para envios individuais e em lote.
  - Exibição de indicadores de carregamento e mensagens ao usuário.
- **`css/custom.css`**: Contém regras CSS personalizadas, notavelmente a classe `.description-truncate` para truncar descrições de serviço em três linhas com reticências. Também inclui estilo para um rodapé fixo.

## Integração com a API

A aplicação se integra com a API da PlugNotas para o gerenciamento de NFSe.

- **Endpoint de Envio de NFSe:** `https://api.plugnotas.com.br/nfse`
- **Endpoint de Registro de Série:** `https://api.plugnotas.com.br/nfse/serie`
- **Autenticação:** As requisições da API são autenticadas usando um cabeçalho `X-API-Key` com o token definido em `PLUGNOTAS_API_TOKEN`.

## Registro de Logs e Tratamento de Erros

- **`log_envio_nfse.txt`:** Registra detalhes das tentativas de envio de NFSe e chamadas da API de registro de série, incluindo códigos HTTP e respostas.
- **`relatorio_erros_nfse.txt`:** Registra mensagens de erro específicas encontradas durante o envio de NFSe, particularmente para respostas HTTP 200, 400 ou 409 inesperadas.
- **`php_errors.log`:** Log de erro padrão do PHP, configurado para capturar todos os erros, avisos e notificações do PHP.
- **`PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION`:** A conexão do banco de dados é configurada para lançar exceções em caso de erros, que são então capturadas e registradas.
- **`ini_set('display_errors', 1)`:** Habilitado para desenvolvimento/depuração. **É crucial definir isso para `0` em um ambiente de produção por questões de segurança.**

## Considerações de Segurança

- **Dados Sensíveis:** `DB_PASS` e `PLUGNOTAS_API_TOKEN` são explicitamente marcados como "IMPORTANTE: Armazene isso de forma segura" em `config.php`. **Para ambientes de produção, considere usar variáveis de ambiente, serviços de gerenciamento de segredos ou um sistema de gerenciamento de configuração mais robusto em vez de codificar esses valores diretamente em `config.php`.**
- **Validação de Entrada:** Embora a aplicação construa o payload, a entrada do lado do cliente é mínima (datas). A validação de dados do lado do servidor obtidos do banco de dados antes de enviar para uma API de terceiros é uma boa prática.
- **Exibição de Erros:** `display_errors` está habilitado para depuração. **Certifique-se de que isso esteja definido como `0` (`ini_set('display_errors', 0);`) em produção para evitar que informações de erro sensíveis sejam expostas aos usuários finais.**
- **Injeção de SQL:** A função `getNotesFromDb` utiliza prepared statements (`$db->prepare($sqlNotas); $stmt->execute($queryParams);`), o que ajuda a prevenir vulnerabilidades de injeção de SQL.

## Solução de Problemas

- **"Erro ao conectar ao banco de dados."**:
  - Verifique `config.php` para os valores corretos de `DB_SERVER`, `DB_NAME`, `DB_USER` e `DB_PASS`.
  - Certifique-se de que a extensão `php_pdo_sqlsrv` esteja instalada e habilitada em seu `php.ini`.
  - Verifique a conectividade de rede entre seu servidor web e o SQL Server.
  - Verifique as regras de firewall do SQL Server.
  - Consulte `php_errors.log` para erros de conexão de banco de dados mais específicos.
- **Erros da API (ex: HTTP 400, 409, outros códigos):**
  - Verifique `config.php` para o `PLUGNOTAS_API_TOKEN` correto.
  - Inspecione `log_envio_nfse.txt` e `relatorio_erros_nfse.txt` para respostas detalhadas da API e mensagens de erro.
  - Consulte a documentação da API PlugNotas para códigos de erro específicos e seus significados.
  - Um erro 409 pode indicar um RPS duplicado, que o sistema tenta lidar marcando a nota como enviada.
  - Um erro 400 sobre "Série inválida" acionará uma tentativa de registrar a série. Verifique os logs para o sucesso/falha desta operação.
- **Nenhuma Nota Exibida:**
  - Verifique o período selecionado.
  - Verifique a consulta `getNotesFromDb` em `functions.php` e certifique-se de que sua tabela `rps_tmp` contenha dados que correspondam às datas de emissão e aos filtros de status.
  - Confirme se o `cnpj_prestador` e `cd_servico` em sua tabela `rps_tmp` estão presentes nos arrays `$GLOBALS['PRESTADOR_CNPJS_PERMITIDOS']` e `$GLOBALS['SERVICO_CODIGOS_PERMITIDOS']` em `config.php`.
  - Consulte `php_errors.log` para quaisquer erros de consulta de banco de dados.
- **"Class 'PDO' not found"**: Certifique-se de que o PDO esteja habilitado em seu `php.ini` e que o driver SQLSRV específico esteja instalado e configurado.
- **CSS/JS não carregando:** Verifique se os caminhos para `src/bootstrap/css/bootstrap.min.css`, `css/custom.css`, `src/bootstrap/js/bootstrap.bundle.min.js` e `js/scripts.js` em `index.php` estão corretos em relação à raiz do seu documento no servidor web. Limpe o cache do navegador.

## Contribuição

Contribuições são bem-vindas! Por favor, siga estes passos:

1.  Faça um fork do repositório.
2.  Crie uma nova branch (`git checkout -b feature/SuaFuncionalidade`).
3.  Faça suas alterações.
4.  Faça commit de suas alterações (`git commit -am 'Adiciona nova funcionalidade'`).
5.  Envie para a branch (`git push origin feature/SuaFuncionalidade`).
6.  Crie um novo Pull Request.
