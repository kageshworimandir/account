/** Shared transport for the public page and the authenticated accounting UI. */
window.MandirAPI = (() => {
  function endpoint() {
    const value = String(window.MANDIR_CONFIG?.appsScriptURL || '').trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(value)) {
      throw new Error('config.js मा सही Apps Script /exec URL राख्नुहोस् ।');
    }
    return value;
  }

  async function send(gateway, request) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      // text/plain is a simple CORS request; application/json would need a preflight.
      // Apps Script ContentService redirects to its output URL: follow that redirect.
      const response = await fetch(endpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8'
        },
        body: JSON.stringify({
          ...request,
          gateway
        }),
        redirect: 'follow',
        credentials: 'omit',
        signal: controller.signal
      });
      if (!response.ok) throw new Error('Server response: ' + response.status);
      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (_) {
        throw new Error('Apps Script deployment को access Anyone र नयाँ version छ कि जाँच्नुहोस् ।');
      }
      if (!result || typeof result.ok !== 'boolean') throw new Error('Invalid server response.');
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('उत्तर आउन ढिलो भयो । विवरण सुरक्षित भएको छ कि जाँचेर पुनः प्रयास गर्नुहोस् ।');
      }
      if (error instanceof TypeError) {
        throw new Error('जडान भएन । Internet, config.js को URL र Web app access Anyone जाँच्नुहोस् ।');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    send
  };
})();
