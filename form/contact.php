<?php
// Ranzo Tech LLC — contact form handler.
// Supports either PHP mail() or SMTP (recommended) via /form/smtp-config.php.
$config = require __DIR__ . '/config.php';

// Optional SMTP config (recommended for deliverability).
$smtpConfigured = false;
$smtpConfigFile = __DIR__ . '/smtp-config.php';
if (file_exists($smtpConfigFile)) {
  require $smtpConfigFile;
  if (
    defined('SMTP_HOST') && defined('SMTP_PORT') && defined('SMTP_ENCRYPTION') &&
    defined('SMTP_USERNAME') && defined('SMTP_PASSWORD')
  ) {
    // Treat placeholder values as “not configured”.
    $smtpConfigured =
      (stripos(SMTP_USERNAME, 'YOUR_REAL_ZOHO_MAILBOX') === false) &&
      (stripos(SMTP_PASSWORD, 'PASTE_ZOHO_APP_PASSWORD') === false);
  }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo "Method Not Allowed";
  exit;
}

// Honeypot (spam trap): field must stay empty
if (!empty($_POST['website'])) {
  http_response_code(200);
  echo "OK";
  exit;
}

function clean($value) {
  $value = trim((string)$value);
  $value = str_replace(["\r", "\n"], " ", $value);
  return $value;
}

$name = clean($_POST['name'] ?? '');
$company = clean($_POST['company'] ?? '');
$email = clean($_POST['email'] ?? '');
$phone = clean($_POST['phone'] ?? '');
$domain = clean($_POST['domain'] ?? ($_POST['domain_interest'] ?? ''));
$timeline = clean($_POST['timeline'] ?? '');
$intent = clean($_POST['intent'] ?? '');
$message = trim((string)($_POST['message'] ?? ''));

if ($name === '' || $email === '' || $message === '') {
  http_response_code(400);
  echo "Missing required fields.";
  exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo "Invalid email.";
  exit;
}

$subjectDomain = $domain !== '' ? " — " . $domain : "";
$subject = $config['site_name'] . " Inquiry" . $subjectDomain;

$bodyLines = [];
$bodyLines[] = "New inquiry received via website form.";
$bodyLines[] = "";
$bodyLines[] = "Name: " . $name;
if ($company !== '') { $bodyLines[] = "Company: " . $company; }
$bodyLines[] = "Email: " . $email;
if ($phone !== '') { $bodyLines[] = "Phone: " . $phone; }
if ($domain !== '') { $bodyLines[] = "Domain: " . $domain; }
if ($timeline !== '') { $bodyLines[] = "Timeline: " . $timeline; }
if ($intent !== '') { $bodyLines[] = "Intended Use: " . $intent; }
$bodyLines[] = "";
$bodyLines[] = "Message:";
$bodyLines[] = $message;

$body = implode("\n", $bodyLines);

// Headers (for both SMTP and mail())
$headers = [];
$headers[] = "MIME-Version: 1.0";
$headers[] = "Content-Type: text/plain; charset=UTF-8";
$fromEmail = $config['from_email'];
$fromName = $config['site_name'];

// If SMTP is enabled, use the authenticated mailbox as From to avoid DMARC rejection.
if ($smtpConfigured) {
  $fromEmail = SMTP_USERNAME;
}

$headers[] = "From: " . $fromName . " <" . $fromEmail . ">";
$headers[] = "Reply-To: " . $name . " <" . $email . ">";
$headers[] = "To: " . $config['to_email'];
$headers[] = "Date: " . date('r');
$rand = '';
if (function_exists('random_bytes')) {
  $rand = bin2hex(random_bytes(12));
} elseif (function_exists('openssl_random_pseudo_bytes')) {
  $rand = bin2hex(openssl_random_pseudo_bytes(12));
} else {
  $rand = bin2hex((string)microtime(true) . (string)mt_rand());
}
$headers[] = "Message-ID: <" . $rand . "@" . (($_SERVER['HTTP_HOST'] ?? 'ranzotech.com')) . ">";
$headers[] = "X-Mailer: RanzoTech-Form";

/**
 * Minimal SMTP sender (SSL 465 or STARTTLS 587).
 *
 * NOTE: This is intentionally dependency-free to keep deployment simple.
 */
