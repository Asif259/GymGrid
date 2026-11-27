export default function Loading() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-56 rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
