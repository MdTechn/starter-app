import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureAccessGuard } from './feature-access.guard';
import { PlanAccessGuard } from './plan-access.guard';
import { FeatureAccessService } from '../feature-access.service';
import { REQUIRES_FEATURE_KEY } from '../../../common/decorators/requires-feature.decorator';
import { REQUIRES_PLAN_KEY } from '../../../common/decorators/requires-plan.decorator';

function mockContext(user?: { userId?: string }) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as never;
}

describe('FeatureAccessGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const features = {
    canAccessFeature: jest.fn(),
  } as unknown as FeatureAccessService;
  const guard = new FeatureAccessGuard(reflector, features);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows when no metadata', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    await expect(guard.canActivate(mockContext())).resolves.toBe(true);
  });

  it('allows when feature is available', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['ai']);
    (features.canAccessFeature as jest.Mock).mockResolvedValue(true);
    await expect(
      guard.canActivate(mockContext({ userId: 'u1' })),
    ).resolves.toBe(true);
    expect(features.canAccessFeature).toHaveBeenCalledWith('u1', 'ai');
  });

  it('rejects when feature missing', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['ai']);
    (features.canAccessFeature as jest.Mock).mockResolvedValue(false);
    await expect(
      guard.canActivate(mockContext({ userId: 'u1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('PlanAccessGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const features = {
    getActivePlanId: jest.fn(),
  } as unknown as FeatureAccessService;
  const guard = new PlanAccessGuard(reflector, features);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows matching plan', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['pro']);
    (features.getActivePlanId as jest.Mock).mockResolvedValue('pro');
    await expect(
      guard.canActivate(mockContext({ userId: 'u1' })),
    ).resolves.toBe(true);
  });

  it('rejects wrong plan', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['pro']);
    (features.getActivePlanId as jest.Mock).mockResolvedValue('starter');
    await expect(
      guard.canActivate(mockContext({ userId: 'u1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reads REQUIRES_PLAN_KEY', () => {
    expect(REQUIRES_PLAN_KEY).toBe('requires_plan');
    expect(REQUIRES_FEATURE_KEY).toBe('requires_feature');
  });
});