function smtp_send_mail($to, $subject, $body, $headers, $fromEmail) {
  $host = SMTP_HOST;
  $port = (int)SMTP_PORT;
  $enc  = strtolower((string)SMTP_ENCRYPTION);

  $timeout = 15;
  $remote = ($enc === 'ssl') ? "ssl://{$host}:{$port}" : "{$host}:{$port}";
  $fp = @stream_socket_client($remote, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT);
  if (!$fp) {
    throw new Exception("SMTP connect failed: {$errstr} ({$errno})");
  }
  stream_set_timeout($fp, $timeout);

  $debug = (defined('SMTP_DEBUG') && SMTP_DEBUG);

  $readResponse = function() use ($fp, $debug) {
    $data = '';
    while (($line = fgets($fp, 515)) !== false) {
      $data .= $line;
      // Response line format: "XYZ " indicates last line.
      if (preg_match('/^\d{3}\s/', $line)) {
        break;
      }
    }
    if ($debug) { echo "S: " . $data; }
    $code = (int)substr($data, 0, 3);
    return [$code, $data];
  };

  $sendCommand = function($cmd, $expect) use ($fp, $readResponse, $debug) {
    if ($debug) { echo "C: {$cmd}\n"; }
    fwrite($fp, $cmd . "\r\n");
    [$code, $resp] = $readResponse();
    $expect = (array)$expect;
    if (!in_array($code, $expect, true)) {
      throw new Exception("SMTP error after '{$cmd}': {$resp}");
    }
    return [$code, $resp];
  };

  // Server greeting
  [$gCode, $gResp] = $readResponse();
  if ($gCode < 200 || $gCode >= 400) {
    throw new Exception("SMTP greeting error: {$gResp}");
  }

  $hostname = $_SERVER['HTTP_HOST'] ?? 'ranzotech.com';
  $sendCommand("EHLO {$hostname}", [250]);

  if ($enc === 'tls') {
    $sendCommand("STARTTLS", [220]);
    if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
      throw new Exception("Failed to enable STARTTLS.");
    }
    // EHLO again after TLS
    $sendCommand("EHLO {$hostname}", [250]);
  }

  // AUTH LOGIN
  $sendCommand("AUTH LOGIN", [334]);
  $sendCommand(base64_encode(SMTP_USERNAME), [334]);
  $sendCommand(base64_encode(SMTP_PASSWORD), [235]);

  // Envelope
  $sendCommand("MAIL FROM:<{$fromEmail}>", [250]);
  $sendCommand("RCPT TO:<{$to}>", [250, 251]);
  $sendCommand("DATA", [354]);

  // Build message
  $safeSubject = "=?UTF-8?B?" . base64_encode($subject) . "?=";
  $msg = "Subject: {$safeSubject}\r\n";
  $msg .= implode("\r\n", $headers) . "\r\n\r\n";

  // Dot-stuffing
  $body = str_replace("\r\n", "\n", $body);
  $body = str_replace("\r", "\n", $body);
  $lines = explode("\n", $body);
  foreach ($lines as &$l) {
    if (isset($l[0]) && $l[0] === '.') {
      $l = '.' . $l;
    }
  }
  $msg .= implode("\r\n", $lines) . "\r\n";

  // End of DATA
  fwrite($fp, $msg . "\r\n.\r\n");
  [$dCode, $dResp] = $readResponse();
  if ($dCode !== 250) {
    throw new Exception("SMTP DATA not accepted: {$dResp}");
  }

  $sendCommand("QUIT", [221, 250]);
  fclose($fp);
  return true;
}

// Send
$ok = false;
if ($smtpConfigured) {
  try {
    $ok = smtp_send_mail($config['to_email'], $subject, $body, $headers, $fromEmail);
  } catch (Exception $e) {
    // SMTP failed; fall back to mail() if available.
    $ok = @mail($config['to_email'], $subject, $body, implode("\r\n", $headers));
  }
} else {
  $ok = @mail($config['to_email'], $subject, $body, implode("\r\n", $headers));
}

if (!$ok) {
  http_response_code(500);
  echo "Mail send failed. Please email us directly.";
  exit;
}

// Redirect to thank you page
$redirect = $config['success_redirect'] ?? '/thank-you/';
header("Location: " . $redirect, true, 303);
exit;
