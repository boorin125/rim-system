// config/permissions.ts - Role-based Menu Permissions

export type UserRole =
  | 'SUPER_ADMIN'
  | 'IT_MANAGER'
  | 'FINANCE_ADMIN'
  | 'HELP_DESK'
  | 'SUPERVISOR'
  | 'TECHNICIAN'
  | 'END_USER'
  | 'READ_ONLY'

export type AccessLevel = 'full' | 'view' | 'create_view' | 'self' | 'none'

export interface MenuPermission {
  roles: UserRole[]
  accessLevel: Record<UserRole, AccessLevel>
}

// Menu permissions configuration
export const menuPermissions: Record<string, MenuPermission> = {
  '/dashboard': {
    roles: ['SUPER_ADMIN', 'IT_MANAGER', 'FINANCE_ADMIN', 'HELP_DESK', 'SUPERVISOR', 'TECHNICIAN', 'END_USER', 'READ_ONLY'],
    accessLevel: {
      SUPER_ADMIN: 'view',
      IT_MANAGER: 'full',
      FINANCE_ADMIN: 'full',
      HELP_DESK: 'full',
      SUPERVISOR: 'full',
      TECHNICIAN: 'full',
      END_USER: 'full',
      READ_ONLY: 'view',
    },
  },
  '/dashboard/incidents': {
    roles: ['IT_MANAGER', 'HELP_DESK', 'SUPERVISOR', 'TECHNICIAN', 'END_USER', 'READ_ONLY'],
    accessLevel: {
      SUPER_ADMIN: 'none',
      IT_MANAGER: 'view',
      FINANCE_ADMIN: 'none',
      HELP_DESK: 'full',           // Can create, edit, delete
      SUPERVISOR: 'view',          // Can view, assign (backend controls assign)
      TECHNICIAN: 'view',          // Can view, accept, resolve (backend controls actions)
      END_USER: 'create_view',     // Can create and view own incidents
      READ_ONLY: 'view',
    },
  },
  '/dashboard/stores': {
    roles: ['SUPER_ADMIN', 'IT_MANAGER', 'HELP_DESK', 'SUPERVISOR', 'TECHNICIAN', 'READ_ONLY'],
    accessLevel: {
      SUPER_ADMIN: 'view',  // Can access for Import only
      IT_MANAGER: 'view',
      FINANCE_ADMIN: 'none',
      HELP_DESK: 'full',
      SUPERVISOR: 'view',
      TECHNICIAN: 'view',
      END_USER: 'none',
      READ_ONLY: 'view',
    },
  },
  '/dashboard/stores/import': {
    roles: ['SUPER_ADMIN'],
    accessLevel: {
      SUPER_ADMIN: 'full',
      IT_MANAGER: 'none',
      FINANCE_ADMIN: 'none',
      HELP_DESK: 'none',
      SUPERVISOR: 'none',
      TECHNICIAN: 'none',
      END_USER: 'none',
      READ_ONLY: 'none',
    },
  },
  '/dashboard/equipment': {
    roles: ['SUPER_ADMIN', 'IT_MANAGER', 'HELP_DESK', 'SUPERVISOR', 'TECHNICIAN', 'READ_ONLY'],
    accessLevel: {
      SUPER_ADMIN: 'full',
      IT_MANAGER: 'view',
      FINANCE_ADMIN: 'none',
      HELP_DESK: 'full',
      SUPERVISOR: 'view',
      TECHNICIAN: 'view',
      END_USER: 'none',
      READ_ONLY: 'view',
    },
  },
  '/dashboard/users': {
    roles: ['SUPER_ADMIN', 'IT_MANAGER'],
    accessLevel: {
      SUPER_ADMIN: 'full',
      IT_MANAGER: 'full',
      FINANCE_ADMIN: 'none',
      HELP_DESK: 'none',
      SUPERVISOR: 'none',
      TECHNICIAN: 'none',
      END_USER: 'none',
      READ_ONLY: 'none',
    },
  },
  '/dashboard/performance': {
    roles: ['IT_MANAGER', 'SUPERVISOR', 'TECHNICIAN'],
    accessLevel: {
      SUPER_ADMIN: 'none',
      IT_MANAGER: 'full',
      FINANCE_ADMIN: 'none',
      HELP_DESK: 'none',
      SUPERVISOR: 'full',
      TECHNICIAN: 'self',
      END_USER: 'none',
      READ_ONLY: 'none',
    },
  },
  '/dashboard/outsource': {
    roles: ['IT_MANAGER', 'FINANCE_ADMIN', 'SUPERVISOR', 'TECHNICIAN'],
    accessLevel: {
      SUPER_ADMIN: 'none',
      IT_MANAGER: 'view',
      FINANCE_ADMIN: 'view', // Payment only (handled in page)
      HELP_DESK: 'none',
      SUPERVISOR: 'full',
      TECHNICIAN: 'self', // Outsource technicians only (handled in page)
      END_USER: 'none',
      READ_ONLY: 'none',
    },
  },
  '/dashboard/map': {
    roles: ['IT_MANAGER'],
    accessLevel: {
      SUPER_ADMIN: 'none',
      IT_MANAGER: 'full',
      FINANCE_ADMIN: 'none',
      HELP_DESK: 'none',
      SUPERVISOR: 'none',
      TECHNICIAN: 'none',
      END_USER: 'none',
      READ_ONLY: 'none',
    },
  },
  '/dashboard/reports': {
    roles: ['IT_MANAGER', 'FINANCE_ADMIN', 'HELP_DESK', 'SUPERVISOR', 'READ_ONLY'],
    accessLevel: {
      SUPER_ADMIN: 'none',
      IT_MANAGER: 'full',
      FINANCE_ADMIN: 'view', // Finance reports only
      HELP_DESK: 'full',
      SUPERVISOR: 'full',
      TECHNICIAN: 'none',
      END_USER: 'none',
      READ_ONLY: 'view',
    },
  },
  '/dashboard/audit-trail': {
    roles: ['IT_MANAGER'],
    accessLevel: {
      SUPER_ADMIN: 'none',
      IT_MANAGER: 'full',
      FINANCE_ADMIN: 'none',
      HELP_DESK: 'none',
      SUPERVISOR: 'none',
      TECHNICIAN: 'none',
      END_USER: 'none',
      READ_ONLY: 'none',
    },
  },
  '/dashboard/knowledge-base': {
    roles: ['IT_MANAGER', 'HELP_DESK', 'SUPERVISOR', 'TECHNICIAN', 'END_USER', 'READ_ONLY'],
    accessLevel: {
      SUPER_ADMIN: 'none',
      IT_MANAGER: 'full',
      FINANCE_ADMIN: 'none',
      HELP_DESK: 'full',
      SUPERVISOR: 'full',
      TECHNICIAN: 'create_view',  // Can view and create articles
      END_USER: 'view',           // Can only view published articles
      READ_ONLY: 'view',
    },
  },
  '/dashboard/settings': {
    roles: ['SUPER_ADMIN'],
    accessLevel: {
      SUPER_ADMIN: 'full',
      IT_MANAGER: 'none',
      FINANCE_ADMIN: 'none',
      HELP_DESK: 'none',
      SUPERVISOR: 'none',
      TECHNICIAN: 'none',
      END_USER: 'none',
      READ_ONLY: 'none',
    },
  },
  '/dashboard/settings/categories': {
    roles: ['SUPER_ADMIN'],
    accessLevel: {
      SUPER_ADMIN: 'full',
      IT_MANAGER: 'none',
      FINANCE_ADMIN: 'none',
      HELP_DESK: 'none',
      SUPERVISOR: 'none',
      TECHNICIAN: 'none',
      END_USER: 'none',
      READ_ONLY: 'none',
    },
  },
  '/dashboard/settings/job-types': {
    roles: ['SUPER_ADMIN'],
    accessLevel: {
      SUPER_ADMIN: 'full',
      IT_MANAGER: 'none',
      FINANCE_ADMIN: 'none',
      HELP_DESK: 'none',
      SUPERVISOR: 'none',
      TECHNICIAN: 'none',
      END_USER: 'none',
      READ_ONLY: 'none',
    },
  },
  '/dashboard/sla-defense': {
    roles: ['IT_MANAGER'],
    accessLevel: {
      SUPER_ADMIN: 'none',
      IT_MANAGER: 'full',
      FINANCE_ADMIN: 'none',
      HELP_DESK: 'none',
      SUPERVISOR: 'none',
      TECHNICIAN: 'none',
      END_USER: 'none',
      READ_ONLY: 'none',
    },
  },
}

