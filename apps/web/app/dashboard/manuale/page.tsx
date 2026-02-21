/**
 * Pagina Manuale Utente - Dashboard Protetta
 *
 * Legge il file `docs/MANUALE_UTENTE_RESELLER_V1.md` e lo renderizza in HTML.
 * Accessibile SOLO dopo login (protetta da app/dashboard/layout.tsx).
 * Per aggiornare il manuale modifica `docs/MANUALE_UTENTE_RESELLER_V1.md` e riesegui la build.
 */

import fs from 'fs/promises';
import path from 'path';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DashboardNav from '@/components/dashboard-nav';

export const metadata = {
  title: 'Manuale Utente | SpedireSicuro',
  description: 'Documentazione completa per reseller e point fisici',
};

// Forza rendering dinamico (legge file system)
export const dynamic = 'force-dynamic';

async function getManualContent(): Promise<string> {
  try {
    const manualPath = path.join(process.cwd(), 'docs', 'MANUALE_UTENTE_RESELLER_V1.md');
    return await fs.readFile(manualPath, 'utf-8');
  } catch (error) {
    console.error('Errore lettura MANUALE_UTENTE_RESELLER_V1.md:', error);
    return '# Errore\n\nManuale non disponibile. Verifica il file `docs/MANUALE_UTENTE_RESELLER_V1.md` nella root del progetto.';
  }
}

// Componenti Markdown con stili dashboard (chiari, non dark)
const markdownComponents: Components = {
  h1: ({ node: _node, ...props }) => (
    <h1 className="text-4xl font-bold text-gray-900 mt-10 mb-4 leading-tight" {...props} />
  ),
  h2: ({ node: _node, ...props }) => (
    <h2
      className="text-3xl font-semibold text-gray-900 mt-10 mb-4 leading-snug border-b border-gray-200 pb-2"
      {...props}
    />
  ),
  h3: ({ node: _node, ...props }) => (
    <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-3 leading-snug" {...props} />
  ),
  h4: ({ node: _node, ...props }) => (
    <h4 className="text-xl font-semibold text-gray-800 mt-6 mb-3 leading-snug" {...props} />
  ),
  p: ({ node: _node, ...props }) => <p className="text-gray-700 leading-relaxed mb-4" {...props} />,
  a: ({ node: _node, ...props }) => (
    <a
      className="text-[#FF9500] hover:text-[#FFB84D] underline underline-offset-2 font-semibold transition-colors"
      {...props}
    />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4 ml-4" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-4 ml-4" {...props} />
  ),
  li: ({ node: _node, ...props }) => <li className="leading-relaxed" {...props} />,
  strong: ({ node: _node, ...props }) => (
    <strong className="text-gray-900 font-semibold" {...props} />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="border-l-4 border-[#FF9500] pl-4 italic text-gray-700 bg-orange-50 rounded-r-xl py-2 pr-3 mb-6"
      {...props}
    />
  ),
  code: ({ node, className, children, ...props }) => {
    const codeClass = className ? String(className) : '';
    const isInline = !className?.includes('language-');

    if (isInline) {
      return (
        <code
          className={`px-2 py-1 rounded-md bg-gray-100 text-[#FF9500] font-mono text-sm ${codeClass}`}
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <pre className="bg-gray-900 border border-gray-200 rounded-xl p-4 overflow-x-auto mb-6">
        <code className={`text-sm text-gray-100 font-mono leading-relaxed ${codeClass}`} {...props}>
          {children}
        </code>
      </pre>
    );
  },
  table: ({ node: _node, ...props }) => (
    <div className="overflow-x-auto my-6 rounded-2xl border border-gray-200 shadow-sm">
      <table className="min-w-full text-left text-gray-700" {...props} />
    </div>
  ),
  thead: ({ node: _node, ...props }) => <thead className="bg-gray-50" {...props} />,
  th: ({ node: _node, ...props }) => (
    <th
      className="px-4 py-3 text-sm font-semibold text-gray-900 border-b border-gray-200"
      {...props}
    />
  ),
  td: ({ node: _node, ...props }) => (
    <td className="px-4 py-3 text-sm border-b border-gray-200 align-top" {...props} />
  ),
  hr: ({ node: _node, ...props }) => <hr className="border-t border-gray-200 my-8" {...props} />,
};

export default async function ManualeDashboardPage() {
  const content = await getManualContent();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <DashboardNav
        title="Manuale Utente"
        subtitle="Documentazione completa per reseller e point fisici"
        showBackButton={true}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
          <div className="p-6 sm:p-10">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
