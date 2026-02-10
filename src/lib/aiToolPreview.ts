export type ToolLanguage = 'html' | 'react' | 'nextjs';

function injectReadonly(doc: string): string {
  const guard = `
  <style>
    /* Readonly mode: disable interactions but keep page visible */
    :root { color-scheme: light dark; }
  </style>
  <script>
    (function () {
      function lock() {
        try {
          var nodes = document.querySelectorAll('input, textarea, select, button');
          nodes.forEach(function (el) {
            try {
              el.setAttribute('disabled', 'disabled');
              el.setAttribute('aria-disabled', 'true');
            } catch (_) {}
          });
          // Prevent form submits even if a button is missed
          document.querySelectorAll('form').forEach(function (form) {
            form.addEventListener('submit', function (e) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }, true);
          });
        } catch (_) {}
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', lock);
      } else {
        lock();
      }

      // Keep locking in case the tool renders inputs later
      setInterval(lock, 750);
    })();
  </script>
  `;

  if (doc.includes('</body>')) return doc.replace('</body>', `${guard}</body>`);
  if (doc.includes('</html>')) return doc.replace('</html>', `${guard}</html>`);
  return `${doc}${guard}`;
}

export function buildToolPreviewSrcDoc(params: { codeLanguage: ToolLanguage; codeContent: string; readonly?: boolean }): string {
  const escaped = (params.codeContent ?? '').toString();

  if (!escaped.trim()) {
    const base = `<!doctype html><html><head><meta charset="utf-8" /></head><body style="font-family: system-ui; padding: 16px;">
      <h3>No code snippet</h3>
      <p>This tool has no saved snippet.</p>
    </body></html>`;
    return params.readonly ? injectReadonly(base) : base;
  }

  if (params.codeLanguage === 'html') {
    // Run HTML directly (scripts allowed, sandboxed on iframe).
    return params.readonly ? injectReadonly(escaped) : escaped;
  }

  if (params.codeLanguage === 'react') {
    // React live preview using in-iframe Babel transform.
    // Expected snippet examples:
    // 1) function App(){ return <div>Hello</div> }
    // 2) const App = () => (<div/>);
    // Optionally: render(<App />)
    const base = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; font-family: system-ui; }
      #root { padding: 16px; }
      .error { padding: 16px; color: #b91c1c; background: #fee2e2; }
    </style>
  </head>
  <body>
    <div id="root"></div>

    <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

    <script type="text/babel">
      try {
        ${escaped}

        // Auto-mount if user defines App and doesn't mount manually.
        if (typeof App !== 'undefined' && document.getElementById('root')?.childNodes?.length === 0) {
          ReactDOM.createRoot(document.getElementById('root')).render(<App />);
        }
      } catch (e) {
        const el = document.getElementById('root');
        if (el) el.innerHTML = '<div class="error"><strong>Preview error:</strong><br/>' + (e?.message ?? e) + '</div>';
        console.error(e);
      }
    </script>
  </body>
</html>`;

    return params.readonly ? injectReadonly(base) : base;
  }

  // nextjs
  const base = `<!doctype html><html><head><meta charset="utf-8" /></head><body style="font-family: system-ui; padding: 16px;">
    <h3>Next.js preview is not supported</h3>
    <p>This app runs on Vite + React. Next.js snippets are stored as text only.</p>
  </body></html>`;

  return params.readonly ? injectReadonly(base) : base;
}
