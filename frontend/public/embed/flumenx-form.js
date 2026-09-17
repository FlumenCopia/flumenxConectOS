/**
 * flumenxConectOS Universal Embeddable Form Loader
 * Lightweight client script to render dynamic forms inside any host website.
 */
(function () {
  const scripts = document.querySelectorAll('script[data-form-key]');
  if (!scripts || scripts.length === 0) return;

  const currentScript = scripts[scripts.length - 1];
  const formKey = currentScript.getAttribute('data-form-key');
  if (!formKey) return;

  const scriptSrc = currentScript.getAttribute('src') || '';
  let baseUrl = window.location.origin;
  try {
    const urlObj = new URL(scriptSrc, window.location.href);
    baseUrl = urlObj.origin;
  } catch (e) {
    // fallback to current origin
  }

  const containerId = `flumenx-form-${formKey}`;
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    currentScript.parentNode.insertBefore(container, currentScript);
  }

  const iframe = document.createElement('iframe');
  iframe.src = `${baseUrl}/public/forms/${formKey}`;
  iframe.style.width = '100%';
  iframe.style.maxWidth = '640px';
  iframe.style.height = '620px';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '12px';
  iframe.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('title', 'FlumenX Intake Form');

  container.appendChild(iframe);
})();
