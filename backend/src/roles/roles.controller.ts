// src/roles/roles.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface RoleInfo {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  level: number; // Higher number = more permissions
}

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  private readonly rolesData: RoleInfo[] = [
    {
      id: 'SUPER_ADMIN',
      name: 'Super Admin',
      description: 'Full system access with all permissions. Can manage all users, roles, and system settings.',
      permissions: [
        'manage_users',
        'manage_roles',
        'manage_settings',
        'view_all_reports',
        'manage_incidents',
        'manage_stores',
        'manage_equipment',
        'approve_users',
      ],
      level: 100,
    },
    {
      id: 'IT_MANAGER',
      name: 'IT Manager',
      description: 'Manage IT operations, users (except Super Admin), and view all reports.',
      permissions: [
        'manage_users',
        'view_all_reports',
        'manage_incidents',
        'manage_stores',
        'manage_equipment',
        'approve_users',
      ],
      level: 90,
    },
    {
      id: 'FINANCE_ADMIN',
      name: 'Finance Admin',
      description: 'Manage outsource payment approvals and access financial reports.',
      permissions: [
        'approve_payments',
        'view_finance_reports',
        'manage_outsource',
      ],
      level: 70,
    },
    {
      id: 'HELP_DESK',
      name: 'Help Desk',
      description: 'Create, close, and cancel incidents. Handle quality control.',
      permissions: [
        'create_incidents',
        'close_incidents',
        'cancel_incidents',
        'quality_control',
      ],
      level: 60,
    },
    {
      id: 'SUPERVISOR',
      name: 'Supervisor',
      description: 'Assign incidents to technicians and view team reports.',
      permissions: [
        'assign_incidents',
        'view_team_reports',
        'manage_assignments',
      ],
      level: 50,
    },
    {
      id: 'TECHNICIAN',
      name: 'Technician',
      description: 'Accept and resolve assigned incidents. View personal reports.',
      permissions: [
        'accept_incidents',
        'resolve_incidents',
        'view_personal_reports',
        'update_incident_status',
      ],
      level: 40,
    },
    {
      id: 'END_USER',
      name: 'End User',
      description: 'Report issues, track incident status, and rate completed work.',
      permissions: [
        'create_incidents',
        'view_own_incidents',
        'rate_work',
      ],
      level: 20,
    },
    {
      id: 'READ_ONLY',
      name: 'Read Only',
      description: 'View-only access to assigned reports and dashboards.',
      permissions: [
        'view_assigned_reports',
      ],
      level: 10,
    },
  ];

  @Get()
  findAll() {
    return this.rolesData;
  }

  @Get('available')
  @Roles('SUPER_ADMIN', 'IT_MANAGER')
  @UseGuards(RolesGuard)
  getAvailableRoles() {
    // Return roles that can be assigned (all roles for display)
    return this.rolesData.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      level: role.level,
    }));
  }

  @Get(':id')
  findOne(id: string) {
    const role = this.rolesData.find(r => r.id === id.toUpperCase());
    if (!role) {
      return { error: 'Role not found' };
    }
    return role;
  }

  @Get(':id/permissions')
  getPermissions(id: string) {
    const role = this.rolesData.find(r => r.id === id.toUpperCase());
    if (!role) {
      return { error: 'Role not found' };
    }
    return {
      roleId: role.id,
      roleName: role.name,
      permissions: role.permissions,
    };
  }
}
