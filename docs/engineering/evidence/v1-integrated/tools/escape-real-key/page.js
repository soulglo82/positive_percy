// The page for run.cjs: one modal dialog from the dialog library the app
// uses, opened by a button, as src/components/ui/dialog.jsx builds it
// (Portal, Overlay, Content). No app code, server or data.
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as D from '@radix-ui/react-dialog';

const h = React.createElement;

function App() {
  const [open, setOpen] = React.useState(false);
  const rows = Array.from({ length: 60 });
  return h('div', null,
    h('button', { id: 'open', onClick: () => setOpen(true) }, 'Edit goals'),
    h(D.Root, { open, onOpenChange: (value) => { if (!value) setOpen(false); } },
      h(D.Portal, null,
        h(D.Overlay, { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)' } }),
        h(D.Content, { 'aria-describedby': undefined, style: { position: 'fixed', left: '10%', top: '10%', width: '80%', maxHeight: '80%', overflow: 'auto', background: '#fff' } },
          h(D.Title, null, 'Manage goals'),
          rows.map((_, i) => h('div', { key: i, style: { display: 'flex', gap: 8, padding: 6 } },
            h('span', { style: { flex: 1 } }, 'Goal number ' + i), h('button', null, 'Edit'))),
          h(D.Close, null, 'Close')))));
}

createRoot(document.getElementById('root')).render(h(App));
