import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { fetchApiHealth } from "../lib/api";

export function HealthPage() {
  const healthQuery = useQuery({
    queryKey: ["api-health"],
    queryFn: fetchApiHealth,
    retry: false,
  });

  const status = healthQuery.isPending
    ? "Checking…"
    : healthQuery.isError
      ? "Unavailable"
      : "Connected";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-16 text-slate-950">
      <section className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-xl shadow-slate-200 sm:p-10">
        <p className="text-sm font-semibold tracking-[0.2em] text-cyan-700 uppercase">
          System status
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          LayerLex health
        </h1>

        <dl className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between gap-4 p-5">
            <dt className="font-medium">Frontend</dt>
            <dd className="font-semibold text-emerald-700">Running</dd>
          </div>
          <div className="flex items-center justify-between gap-4 p-5">
            <dt className="font-medium">API</dt>
            <dd
              className={
                healthQuery.isSuccess
                  ? "font-semibold text-emerald-700"
                  : healthQuery.isError
                    ? "font-semibold text-rose-700"
                    : "font-semibold text-slate-500"
              }
            >
              {status}
            </dd>
          </div>
        </dl>

        {healthQuery.isError ? (
          <p role="alert" className="mt-5 text-sm leading-6 text-rose-700">
            The frontend could not reach the API. Start the backend on port
            8000, then retry.
          </p>
        ) : null}

        <div className="mt-8 flex items-center gap-5">
          <button
            className="rounded-full bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:outline-none disabled:cursor-wait disabled:opacity-60"
            type="button"
            onClick={() => void healthQuery.refetch()}
            disabled={healthQuery.isFetching}
          >
            Check again
          </button>
          <Link
            className="font-medium text-cyan-800 underline-offset-4 hover:underline"
            to="/"
          >
            Back home
          </Link>
        </div>
      </section>
    </main>
  );
}
