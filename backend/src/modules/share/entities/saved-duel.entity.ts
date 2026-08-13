import { Entity, PrimaryColumn, CreateDateColumn } from 'typeorm';

/**
 * A bookmarked opponent, keyed by their share token rather than their user
 * id — see the migration docblock: revoking a token must break the bookmark
 * the same way it breaks a share link.
 */
@Entity('saved_duels')
export class SavedDuel {
  @PrimaryColumn({ name: 'user_id' })
  userId: number;

  @PrimaryColumn({ name: 'opponent_token', type: 'varchar', length: 24 })
  opponentToken: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
