import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import type {
    DexMetadata,
    PokemonDetail,
    PokemonList,
    PokemonSummary,
} from '../../../packages/shared/src/index.js';

type Tab = 'moves' | 'machines' | 'evolutions';

function Icon({
    name,
    size = 20,
}: {
    name: 'search' | 'arrow' | 'back' | 'book' | 'spark' | 'disc' | 'branch' | 'close';
    size?: number;
}) {
    const paths: Record<string, ReactNode> = {
        search: (
            <>
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 4 4" />
            </>
        ),
        arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
        back: <path d="M19 12H5m5-5-5 5 5 5" />,
        book: (
            <>
                <path d="M12 6c-3-3-7-2-9-1v14c2-1 6-2 9 1 3-3 7-2 9-1V5c-2-1-6-2-9 1Z" />
                <path d="M12 6v14" />
            </>
        ),
        spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />,
        disc: (
            <>
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="2.5" />
                <path d="m15 5 4 4" />
            </>
        ),
        branch: (
            <>
                <circle cx="6" cy="5" r="2" />
                <circle cx="18" cy="5" r="2" />
                <circle cx="6" cy="19" r="2" />
                <path d="M6 7v10m12-10v2a4 4 0 0 1-4 4H6" />
            </>
        ),
        close: <path d="m6 6 12 12M18 6 6 18" />,
    };
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {paths[name]}
        </svg>
    );
}

function Pokeball({ className = '' }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <circle cx="32" cy="32" r="27" stroke="currentColor" strokeWidth="3" />
            <path d="M5 32h20m14 0h20" stroke="currentColor" strokeWidth="3" />
            <circle cx="32" cy="32" r="7" stroke="currentColor" strokeWidth="3" />
        </svg>
    );
}

function Sprite({ name, large = false }: { name: string; large?: boolean }) {
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [name]);
    const slug = name
        .normalize('NFKD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace('♀', 'f')
        .replace('♂', 'm')
        .replace(/[^a-z0-9]/g, '');
    return (
        <div className={`sprite ${large ? 'sprite-large' : ''}`}>
            {failed ? (
                <Pokeball className="sprite-fallback" />
            ) : (
                <img
                    src={`https://play.pokemonshowdown.com/sprites/gen5/${slug}.png`}
                    alt=""
                    loading={large ? 'eager' : 'lazy'}
                    onError={() => setFailed(true)}
                />
            )}
        </div>
    );
}

function navigate(path: string): void {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'instant' });
}

function PageLink({
    href,
    children,
    className,
    label,
}: {
    href: string;
    children: ReactNode;
    className?: string;
    label?: string;
}) {
    function onClick(event: MouseEvent<HTMLAnchorElement>): void {
        if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        event.preventDefault();
        navigate(href);
    }
    return (
        <a href={href} onClick={onClick} className={className} aria-label={label}>
            {children}
        </a>
    );
}

async function api<T>(path: string, signal: AbortSignal): Promise<T> {
    const response = await fetch(path, { signal });
    if (!response.ok)
        throw new Error(
            response.status === 404
                ? 'This Pokémon could not be found.'
                : 'The Pokédex is unavailable right now. Please try again.',
        );
    return response.json() as Promise<T>;
}

function useApi<T>(
    path: string,
    delay = 0,
): { data: T | null; loading: boolean; error: string; retry: () => void } {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError('');
        setData(null);
        const timer = window.setTimeout(() => {
            void api<T>(path, controller.signal)
                .then((value) => {
                    if (!controller.signal.aborted) {
                        setData(value);
                        setLoading(false);
                    }
                })
                .catch((reason: unknown) => {
                    if (!controller.signal.aborted) {
                        setError(reason instanceof Error ? reason.message : 'Unable to load data.');
                        setLoading(false);
                    }
                });
        }, delay);
        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [path, delay, attempt]);
    return { data, loading, error, retry: () => setAttempt((value) => value + 1) };
}

function ErrorState({ error, retry }: { error: string; retry: () => void }) {
    return (
        <div className="empty-state" role="alert">
            <Pokeball />
            <h2>A little trouble connecting</h2>
            <p>{error}</p>
            <button className="primary-button" onClick={retry}>
                Try again
            </button>
        </div>
    );
}

