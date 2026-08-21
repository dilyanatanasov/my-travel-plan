import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useGetSavedDuelsQuery,
  useRemoveDuelMutation,
} from './shareApi';
import { useToast } from '../../components/Toast/ToastProvider';
import { extractTokens } from './duelTokens';

/**
 * Duels live on share tokens, not a friend graph (decision 2026-08-13):
 * the challenge link is your share token wearing boxing gloves, an opponent
 * is a pasted link, and a saved duel is a bookmark that dies with either
 * side's token - exactly like the share links it is made of.
 */

function DuelSection({ myToken }: { myToken: string }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [opponentInput, setOpponentInput] = useState('');
  const { data: savedDuels = [] } = useGetSavedDuelsQuery();
  const [removeDuel] = useRemoveDuelMutation();

  const challengeUrl = `${window.location.origin}/duel/${myToken}`;

  /*
    Hand the challenge to the OS share sheet (owner ask, 2026-08-21):
    a duel is aimed at one friend on WhatsApp or Instagram, and asking
    someone to copy a link and then go find the app to paste it into
    loses most of them. Clipboard remains the fallback for desktop
    browsers without navigator.share, which is most of them.
  */
  const handleShareChallenge = async () => {
    const payload = {
      title: 'myContrail map duel',
      text: 'I challenge you to a map duel - who has seen more of the world?',
      url: challengeUrl,
    };
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(payload);
        return;
      } catch (error) {
        // A dismissed sheet is a choice, not a failure to work around.
        if ((error as Error)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(challengeUrl);
      showToast('Challenge link copied - send it to someone', {
        tone: 'success',
      });
    } catch {
      showToast(challengeUrl, { durationMs: 15000 });
    }
  };

  const handleStartDuel = () => {
    const candidates = extractTokens(opponentInput);
    if (candidates.length === 0) {
      showToast('Paste their share or duel link (or the token itself)', {
        tone: 'error',
      });
      return;
    }
    const opponent = candidates.find((token) => token !== myToken);
    if (!opponent) {
      showToast('That link only contains your own map', { tone: 'error' });
      return;
    }
    navigate(`/duel/${myToken}/${opponent}`);
  };

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
      <p className="text-sm font-semibold text-ink">Map duels</p>
      <p className="text-xs text-ink-muted mt-1 leading-relaxed">
        Compare maps head to head. Send your challenge link, or paste a
        friend's map link to start one.
      </p>

      <button
        type="button"
        onClick={handleShareChallenge}
        className="mt-3 flex items-center justify-center gap-2 w-full min-h-11 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
      >
        <svg
          className="w-4 h-4 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="18" cy="5" r="2.6" />
          <circle cx="6" cy="12" r="2.6" />
          <circle cx="18" cy="19" r="2.6" />
          <path d="M8.4 13.3l7.2 4.2M15.6 6.5L8.4 10.7" />
        </svg>
        Challenge a friend
      </button>

      <div className="mt-2 flex items-center gap-1">
        <input
          type="text"
          value={opponentInput}
          onChange={(e) => setOpponentInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleStartDuel()}
          placeholder="Paste a friend's map link…"
          aria-label="Opponent's map link"
          className="flex-1 min-w-0 min-h-10 px-2 text-xs border border-line rounded-lg bg-surface-sunken text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={handleStartDuel}
          className="flex-shrink-0 min-h-10 px-3 text-xs font-medium text-brand-700 hover:bg-brand-50 rounded-lg"
        >
          Duel
        </button>
      </div>

      {savedDuels.length > 0 && (
        <div className="mt-3 pt-3 border-t border-line space-y-1">
          <p className="text-xs font-semibold text-ink">Saved duels</p>
          {savedDuels.map((duel) => (
            <div key={duel.token} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => navigate(`/duel/${myToken}/${duel.token}`)}
                className="flex-1 min-w-0 min-h-10 px-2 text-left text-xs text-ink hover:bg-surface-sunken rounded-lg truncate"
              >
                vs <span className="font-medium">{duel.displayName}</span>
                <span className="text-ink-subtle">
                  {' '}
                  · {duel.countries}{' '}
                  {duel.countries === 1 ? 'country' : 'countries'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void removeDuel(duel.token)}
                aria-label={`Remove duel with ${duel.displayName}`}
                className="flex-shrink-0 p-1.5 text-ink-subtle hover:text-red-500 rounded"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DuelSection;
