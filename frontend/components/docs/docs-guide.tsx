'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Badge, Button } from '@/components/ui';
import { DOCS_SECTIONS } from '@/lib/docs-guide';
import { useBrand } from '@/providers';

type Props = {
  health: { ok: boolean; detail?: string };
};

export function DocsGuide({ health }: Props) {
  const { brand } = useBrand();
  const [activeId, setActiveId] = useState(DOCS_SECTIONS[0]?.id ?? '');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const nodes = DOCS_SECTIONS.map((section) =>
      document.getElementById(section.id),
    ).filter((el): el is HTMLElement => Boolean(el));

    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target.id;
        if (top) setActiveId(top);
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.1, 0.35, 0.6] },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const goTo = (id: string) => {
    setActiveId(id);
    setMobileNavOpen(false);
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="docs-shell">
      <header className="docs-header">
        <div className="docs-header-left">
          <Button
            type="button"
            variant="ghost"
            size="small"
            className="docs-mobile-toggle"
            aria-expanded={mobileNavOpen}
            aria-controls="docs-sidebar"
            onClick={() => setMobileNavOpen((v) => !v)}
          >
            Sections
          </Button>
          <Link href="/" className="docs-brand-link">
            <BrandLogo height={28} />
          </Link>
          <span className="docs-header-title">Documentation</span>
        </div>

        <div className="docs-header-right">
          <ThemeSwitcher compact />
          <span className="docs-health" title={health.detail ?? undefined}>
            API{' '}
            {health.ok ? (
              <Badge variant="success" size="small">
                ok
              </Badge>
            ) : (
              <Badge variant="error" size="small">
                down
              </Badge>
            )}
          </span>
          <a
            href="http://localhost:3001/docs"
            target="_blank"
            rel="noreferrer"
            className="docs-swagger-link"
          >
            Swagger
          </a>
          <Link href="/login" className="docs-login-cta">
            Se connecter
          </Link>
        </div>
      </header>

      {mobileNavOpen ? (
        <button
          type="button"
          className="docs-sidebar-backdrop"
          aria-label="Fermer les sections"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <div className="docs-body">
        <aside
          id="docs-sidebar"
          className={`docs-sidebar${mobileNavOpen ? ' is-open' : ''}`}
          aria-label="Sections documentation"
        >
          <p className="docs-sidebar-kicker">Guide de configuration</p>
          <nav>
            <ul>
              {DOCS_SECTIONS.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    className={
                      activeId === section.id
                        ? 'docs-nav-link is-active'
                        : 'docs-nav-link'
                    }
                    onClick={() => goTo(section.id)}
                  >
                    {section.title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="docs-content">
          <header className="docs-intro">
            <p className="docs-eyebrow">{brand.companyName}</p>
            <h1>Configuration du starter</h1>
            <p>
              Guide pratique pour activer et configurer toutes les
              fonctionnalités de <strong>{brand.appName}</strong> : auth,
              billing, notifications, storage, CMS, observabilité et white
              label.
            </p>
          </header>

          {DOCS_SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="docs-section">
              <h2>{section.title}</h2>
              <p>{section.summary}</p>

              {section.id === 'theme' ? (
                <div className="mt-4 mb-4 flex justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-8 shadow-sm">
                  <ThemeSwitcher />
                </div>
              ) : null}

              {section.steps?.length ? (
                <>
                  <h3>Configuration</h3>
                  <ol className="docs-steps">
                    {section.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </>
              ) : null}

              {section.env?.length ? (
                <>
                  <h3>Variables d&apos;environnement</h3>
                  <div className="table-wrap">
                    <table className="admin-table docs-env-table">
                      <thead>
                        <tr>
                          <th>Variable</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.env.map((row) => (
                          <tr key={row.name}>
                            <td>
                              <code>{row.name}</code>
                            </td>
                            <td>{row.hint ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {section.routes?.length ? (
                <>
                  <h3>Routes / URLs</h3>
                  <ul className="docs-list">
                    {section.routes.map((route) => (
                      <li key={route}>
                        <code>{route}</code>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {section.notes?.length ? (
                <>
                  <h3>Notes</h3>
                  <ul className="docs-list">
                    {section.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </>
              ) : null}

              {section.docs ? (
                <p className="docs-file-ref">
                  Détails : <code>{section.docs}</code>
                </p>
              ) : null}
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
