import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import * as bcrypt from 'bcrypt';

import { User, UserDocument } from './schemas/user.schema';
import { Pet, PetDocument } from '../pets/schemas/pet.schema';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserRole } from '../../common/enums/user-role.enum';
import { AdminUserQueryDto } from '../admin/dto/admin-user-query.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Pet.name)
    private readonly petModel: Model<PetDocument>,
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

  async findById(id: string) {
  return this.userModel
    .findById(id)
    .select('-password');
  }

  async findAll(query: AdminUserQueryDto) {
  const {
    page,
    limit,
    search,
    role,
    isActive,
    sort,
    order,
  } = query;

  const filter: any = {};

  if (search) {
    filter.$or = [
      {
        fullName: {
          $regex: search,
          $options: 'i',
        },
      },
      {
        email: {
          $regex: search,
          $options: 'i',
        },
      },
    ];
  }

  if (role) {
    filter.role = role;
  }

  if (isActive !== undefined) {
    filter.isActive = isActive;
  }

  const total = await this.userModel.countDocuments(filter);

  const users = await this.userModel
    .find(filter)
    .select('-password')
    .sort({
      [sort]: order === 'asc' ? 1 : -1,
    })
    .skip((page - 1) * limit)
    .limit(limit);

  return {
    users,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
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

  async monthlyRegistrations() {
  const months = new Array(12).fill(0);

  const users =
    await this.userModel.find();

  users.forEach((user) => {
    const createdAt = user.get('createdAt');

    if (createdAt) {
      months[
        new Date(
          createdAt,
        ).getMonth()
      ]++;
    }
  });

  return months;
}

async monthlyQrScans() {
  const months = new Array(12).fill(0);

  const pets =
    await this.petModel.find();

  pets.forEach((pet) => {
    if (pet.lastScannedAt) {
      months[
        new Date(
          pet.lastScannedAt,
        ).getMonth()
      ] += pet.scanCount;
    }
  });

  return months;
}
}