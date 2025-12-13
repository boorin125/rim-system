import { Priority } from '@prisma/client';
export declare class CreateIncidentDto {
    title: string;
    description: string;
    priority: Priority;
    storeId: number;
    equipmentId?: number;
}
