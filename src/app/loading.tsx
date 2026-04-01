export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-24 text-center">
      <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500" />
      <p className="mt-4 text-sm text-slate-400">Loading...</p>
    </div>
  );
}
