<?php
/**
 * Ranzo Tech LLC — SMTP configuration (Zoho example).
 *
 * 1) Replace SMTP_USERNAME with a REAL Zoho mailbox you can authenticate as.
 *    (Aliases often cannot authenticate.)
 * 2) Use a Zoho App Password for SMTP_PASSWORD (recommended).
 *
 * After updating, upload this file along with the rest of the site.
 */

define('SMTP_HOST', 'smtppro.zoho.com');
define('SMTP_PORT', 465);               // 465 (SSL) or 587 (STARTTLS)
define('SMTP_ENCRYPTION', 'ssl');       // 'ssl' or 'tls'

// IMPORTANT: SMTP_USERNAME should be a REAL Zoho mailbox you can authenticate as.
// Aliases often cannot authenticate. Use your main mailbox login.
define('SMTP_USERNAME', 'YOUR_REAL_ZOHO_MAILBOX@YOURDOMAIN.COM');

// Use a Zoho App Password here (recommended, especially if you sign in with Google / have 2FA).
define('SMTP_PASSWORD', 'PASTE_ZOHO_APP_PASSWORD_HERE');

// Optional: set true to echo SMTP conversation (debugging only; do NOT enable on production).
define('SMTP_DEBUG', false);
