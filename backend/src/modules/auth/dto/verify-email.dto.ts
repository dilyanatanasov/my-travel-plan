import { IsString, MaxLength } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @MaxLength(128)
  token: string;
}
