import { useCallback, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import ContrailLoader from '../components/ContrailLoader';
import { useAuth } from '../features/auth/authApi';
import FlipBook from '../features/book/components/FlipBook';
import { BookPageView } from '../features/book/components/BookPages';
import { useTravelBook } from '../features/book/useTravelBook';
import type { BookPage } from '../features/book/types';
import { track } from '../lib/analytics';

function pageLabel(pages: BookPage[], index: number): string {
  const page = pages[index];
  if (!page) return '';
  if (page.kind === 'cover') return 'Cover';
  if (page.kind === 'back-cover') return 'Back cover';
  return `Page ${index}`;
}

/**
 * The travel book at /book (2026-10-27): the owner's journeys as a
 * yearbook with page turns. Private: it reads only the owner's own data,
 * and guests get a closed cover inviting them to sign in.
 */
function TravelBookPage() {
  const { user, isGuest } = useAuth();
  const { book, pages, isLoading, isError } = useTravelBook({ skip: isGuest });
  const [params, setParams] = useSearchParams();
  const initialPage = Number(params.get('page')) || 0;

  useEffect(() => {
    track('book_open', { kind: isGuest ? 'guest' : 'registered' });
  }, [isGuest]);

  // Keep the page in the URL so a reload or back button returns to it.
  // Only when it differs: every URL write hands out a new setParams, so an
  // unconditional write here re-renders forever.
  const onPageChange = useCallback(
    (page: number) => {
      const current = Number(params.get('page')) || 0;
      if (current === page) return;
      setParams(page > 0 ? { page: String(page) } : {}, { replace: true });
    },
    [params, setParams],
  );

  if (isGuest || !user) return <GuestTeaser />;

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <ContrailLoader />
      </div>
    );
  }

  if (isError || !book) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-ink">Your travel book could not be opened just now.</p>
        <Link to="/" className="text-sm font-medium text-brand-text hover:underline">
          Back to map
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-canvas">
      <h1 className="sr-only">Travel book</h1>
      <FlipBook
        pageCount={pages.length}
        initialPage={Math.min(initialPage, pages.length - 1)}
        onPageChange={onPageChange}
        pageLabel={(index) => pageLabel(pages, index)}
        renderPage={(index, side, api) => (
          <BookPageView page={pages[index]} book={book} side={side} number={index} api={api} />
        )}
      />
    </div>
  );
}

/** A closed book for guests: the shape of the feature, not anyone's data. */
function GuestTeaser() {
  return (
    <div className="h-full overflow-y-auto flex flex-col items-center justify-center gap-8 px-6 py-10 bg-canvas">
      <div
        className="relative w-[220px] aspect-[3/4] rounded-r-md rounded-l-sm bg-binding text-binding-foil shadow-lg flex flex-col items-center justify-center text-center px-6"
        style={{ transform: 'rotate(-3deg)' }}
        aria-hidden="true"
      >
        <div className="absolute inset-[5%] rounded-sm border border-binding-foil/40" />
        <div
          className="absolute inset-0 rounded-r-md"
          style={{ backgroundImage: 'linear-gradient(to right, rgb(0 0 0 / 0.35), transparent 8%)' }}
        />
        <BrandMark className="w-8 h-8 opacity-90" />
        <p className="mt-4 text-[10px] uppercase tracking-[0.35em] opacity-80">Travel book</p>
        <p className="mt-2 font-display text-2xl">My travels</p>
      </div>
      <div className="max-w-sm text-center">
        <h1 className="font-display text-2xl text-ink">Your journeys, as a book</h1>
        <p className="mt-2 text-ink-muted">
          Every trip becomes a page, with its route, your photos and a stamp for each new country. Sign in to keep
          your travel book.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Link
            to="/register"
            className="inline-flex items-center min-h-11 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
          >
            Create an account
          </Link>
          <Link
            to="/login"
            state={{ from: '/book' }}
            className="inline-flex items-center min-h-11 px-4 rounded-lg text-sm font-medium text-brand-text hover:bg-brand-50"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default TravelBookPage;
