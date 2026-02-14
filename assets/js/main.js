(function(){
  const menuBtn = document.querySelector('[data-menu-btn]');
  const navLinks = document.querySelector('[data-navlinks]');
  if(menuBtn && navLinks){
    menuBtn.addEventListener('click', function(){
      navLinks.classList.toggle('open');
      const expanded = navLinks.classList.contains('open');
      menuBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
    
    // Close menu after selecting a link
    navLinks.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){
        navLinks.classList.remove('open');
        menuBtn.setAttribute('aria-expanded','false');
      });
    });
document.addEventListener('click', function(e){
      if(!navLinks.contains(e.target) && !menuBtn.contains(e.target)){
        navLinks.classList.remove('open');
        menuBtn.setAttribute('aria-expanded','false');
      }
    });
  }

  // rt-external-links: open external site links in a new tab
  try{
    const origin = window.location.origin;
    document.querySelectorAll('a[href^="http"]').forEach(a => {
      const href = a.getAttribute('href');
      if(!href) return;
      const u = new URL(href, origin);
      if(u.origin !== origin){
        a.setAttribute('target','_blank');
        const rel = (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
        for(const v of ['noopener','noreferrer']){
          if(!rel.includes(v)) rel.push(v);
        }
        a.setAttribute('rel', rel.join(' '));
      }
    });
  }catch(e){}

  // Prefill domain selection via ?domain=...
  const params = new URLSearchParams(window.location.search);
  const domainParam = params.get('domain');
  if(domainParam){
    const select = document.querySelector('select[name="domain_interest"]');
    if(select){
      const normalized = domainParam.trim();
      for(const opt of select.options){
        if(opt.value.toLowerCase() === normalized.toLowerCase()){
          opt.selected = true;
          break;
        }
      }
    }
    const hiddenDomain = document.querySelector('input[name="domain"]');
    if(hiddenDomain && !hiddenDomain.value){
      hiddenDomain.value = domainParam.trim();
    }
  }

  // Simple client-side validation hints
  const forms = document.querySelectorAll('form[data-rt-form]');
  forms.forEach(form => {
    form.addEventListener('submit', function(e){
      const email = form.querySelector('input[name="email"]');
      if(email && email.value){
        const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
        if(!ok){
          e.preventDefault();
          alert('Please enter a valid email address.');
          email.focus();
        }
      }
    });
  });

  // ==========================
  // Domain Status (from JSON)
  // ==========================
  const STATUS_URL = '/assets/data/domain-status.json';

  function normalizeStatus(val){
    if(!val) return 'open';
    let s = String(val).toLowerCase().trim();
    s = s.replace(/\s+/g,'_');
    if(s === 'open' || s === 'available') return 'open';
    if(s === 'sold' || s === 'closed') return 'sold';
    if(
      s === 'under_contract_review' ||
      s === 'undercontractreview' ||
      s === 'under_contract' ||
      s === 'undercontract' ||
      s === 'contract_review' ||
      s === 'under-contract-review'
    ) return 'under_contract_review';
    return 'open';
  }

  function getDomainKeyFromHref(href){
    if(!href) return null;
    try{
      const u = new URL(href, window.location.origin);
      const host = (u.hostname || '').toLowerCase();
      if(/^w3\./.test(host)) return host;

      const path = (u.pathname || '');
      const m = path.match(/^\/(w3\.[a-z0-9.-]+)(?:\/|$)/i);
      return m ? m[1].toLowerCase() : null;
    }catch(e){
      return null;
    }
  }

  function ensureOverlay(container, kind){
    let ov = container.querySelector(':scope > .status-overlay');
    if(!ov){
      ov = document.createElement('div');
      ov.className = 'status-overlay';
      container.appendChild(ov);
    }
    // Apply kind class if provided (e.g., contract)
    ov.className = 'status-overlay' + (kind ? (' status-overlay--' + kind) : '');
    return ov;
  }

  function ensureBadge(container, kind, text){
    let badge = container.querySelector(':scope > .status-badge');
    if(!badge){
      badge = document.createElement('div');
      badge.className = 'status-badge';
      container.appendChild(badge);
    }
    badge.className = 'status-badge' + (kind ? (' status-badge--' + kind) : '');
    badge.textContent = text || '';
    return badge;
  }

  function disableInquireLinks(container){
    const links = container.querySelectorAll('a.btn:not(.btn--outline), a.btn[href*="/contact/?domain="]');
    links.forEach(a => {
      // Keep "View" links enabled; disable only inquiry / request availability buttons
      const label = (a.textContent || '').toLowerCase();
      if(label.includes('inquire') || label.includes('request availability') || (a.getAttribute('href') || '').includes('/contact/?domain=')){
        a.classList.add('is-disabled');
        a.setAttribute('aria-disabled','true');
        a.setAttribute('tabindex','-1');
      }
    });
  }

  function disableForms(container){
    const form = container.querySelector('form');
    if(!form) return;
    form.querySelectorAll('input, select, textarea, button').forEach(el => {
      el.disabled = true;
    });
    const existing = container.querySelector('.status-note');
    if(!existing){
      const note = document.createElement('div');
      note.className = 'status-note';
      note.innerHTML = '<strong>Status:</strong> SOLD. This domain is no longer available.';
      // Place note near the top of the inquiry section if possible
      const anchor = container.querySelector('#inquiry') || container.querySelector('h2') || form;
      if(anchor && anchor.parentNode){
        anchor.parentNode.insertBefore(note, anchor.nextSibling);
      }else{
        form.parentNode.insertBefore(note, form);
      }
    }
  }

  function applyStatusToCard(card, domainKey, status){
    // Clear old status elements
    const oldWm = card.querySelector(':scope > .status-overlay');
    if(oldWm) oldWm.remove();
    const oldBadge = card.querySelector(':scope > .status-badge');
    if(oldBadge) oldBadge.remove();
    card.classList.remove('domain--under-contract');

    if(status === 'under_contract_review'){
      card.classList.add('domain--under-contract');
      const ov = ensureOverlay(card, 'contract');
      ov.textContent = 'UNDER CONTRACT REVIEW';
    }else if(status === 'sold'){
      const badge = ensureBadge(card, 'sold', 'SOLD');
      disableInquireLinks(card);
    }
  }

  function applyStatusToHero(hero, domainKey, status){
    // Prefer the right-side panel on domain pages; fall back to the hero container
    const target = hero.querySelector('.panel') || hero;

    // Clear old
    const oldOv = target.querySelector(':scope > .status-overlay');
    if(oldOv) oldOv.remove();
    const oldBadgeHero = hero.querySelector(':scope > .status-badge');
    if(oldBadgeHero) oldBadgeHero.remove();
    const oldBadgeTarget = target.querySelector(':scope > .status-badge');
    if(oldBadgeTarget) oldBadgeTarget.remove();

    hero.classList.remove('domain--under-contract');
    target.classList.remove('domain--under-contract');

    if(status === 'under_contract_review'){
      target.classList.add('domain--under-contract');
      const ov = ensureOverlay(target, 'contract');
      ov.textContent = 'UNDER CONTRACT REVIEW';
    }else if(status === 'sold'){
      ensureBadge(target, 'sold', 'SOLD');
      disableInquireLinks(hero);
      disableForms(document);
    }
  }

    function applyStatuses(statusMap){
    const statuses = statusMap || {};

    // Cards on listing pages
    document.querySelectorAll('.card .mono a[href^="https://w3."], .card .mono a[href^="/w3."]').forEach(a => {
      const card = a.closest('.card');
      if(!card) return;
      const key = getDomainKeyFromHref(a.getAttribute('href'));
      if(!key) return;
      const raw = statuses[key] && statuses[key].status ? statuses[key].status : statuses[key];
      const st = normalizeStatus(raw);
      applyStatusToCard(card, key, st);
    });

    // Domain landing page hero
    const hero = document.querySelector('.hero');
    const heroLink = hero ? hero.querySelector('h1 a[href^="https://w3."], h1 a[href^="/w3."]') : null;
    if(hero && heroLink){
      const key = getDomainKeyFromHref(heroLink.getAttribute('href'));
      const raw = statuses[key] && statuses[key].status ? statuses[key].status : statuses[key];
      const st = normalizeStatus(raw);
      applyStatusToHero(hero, key, st);
      if(st === 'sold'){
        // Disable inquiry section specifically if present
        const inquiry = document.querySelector('#inquiry');
        if(inquiry){
          disableForms(inquiry.closest('section') || document);
        }
      }
    }

    // Disable sold options in selects (home/contact)
    document.querySelectorAll('select[name="domain"]').forEach(sel => {
      Array.from(sel.options).forEach(opt => {
        const val = (opt.value || '').trim();
        if(!val || val.toLowerCase() === 'general inquiry') return;
        if(!/^w3\./i.test(val)) return;
        const key = ('w3.' + val.replace(/^w3\./i,'')).toLowerCase();
        const raw = statuses[key] && statuses[key].status ? statuses[key].status : statuses[key];
        const st = normalizeStatus(raw);
        if(st === 'sold'){
          opt.disabled = true;
        }
      });
    });
  }

  // Load statuses from JSON (fails gracefully)
  fetch(STATUS_URL, { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      const domains = data && data.domains ? data.domains : (data || {});
      applyStatuses(domains);
    })
    .catch(() => { /* no-op */ });



})();
