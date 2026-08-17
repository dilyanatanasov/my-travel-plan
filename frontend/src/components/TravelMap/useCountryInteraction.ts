import { useCallback } from 'react';
import type { Visit } from '../../types';

/**
 * The tap-cycle and long-press editing gestures on countries.
 *
 * Extracted from TravelMap (2026-08-13 consolidation) as a pure move: the
 * guards, the cycle order and the toasts are the originals. The drag/consumed
 * refs stay owned by the map container - they arbitrate between d3-zoom and
 * clicks for every layer, not just countries.
 */

interface UpdateVisitArgs {
  id: number;
  data: { visitType: 'lived' | 'transit' | 'wishlist' };
}

export function useCountryInteraction(options: {
  countryByIsoCode: Map<string, number>;
  visitByCountryId: Map<number, Visit>;
  addVisitForCountry: (countryId: number) => Promise<unknown>;
  updateVisit: (args: UpdateVisitArgs) => { unwrap: () => Promise<unknown> };
  removeVisitWithUndo: (visit: Visit) => unknown;
  showToast: (
    message: string,
    opts?: { durationMs?: number; key?: string },
  ) => void;
  /** A highlighted journey puts the map in "reading" mode. */
  hasSelectedJourney: boolean;
  /** The replay owns the map while it runs. */
  replayActive: boolean;
  /** True when the click that is landing was actually the end of a drag. */
  wasDragRef: React.RefObject<boolean>;
  /** Set when a handler acted, so the container does not also clear. */
  clickConsumedRef: React.MutableRefObject<boolean>;
  onOpenCountry: (isoCode: string) => void;
}): {
  handleCountryClick: (isoCode: string) => Promise<void>;
  handleCountryLongPress: (isoCode: string) => Promise<void>;
} {
  const {
    countryByIsoCode,
    visitByCountryId,
    addVisitForCountry,
    updateVisit,
    removeVisitWithUndo,
    showToast,
    hasSelectedJourney,
    replayActive,
    wasDragRef,
    clickConsumedRef,
    onOpenCountry,
  } = options;

  const handleCountryClick = useCallback(
    async (isoCode: string) => {
      // A pan ends with a click on whatever is under the finger. Without this
      // guard, dragging the map to look around silently toggled a country.
      if (wasDragRef.current) return;

      // While a journey is highlighted the map is in "reading" mode: a tap
      // dismisses the highlight rather than editing your countries, so
      // missing a thin route cannot silently add one. The container handler
      // does the clearing; this just declines to toggle.
      if (hasSelectedJourney) return;

      /*
        The replay owns the map while it runs. Editing during it would both
        corrupt the illusion - countries appearing that you did not fly to —
        and quietly change real data from a tap the user meant as "pause".
      */
      if (replayActive) return;

      const countryId = countryByIsoCode.get(isoCode);
      if (!countryId) return;

      clickConsumedRef.current = true;
      const existingVisit = visitByCountryId.get(countryId);
      /*
        Tap cycles the state (user's design, 2026-08-13):
        none → visited → transit → want to go → removed (undo toast).

        The detail card moved to long-press - it was the tap-on-visited
        action before, which is why the cycle "didn't register" in testing:
        the card swallowed every tap after the first. Home stays out of the
        cycle entirely; tapping it opens its card, and only the card can
        change or remove a home. Removal at the end of the cycle is
        acceptable where tap-to-remove once was not: it takes three
        deliberate taps to reach, each announced, and undo remains.
      */
      if (!existingVisit) {
        await addVisitForCountry(countryId);
        return;
      }
      /*
        Cycle grew a step (friend feedback, 2026-08-17): visited → lived →
        transit → want to go → removed. The toasts share one coalescing key
        so rapid taps replace the message instead of stacking four of them.
      */
      const type = existingVisit.visitType || 'trip';
      if (type === 'home') {
        onOpenCountry(isoCode);
      } else if (type === 'trip') {
        await updateVisit({
          id: existingVisit.id,
          data: { visitType: 'lived' },
        }).unwrap();
        showToast('Lived here - tap again for transit', {
          durationMs: 3000,
          key: 'visit-cycle',
        });
      } else if (type === 'lived') {
        await updateVisit({
          id: existingVisit.id,
          data: { visitType: 'transit' },
        }).unwrap();
        showToast('Transit - tap again for "want to go", hold for details', {
          durationMs: 3000,
          key: 'visit-cycle',
        });
      } else if (type === 'transit') {
        await updateVisit({
          id: existingVisit.id,
          data: { visitType: 'wishlist' },
        }).unwrap();
        showToast('On your "want to go" list - tap again to clear', {
          durationMs: 3000,
          key: 'visit-cycle',
        });
      } else {
        await removeVisitWithUndo(existingVisit);
      }
    },
    [
      countryByIsoCode,
      visitByCountryId,
      addVisitForCountry,
      updateVisit,
      removeVisitWithUndo,
      showToast,
      hasSelectedJourney,
      replayActive,
      wasDragRef,
      clickConsumedRef,
      onOpenCountry,
    ],
  );

  /*
    Hold a country to open its card, adding it first if it is not yet
    visited. That gives trip / transit / home a route that does not involve
    opening a panel - which matters most on a phone, where the panel covers
    the map you are pointing at.
  */
  const handleCountryLongPress = useCallback(
    async (isoCode: string) => {
      if (hasSelectedJourney || replayActive) return;
      const countryId = countryByIsoCode.get(isoCode);
      if (!countryId) return;

      clickConsumedRef.current = true;
      if (!visitByCountryId.get(countryId)) {
        await addVisitForCountry(countryId);
      }
      onOpenCountry(isoCode);
    },
    [
      countryByIsoCode,
      visitByCountryId,
      addVisitForCountry,
      hasSelectedJourney,
      replayActive,
      clickConsumedRef,
      onOpenCountry,
    ],
  );

  return { handleCountryClick, handleCountryLongPress };
}
