import { useToast } from '../../../components/Toast/ToastProvider';
import Button from '../../../components/ui/Button';
import {
  useGetWatchesQuery,
  useRemoveWatchMutation,
} from './watchesApi';

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The user's active watches. The nightly sweep does the work; this list
 * is the receipt — and the off switch.
 */
function WatchList() {
  const { data: watches = [] } = useGetWatchesQuery();
  const [removeWatch, { isLoading: isRemoving }] = useRemoveWatchMutation();
  const { showToast } = useToast();

  const active = watches.filter((watch) => watch.active);
  if (active.length === 0) return null;

  const handleRemove = async (id: number) => {
    try {
      await removeWatch(id).unwrap();
      showToast('Watch removed');
    } catch {
      showToast('Could not remove the watch', { tone: 'error' });
    }
  };

  return (
    <div className="bg-surface border border-line rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-ink mb-1">Watching</h3>
      <p className="text-xs text-ink-muted mb-3">
        Checked nightly. You get a notification when a price genuinely
        drops — at most one per watch per day.
      </p>
      <ul className="space-y-2">
        {active.map((watch) => (
          <li
            key={watch.id}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="text-ink min-w-0 truncate">
              <span className="font-mono font-semibold">
                {watch.origin} → {watch.destination}
              </span>{' '}
              <span className="text-ink-muted">
                {monthLabel(watch.month)}
                {watch.thresholdPrice !== null &&
                  ` · under $${Math.round(Number(watch.thresholdPrice))}`}
                {watch.lastNotifiedPrice !== null &&
                  ` · last alert $${Math.round(Number(watch.lastNotifiedPrice))}`}
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemove(watch.id)}
              disabled={isRemoving}
            >
              Stop
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default WatchList;
