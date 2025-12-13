import { Priority, IncidentStatus } from '@prisma/client';
export declare class UpdateIncidentDto {
    title?: string;
    description?: string;
    priority?: Priority;
    status?: IncidentStatus;
    storeId?: number;
    equipmentId?: number;
    assigneeId?: number;
    resolutionNote?: string;
}
