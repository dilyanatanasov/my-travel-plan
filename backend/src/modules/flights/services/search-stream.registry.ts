import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Observable, ReplaySubject } from 'rxjs';

/**
 * In-memory registry of running smart searches (M3). The POST starts the
 * orchestrator and gets a searchId; the GET subscribes to its stream.
 *
 * A ReplaySubject buffers everything emitted so far, so a subscriber who
 * arrives after the surface event (the normal case — the browser needs a
 * beat to open the EventSource) still receives the whole story in order.
 *
 * Single-container deployment makes in-memory state safe today; if the
 * backend ever scales out, searches pin to their container or move to
 * Redis — a problem worth having.
 */

export interface StreamEnvelope {
  event: string;
  data: unknown;
}

interface PendingSearch {
  userId: number;
  subject: ReplaySubject<StreamEnvelope>;
  createdAt: number;
}

/** A finished stream lingers briefly for slow subscribers, then goes. */
const RETENTION_MS = 5 * 60 * 1000;

@Injectable()
export class SearchStreamRegistry {
  private readonly pending = new Map<string, PendingSearch>();

  open(userId: number): { searchId: string; emit: (e: StreamEnvelope) => void; close: () => void } {
    this.sweep();
    const searchId = randomBytes(12).toString('hex');
    const subject = new ReplaySubject<StreamEnvelope>();
    this.pending.set(searchId, { userId, subject, createdAt: Date.now() });
    return {
      searchId,
      emit: (envelope) => subject.next(envelope),
      close: () => subject.complete(),
    };
  }

  /** Owner-checked: a searchId is not a capability to read someone else's search. */
  subscribe(searchId: string, userId: number): Observable<StreamEnvelope> {
    const entry = this.pending.get(searchId);
    if (!entry || entry.userId !== userId) {
      throw new NotFoundException('Unknown search');
    }
    return entry.subject.asObservable();
  }

  private sweep(): void {
    const cutoff = Date.now() - RETENTION_MS;
    for (const [id, entry] of this.pending) {
      if (entry.createdAt < cutoff) {
        entry.subject.complete();
        this.pending.delete(id);
      }
    }
  }
}
