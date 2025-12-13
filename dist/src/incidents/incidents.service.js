"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncidentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let IncidentsService = class IncidentsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(createIncidentDto, userId) {
        const store = await this.prisma.store.findUnique({
            where: { id: createIncidentDto.storeId },
        });
        if (!store) {
            throw new common_1.NotFoundException('Store not found');
        }
        if (createIncidentDto.equipmentId) {
            const equipment = await this.prisma.equipment.findUnique({
                where: { id: createIncidentDto.equipmentId },
            });
            if (!equipment) {
                throw new common_1.NotFoundException('Equipment not found');
            }
            if (equipment.storeId !== createIncidentDto.storeId) {
                throw new common_1.BadRequestException('Equipment does not belong to this store');
            }
        }
        const slaDeadline = this.calculateSLADeadline(createIncidentDto.priority);
        const incident = await this.prisma.incident.create({
            data: {
                title: createIncidentDto.title,
                description: createIncidentDto.description,
                priority: createIncidentDto.priority,
                storeId: createIncidentDto.storeId,
                equipmentId: createIncidentDto.equipmentId,
                createdById: userId,
                slaDeadline,
                status: client_1.IncidentStatus.OPEN,
            },
            include: {
                store: true,
                equipment: true,
                createdBy: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                    },
                },
            },
        });
        return incident;
    }
    async findAll(query) {
        const { page = 1, limit = 10, priority, status, storeId, assigneeId, createdById } = query;
        const skip = (page - 1) * limit;
        const where = {};
        if (priority)
            where.priority = priority;
        if (status)
            where.status = status;
        if (storeId)
            where.storeId = storeId;
        if (assigneeId)
            where.assigneeId = assigneeId;
        if (createdById)
            where.createdById = createdById;
        const total = await this.prisma.incident.count({ where });
        const incidents = await this.prisma.incident.findMany({
            where,
            skip,
            take: limit,
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                store: {
                    select: {
                        id: true,
                        storeCode: true,
                        name: true,
                        province: true,
                    },
                },
                equipment: {
                    select: {
                        id: true,
                        serialNumber: true,
                        name: true,
                        category: true,
                    },
                },
                createdBy: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                    },
                },
                assignee: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                    },
                },
            },
        });
        return {
            data: incidents,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async findOne(id) {
        const incident = await this.prisma.incident.findUnique({
            where: { id },
            include: {
                store: true,
                equipment: true,
                createdBy: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        role: true,
                    },
                },
                assignee: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        role: true,
                    },
                },
            },
        });
        if (!incident) {
            throw new common_1.NotFoundException('Incident not found');
        }
        return incident;
    }
    async update(id, updateIncidentDto, userId) {
        const incident = await this.findOne(id);
        if (updateIncidentDto.storeId && updateIncidentDto.storeId !== incident.storeId) {
            const store = await this.prisma.store.findUnique({
                where: { id: updateIncidentDto.storeId },
            });
            if (!store) {
                throw new common_1.NotFoundException('Store not found');
            }
        }
        if (updateIncidentDto.equipmentId) {
            const equipment = await this.prisma.equipment.findUnique({
                where: { id: updateIncidentDto.equipmentId },
            });
            if (!equipment) {
                throw new common_1.NotFoundException('Equipment not found');
            }
            const targetStoreId = updateIncidentDto.storeId || incident.storeId;
            if (equipment.storeId !== targetStoreId) {
                throw new common_1.BadRequestException('Equipment does not belong to the selected store');
            }
        }
        if (updateIncidentDto.assigneeId) {
            const assignee = await this.prisma.user.findUnique({
                where: { id: updateIncidentDto.assigneeId },
            });
            if (!assignee) {
                throw new common_1.NotFoundException('Assignee not found');
            }
            if (assignee.role !== 'TECHNICIAN') {
                throw new common_1.BadRequestException('Assignee must be a technician');
            }
        }
        const updateData = { ...updateIncidentDto };
        if (updateIncidentDto.status === client_1.IncidentStatus.RESOLVED && incident.status !== client_1.IncidentStatus.RESOLVED) {
            updateData.resolvedAt = new Date();
        }
        const updated = await this.prisma.incident.update({
            where: { id },
            data: updateData,
            include: {
                store: true,
                equipment: true,
                createdBy: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                    },
                },
                assignee: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                    },
                },
            },
        });
        return updated;
    }
    async assign(id, technicianId) {
        const incident = await this.findOne(id);
        const technician = await this.prisma.user.findUnique({
            where: { id: technicianId },
        });
        if (!technician) {
            throw new common_1.NotFoundException('Technician not found');
        }
        if (technician.role !== 'TECHNICIAN') {
            throw new common_1.BadRequestException('User is not a technician');
        }
        if (technician.status !== 'ACTIVE') {
            throw new common_1.BadRequestException('Technician is not active');
        }
        const updateData = {
            assigneeId: technicianId,
        };
        if (incident.status === client_1.IncidentStatus.OPEN) {
            updateData.status = client_1.IncidentStatus.IN_PROGRESS;
        }
        const updated = await this.prisma.incident.update({
            where: { id },
            data: updateData,
            include: {
                assignee: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        role: true,
                    },
                },
            },
        });
        return updated;
    }
    async remove(id, userId) {
        const incident = await this.findOne(id);
        if (incident.createdById !== userId) {
            throw new common_1.ForbiddenException('You can only cancel your own incidents');
        }
        if (incident.status === client_1.IncidentStatus.RESOLVED || incident.status === client_1.IncidentStatus.CLOSED) {
            throw new common_1.BadRequestException('Cannot cancel resolved or closed incidents');
        }
        const cancelled = await this.prisma.incident.update({
            where: { id },
            data: {
                status: client_1.IncidentStatus.CANCELLED,
            },
        });
        return cancelled;
    }
    calculateSLADeadline(priority) {
        const now = new Date();
        const deadline = new Date(now);
        switch (priority) {
            case client_1.Priority.CRITICAL:
                deadline.setHours(deadline.getHours() + 2);
                break;
            case client_1.Priority.HIGH:
                deadline.setHours(deadline.getHours() + 4);
                break;
            case client_1.Priority.MEDIUM:
                deadline.setHours(deadline.getHours() + 8);
                break;
            case client_1.Priority.LOW:
                deadline.setHours(deadline.getHours() + 24);
                break;
        }
        return deadline;
    }
};
exports.IncidentsService = IncidentsService;
exports.IncidentsService = IncidentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IncidentsService);
//# sourceMappingURL=incidents.service.js.map