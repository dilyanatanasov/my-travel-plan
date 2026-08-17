import { useCallback } from 'react';
import {
  useAddVisitMutation,
  useRemoveVisitMutation,
} from './visitsApi';
import { useToast } from '../../components/Toast/ToastProvider';
import type { Visit, VisitType } from '../../types';

/**
 * Country add/remove with undo and visible failure.
 *
 * Two problems this fixes:
 *  - Removing a country destroyed its date, notes and visit type with no
 *    confirmation and no way back. One mis-tap on a small country on a phone
 *    was enough.
 *  - Mutation errors were awaited and then ignored, so with the backend down
 *    clicking a country did nothing at all and said nothing.
 */
export function useVisitActions() {
  const [addVisit] = useAddVisitMutation();
  const [removeVisit] = useRemoveVisitMutation();
  const { showToast } = useToast();

  /** Re-create a removed visit from the snapshot taken before deletion. */
  const restoreVisit = useCallback(
    async (visit: Visit) => {
      try {
        await addVisit({
          countryId: visit.countryId,
          visitedAt: visit.visitedAt
            ? new Date(visit.visitedAt).toISOString().split('T')[0]
            : undefined,
          notes: visit.notes ?? undefined,
          visitType: visit.visitType || 'trip',
        }).unwrap();
        showToast(`${visit.country?.name ?? 'Country'} restored`, {
          tone: 'success',
        });
      } catch {
        showToast('Could not restore that country', { tone: 'error' });
      }
    },
    [addVisit, showToast]
  );

  /**
   * Remove a visit, offering undo.
   *
   * Takes the whole Visit rather than an id so the undo has the date, notes
   * and type to restore — an id alone would only bring the country back empty.
   */
  const removeVisitWithUndo = useCallback(
    async (visit: Visit) => {
      const name = visit.country?.name ?? 'Country';
      try {
        await removeVisit(visit.id).unwrap();
        showToast(`Removed ${name}`, {
          action: { label: 'Undo', onAction: () => restoreVisit(visit) },
        });
      } catch {
        showToast(`Could not remove ${name}`, { tone: 'error' });
      }
    },
    [removeVisit, restoreVisit, showToast]
  );

  const addVisitForCountry = useCallback(
    async (
      countryId: number,
      countryName?: string,
      visitType?: VisitType,
    ) => {
      try {
        await addVisit({
          countryId,
          visitedAt: new Date().toISOString().split('T')[0],
          ...(visitType ? { visitType } : {}),
        }).unwrap();
      } catch {
        showToast(
          countryName ? `Could not add ${countryName}` : 'Could not add country',
          { tone: 'error' }
        );
      }
    },
    [addVisit, showToast]
  );

  return { addVisitForCountry, removeVisitWithUndo, restoreVisit };
}
