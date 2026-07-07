import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  fullName!: string;

  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;
}