function PokemonCard({ pokemon, query }: { pokemon: PokemonSummary; query: string }) {
    return (
        <PageLink className="pokemon-card" href={`/pokemon/${pokemon.speciesId}${query}`}>
            <div className={`card-art tint-${pokemon.speciesId % 6}`}>
                <span className="card-id">#{String(pokemon.speciesId).padStart(4, '0')}</span>
                <Pokeball className="card-watermark" />
                <Sprite name={pokemon.name} />
            </div>
            <div className="card-content">
                <h2>{pokemon.name}</h2>
                <p>
                    {pokemon.sameNameCount > 1 ? 'Species / form' : 'Species'}{' '}
                    <span className="card-arrow">
                        <Icon name="arrow" size={17} />
                    </span>
                </p>
                <div className="card-meta">
                    <span>
                        <Icon name="spark" size={13} />
                        {pokemon.moveCount} moves
                    </span>
                    <span>
                        <Icon name="disc" size={13} />
                        {pokemon.machineCount} machines
                    </span>
                </div>
            </div>
        </PageLink>
    );
}

function Browse({ metadata, query }: { metadata: DexMetadata | null; query: string }) {
    const parameters = new URLSearchParams(query);
    const [search, setSearch] = useState(parameters.get('search') ?? '');
    const [sort, setSort] = useState(parameters.get('sort') === 'name' ? 'name' : 'id');
    const requestedPage = Number(parameters.get('page') ?? '1');
    const [page, setPage] = useState(
        Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 100000
            ? requestedPage
            : 1,
    );
    const searchInput = useRef<HTMLInputElement>(null);
    const { data, loading, error, retry } = useApi<PokemonList>(
        `/api/pokemon?${new URLSearchParams({ search, sort, page: String(page), pageSize: '36' }).toString()}`,
        200,
    );
    const currentQuery = `?${new URLSearchParams({ search, sort, page: String(page) }).toString()}`;
    useEffect(() => {
        window.history.replaceState(null, '', `/${currentQuery}`);
    }, [currentQuery]);
    const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;
    useEffect(() => {
        if (data && page > Math.max(1, totalPages)) setPage(Math.max(1, totalPages));
    }, [data, page, totalPages]);
    return (
        <>
            <section className="intro">
                <div>
                    <div className="eyebrow">
                        <span className="status-dot" />
                        YOUR HOENN FIELD GUIDE
                    </div>
                    <h1>
                        A world of Pokémon.
                        <br />
                        <span>One place to explore.</span>
                    </h1>
                    <p>
                        Find your next partner. Explore moves, machines, and evolutions
                        <br className="desktop-break" /> from Pokémon Emerald EX.
                    </p>
                </div>
                <div className="intro-art" aria-hidden="true">
                    <Pokeball className="intro-ball" />
                    <span className="little-star star-one">✦</span>
                    <span className="little-star star-two">✧</span>
                    <div className="intro-sprite">
                        <Sprite name="Treecko" large />
                    </div>
                    <span className="field-note">Adventure starts here.</span>
                </div>
            </section>
            <section className="dex-section" aria-label="Search Pokémon">
                <div className="section-title">
                    <h2>
                        <Icon name="book" />
                        The Pokédex
                    </h2>
                    <span className="count-pill">
                        {metadata?.speciesCount.toLocaleString() ?? '…'} species & forms
                    </span>
                </div>
                <div className="search-toolbar">
                    <div className="search-box">
                        <Icon name="search" />
                        <input
                            ref={searchInput}
                            type="search"
                            value={search}
                            maxLength={100}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                setPage(1);
                            }}
                            placeholder="Search by name or ROM ID…"
                            aria-label="Search Pokémon by name or ROM ID"
                            autoComplete="off"
                        />
                        {search && (
                            <button
                                onClick={() => {
                                    setSearch('');
                                    setPage(1);
                                    searchInput.current?.focus();
                                }}
                                aria-label="Clear search"
                            >
                                <Icon name="close" size={18} />
                            </button>
                        )}
                    </div>
                    <label className="sort-control">
                        <span>Sort by</span>
                        <select
                            value={sort}
                            onChange={(event) => {
                                setSort(event.target.value);
                                setPage(1);
                            }}
                            aria-label="Sort Pokémon"
                        >
                            <option value="id">ROM ID</option>
                            <option value="name">Name A–Z</option>
                        </select>
                    </label>
                </div>
                <div className="results-label" aria-live="polite">
                    {loading ? (
                        'Finding Pokémon…'
                    ) : data ? (
                        <>
                            <strong>{data.total.toLocaleString()}</strong>{' '}
                            {search ? `results for “${search}”` : 'Pokémon to discover'}
                            <span>{search ? 'Search results' : 'All species & forms'}</span>
                        </>
                    ) : (
                        'Unable to load Pokémon'
                    )}
                </div>
                {error ? (
                    <ErrorState error={error} retry={retry} />
                ) : loading ? (
                    <div className="pokemon-grid" aria-label="Loading Pokémon" aria-busy="true">
                        {Array.from({ length: 12 }, (_, i) => (
                            <div className="card-skeleton" key={i} />
                        ))}
                    </div>
                ) : data?.total === 0 ? (
                    <div className="empty-state">
                        <Icon name="search" size={36} />
                        <h2>No Pokémon found</h2>
                        <p>Try a different name or ROM species ID.</p>
                        <button
                            className="primary-button"
                            onClick={() => {
                                setSearch('');
                                setPage(1);
                            }}
                        >
                            Show all Pokémon
                        </button>
                    </div>
                ) : (
                    <div className="pokemon-grid">
                        {data?.pokemon.map((pokemon) => (
                            <PokemonCard
                                key={pokemon.speciesId}
                                pokemon={pokemon}
                                query={currentQuery}
                            />
                        ))}
                    </div>
                )}
                {data && totalPages > 1 && (
                    <nav className="pagination" aria-label="Pokédex pages">
                        <button
                            disabled={page <= 1}
                            onClick={() => {
                                setPage((value) => value - 1);
                                document
                                    .querySelector('.dex-section')
                                    ?.scrollIntoView({ behavior: 'smooth' });
                            }}
                        >
                            <Icon name="back" size={17} />
                            Previous
                        </button>
                        <span>
                            Page <strong>{page}</strong> of {totalPages}
                        </span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => {
                                setPage((value) => value + 1);
                                document
                                    .querySelector('.dex-section')
                                    ?.scrollIntoView({ behavior: 'smooth' });
                            }}
                        >
                            Next
                            <Icon name="arrow" size={17} />
                        </button>
                    </nav>
                )}
            </section>
        </>
    );
}

