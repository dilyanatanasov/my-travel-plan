import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MaxLength(128)
  token: string;

  // Same policy as RegisterDto: length is what matters, composition rules
  // push people toward "Password1!" patterns.
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  password: string;
}
