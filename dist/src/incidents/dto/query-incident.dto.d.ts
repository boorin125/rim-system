import { Priority, IncidentStatus } from '@prisma/client';
export declare class QueryIncidentDto {
    priority?: Priority;
    status?: IncidentStatus;
    storeId?: number;
    assigneeId?: number;
    createdById?: number;
    page?: number;
    limit?: number;
}
