export interface DebugCounter {
  readonly element: HTMLElement;
  update(vitality: number): void;
}

/** Creates a fixed-position Vitality Debug Counter overlay and returns its frame updater function. */
export function createDebugCounter(): DebugCounter {
  if (typeof document === 'undefined') {
    return {
      element: null as unknown as HTMLElement,
      update(): void {},
    };
  }

  const el = document.createElement('div');
  
  el.style.position = 'fixed';
  el.style.top = '12px';
  el.style.left = '12px';
  el.style.padding = '6px 10px';
  el.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
  el.style.color = '#ffffff';
  el.style.fontFamily = 'monospace';
  el.style.fontSize = '14px';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '9999';
  el.style.userSelect = 'none';
  el.style.whiteSpace = 'nowrap';

  document.body.appendChild(el);

  return {
    element: el,
    update(vitality: number): void {
      // Displays the precise floating-point representation without truncation or rounding
      el.textContent = vitality.toString();
    },
  };
}