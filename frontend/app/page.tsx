import { DocsGuide } from '@/components/docs/docs-guide';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

async function getHealth(): Promise<{ ok: boolean; detail?: string }> {
  try {
    const res = await fetch(`${apiBase}/health`, {
      next: { revalidate: 10 },
    });
    if (!res.ok) {
      return { ok: false, detail: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : 'unreachable',
    };
  }
}

export default async function HomePage() {
  const health = await getHealth();
  return <DocsGuide health={health} />;
}
