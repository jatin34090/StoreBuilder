import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
// Accept any string so controllers can use either @jewellery/types Role or @prisma/client Role
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
