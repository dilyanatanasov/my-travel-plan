import { IsOptional, IsString } from 'class-validator';

/**
 * Account deletion confirmation. Password is required for registered
 * accounts (the service enforces it — a stolen session must not be enough
 * to destroy someone's data); guests have none and may delete freely.
 */
export class DeleteAccountDto {
  @IsOptional()
  @IsString()
  password?: string;
}
