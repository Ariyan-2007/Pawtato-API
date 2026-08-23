import { BadRequestException, Injectable } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { QueryFilter, Model } from 'mongoose';

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

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = await this.userModel.create({
      ...createUserDto,
      password: hashedPassword,
    });

    return {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.get('createdAt') as Date,
    };
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email }).select('+password');
  }

  async findByVerificationTokenHash(tokenHash: string) {
    return this.userModel
      .findOne({ emailVerificationTokenHash: tokenHash })
      .select('+emailVerificationTokenHash');
  }

  async setEmailVerificationToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    return this.userModel.findByIdAndUpdate(userId, {
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: expiresAt,
    });
  }

  async markEmailVerified(userId: string) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          isEmailVerified: true,
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
        },
        { new: true },
      )
      .select('-password');
  }

  async findByResetTokenHash(tokenHash: string) {
    return this.userModel
      .findOne({ passwordResetTokenHash: tokenHash })
      .select('+passwordResetTokenHash');
  }

  async setPasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    return this.userModel.findByIdAndUpdate(userId, {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: expiresAt,
    });
  }

  async resetPassword(userId: string, hashedPassword: string) {
    const changedAt = new Date();

    await this.userModel.findByIdAndUpdate(userId, {
      password: hashedPassword,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      passwordChangedAt: changedAt,
    });

    return changedAt;
  }

  // Lean lookup used on every authenticated request (JwtStrategy) — only the
  // fields needed to decide whether a JWT is still valid.
  async findAuthState(userId: string) {
    return this.userModel.findById(userId).select('isActive passwordChangedAt');
  }

  async getProfile(userId: string) {
    return this.userModel.findById(userId).select('-password');
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    return this.userModel
      .findByIdAndUpdate(userId, updateProfileDto, {
        new: true,
      })
      .select('-password');
  }

  async updateAvatar(userId: string, avatar: string) {
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
    return this.userModel.findById(id).select('-password');
  }

  async findAll(query: AdminUserQueryDto) {
    const { page, limit, search, role, isActive, sort, order } = query;

    interface UserAdminFilter {
      $or?: Array<{ [field: string]: { $regex: string; $options: string } }>;
      role?: UserRole;
      isActive?: boolean;
    }

    const filter: UserAdminFilter = {};

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

    // Mongoose's QueryFilter<User> is too deeply recursive for eslint's type-aware
    // checker to resolve here, though tsc itself type-checks it fine.

    const queryFilter = filter as QueryFilter<User>;

    const total = await this.userModel.countDocuments(queryFilter);

    const users = await this.userModel
      .find(queryFilter)
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

  async changeRole(id: string, role: UserRole) {
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
    const months: number[] = new Array<number>(12).fill(0);

    const users = await this.userModel.find();

    users.forEach((user) => {
      const createdAt = user.get('createdAt') as Date | undefined;

      if (createdAt) {
        months[new Date(createdAt).getMonth()]++;
      }
    });

    return months;
  }

  async monthlyQrScans() {
    const months: number[] = new Array<number>(12).fill(0);

    const pets = await this.petModel.find();

    pets.forEach((pet) => {
      if (pet.lastScannedAt) {
        months[new Date(pet.lastScannedAt).getMonth()] += pet.scanCount;
      }
    });

    return months;
  }
}
