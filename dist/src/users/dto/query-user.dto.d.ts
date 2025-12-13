import { UserRole, UserStatus } from '@prisma/client';
export declare class QueryUserDto {
    role?: UserRole;
    status?: UserStatus;
    search?: string;
    page?: number;
    limit?: number;
}
