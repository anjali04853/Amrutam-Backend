export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  role: 'PATIENT' | 'DOCTOR';
}

export interface LoginInput {
  email: string;
  password: string;
  totpCode?: string;
}

export interface PublicUser {
  id: string;
  email: string;
  role: string;
}

export type LoginResult =
  | { user: PublicUser; accessToken: string; refreshToken: string }
  | { mfaRequired: true; userId: string };
