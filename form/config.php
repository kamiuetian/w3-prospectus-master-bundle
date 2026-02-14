<?php
/**
 * Ranzo Tech LLC — contact form configuration.
 *
 * If you're deploying this site on a PHP-enabled host, you can edit the values below.
 * Tip: ensure your hosting is configured to send mail() successfully (SPF/DKIM recommended).
 */
return [
  'to_email' => 'customers@ranzotech.com',
  'site_name' => 'Ranzo Tech LLC',
  // Use a domain-based From address to reduce DMARC issues. Reply-To will be the sender's email.
  'from_email' => 'no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'ranzotech.com'),
  'success_redirect' => '/thank-you/',
];
