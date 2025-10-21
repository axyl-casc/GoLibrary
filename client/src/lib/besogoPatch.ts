import 'besogo/besogo.all.js';

declare global {
  interface Window {
    besogo: any;
  }
}

const besogo = typeof window !== 'undefined' ? window.besogo : undefined;

if (besogo && typeof besogo.create === 'function' && !besogo.__glCreatePatched) {
  const originalCreate = besogo.create;

  besogo.create = function patchedCreate(this: any, container: any, options: any) {
    let createdEditor: any;
    const originalMakeEditor = besogo.makeEditor;

    besogo.makeEditor = function patchedMakeEditor(this: any, ...args: any[]) {
      const editor = originalMakeEditor.apply(this, args);
      createdEditor = editor;
      return editor;
    };

    try {
      originalCreate.apply(this, [container, options]);
    } finally {
      besogo.makeEditor = originalMakeEditor;
    }

    if (container && createdEditor && typeof container === 'object') {
      try {
        // Ensure downstream code can access the editor via the container reference
        (container as { besogoEditor?: any }).besogoEditor = createdEditor;
      } catch (err) {
        // Ignore assignment failures; the caller will surface initialization errors
      }
    }

    return createdEditor;
  };

  besogo.__glCreatePatched = true;
}

export {};
