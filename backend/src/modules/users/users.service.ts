import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /** With sign-in methods: the profile and login both report them. */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.trim().toLowerCase() },
      relations: ['identities'],
    });
  }

  /** Lean: runs on every authenticated request from the JWT strategy. */
  async findById(id: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByIdWithIdentities(id: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: ['identities'],
    });
  }

  async emailExists(email: string): Promise<boolean> {
    const count = await this.userRepository.count({
      where: { email: email.trim().toLowerCase() },
    });
    return count > 0;
  }
}
