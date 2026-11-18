/* Cable — comportamento do site institucional (sem dependências). */
(function () {
  'use strict';

  var STORAGE_KEY = 'cable_cookie_consent';
  var HISTORY_KEY = 'cable_cookie_history';
  var CATEGORIES = ['preferences', 'statistics', 'marketing'];

  function readConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeConsent(action, categories, policyVersion) {
    var record = {
      action: action,
      categories: categories,
      policyVersion: policyVersion,
      at: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      var history = [];
      try {
        history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      } catch (error) {
        history = [];
      }
      history.unshift(record);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
    } catch (error) {
      /* armazenamento indisponível: o registro no servidor continua valendo */
    }
    return record;
  }

  function sendToServer(action, categories, policyVersion) {
    return fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, categories: categories, policyVersion: policyVersion }),
      credentials: 'same-origin',
    }).catch(function () {
      return null;
    });
  }

  /**
   * Ativa somente categorias consentidas.
   * Nenhum script de terceiros está configurado hoje: a função existe para que a
   * ativação condicional seja respeitada quando um serviço for cadastrado.
   */
  function applyCategories(categories) {
    document.documentElement.setAttribute('data-consent', (categories || []).join(',') || 'essential-only');
  }

  var banner = document.querySelector('[data-cookie-version]');

  function currentVersion() {
    return (banner && banner.getAttribute('data-cookie-version')) || '1.0';
  }

  function decide(action, categories) {
    var version = currentVersion();
    writeConsent(action, categories, version);
    applyCategories(categories);
    sendToServer(action, categories, version);
    if (banner) banner.hidden = true;
    renderHistory();
    setStatus('Preferências salvas. Você pode alterar a escolha a qualquer momento.');
    syncCheckboxes(categories);
  }

  function syncCheckboxes(categories) {
    document.querySelectorAll('[data-cookie-cat]').forEach(function (input) {
      input.checked = (categories || []).indexOf(input.getAttribute('data-cookie-cat')) !== -1;
    });
  }

  function setStatus(message) {
    var status = document.querySelector('[data-cookie-status]');
    if (!status) return;
    status.hidden = false;
    status.className = 'form-status is-ok';
    status.textContent = message;
  }

  function renderHistory() {
    var list = document.querySelector('[data-cookie-history]');
    if (!list) return;
    var history = [];
    try {
      history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch (error) {
      history = [];
    }
    if (!history.length) {
      list.innerHTML = '<li>Nenhum registro neste dispositivo.</li>';
      return;
    }
    list.innerHTML = history
      .map(function (item) {
        var when = new Date(item.at).toLocaleString('pt-BR');
        var cats = item.categories && item.categories.length ? item.categories.join(', ') : 'somente essenciais';
        return '<li>' + when + ' — ' + item.action + ' (' + cats + ') · política v' + item.policyVersion + '</li>';
      })
      .join('');
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-cookie-action]');
    if (trigger) {
      var action = trigger.getAttribute('data-cookie-action');
      if (action === 'accept') {
        decide('accept-all', CATEGORIES.slice());
      } else if (action === 'reject') {
        decide('reject-non-essential', []);
      } else if (action === 'customize') {
        window.location.href = '/cookies';
      } else if (action === 'save') {
        var selected = [];
        document.querySelectorAll('[data-cookie-cat]').forEach(function (input) {
          if (input.checked) selected.push(input.getAttribute('data-cookie-cat'));
        });
        decide('customize', selected);
      } else if (action === 'revoke') {
        decide('revoke', []);
      }
      return;
    }
  });

  var saved = readConsent();
  if (saved && saved.policyVersion === currentVersion()) {
    applyCategories(saved.categories);
    if (banner) banner.hidden = true;
  } else if (banner) {
    banner.hidden = false;
    applyCategories([]);
  }
  syncCheckboxes(saved && saved.categories);
  renderHistory();

  /* ---------------- Menu mobile ---------------- */
  var toggle = document.querySelector('[data-nav-toggle]');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* ---------------- Instalação PWA ---------------- */
  var installButton = document.querySelector('[data-install]');
  var installHint = document.querySelector('[data-install-hint]');
  var deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    if (installButton) {
      installButton.hidden = false;
      if (installHint) installHint.hidden = true;
    }
  });

  if (installButton) {
    installButton.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt = null;
      installButton.hidden = true;
    });
  }

  /* ---------------- Formulários ---------------- */
  document.querySelectorAll('form[data-validate]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      var button = form.querySelector('button[type="submit"]');
      if (!form.checkValidity()) return;
      if (button) {
        button.disabled = true;
        button.textContent = 'Enviando...';
      }
      /* Reabilita caso a navegação seja bloqueada pelo navegador. */
      setTimeout(function () {
        if (button) {
          button.disabled = false;
          button.textContent = button.getAttribute('data-label') || 'Enviar';
        }
      }, 6000);
      void event;
    });
  });
})();
