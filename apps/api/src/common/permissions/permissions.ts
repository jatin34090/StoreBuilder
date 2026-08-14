// Centralised permission definitions for store roles.
// These are the ONLY sources of truth — never check roles directly in controllers.

export type Permission =
  | 'products.read'    | 'products.create'    | 'products.update'    | 'products.delete'
  | 'categories.read'  | 'categories.create'  | 'categories.update'  | 'categories.delete'
  | 'inventory.read'   | 'inventory.update'
  | 'orders.read'      | 'orders.update'      | 'orders.cancel'
  | 'customers.read'   | 'customers.update'
  | 'coupons.read'     | 'coupons.create'     | 'coupons.update'     | 'coupons.delete'
  | 'reviews.read'     | 'reviews.update'     | 'reviews.delete'
  | 'theme.read'       | 'theme.update'
  | 'website.read'     | 'website.update'
  | 'analytics.read'
  | 'payments.read'    | 'payments.update'
  | 'shipping.read'    | 'shipping.update'
  | 'staff.read'       | 'staff.invite'       | 'staff.update'       | 'staff.remove'
  | 'store.read'       | 'store.update'       | 'store.launch'
  | 'subscription.read'| 'subscription.update';

const ALL_PERMISSIONS: Permission[] = [
  'products.read', 'products.create', 'products.update', 'products.delete',
  'categories.read', 'categories.create', 'categories.update', 'categories.delete',
  'inventory.read', 'inventory.update',
  'orders.read', 'orders.update', 'orders.cancel',
  'customers.read', 'customers.update',
  'coupons.read', 'coupons.create', 'coupons.update', 'coupons.delete',
  'reviews.read', 'reviews.update', 'reviews.delete',
  'theme.read', 'theme.update',
  'website.read', 'website.update',
  'analytics.read',
  'payments.read', 'payments.update',
  'shipping.read', 'shipping.update',
  'staff.read', 'staff.invite', 'staff.update', 'staff.remove',
  'store.read', 'store.update', 'store.launch',
  'subscription.read', 'subscription.update',
];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: ALL_PERMISSIONS,

  ADMIN: [
    'products.read', 'products.create', 'products.update', 'products.delete',
    'categories.read', 'categories.create', 'categories.update', 'categories.delete',
    'inventory.read', 'inventory.update',
    'orders.read', 'orders.update', 'orders.cancel',
    'customers.read', 'customers.update',
    'coupons.read', 'coupons.create', 'coupons.update', 'coupons.delete',
    'reviews.read', 'reviews.update', 'reviews.delete',
    'theme.read', 'theme.update',
    'website.read', 'website.update',
    'analytics.read',
    'payments.read',
    'shipping.read', 'shipping.update',
    'staff.read', 'staff.invite', 'staff.update',
    'store.read', 'store.update',
    'subscription.read',
  ],

  MANAGER: [
    'products.read', 'products.create', 'products.update',
    'categories.read',
    'inventory.read', 'inventory.update',
    'orders.read', 'orders.update',
    'customers.read',
    'coupons.read',
    'reviews.read', 'reviews.update',
    'theme.read',
    'website.read',
    'analytics.read',
    'shipping.read',
    'store.read',
  ],

  STAFF: [
    'products.read',
    'inventory.read',
    'orders.read', 'orders.update',
    'customers.read',
    'reviews.read',
    'store.read',
  ],
};

export function getPermissionsForRole(storeRole: string): Permission[] {
  return ROLE_PERMISSIONS[storeRole] ?? [];
}

export function hasPermission(storeRole: string, permission: Permission): boolean {
  return getPermissionsForRole(storeRole).includes(permission);
}
