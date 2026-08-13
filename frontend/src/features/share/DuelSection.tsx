import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useGetSavedDuelsQuery,
  useRemoveDuelMutation,
} from './shareApi';
import { useToast } from '../../components/Toast/ToastProvider';

/**
 * Duels live on share tokens, not a friend graph (decision 2026-08-13):
 * the challenge link is your share token wearing boxing gloves, an opponent
 * is a pasted link, and a saved duel is a bookmark that dies with either
 * side's token — exactly like the share links it is made of.
 */

/**
 * Every token in the pasted input, in order. A duel URL carries TWO tokens —
 * naively taking the first meant pasting an existing duel link handed you
 * your own token back ("you cannot duel yourself"). The caller filters self
 * out and duels whoever remains.
 */
function extractTokens(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const fromUrl = [
    ...trimmed.matchAll(/\/(?:s|duel)\/([A-Za-z0-9_-]{8,24})/g),
  ].flatMap((match) => {
    // A /duel/a/b URL: the second token rides after the captured first.
    const tail = trimmed
      .slice((match.index ?? 0) + match[0].length)
      .match(/^\/([A-Za-z0-9_-]{8,24})/);
    return tail ? [match[1], tail[1]] : [match[1]];
  });
  if (fromUrl.length > 0) return [...new Set(fromUrl)];
  if (/^[A-Za-z0-9_-]{8,24}$/.test(trimmed)) return [trimmed];
  return [];
}

function DuelSection({ myToken }: { myToken: string }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [opponentInput, setOpponentInput] = useState('');
  const { data: savedDuels = [] } = useGetSavedDuelsQuery();
  const [removeDuel] = useRemoveDuelMutation();

  const challengeUrl = `${window.location.origin}/duel/${myToken}`;

  const handleCopyChallenge = async () => {
    try {
      await navigator.clipboard.writeText(challengeUrl);
      showToast('Challenge link copied — send it to someone', {
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
        onClick={handleCopyChallenge}
        className="mt-3 flex items-center justify-center w-full min-h-11 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
      >
        Copy my challenge link
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
