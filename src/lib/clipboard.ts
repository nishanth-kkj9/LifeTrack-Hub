export async function copyText(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to legacy textarea + execCommand fallback
  }

  let textarea: HTMLTextAreaElement | null = null;
  try {
    if (typeof document === 'undefined' || !document.body) {
      return false;
    }

    const activeEl =
      typeof document.activeElement === 'object' && document.activeElement !== null
        ? (document.activeElement as HTMLElement)
        : null;

    textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();
    if (typeof textarea.setSelectionRange === 'function') {
      textarea.setSelectionRange(0, text.length);
    }

    const ok =
      typeof document.execCommand === 'function' && document.execCommand('copy') === true;

    if (activeEl && typeof activeEl.focus === 'function') {
      activeEl.focus();
    }
    return ok;
  } catch {
    return false;
  } finally {
    if (textarea && textarea.parentNode) {
      textarea.parentNode.removeChild(textarea);
    }
  }
}