// Helper function to get user's roles from user object
export function getUserRoles(user: any): UserRole[] {
  // Support multiple formats:
  // 1. user.roles = ['ADMIN', 'USER'] (array of strings)
  // 2. user.roles = [{role: 'ADMIN'}, {role: 'USER'}] (array of objects)
  // 3. user.roles = [{role: {name: 'ADMIN'}}] (nested objects)
  // 4. user.role = 'ADMIN' (single role as string - legacy format)

  // Legacy format: single role as string
  if (user?.role && typeof user.role === 'string') {
    return [user.role as UserRole]
  }

  if (!user?.roles) return []

  // If roles is not an array, return empty
  if (!Array.isArray(user.roles)) return []

  return user.roles.map((r: any) => {
    // If r is a string, return it directly
    if (typeof r === 'string') return r
    // If r is an object with role property
    if (r?.role) {
      // If role is an object with name
      if (typeof r.role === 'object' && r.role?.name) return r.role.name
      // If role is a string
      if (typeof r.role === 'string') return r.role
    }
    return null
  }).filter(Boolean) as UserRole[]
}

// Menus hidden for OUTSOURCE technicians (accessible only through Incident)
const OUTSOURCE_HIDDEN_MENUS = ['/dashboard/stores', '/dashboard/equipment', '/dashboard/knowledge-base']

