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
import { UserRole } from '../../common/enums/user-role.enum';

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

  async count(): Promise<number> {
  return this.userModel.countDocuments();
  }

  async findAll() {
  return this.userModel
    .find()
    .select('-password')
    .sort({
      createdAt: -1,
    });
 }

 async findById(id: string) {
  return this.userModel
    .findById(id)
    .select('-password');
  }

  async blockUser(id: string) {
  return this.userModel.findByIdAndUpdate(
    id,
    {
      isActive: false,
    },
    {
      new: true,
    },
    );
  }

  async unblockUser(id: string) {
  return this.userModel.findByIdAndUpdate(
    id,
    {
      isActive: true,
    },
    {
      new: true,
    },
   );
  }

  async changeRole(
  id: string,
  role: UserRole,
) {
  return this.userModel.findByIdAndUpdate(
    id,
    {
      role,
    },
    {
      new: true,
    },
   );
  }

  async deleteUser(id: string) {
    await this.userModel.findByIdAndDelete(id);

   return {
    message: 'User deleted successfully',
   };
  }
}