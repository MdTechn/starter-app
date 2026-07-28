/**
 * Queue port — sync by default; BullMQ/Redis ready when REDIS_URL is set later.
 */
export type NotificationJob = {
  notificationId: string;
};

export interface NotificationQueue {
  enqueue(job: NotificationJob): Promise<void>;
}
