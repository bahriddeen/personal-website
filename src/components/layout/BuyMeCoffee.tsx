import { useEffect } from 'react';

const SCRIPT_ID = 'bmc-widget-script';

/** Buy Me a Coffee page: https://www.buymeacoffee.com/mbahriddin */
const WIDGET = {
  id: 'mbahriddin',
  description: 'Support me on Buy me a coffee!',
  message: '',
  // Mid-tone blue, readable against both the white and the near-black page.
  color: '#5F7FFF',
  // The bottom right already holds the theme toggle and the back-to-top button.
  // Must be lowercase: the vendor script compares it to "left" exactly.
  position: 'left',
  // Lines the button up with the theme toggle (32px from the edge).
  xMargin: '32',
  yMargin: '32',
};

/**
 * Floating "Buy me a coffee" button, public pages only.
 *
 * The vendor script reads its settings from a <script data-name="BMC-Widget"> tag and builds
 * the button when `DOMContentLoaded` fires. In a Next.js app that event is long gone by the
 * time a script can be added, so the tag is added by hand and the event is fired once after it
 * loads. The script is also held back until the page has finished loading and the browser is
 * idle, so it never competes with the content visitors came for.
 */
export function BuyMeCoffee() {
  useEffect(() => {
    // Already added (client-side navigation, or React's double effect in development).
    if (document.getElementById(SCRIPT_ID)) return;

    let cancelled = false;
    let idleHandle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const inject = () => {
      if (cancelled || document.getElementById(SCRIPT_ID)) return;
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js';
      script.async = true;
      script.dataset.name = 'BMC-Widget';
      script.dataset.cfasync = 'false';
      script.dataset.id = WIDGET.id;
      script.dataset.description = WIDGET.description;
      script.dataset.message = WIDGET.message;
      script.dataset.color = WIDGET.color;
      script.dataset.position = WIDGET.position;
      script.dataset.x_margin = WIDGET.xMargin;
      script.dataset.y_margin = WIDGET.yMargin;
      script.onload = () => window.dispatchEvent(new Event('DOMContentLoaded'));
      document.body.appendChild(script);
    };

    const whenIdle = () => {
      if ('requestIdleCallback' in window) {
        idleHandle = window.requestIdleCallback(inject, { timeout: 4000 });
      } else {
        timer = setTimeout(inject, 2000);
      }
    };

    if (document.readyState === 'complete') whenIdle();
    else window.addEventListener('load', whenIdle, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', whenIdle);
      if (idleHandle !== undefined) window.cancelIdleCallback(idleHandle);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}
