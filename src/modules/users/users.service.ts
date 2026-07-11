import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import * as bcrypt from 'bcrypt';

import { User, UserDocument } from './schemas/user.schema';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async createUser(createUserDto: CreateUserDto) {
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

  async findByEmail(email: string) {
  return this.userModel
    .findOne({ email })
    .select('+password');
  }
  async findById(id: string) {
  return this.userModel.findById(id);
  }

  async updateRefreshToken(
  userId: string,
  refreshToken: string | null,
) {
  return this.userModel.findByIdAndUpdate(
    userId,
    {
      refreshToken,
    },
    {
      new: true,
    },
  );
  }
  async getProfile(userId: string) {
  return this.userModel.findById(userId)
     .select('-password');
}

async updateProfile(
  userId: string,
  updateProfileDto: UpdateProfileDto,
) {
  return this.userModel.findByIdAndUpdate(
    userId,
    updateProfileDto,
    {
      new: true,
    },
  ).select('-password');
  }

  async updateAvatar(
  userId: string,
  avatar: string,
) {
  return this.userModel.findByIdAndUpdate(
    userId,
     {
      avatar,
     },
     {
      new: true,
     },
     );
  }
}