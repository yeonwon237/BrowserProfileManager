/**
 * Multi-tenant Organization & Role-Based Access Control (RBAC) Architecture
 */

const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
}

const ROLE_PERMISSIONS = {
  [ROLES.OWNER]: [
    'manage_organization',
    'manage_billing',
    'manage_workspaces',
    'manage_profiles',
    'run_automation',
    'manage_proxies',
    'install_plugins',
    'view_logs',
    'export_data',
  ],
  [ROLES.ADMIN]: [
    'manage_workspaces',
    'manage_profiles',
    'run_automation',
    'manage_proxies',
    'install_plugins',
    'view_logs',
    'export_data',
  ],
  [ROLES.MEMBER]: [
    'manage_profiles',
    'run_automation',
    'view_logs',
  ],
  [ROLES.VIEWER]: [
    'view_logs',
  ],
}

class OrganizationService {
  constructor() {
    this.currentOrg = {
      id: 'org-local-default',
      name: 'Default Local Organization',
      role: ROLES.OWNER,
    }
  }

  hasPermission(role, action) {
    const allowed = ROLE_PERMISSIONS[role] || []
    return allowed.includes(action)
  }

  canPerformAction(action) {
    return this.hasPermission(this.currentOrg.role, action)
  }
}

const organizationService = new OrganizationService()

module.exports = {
  ROLES,
  ROLE_PERMISSIONS,
  OrganizationService,
  organizationService,
}