// Menus hidden for INSOURCE (Inhouse) technicians
const INSOURCE_HIDDEN_MENUS = ['/dashboard/outsource', '/dashboard/equipment']

// Helper function to check if user has access to a menu
export function hasMenuAccess(user: any, menuPath: string): boolean {
  const userRoles = getUserRoles(user)
  const permission = menuPermissions[menuPath]

  if (!permission) return false

  // Apply technician-type restrictions ONLY when the user has no higher-privilege role.
  // A user with IT_MANAGER/SUPERVISOR/HELP_DESK + TECHNICIAN should not be restricted.
  const higherRoles: UserRole[] = ['SUPER_ADMIN', 'IT_MANAGER', 'FINANCE_ADMIN', 'HELP_DESK', 'SUPERVISOR']
  const hasHigherRole = userRoles.some(r => higherRoles.includes(r))

  if (userRoles.includes('TECHNICIAN') && !hasHigherRole) {
    const isOutsourceTech = user?.technicianType === 'OUTSOURCE'
    const isInsourceTech = user?.technicianType === 'INSOURCE' || !isOutsourceTech

    // Outsource technicians cannot see Stores or Equipment in the sidebar
    if (isOutsourceTech && OUTSOURCE_HIDDEN_MENUS.includes(menuPath)) return false

    // Insource technicians cannot see the Outsource menu
    if (isInsourceTech && INSOURCE_HIDDEN_MENUS.includes(menuPath)) return false
  }

  return userRoles.some(role => permission.roles.includes(role))
}

// Helper function to get access level for a menu
export function getAccessLevel(user: any, menuPath: string): AccessLevel {
  const userRoles = getUserRoles(user)
  const permission = menuPermissions[menuPath]

  if (!permission) return 'none'

  // Return highest access level among user's roles
  const accessLevels: AccessLevel[] = ['full', 'create_view', 'self', 'view', 'none']

  for (const level of accessLevels) {
    if (userRoles.some(role => permission.accessLevel[role] === level)) {
      return level
    }
  }

  return 'none'
}

// Helper function to check if user can perform action
export function canPerformAction(user: any, menuPath: string, action: 'create' | 'edit' | 'delete' | 'view'): boolean {
  const accessLevel = getAccessLevel(user, menuPath)

  switch (action) {
    case 'view':
      return accessLevel !== 'none'
    case 'create':
      return accessLevel === 'full' || accessLevel === 'create_view'
    case 'edit':
    case 'delete':
      return accessLevel === 'full'
    default:
      return false
  }
}

// Check if user is view-only for a specific menu
export function isViewOnly(user: any, menuPath: string): boolean {
  const accessLevel = getAccessLevel(user, menuPath)
  return accessLevel === 'view' || accessLevel === 'self'
}
