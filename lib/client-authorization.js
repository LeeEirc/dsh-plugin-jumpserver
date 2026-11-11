export async function authorizeInBrowser(request, id, browser = window) {
  const location = browser.location;
  const desktop = !['http:', 'https:'].includes(location.protocol);
  let popup;
  if (!desktop) {
    try { popup = browser.open('about:blank', '_blank'); if (popup) popup.opener = null; }
    catch { /* A blocked popup must not prevent preparing a manual authorization link. */ }
  }
  try {
    const options = { openBrowser: desktop };
    if (location.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) {
      const callback = new URL(location.origin);
      if (callback.hostname === 'localhost') callback.hostname = '127.0.0.1';
      options.callbackOrigin = callback.origin;
    }
    const result = await request({ action: 'authorize', id, options });
    if (desktop) return result;
    const url = new URL(result.authorizeUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid authorization URL');
    if (popup && !popup.closed) { popup.location.href = url.href; return { ...result, browserOpened: true }; }
    return { ...result, browserOpened: false };
  } catch (error) { popup?.close(); throw error; }
}
