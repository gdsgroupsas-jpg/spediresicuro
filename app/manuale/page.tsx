/**
 * Pagina Manuale Utente.
 *
 * Legge il file root `MANUALE_UTENTE.md` e lo renderizza in HTML.
 * Per aggiornare il manuale modifica `MANUALE_UTENTE.md` e riesegui la build.
 */

import fs from 'fs/promises';
import path from 'path';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Header from '@/components/header';
import Footer from '@/components/footer';

export const metadata = {
  title: 'Manuale Utente | SpediRe Sicuro',
  description: 'Documentazione completa della piattaforma SpediRe Sicuro.',
};

// Rigenera la pagina ogni ora per riflettere eventuali modifiche al manuale
export const revalidate = 60 * 60;

async function getManualContent(): Promise<string> {
  try {
    const manualPath = path.join(process.cwd(), 'MANUALE_UTENTE.md');
    return await fs.readFile(manualPath, 'utf-8');
  } catch (error) {
    console.error('Errore lettura MANUALE_UTENTE.md', error);
    return 'Manuale non disponibile. Verifica il file MANUALE_UTENTE.md nella root del progetto.';
  }
}

const markdownComponents: Components = {
  h1: ({ node: _node, ...props }) => (
    <h1 className="text-4xl font-bold text-white mt-10 mb-4 leading-tight" {...props} />
  ),
  h2: ({ node: _node, ...props }) => (
    <h2 className="text-3xl font-semibold text-white mt-10 mb-4 leading-snug" {...props} />
  ),
  h3: ({ node: _node, ...props }) => (
    <h3 className="text-2xl font-semibold text-white mt-8 mb-3 leading-snug" {...props} />
  ),
  h4: ({ node: _node, ...props }) => (
    <h4 className="text-xl font-semibold text-white mt-6 mb-3 leading-snug" {...props} />
  ),
  p: ({ node: _node, ...props }) => (
    <p className="text-gray-200 leading-relaxed mb-4" {...props} />
  ),
  a: ({ node: _node, ...props }) => (
    <a
      className="text-amber-300 hover:text-amber-200 underline underline-offset-2 font-semibold"
      {...props}
    />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul className="list-disc list-inside space-y-2 text-gray-200 mb-4" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="list-decimal list-inside space-y-2 text-gray-200 mb-4" {...props} />
  ),
  li: ({ node: _node, ...props }) => (
    <li className="leading-relaxed" {...props} />
  ),
  strong: ({ node: _node, ...props }) => (
    <strong className="text-white font-semibold" {...props} />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="border-l-4 border-amber-400/70 pl-4 italic text-gray-200 bg-white/5 rounded-r-xl py-2 pr-3 mb-6"
      {...props}
    />
  ),
  code: ({ node: _node, inline, className, children, ...props }) => {
    const codeClass = className ? String(className) : '';

    if (inline) {
      return (
        <code
          className={`px-2 py-1 rounded-md bg-white/10 text-amber-200 font-mono text-sm ${codeClass}`}
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <pre className="bg-black/60 border border-white/10 rounded-xl p-4 overflow-x-auto mb-6">
        <code
          className={`text-sm text-amber-100 font-mono leading-relaxed ${codeClass}`}
          {...props}
        >
          {children}
        </code>
      </pre>
    );
  },
  table: ({ node: _node, ...props }) => (
    <div className="overflow-x-auto my-6 rounded-2xl border border-white/10">
      <table className="min-w-full text-left text-gray-200" {...props} />
    </div>
  ),
  thead: ({ node: _node, ...props }) => (
    <thead className="bg-white/5" {...props} />
  ),
  th: ({ node: _node, ...props }) => (
    <th className="px-4 py-3 text-sm font-semibold text-white border-b border-white/10" {...props} />
  ),
  td: ({ node: _node, ...props }) => (
    <td className="px-4 py-3 text-sm border-b border-white/10 align-top" {...props} />
  ),
  hr: ({ node: _node, ...props }) => (
    <hr className="border-t border-white/10 my-8" {...props} />
  ),
};

export default async function ManualePage() {
  const content = await getManualContent();

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#0b0b0f] text-gray-100 pt-24 pb-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 blur-3xl rounded-full" />
          <div className="absolute top-20 right-0 w-[420px] h-[420px] bg-cyan-500/10 blur-3xl rounded-full" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-amber-200 text-sm font-semibold uppercase tracking-wide">
              📖 Manuale Utente
            </span>
            <h1 className="mt-4 text-4xl sm:text-5xl font-black text-white leading-tight">
              Tutta la documentazione di SpediRe Sicuro, aggiornata e pronta all&apos;uso
            </h1>
            <p className="mt-4 text-lg text-gray-300 max-w-3xl mx-auto">
              Il contenuto viene generato direttamente dal file <code className="px-2 py-1 rounded-md bg-white/10 text-amber-200">MANUALE_UTENTE.md</code> presente nella root del repository.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-xl">
            <div className="p-6 sm:p-10">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
