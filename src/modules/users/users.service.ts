import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import * as bcrypt from 'bcrypt';

import { User, UserDocument } from './schemas/user.schema';

import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.userModel.findOne({
      email: createUserDto.email,
    });

    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      10,
    );

    const user = await this.userModel.create({
      ...createUserDto,
      password: hashedPassword,
    });

    return {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      createdAt: user.get('createdAt'),
    };
  }
}