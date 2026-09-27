import { Queue } from 'bullmq';
import type { QueueJob, QueuePort } from '../../domain/ports/QueuePort.js';
import type { Env } from '../../config/env.js';

export const NOTIFICATIONS_QUEUE = 'notifications';

export interface QueueStats {
  queue: string;
  running: boolean;
  workers: number;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
  recentFailed: Array<{ id: string; name: string; failedReason: string | null; at: string | null }>;
}

export const redisConnection = (env: Env) => ({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
});

export class BullMqQueueAdapter implements QueuePort {
  private readonly queue: Queue;

  constructor(env: Env) {
    this.queue = new Queue(NOTIFICATIONS_QUEUE, {
      connection: redisConnection(env),
      prefix: 'notify',
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { age: 24 * 3600, count: 5000 },
        removeOnFail: false,
      },
    });
  }

  async enqueue(job: QueueJob): Promise<void> {
    await this.queue.add('deliver', job, { jobId: job.notificationId });
  }

  async getStats(): Promise<QueueStats> {
    const empty: QueueStats = {
      queue: NOTIFICATIONS_QUEUE,
      running: false,
      workers: 0,
      counts: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
      lastCompletedAt: null,
      lastFailedAt: null,
      recentFailed: [],
    };

    try {
      const [rawCounts, workers, [lastCompleted], [lastFailed], recentFailed] = await Promise.all([
        this.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused'),
        this.queue.getWorkers(),
        this.queue.getJobs(['completed'], 0, 0, false),
        this.queue.getJobs(['failed'], 0, 0, false),
        this.queue.getFailed(0, 5),
      ]);

      return {
        queue: NOTIFICATIONS_QUEUE,
        running: workers.length > 0,
        workers: workers.length,
        counts: {
          waiting: rawCounts.waiting ?? 0,
          active: rawCounts.active ?? 0,
          completed: rawCounts.completed ?? 0,
          failed: rawCounts.failed ?? 0,
          delayed: rawCounts.delayed ?? 0,
          paused: rawCounts.paused ?? 0,
        },
        lastCompletedAt: lastCompleted?.finishedOn ? new Date(lastCompleted.finishedOn).toISOString() : null,
        lastFailedAt: lastFailed?.finishedOn ? new Date(lastFailed.finishedOn).toISOString() : null,
        recentFailed: recentFailed.map((job) => ({
          id: String(job.id),
          name: job.name,
          failedReason: job.failedReason ?? null,
          at: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        })),
      };
    } catch {
      return empty;
    }
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
