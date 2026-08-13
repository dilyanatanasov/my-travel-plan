import { IsString, Length } from 'class-validator';

export class SaveDuelDto {
  /** The opponent's share token — same shape share links carry. */
  @IsString()
  @Length(8, 24)
  token: string;
}
