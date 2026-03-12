// src/incidents/dto/update-incident.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateIncidentDto } from './create-incident.dto';

export class UpdateIncidentDto extends PartialType(CreateIncidentDto) {}
