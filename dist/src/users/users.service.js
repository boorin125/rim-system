"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const bcrypt = __importStar(require("bcrypt"));
const client_1 = require("@prisma/client");
let UsersService = class UsersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(createUserDto) {
        const existingUser = await this.prisma.user.findUnique({
            where: { email: createUserDto.email },
        });
        if (existingUser) {
            throw new common_1.ConflictException('Email already exists');
        }
        const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
        const user = await this.prisma.user.create({
            data: {
                email: createUserDto.email,
                password: hashedPassword,
                firstName: createUserDto.firstName,
                lastName: createUserDto.lastName,
                phone: createUserDto.phone,
                role: createUserDto.role,
                status: 'ACTIVE',
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                status: true,
                createdAt: true,
            },
        });
        return user;
    }
    async findAll(query) {
        const { page = 1, limit = 10, role, status, search } = query;
        const skip = (page - 1) * limit;
        const where = {};
        if (role)
            where.role = role;
        if (status)
            where.status = status;
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
            ];
        }
        const total = await this.prisma.user.count({ where });
        const users = await this.prisma.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                status: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return {
            data: users,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async findOne(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                status: true,
                twoFactorEnabled: true,
                failedLoginAttempts: true,
                lockedUntil: true,
                lastLogin: true,
                lastPasswordChange: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        createdIncidents: true,
                        assignedIncidents: true,
                    },
                },
            },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user;
    }
    async update(id, updateUserDto, currentUserId) {
        const user = await this.findOne(id);
        const currentUser = await this.prisma.user.findUnique({
            where: { id: currentUserId },
        });
        if (!currentUser) {
            throw new common_1.NotFoundException('Current user not found');
        }
        if (updateUserDto.role && id === currentUserId && currentUser.role !== client_1.UserRole.SUPER_ADMIN) {
            throw new common_1.ForbiddenException('You cannot change your own role');
        }
        const updated = await this.prisma.user.update({
            where: { id },
            data: updateUserDto,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                status: true,
                updatedAt: true,
            },
        });
        return updated;
    }
    async changeRole(id, role, currentUserId) {
        const user = await this.findOne(id);
        if (id === currentUserId) {
            throw new common_1.ForbiddenException('You cannot change your own role');
        }
        const updated = await this.prisma.user.update({
            where: { id },
            data: { role },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
            },
        });
        return updated;
    }
    async changePassword(id, changePasswordDto, currentUserId) {
        if (id !== currentUserId) {
            throw new common_1.ForbiddenException('You can only change your own password');
        }
        const user = await this.prisma.user.findUnique({
            where: { id },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const isPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.password);
        if (!isPasswordValid) {
            throw new common_1.BadRequestException('Current password is incorrect');
        }
        const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);
        await this.prisma.user.update({
            where: { id },
            data: {
                password: hashedPassword,
                lastPasswordChange: new Date(),
            },
        });
        return { message: 'Password changed successfully' };
    }
    async deactivate(id, currentUserId) {
        const user = await this.findOne(id);
        if (id === currentUserId) {
            throw new common_1.ForbiddenException('You cannot deactivate your own account');
        }
        const updated = await this.prisma.user.update({
            where: { id },
            data: {
                status: 'INACTIVE',
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                status: true,
            },
        });
        return updated;
    }
    async activate(id) {
        const user = await this.findOne(id);
        const updated = await this.prisma.user.update({
            where: { id },
            data: {
                status: 'ACTIVE',
                failedLoginAttempts: 0,
                lockedUntil: null,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                status: true,
            },
        });
        return updated;
    }
    async remove(id, currentUserId) {
        const user = await this.findOne(id);
        if (id === currentUserId) {
            throw new common_1.ForbiddenException('You cannot delete your own account');
        }
        const incidentCount = await this.prisma.incident.count({
            where: { createdById: id },
        });
        if (incidentCount > 0) {
            throw new common_1.BadRequestException(`Cannot delete user. User has ${incidentCount} incidents. Please deactivate instead.`);
        }
        await this.prisma.user.delete({
            where: { id },
        });
        return { message: 'User deleted successfully' };
    }
    async getStatistics(id) {
        const user = await this.findOne(id);
        const createdIncidents = await this.prisma.incident.count({
            where: { createdById: id },
        });
        const assignedIncidents = await this.prisma.incident.count({
            where: { assigneeId: id },
        });
        const resolvedIncidents = await this.prisma.incident.count({
            where: {
                assigneeId: id,
                status: 'RESOLVED',
            },
        });
        const pendingIncidents = await this.prisma.incident.count({
            where: {
                assigneeId: id,
                status: {
                    in: ['OPEN', 'IN_PROGRESS', 'PENDING'],
                },
            },
        });
        return {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
            },
            statistics: {
                createdIncidents,
                assignedIncidents,
                resolvedIncidents,
                pendingIncidents,
                resolutionRate: assignedIncidents > 0
                    ? ((resolvedIncidents / assignedIncidents) * 100).toFixed(2) + '%'
                    : '0%',
            },
        };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map