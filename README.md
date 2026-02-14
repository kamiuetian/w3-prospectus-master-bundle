# Ranzo Tech LLC Website (Static + PHP Contact Form)

This package contains a complete, production-ready static website for **Ranzotech.com** with a simple PHP contact form handler.

## Quick Upload (PHP Hosting)

1. Upload **all files and folders** to your web root (commonly `public_html/`).
2. Ensure your hosting supports **PHP** (the contact form posts to `/form/contact.php`).
3. Visit:
   - `/` (homepage)
   - `/domains/` (W3 inventory)
   - `/contact/` (general inquiry)
4. Test the inquiry form:
   - Submitting should redirect to `/thank-you/`
   - Emails will be sent to: **customers@ranzotech.com**

### If emails don’t deliver
Some hosts require domain email configuration (SPF/DKIM) for reliable delivery.

Options:
- Configure SPF/DKIM for the sending domain.
- Enable SMTP (recommended): edit `/form/smtp-config.php` and set your Zoho mailbox + app password.
  - The form handler will automatically use SMTP when configured.
  - Emails are always delivered to: **customers@ranzotech.com**

## Static Hosting (No PHP)
If deploying to a static host (Netlify, Cloudflare Pages, S3, etc.), the included PHP form will not run.
Your developer can:
- Connect the forms to your preferred form service or serverless function, **or**
- Convert the form action to a `mailto:customers@ranzotech.com` fallback.

## Editing Inventory (W3 Domains)
- Domain pages live in `/domains/<slug>/index.html`
- The hub listing is `/domains/index.html`

To add more domains, duplicate a domain folder and update:
- Page title / H1
- Meta description
- Inquiry form hidden field `domain`

## Phone & Email
Site-wide phone: **866-692-4322**
Site-wide email: **customers@ranzotech.com**

## Footer Ownership Statement
Every page includes:
> “Ranzo Tech LLC is the owner and operator of this site.”

---
© 2026 Ranzo Tech LLC


## Deploying Each W3 Domain as Its Own Landing Site
If you want buyers to land directly on a W3 domain (e.g., `W3.Realestate`) and submit an inquiry there:

1. Point the domain to your hosting.
2. Copy the **entire site** to that domain’s web root, or at minimum copy:
   - `/assets/`
   - `/form/` (PHP handler)
   - `/thank-you/`
   - The single landing page you want to serve as the homepage (recommended)

### Option A (recommended): Make the domain page the homepage
Example for W3.Realestate:
- Copy `/domains/w3-realestate/index.html` to the domain root as `/index.html`

Then update the canonical URL inside `<link rel="canonical">` (optional but recommended).

### Option B: Keep full navigation
Deploy the full site as-is so the domain routes work normally.
