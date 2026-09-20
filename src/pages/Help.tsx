import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  Layers,
  LayoutGrid,
  MessagesSquare,
  Package,
  QrCode,
  ReceiptText,
  SearchX,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useAppStore } from "../store/useStore";
import {
  canSee,
  findArticle,
  HELP_CATEGORIES,
  ALL_ARTICLES,
  type HelpArticle,
  type HelpBlock,
  type HelpCategory,
} from "../help/content";
import { Badge, PageHeader, SearchInput } from "../components/ui";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "getting-started": Sparkles,
  dashboard: LayoutDashboard,
  pos: ShoppingCart,
  "products-inventory": Package,
  sales: ReceiptText,
  customers: Users,
  suppliers: Truck,
  "purchase-orders": ClipboardList,
  reports: BarChart3,
  staff: UserCog,
  "qr-ordering": QrCode,
  tables: LayoutGrid,
  "chat-notifications": MessagesSquare,
  settings: Settings,
  "account-security": ShieldCheck,
  troubleshooting: Wrench,
  faq: HelpCircle,
  "system-overview": Layers,
};

const NOTE_COLORS: Record<string, { color: string; soft: string; label: string }> = {
  tip: { color: "var(--success)", soft: "var(--success-soft)", label: "Tip" },
  info: { color: "var(--info)", soft: "var(--info-soft)", label: "Note" },
  warn: { color: "var(--warn)", soft: "var(--warn-soft)", label: "Heads up" },
  danger: { color: "var(--danger)", soft: "var(--danger-soft)", label: "Careful" },
};

function useVisibleData(): { categories: HelpCategory[]; articles: Array<HelpArticle & { categoryId: string }> } {
  const permissions = useAppStore((s) => s.permissions);
  const perms = permissions();
  return useMemo(() => {
    const articles = ALL_ARTICLES.filter((a) => canSee(a, perms));
    const categories = HELP_CATEGORIES.map((c) => ({ ...c, articles: c.articles.filter((a) => canSee(a, perms)) })).filter(
      (c) => c.articles.length > 0
    );
    return { categories, articles };
  }, [perms]);
}

