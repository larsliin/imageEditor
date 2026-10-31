export function isMacOS(): boolean {
    return typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
}

export function shortcutModifierLabel(): string {
    return isMacOS() ? '⌘' : 'Ctrl';
}

export function hasShortcutModifier(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey'>): boolean {
    return isMacOS() ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

export function isZoomWheel(event: Pick<WheelEvent, 'ctrlKey' | 'metaKey'>): boolean {
    return isMacOS()
        ? event.metaKey && !event.ctrlKey
        : event.ctrlKey && !event.metaKey;
}
