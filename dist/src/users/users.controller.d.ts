import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, QueryUserDto, ChangePasswordDto } from './dto';
import { UserRole } from '@prisma/client';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    create(createUserDto: CreateUserDto): Promise<{
        email: string;
        firstName: string | null;
        lastName: string | null;
        phone: string | null;
        role: import("@prisma/client").$Enums.UserRole;
        status: import("@prisma/client").$Enums.UserStatus;
        createdAt: Date;
        id: number;
    }>;
    findAll(query: QueryUserDto): Promise<{
        data: {
            email: string;
            firstName: string | null;
            lastName: string | null;
            phone: string | null;
            role: import("@prisma/client").$Enums.UserRole;
            status: import("@prisma/client").$Enums.UserStatus;
            lastLogin: Date | null;
            createdAt: Date;
            updatedAt: Date;
            id: number;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    findOne(id: number): Promise<{
        email: string;
        firstName: string | null;
        lastName: string | null;
        phone: string | null;
        role: import("@prisma/client").$Enums.UserRole;
        status: import("@prisma/client").$Enums.UserStatus;
        twoFactorEnabled: boolean;
        failedLoginAttempts: number;
        lockedUntil: Date | null;
        lastLogin: Date | null;
        lastPasswordChange: Date | null;
        createdAt: Date;
        updatedAt: Date;
        id: number;
        _count: {
            createdIncidents: number;
            assignedIncidents: number;
        };
    }>;
    update(id: number, updateUserDto: UpdateUserDto, req: any): Promise<{
        email: string;
        firstName: string | null;
        lastName: string | null;
        phone: string | null;
        role: import("@prisma/client").$Enums.UserRole;
        status: import("@prisma/client").$Enums.UserStatus;
        updatedAt: Date;
        id: number;
    }>;
    changeRole(id: number, role: UserRole, req: any): Promise<{
        email: string;
        firstName: string | null;
        lastName: string | null;
        role: import("@prisma/client").$Enums.UserRole;
        id: number;
    }>;
    changePassword(id: number, changePasswordDto: ChangePasswordDto, req: any): Promise<{
        message: string;
    }>;
    deactivate(id: number, req: any): Promise<{
        email: string;
        firstName: string | null;
        lastName: string | null;
        status: import("@prisma/client").$Enums.UserStatus;
        id: number;
    }>;
    activate(id: number): Promise<{
        email: string;
        firstName: string | null;
        lastName: string | null;
        status: import("@prisma/client").$Enums.UserStatus;
        id: number;
    }>;
    getStatistics(id: number): Promise<{
        user: {
            id: number;
            email: string;
            firstName: string | null;
            lastName: string | null;
            role: import("@prisma/client").$Enums.UserRole;
        };
        statistics: {
            createdIncidents: number;
            assignedIncidents: number;
            resolvedIncidents: number;
            pendingIncidents: number;
            resolutionRate: string;
        };
    }>;
    remove(id: number, req: any): Promise<{
        message: string;
    }>;
}
