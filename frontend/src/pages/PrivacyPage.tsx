import { Link } from 'react-router-dom';

/**
 * GDPR transparency page (2026-08-14). Written from the codebase — every
 * claim here is checked against what the app actually does. The operator
 * should review the wording; the structure follows GDPR Art. 13.
 */
function PrivacyPage() {
  return (
    <div className="scroll-page bg-canvas">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold text-ink">Privacy policy</h1>
          <Link
            to="/"
            className="inline-flex items-center min-h-11 px-3 rounded-lg text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            Back to myContrail
          </Link>
        </div>

        <div className="space-y-6 text-sm text-ink-muted leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:mb-1.5">
          <p>
            myContrail is a personal travel map. This page explains what data
            it keeps and why, in plain words. Last updated: 14 August 2026.
          </p>

          <section>
            <h2>Who is responsible</h2>
            <p>
              myContrail (mycontrail.com) is operated by its individual owner
              in Bulgaria, in the European Union. For anything about your
              data, contact: privacy@mycontrail.com.
            </p>
          </section>

          <section>
            <h2>What we store, and why</h2>
            <p>
              Your email address and a securely hashed password (to sign you
              in), an optional display name, and the travel records you enter:
              countries, flights, dates and notes. That is the product — a map
              of your travels — and it is processed only to show it to you and
              to whoever you explicitly share it with. Legal basis: performing
              the service you signed up for.
            </p>
          </section>

          <section>
            <h2>What we deliberately do not do</h2>
            <p>
              No advertising, no tracking cookies, no data sales, no
              third-party analytics scripts. Our usage statistics run on
              self-hosted, cookieless software (Umami) that stores no personal
              identifiers and no travel data — which is why there is no cookie
              banner: there is nothing to consent to. The only browser storage
              used is what signs you in and remembers preferences like your
              theme.
            </p>
          </section>

          <section>
            <h2>Sharing is opt-in, always</h2>
            <p>
              Your map is private until you create a share link. A share link
              shows your countries and routes — never your notes, and never
              your &ldquo;want to go&rdquo; list. Turning sharing off kills
              every existing link and duel immediately.
            </p>
          </section>

          <section>
            <h2>Who processes data for us</h2>
            <p>
              Hosting: DigitalOcean (servers in the USA, under their EU data
              processing agreement with standard contractual clauses). Email
              delivery (verification and password reset only): Resend. Neither
              receives your travel records for any purpose beyond storing and
              transmitting them for the service.
            </p>
          </section>

          <section>
            <h2>Retention</h2>
            <p>
              Your data stays as long as your account exists. Anonymous guest
              sessions that are abandoned are cleaned up automatically.
              Database backups rotate out within days.
            </p>
          </section>

          <section>
            <h2>Your rights</h2>
            <p>
              Settings → Your data gives you both big ones directly: download
              everything as JSON, or delete your account and every record with
              it, immediately and permanently. You also have the right to
              correction (edit anything in the app), and to complain to a
              supervisory authority — in Bulgaria, the Commission for Personal
              Data Protection (cpdp.bg).
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPage;
