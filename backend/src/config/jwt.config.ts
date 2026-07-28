import { registerAs } from '@nestjs/config';

export const jwtConfigFactory = () => ({
  secret: process.env.JWT_SECRET ?? '',
  expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
});

export default registerAs('jwt', jwtConfigFactory);
