import { Link } from 'react-router-dom';

/** Plain-language terms (2026-08-14). Operator should review the wording. */
function TermsPage() {
  return (
    <div className="scroll-page bg-canvas">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold text-ink">Terms of service</h1>
          <Link
            to="/"
            className="inline-flex items-center min-h-11 px-3 rounded-lg text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            Back to myContrail
          </Link>
        </div>

        <div className="space-y-6 text-sm text-ink-muted leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:mb-1.5">
          <p>
            Short version: myContrail is a free personal travel map, provided
            as-is by an individual. Be decent, your data is yours, no
            guarantees. Last updated: 14 August 2026.
          </p>

          <section>
            <h2>The service</h2>
            <p>
              myContrail lets you record and visualise your travels and,
              optionally, share your map. It is provided free of charge and
              may change, gain or lose features, or — worst case — shut down.
              If it ever does, you can always take your data with you
              (Settings → Your data).
            </p>
          </section>

          <section>
            <h2>Your account</h2>
            <p>
              You must be at least 14 to create an account. Keep your password
              to yourself; what happens under your login is your
              responsibility. You can delete your account at any time, which
              removes all your data immediately.
            </p>
          </section>

          <section>
            <h2>Your content</h2>
            <p>
              Travel records and notes you enter remain yours. By creating a
              share link you allow anyone holding that link to view the shared
              parts of your map until you revoke it.
            </p>
          </section>

          <section>
            <h2>Acceptable use</h2>
            <p>
              Don&rsquo;t abuse the service: no attempts to access other
              people&rsquo;s data, no automated scraping, no using the app to
              harass anyone. Accounts doing so may be removed.
            </p>
          </section>

          <section>
            <h2>No warranty</h2>
            <p>
              The service is provided &ldquo;as is&rdquo;, without warranties
              of any kind. To the extent the law allows, the operator is not
              liable for losses arising from use of the service, including
              data loss — export your data if it matters to you.
            </p>
          </section>

          <section>
            <h2>Privacy</h2>
            <p>
              How data is handled is described in the{' '}
              <Link to="/privacy" className="text-brand-700 hover:underline">
                privacy policy
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default TermsPage;
