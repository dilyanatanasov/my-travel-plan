import { IsString, MinLength } from 'class-validator';

/** Change password while signed in; the current one proves it is you. */
export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
