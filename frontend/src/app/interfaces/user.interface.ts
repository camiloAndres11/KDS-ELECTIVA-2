export type UserRole = 'KITCHEN_OPERATOR' | 'DISPATCHER' | 'POS_SYSTEM' | 'ADMIN';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
}
