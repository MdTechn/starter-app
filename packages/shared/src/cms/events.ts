/** CMS article lifecycle statuses (mirrors Prisma CmsArticleStatus). */
export enum CmsArticleStatus {
  DRAFT = 'DRAFT',
  REVIEW = 'REVIEW',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

/** Domain CMS events — emit from CmsModule, consume elsewhere. */
export enum AppCmsEvent {
  CMS_CREATED = 'CMS_CREATED',
  CMS_UPDATED = 'CMS_UPDATED',
  CMS_PUBLISHED = 'CMS_PUBLISHED',
}

/** Nest EventEmitter channel for CMS domain events. */
export const CMS_DOMAIN_EVENT = 'app.cms.domain';

export type CmsDomainEventPayload = {
  event: AppCmsEvent;
  articleId: string;
  slug?: string;
  folderId?: string;
  status?: CmsArticleStatus | string;
  actorUserId?: string | null;
  locale?: string | null;
};