function Detail({ id, query }: { id: number; query: string }) {
    const { data, loading, error, retry } = useApi<PokemonDetail>(`/api/pokemon/${id}`);
    const [tab, setTab] = useState<Tab>('moves');
    const [moveSearch, setMoveSearch] = useState('');
    const [kind, setKind] = useState('all');
    useEffect(() => {
        setTab('moves');
        setMoveSearch('');
        setKind('all');
    }, [id]);
    const tabLabels: { id: Tab; name: string; icon: 'spark' | 'disc' | 'branch'; count: number }[] =
        [
            {
                id: 'moves',
                name: 'Level-up moves',
                icon: 'spark',
                count: data?.learnset.length ?? 0,
            },
            { id: 'machines', name: 'TM / HM', icon: 'disc', count: data?.machines.length ?? 0 },
            {
                id: 'evolutions',
                name: 'Evolutions',
                icon: 'branch',
                count: data?.evolutionChain.length ?? 0,
            },
        ];
    return (
        <section className="detail-page">
            <PageLink className="back-link" href={`/${query}`}>
                <Icon name="back" size={18} />
                Back to Pokédex
            </PageLink>
            {error ? (
                <ErrorState error={error} retry={retry} />
            ) : loading || !data ? (
                <div className="detail-skeleton" aria-busy="true">
                    Loading Pokémon…
                </div>
            ) : (
                <>
                    <div className="detail-hero">
                        <div className={`detail-art tint-${id % 6}`}>
                            <Pokeball className="detail-watermark" />
                            <Sprite name={data.name} large />
                        </div>
                        <div className="detail-heading">
                            <div className="eyebrow">
                                ROM SPECIES / FORM #{String(id).padStart(4, '0')}
                            </div>
                            <h1>{data.name}</h1>
                            <p>Your field notes, all in one place.</p>
                            <div className="detail-stats">
                                <div>
                                    <strong>{data.learnset.length}</strong>
                                    <span>Level-up moves</span>
                                </div>
                                <div>
                                    <strong>
                                        {data.machines.filter((m) => m.kind === 'TM').length}
                                    </strong>
                                    <span>Compatible TMs</span>
                                </div>
                                <div>
                                    <strong>
                                        {data.machines.filter((m) => m.kind === 'HM').length}
                                    </strong>
                                    <span>Compatible HMs</span>
                                </div>
                            </div>
                            {data.sameNameCount > 1 && (
                                <p className="form-note">
                                    {data.sameNameCount} entries share this name. This is ROM form #
                                    {id}.
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="detail-tabs" role="tablist" aria-label="Pokémon information">
                        {tabLabels.map((item) => (
                            <button
                                key={item.id}
                                id={`tab-${item.id}`}
                                role="tab"
                                tabIndex={tab === item.id ? 0 : -1}
                                onKeyDown={(event) => {
                                    const index = tabLabels.findIndex(
                                        (value) => value.id === item.id,
                                    );
                                    const target =
                                        event.key === 'ArrowRight'
                                            ? (index + 1) % 3
                                            : event.key === 'ArrowLeft'
                                              ? (index + 2) % 3
                                              : event.key === 'Home'
                                                ? 0
                                                : event.key === 'End'
                                                  ? 2
                                                  : -1;
                                    if (target >= 0) {
                                        event.preventDefault();
                                        setTab(tabLabels[target].id);
                                        setMoveSearch('');
                                        document
                                            .getElementById(`tab-${tabLabels[target].id}`)
                                            ?.focus();
                                    }
                                }}
                                aria-selected={tab === item.id}
                                aria-controls="detail-panel"
                                className={tab === item.id ? 'active' : ''}
                                onClick={() => {
                                    setTab(item.id);
                                    setMoveSearch('');
                                }}
                            >
                                <Icon name={item.icon} size={18} />
                                {item.name}
                                <span>{item.count}</span>
                            </button>
                        ))}
                    </div>
                    <div
                        className="detail-panel"
                        id="detail-panel"
                        role="tabpanel"
                        aria-labelledby={`tab-${tab}`}
                    >
                        {tab === 'evolutions' ? (
                            <>
                                <div className="panel-title">
                                    <h2>Evolution chain</h2>
                                    <p>Follow every path in this Pokémon’s family.</p>
                                </div>
                                {data.evolutionChain.length ? (
                                    <div className="evolution-list">
                                        {data.evolutionChain.map((edge, index) => (
                                            <div className="evolution-row" key={index}>
                                                <PageLink
                                                    className={`evolution-pokemon ${edge.fromSpeciesId === id ? 'current' : ''}`}
                                                    href={`/pokemon/${edge.fromSpeciesId}${query}`}
                                                >
                                                    <Sprite name={edge.fromName} />
                                                    <strong>{edge.fromName}</strong>
                                                    <span>ROM #{edge.fromSpeciesId}</span>
                                                </PageLink>
                                                <div className="evolution-condition">
                                                    <Icon name="arrow" />
                                                    <p>{edge.summary}</p>
                                                </div>
                                                <PageLink
                                                    className={`evolution-pokemon ${edge.toSpeciesId === id ? 'current' : ''}`}
                                                    href={`/pokemon/${edge.toSpeciesId}${query}`}
                                                >
                                                    <Sprite name={edge.toName} />
                                                    <strong>{edge.toName}</strong>
                                                    <span>ROM #{edge.toSpeciesId}</span>
                                                </PageLink>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-state compact">
                                        <Icon name="branch" size={32} />
                                        <h3>No known evolutions</h3>
                                        <p>
                                            This form has no ordinary evolution rules in Emerald EX.
                                        </p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="panel-title">
                                    <div>
                                        <h2>
                                            {tab === 'moves'
                                                ? 'A move for every milestone'
                                                : 'Find the right machine'}
                                        </h2>
                                        <p>
                                            {tab === 'moves'
                                                ? 'Moves learned as this Pokémon levels up.'
                                                : 'All compatible TMs and HMs in Emerald EX.'}
                                        </p>
                                    </div>
                                </div>
                                <div className="move-controls">
                                    <div className="search-box small">
                                        <Icon name="search" size={18} />
                                        <input
                                            type="search"
                                            value={moveSearch}
                                            onChange={(event) => setMoveSearch(event.target.value)}
                                            placeholder="Filter moves…"
                                            aria-label="Filter moves by name"
                                        />
                                    </div>
                                    {tab === 'machines' && (
                                        <div className="segmented" aria-label="Machine type">
                                            {['all', 'TM', 'HM'].map((value) => (
                                                <button
                                                    aria-pressed={kind === value}
                                                    className={kind === value ? 'selected' : ''}
                                                    key={value}
                                                    onClick={() => setKind(value)}
                                                >
                                                    {value === 'all' ? 'All' : value}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <table className="moves-table">
                                    <thead>
                                        <tr>
                                            <th scope="col">
                                                {tab === 'moves' ? 'Learned at' : 'Machine'}
                                            </th>
                                            <th scope="col">Move</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tab === 'moves'
                                            ? data.learnset
                                                  .filter((m) =>
                                                      m.move
                                                          .toLowerCase()
                                                          .includes(moveSearch.toLowerCase()),
                                                  )
                                                  .map((move, index) => (
                                                      <tr key={index}>
                                                          <td>
                                                              <span
                                                                  className={`level-badge ${move.level === 0 ? 'evolution-level' : ''}`}
                                                              >
                                                                  {move.level === 0
                                                                      ? 'Evolution'
                                                                      : `Lv. ${move.level}`}
                                                              </span>
                                                          </td>
                                                          <td>{move.move}</td>
                                                      </tr>
                                                  ))
                                            : data.machines
                                                  .filter(
                                                      (m) =>
                                                          (kind === 'all' || m.kind === kind) &&
                                                          m.move
                                                              .toLowerCase()
                                                              .includes(moveSearch.toLowerCase()),
                                                  )
                                                  .map((move) => (
                                                      <tr key={move.machine}>
                                                          <td>
                                                              <span
                                                                  className={`machine-badge ${move.kind === 'HM' ? 'hm' : ''}`}
                                                              >
                                                                  {move.machine}
                                                              </span>
                                                          </td>
                                                          <td>{move.move}</td>
                                                      </tr>
                                                  ))}
                                    </tbody>
                                </table>
                                {(tab === 'moves'
                                    ? data.learnset.filter((m) =>
                                          m.move.toLowerCase().includes(moveSearch.toLowerCase()),
                                      ).length
                                    : data.machines.filter(
                                          (m) =>
                                              (kind === 'all' || m.kind === kind) &&
                                              m.move
                                                  .toLowerCase()
                                                  .includes(moveSearch.toLowerCase()),
                                      ).length) === 0 && (
                                    <div className="empty-state compact">
                                        <h3>No moves to show</h3>
                                        <p>
                                            {moveSearch
                                                ? 'Try another move name.'
                                                : 'No moves are listed for this form.'}
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div className="detail-navigation">
                        {id > 1 && (
                            <PageLink href={`/pokemon/${id - 1}${query}`}>
                                <Icon name="back" size={17} />
                                Previous Pokémon
                            </PageLink>
                        )}
                        {id < 1523 && (
                            <PageLink href={`/pokemon/${id + 1}${query}`}>
                                Next Pokémon
                                <Icon name="arrow" size={17} />
                            </PageLink>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}

export function App() {
    const [location, setLocation] = useState({
        path: window.location.pathname + window.location.search,
        revision: 0,
    });
    const { data: metadata } = useApi<DexMetadata>('/api/metadata');
    useEffect(() => {
        const onPopState = () =>
            setLocation((previous) => ({
                path: window.location.pathname + window.location.search,
                revision: previous.revision + 1,
            }));
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);
    const url = new URL(location.path, window.location.origin);
    const detail = /^\/pokemon\/(\d+)$/.exec(url.pathname);
    useEffect(() => {
        document.title = detail
            ? 'Pokémon · Emerald EX Pokédex'
            : 'Emerald EX Pokédex · Your Hoenn field guide';
    }, [location.path, detail]);
    useEffect(() => {
        if (location.revision > 0) document.getElementById('main')?.focus({ preventScroll: true });
    }, [location.revision]);
    return (
        <>
            <a className="skip-link" href="#main">
                Skip to content
            </a>
            <header className="site-header">
                <div className="header-inner">
                    <PageLink className="brand" href="/">
                        <span className="brand-mark">
                            <Pokeball />
                        </span>
                        <span>
                            emerald<span className="brand-ex">EX</span>
                            <small>THE POKÉDEX</small>
                        </span>
                    </PageLink>
                    <div className="header-right">
                        <span className="version">
                            <span className="status-dot" />
                            EMERALD EX {metadata?.version ?? '1.0.4'}
                        </span>
                        <span className="header-divider" />
                        <span className="header-caption">A trainer’s companion</span>
                    </div>
                </div>
            </header>
            <main id="main" className="main-shell" tabIndex={-1}>
                {detail ? (
                    <Detail id={Number(detail[1])} query={url.search} />
                ) : url.pathname === '/' ? (
                    <Browse key={location.revision} metadata={metadata} query={url.search} />
                ) : (
                    <div className="empty-state">
                        <h1>Page not found</h1>
                        <PageLink className="primary-button" href="/">
                            Open Pokédex
                        </PageLink>
                    </div>
                )}
            </main>
            <footer className="site-footer">
                <div>
                    <span className="footer-brand">
                        <Pokeball />
                        Made for the journey.
                    </span>
                    <span>Pokémon Emerald EX · v{metadata?.version ?? '1.0.4'}</span>
                </div>
                <p>
                    An unofficial fan reference. Pokémon belongs to Nintendo, Game Freak, and
                    Creatures.
                    <br />
                    ROM species IDs identify forms. Artwork is illustrative; game data comes from
                    the supplied ROM exports.
                </p>
            </footer>
        </>
    );
}