function Block({ block }: { block: HelpBlock }): React.ReactElement {
  switch (block.type) {
    case "p":
      return <p className="text-[14px] leading-relaxed text-ink">{block.text}</p>;
    case "h3":
      return <h3 className="pt-1 text-[15px] font-bold">{block.text}</h3>;
    case "steps":
      return (
        <div>
          {block.title && <div className="mb-2 text-[13px] font-bold tracking-wide text-muted uppercase">{block.title}</div>}
          <ol className="space-y-2.5">
            {block.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-[14px] leading-relaxed">
                <span
                  className="mt-0.5 flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
                  style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
                >
                  {i + 1}
                </span>
                <span className="text-ink">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    case "list":
      return (
        <div>
          {block.title && <div className="mb-2 text-[13px] font-bold tracking-wide text-muted uppercase">{block.title}</div>}
          {block.ordered ? (
            <ol className="list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-ink">
              {block.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ol>
          ) : (
            <ul className="space-y-1.5 pl-1">
              {block.items.map((item, i) => (
                <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {block.head.map((h, i) => (
                  <th
                    key={i}
                    className="border-b px-3 py-2 text-left font-bold"
                    style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`border-b px-3 py-2 align-top ${j > 0 ? "text-muted" : "font-semibold text-ink"}`}
                      style={{ borderColor: "var(--border)" }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "note":
      return (
        <div
          className="rounded-xl border-l-4 px-4 py-3 text-[13.5px] leading-relaxed"
          style={{ background: NOTE_COLORS[block.tone]?.soft ?? "var(--surface-2)", borderLeftColor: NOTE_COLORS[block.tone]?.color ?? "var(--accent)" }}
        >
          <div className="mb-0.5 font-bold" style={{ color: NOTE_COLORS[block.tone]?.color ?? "var(--accent)" }}>
            {block.title ?? NOTE_COLORS[block.tone]?.label ?? "Note"}
          </div>
          <div className="text-ink">{block.text}</div>
        </div>
      );
    case "keys":
      return (
        <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)" }}>
          {block.rows.map(([keys, desc], i) => (
            <div
              key={i}
              className={`flex items-center justify-between gap-4 px-3 py-2 text-[13px] ${i > 0 ? "border-t" : ""}`}
              style={{ borderColor: "var(--border)", background: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)" }}
            >
              <span className="text-muted">{desc}</span>
              <span className="kbd whitespace-nowrap">{keys}</span>
            </div>
          ))}
        </div>
      );
    case "probe":
      return (
        <div className="space-y-3">
          <div className="rounded-xl border border-l-4 px-4 py-3" style={{ borderColor: "var(--border)", borderLeftColor: "var(--warn)" }}>
            <div className="mb-1 text-[13px] font-bold" style={{ color: "var(--warn)" }}>
              The problem
            </div>
            <div className="text-[14px] font-semibold text-ink">{block.problem}</div>
            <div className="mt-1.5 text-[13px] leading-relaxed text-muted">{block.cause}</div>
          </div>
          <div className="rounded-xl px-4 py-3" style={{ background: "var(--success-soft)" }}>
            <div className="mb-1.5 text-[13px] font-bold" style={{ color: "var(--success)" }}>
              How to fix it
            </div>
            <ol className="space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-ink">
              {block.fix.map((step, i) => (
                <li key={i} className="list-decimal">
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl px-4 py-3 text-[13px] leading-relaxed" style={{ background: "var(--info-soft)", color: "var(--info)" }}>
            <b>For the owner:</b> {block.admin}
          </div>
        </div>
      );
    case "links":
      return (
        <div>
          {block.label && <div className="mb-2 text-[13px] font-bold tracking-wide text-muted uppercase">{block.label}</div>}
          <div className="flex flex-wrap gap-2">
            {block.items.map((item, i) => (
              <Link key={i} to={item.to} className="btn btn-secondary btn-sm" style={{ borderColor: "var(--border)" }}>
                <BookOpen size={14} />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      );
  }
}

function Sidebar({
  activeSlug,
  activeCategory,
}: {
  activeSlug?: string;
  activeCategory?: string;
}): React.ReactElement | null {
  const { categories } = useVisibleData();
  return (
    <aside className="hidden lg:block">
      <div className="mb-2 px-2 text-[10.5px] font-bold tracking-[0.08em] text-muted uppercase">Topics</div>
      <nav className="space-y-2">
        {categories.map((category) => {
          const Icon = CATEGORY_ICONS[category.id] ?? BookOpen;
          const categoryActive = activeCategory === category.id || category.articles.some((a) => a.slug === activeSlug);
          const isOpen = categoryActive;
          return (
            <div key={category.id}>
              <Link
                to={`/help?cat=${category.id}`}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-bold transition-colors ${
                  categoryActive ? "text-accent-strong dark:text-accent" : "text-muted hover:text-ink hover:bg-surface-2"
                }`}
                style={categoryActive ? { background: "var(--accent-soft)" } : undefined}
              >
                <Icon size={15} />
                <span className="flex-1 truncate">{category.label}</span>
              </Link>
              {isOpen && (
                <div className="mt-0.5 space-y-0.5 border-l pl-3 ml-[15px]" style={{ borderColor: "var(--border)" }}>
                  {category.articles.map((article) => (
                    <Link
                      key={article.slug}
                      to={`/help/${article.slug}`}
                      className={`block rounded-md px-2 py-1 text-[12.5px] leading-snug transition-colors ${
                        activeSlug === article.slug ? "font-bold text-accent-strong dark:text-accent" : "text-muted hover:text-ink"
                      }`}
                    >
                      {article.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function ArticleView({ article }: { article: HelpArticle & { categoryId: string } }): React.ReactElement {
  const category = HELP_CATEGORIES.find((c) => c.id === article.categoryId);
  return (
    <div>
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-[12.5px] text-muted">
        <Link to="/help" className="hover:text-ink">
          Help & User Guide
        </Link>
        <ChevronRight size={13} />
        {category && (
          <span>
            <Link to={`/help?cat=${category.id}`} className="hover:text-ink">
              {category.label}
            </Link>
            <ChevronRight size={13} className="mx-1 inline" />
          </span>
        )}
        <span className="font-semibold text-ink">{article.title}</span>
      </nav>

      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <Sidebar activeSlug={article.slug} />

        <div className="min-w-0">
          <div className="mb-6">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{article.title}</h1>
            <p className="mt-1 text-[14px] text-muted">{article.description}</p>
          </div>

          <div className="space-y-5">
            {article.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-2 border-t pt-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border)" }}>
            <Link to="/help" className="btn btn-ghost btn-sm">
              <ArrowLeft size={15} /> Back to Help & User Guide
            </Link>
            {category && (
              <Link to={`/help?cat=${category.id}`} className="btn btn-secondary btn-sm" style={{ borderColor: "var(--border)" }}>
                <BookOpen size={15} /> More in {category.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryView({ category }: { category: HelpCategory }): React.ReactElement {
  const Icon = CATEGORY_ICONS[category.id] ?? BookOpen;
  return (
    <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
      <Sidebar activeCategory={category.id} />
      <div className="min-w-0">
        <nav className="mb-4 flex items-center gap-1 text-[12.5px] text-muted">
          <Link to="/help" className="hover:text-ink">
            Help & User Guide
          </Link>
          <ChevronRight size={13} />
          <span className="font-semibold text-ink">{category.label}</span>
        </nav>
        <div className="mb-6 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <Icon size={20} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{category.label}</h1>
            <p className="mt-0.5 text-[14px] text-muted">{category.blurb}</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {category.articles.map((article) => (
            <Link key={article.slug} to={`/help/${article.slug}`} className="card block p-4 transition-shadow hover:shadow-md">
              <div className="mb-0.5 text-[14.5px] font-bold text-ink">{article.title}</div>
              <div className="text-[13px] text-muted">{article.description}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HelpPage(): React.ReactElement {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const catFilter = searchParams.get("cat");
  const { articles, categories } = useVisibleData();

  if (slug) {
    const article = findArticle(slug);
    if (!article || !articles.some((a) => a.slug === slug)) {
      return (
        <div className="mx-auto max-w-xl py-16 text-center">
          <SearchX size={40} className="mx-auto mb-4 text-muted" />
          <h1 className="mb-1 text-lg font-bold">Article not found</h1>
          <p className="mb-5 text-[13.5px] text-muted">The article you're looking for doesn't exist or isn't available for your role.</p>
          <Link to="/help" className="btn btn-ghost">
            <ArrowLeft size={15} /> Back to Help & User Guide
          </Link>
        </div>
      );
    }
    return <ArticleView article={article} />;
  }

  if (catFilter) {
    const category = categories.find((c) => c.id === catFilter);
    if (category) {
      return <CategoryView category={category} />;
    }
  }

  return <HelpHome />;
}

function HelpHome(): React.ReactElement {
  const { categories, articles } = useVisibleData();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return [];
    const haystack = (a: HelpArticle) =>
      [a.title, a.description, a.slug, (a.keywords ?? []).join(" ")].join(" ").toLowerCase();
    return articles.filter((a) => haystack(a).includes(q)).slice(0, 14);
  }, [q, articles]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Help & User Guide"
        subtitle="Step-by-step guides for every screen in NovaPOS — how to sell, manage stock, handle customers, QR ordering and more."
      />

      <div className="mb-8">
        <SearchInput value={query} onChange={setQuery} placeholder="Search the guide… e.g. refund, purchase order, QR" />
      </div>

      {q ? (
        <div className="space-y-2.5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[13px] font-bold tracking-wide text-muted uppercase">
              {results.length === 0 ? "No results" : `${results.length} result${results.length === 1 ? "" : "s"}`}
            </div>
            {results.length === 0 && (
              <button onClick={() => setQuery("")} className="text-xs font-semibold text-accent">
                Clear search
              </button>
            )}
          </div>
          {results.length === 0 ? (
            <div className="card p-8 text-center">
              <SearchX size={36} className="mx-auto mb-3 text-muted" />
              <p className="mb-1 text-[14px] font-bold">Nothing matched “{query}”</p>
              <p className="text-[13px] text-muted">Try a different word, like “stock”, “refund”, “staff” or “QR”.</p>
            </div>
          ) : (
            results.map((article) => {
              const category = HELP_CATEGORIES.find((c) => c.id === article.categoryId);
              const Icon = CATEGORY_ICONS[article.categoryId] ?? BookOpen;
              return (
                <Link key={article.slug} to={`/help/${article.slug}`} className="card flex items-start gap-3 p-4 transition-shadow hover:shadow-md">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-bold text-ink">{article.title}</span>
                    <span className="mt-0.5 block text-[13px] text-muted">{article.description}</span>
                  </span>
                  {category && <Badge tone="neutral">{category.label}</Badge>}
                </Link>
              );
            })
          )}
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2 text-[13px] font-bold tracking-wide text-muted uppercase">
            <BookOpen size={15} /> Browse by topic
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {categories.map((category) => {
              const Icon = CATEGORY_ICONS[category.id] ?? BookOpen;
              return (
                <Link key={category.id} to={`/help?cat=${category.id}`} className="card flex items-start gap-3 p-4 transition-shadow hover:shadow-md">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                    <Icon size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[14.5px] font-bold text-ink">{category.label}</span>
                      <ChevronRight size={16} className="shrink-0 text-muted" />
                    </span>
                    <span className="mt-0.5 block text-[13px] text-muted">{category.blurb}</span>
                    <span className="mt-1.5 block text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
                      {category.articles.length} guide{category.articles.length === 1 ? "" : "s"}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}