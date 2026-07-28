import { Injectable } from '@nestjs/common';
import {
  isSubscriptionActive,
  planHasFeature,
  type PlanFeature,
  getPlanEntitlements,
} from '@saas-starter/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';

/**
 * Feature gating minimal basé sur l’abonnement actif (plan starter/pro).
 * Exemple : accès IA réservé au plan Pro.
 */
@Injectable()
export class FeatureAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(FeatureAccessService.name);
  }

  async getActivePlanId(userId: string): Promise<string | null> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    if (memberships.length === 0) return null;

    const accounts = await this.prisma.billingAccount.findMany({
      where: {
        organizationId: { in: memberships.map((m) => m.organizationId) },
      },
      select: {
        subscriptions: {
          where: {
            status: { in: ['ACTIVE', 'TRIALING'] },
          },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            planId: true,
            status: true,
            currentPeriodEnd: true,
          },
        },
      },
    });

    for (const account of accounts) {
      const sub = account.subscriptions[0];
      if (!sub || !isSubscriptionActive(sub.status)) continue;
      if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < Date.now()) {
        continue;
      }
      return sub.planId;
    }
    return null;
  }

  /**
   * @returns true si l’utilisateur a un abonnement actif dont le plan inclut `feature`.
   */
  async canAccessFeature(
    userId: string,
    feature: PlanFeature,
  ): Promise<boolean> {
    const planId = await this.getActivePlanId(userId);
    if (!planId) {
      this.logger.debug(
        `canAccessFeature user=${userId} feature=${feature} → false (no active plan)`,
      );
      return false;
    }
    const allowed = planHasFeature(planId, feature);
    this.logger.debug(
      `canAccessFeature user=${userId} feature=${feature} plan=${planId} → ${allowed}`,
    );
    return allowed;
  }

  async getAccessSummary(userId: string) {
    const planId = await this.getActivePlanId(userId);
    const entitlements = planId ? getPlanEntitlements(planId) : undefined;
    return {
      planId,
      active: Boolean(planId),
      features: entitlements?.features ?? [],
      memberLimit: entitlements?.memberLimit ?? null,
      canAccessAi: planId ? planHasFeature(planId, 'ai') : false,
      canAccessCmsAiRewrite: planId
        ? planHasFeature(planId, 'cms_ai_rewrite')
        : false,
    };
  }

  /** Active plan for a specific organization billing account (not cross-org). */
  async getActivePlanIdForOrganization(
    organizationId: string,
  ): Promise<string | null> {
    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId },
      select: {
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIALING'] } },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            planId: true,
            status: true,
            currentPeriodEnd: true,
          },
        },
      },
    });
    const sub = account?.subscriptions[0];
    if (!sub || !isSubscriptionActive(sub.status)) return null;
    if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < Date.now()) {
      return null;
    }
    return sub.planId;
  }

  /**
   * Member cap for an org. No active subscription → starter default (5).
   * Pro / unlimited → `null`.
   */
  async getMemberLimitForOrganization(
    organizationId: string,
  ): Promise<number | null> {
    const planId =
      (await this.getActivePlanIdForOrganization(organizationId)) ?? 'starter';
    return getPlanEntitlements(planId)?.memberLimit ?? null;
  }
}
