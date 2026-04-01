"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-24 text-center">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-6xl">&#9888;</div>
        <h2 className="text-2xl font-bold text-slate-800 mb-3">
          Something went wrong
        </h2>
        <p className="text-slate-500 mb-8">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
