export type KeycloakSessionUser = {
  sub: string;
  email: string;
  name?: string;
  roles: string[];
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};
