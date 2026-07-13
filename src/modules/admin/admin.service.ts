import { Injectable } from '@nestjs/common';

@Injectable()
export class AdminService {
  dashboard() {
    return {
      message: 'Welcome Admin',
      version: '1.0.0',
      status: 'Running',
    };
  }
}