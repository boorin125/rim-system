import { IncidentsService } from './incidents.service';
import { CreateIncidentDto, UpdateIncidentDto, QueryIncidentDto } from './dto';
export declare class IncidentsController {
    private readonly incidentsService;
    constructor(incidentsService: IncidentsService);
    create(createIncidentDto: CreateIncidentDto, req: any): Promise<{
        createdBy: {
            email: string;
            firstName: string | null;
            lastName: string | null;
            role: import("@prisma/client").$Enums.UserRole;
            id: number;
        };
        equipment: {
            status: import("@prisma/client").$Enums.EquipmentStatus;
            createdAt: Date;
            updatedAt: Date;
            id: number;
            name: string;
            serialNumber: string;
            category: import("@prisma/client").$Enums.EquipmentCategory;
            brand: string | null;
            model: string | null;
            purchaseDate: Date | null;
            warrantyExpiry: Date | null;
            storeId: number;
        } | null;
        store: {
            phone: string | null;
            createdAt: Date;
            updatedAt: Date;
            id: number;
            name: string;
            storeCode: string;
            address: string | null;
            province: string;
            district: string | null;
            subDistrict: string | null;
            postalCode: string | null;
            latitude: number | null;
            longitude: number | null;
            isPopup: boolean;
        };
    } & {
        status: import("@prisma/client").$Enums.IncidentStatus;
        createdAt: Date;
        updatedAt: Date;
        id: string;
        storeId: number;
        title: string;
        description: string;
        priority: import("@prisma/client").$Enums.Priority;
        slaDeadline: Date | null;
        resolvedAt: Date | null;
        resolutionNote: string | null;
        equipmentId: number | null;
        createdById: number;
        assigneeId: number | null;
    }>;
    findAll(query: QueryIncidentDto): Promise<{
        data: ({
            createdBy: {
                email: string;
                firstName: string | null;
                lastName: string | null;
                role: import("@prisma/client").$Enums.UserRole;
                id: number;
            };
            equipment: {
                id: number;
                name: string;
                serialNumber: string;
                category: import("@prisma/client").$Enums.EquipmentCategory;
            } | null;
            store: {
                id: number;
                name: string;
                storeCode: string;
                province: string;
            };
            assignee: {
                email: string;
                firstName: string | null;
                lastName: string | null;
                role: import("@prisma/client").$Enums.UserRole;
                id: number;
            } | null;
        } & {
            status: import("@prisma/client").$Enums.IncidentStatus;
            createdAt: Date;
            updatedAt: Date;
            id: string;
            storeId: number;
            title: string;
            description: string;
            priority: import("@prisma/client").$Enums.Priority;
            slaDeadline: Date | null;
            resolvedAt: Date | null;
            resolutionNote: string | null;
            equipmentId: number | null;
            createdById: number;
            assigneeId: number | null;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    findOne(id: string): Promise<{
        createdBy: {
            email: string;
            firstName: string | null;
            lastName: string | null;
            phone: string | null;
            role: import("@prisma/client").$Enums.UserRole;
            id: number;
        };
        equipment: {
            status: import("@prisma/client").$Enums.EquipmentStatus;
            createdAt: Date;
            updatedAt: Date;
            id: number;
            name: string;
            serialNumber: string;
            category: import("@prisma/client").$Enums.EquipmentCategory;
            brand: string | null;
            model: string | null;
            purchaseDate: Date | null;
            warrantyExpiry: Date | null;
            storeId: number;
        } | null;
        store: {
            phone: string | null;
            createdAt: Date;
            updatedAt: Date;
            id: number;
            name: string;
            storeCode: string;
            address: string | null;
            province: string;
            district: string | null;
            subDistrict: string | null;
            postalCode: string | null;
            latitude: number | null;
            longitude: number | null;
            isPopup: boolean;
        };
        assignee: {
            email: string;
            firstName: string | null;
            lastName: string | null;
            phone: string | null;
            role: import("@prisma/client").$Enums.UserRole;
            id: number;
        } | null;
    } & {
        status: import("@prisma/client").$Enums.IncidentStatus;
        createdAt: Date;
        updatedAt: Date;
        id: string;
        storeId: number;
        title: string;
        description: string;
        priority: import("@prisma/client").$Enums.Priority;
        slaDeadline: Date | null;
        resolvedAt: Date | null;
        resolutionNote: string | null;
        equipmentId: number | null;
        createdById: number;
        assigneeId: number | null;
    }>;
    update(id: string, updateIncidentDto: UpdateIncidentDto, req: any): Promise<{
        createdBy: {
            email: string;
            firstName: string | null;
            lastName: string | null;
            role: import("@prisma/client").$Enums.UserRole;
            id: number;
        };
        equipment: {
            status: import("@prisma/client").$Enums.EquipmentStatus;
            createdAt: Date;
            updatedAt: Date;
            id: number;
            name: string;
            serialNumber: string;
            category: import("@prisma/client").$Enums.EquipmentCategory;
            brand: string | null;
            model: string | null;
            purchaseDate: Date | null;
            warrantyExpiry: Date | null;
            storeId: number;
        } | null;
        store: {
            phone: string | null;
            createdAt: Date;
            updatedAt: Date;
            id: number;
            name: string;
            storeCode: string;
            address: string | null;
            province: string;
            district: string | null;
            subDistrict: string | null;
            postalCode: string | null;
            latitude: number | null;
            longitude: number | null;
            isPopup: boolean;
        };
        assignee: {
            email: string;
            firstName: string | null;
            lastName: string | null;
            role: import("@prisma/client").$Enums.UserRole;
            id: number;
        } | null;
    } & {
        status: import("@prisma/client").$Enums.IncidentStatus;
        createdAt: Date;
        updatedAt: Date;
        id: string;
        storeId: number;
        title: string;
        description: string;
        priority: import("@prisma/client").$Enums.Priority;
        slaDeadline: Date | null;
        resolvedAt: Date | null;
        resolutionNote: string | null;
        equipmentId: number | null;
        createdById: number;
        assigneeId: number | null;
    }>;
    assign(id: string, technicianId: number): Promise<{
        assignee: {
            email: string;
            firstName: string | null;
            lastName: string | null;
            phone: string | null;
            role: import("@prisma/client").$Enums.UserRole;
            id: number;
        } | null;
    } & {
        status: import("@prisma/client").$Enums.IncidentStatus;
        createdAt: Date;
        updatedAt: Date;
        id: string;
        storeId: number;
        title: string;
        description: string;
        priority: import("@prisma/client").$Enums.Priority;
        slaDeadline: Date | null;
        resolvedAt: Date | null;
        resolutionNote: string | null;
        equipmentId: number | null;
        createdById: number;
        assigneeId: number | null;
    }>;
    remove(id: string, req: any): Promise<{
        status: import("@prisma/client").$Enums.IncidentStatus;
        createdAt: Date;
        updatedAt: Date;
        id: string;
        storeId: number;
        title: string;
        description: string;
        priority: import("@prisma/client").$Enums.Priority;
        slaDeadline: Date | null;
        resolvedAt: Date | null;
        resolutionNote: string | null;
        equipmentId: number | null;
        createdById: number;
        assigneeId: number | null;
    }>;
}
