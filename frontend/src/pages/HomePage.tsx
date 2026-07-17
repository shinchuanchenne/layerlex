import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
      <section className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-cyan-950/30 sm:p-12">
        <p className="mb-4 text-sm font-semibold tracking-[0.2em] text-cyan-300 uppercase">
          Project foundation
        </p>
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
          LayerLex
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Learn the word on the outer card, then learn how to use it naturally
          through inner cards for collocations, phrases, patterns, and examples.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            className="rounded-full bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none"
            to="/decks"
          >
            Manage decks and cards
          </Link>
          <Link
            className="font-medium text-cyan-200 underline-offset-4 hover:underline"
            to="/health"
          >
            Check application health
          </Link>
        </div>
      </section>
    </main>
  );
}
