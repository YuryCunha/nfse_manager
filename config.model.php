<?php
// config.php

// Database configuration
define('DB_SERVER', '');
define('DB_NAME', '');
define('DB_USER', '');
define('DB_PASS', ''); // !!! IMPORTANT: Store this securely, e.g., environment variable in production
define('DB_DSN', "sqlsrv:Server=" . DB_SERVER . ";Database=" . DB_NAME . ";TrustServerCertificate=1");

// PlugNotas API configuration
define('PLUGNOTAS_API_URL_NFSE', "https://api.plugnotas.com.br/nfse");
define('PLUGNOTAS_API_URL_SERIE', "https://api.plugnotas.com.br/nfse/serie");
define('PLUGNOTAS_API_TOKEN', ""); // Your PlugNotas API token here !!! IMPORTANT: Store this securely

// Log files
define('LOG_FILE', 'log_envio_nfse.txt');
define('ERROR_REPORT_FILE', 'relatorio_erros_nfse.txt');

// Allowed CNPJs and Service Codes (from your original script)
$GLOBALS['PRESTADOR_CNPJS_PERMITIDOS'] = [

];

$GLOBALS['SERVICO_CODIGOS_PERMITIDOS'] = [

];

date_default_timezone_set('America/Sao_Paulo');

// --- DEBUGGING SETTINGS ---
ini_set('display_errors', 1); // Display errors directly in the browser (turn off in production)
ini_set('display_startup_errors', 1); // Display startup errors (turn off in production)
error_reporting(E_ALL); // Report all types of errors
ini_set('log_errors', 1); // Ensure errors are logged to a file
ini_set('error_log', 'php_errors.log'); // Path to your error log file. Make sure this file exists and is writable by the web server.
// --- END DEBUGGING SETTINGS ---