import contributors from '@/lib/contributors.json';

type Entry = { total: number; top: { name: string; lines: number }[] };

/** Top contributors of one source file, from lib/contributors.json (`pnpm contributors`). */
export function Contributors({ source }: { source: string }) {
  const entry = (contributors as Record<string, Entry>)[source];
  if (!entry || entry.top.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="mb-3 text-lg font-semibold">Top contributors</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-fd-secondary text-left text-fd-secondary-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Contributor</th>
              <th className="px-3 py-2 text-right font-medium">Lines</th>
              <th className="px-3 py-2 text-right font-medium">Share</th>
            </tr>
          </thead>
          <tbody>
            {entry.top.map((c, i) => (
              <tr key={c.name} className="border-t">
                <td className="px-3 py-2 text-fd-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2">{c.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.lines}</td>
                <td className="px-3 py-2 text-right tabular-nums text-fd-muted-foreground">
                  {Math.round((c.lines / entry.total) * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-fd-muted-foreground">
        Lines of the current file attributed by <code>git blame</code>, out of {entry.total}.
      </p>
    </section>
  );
}
