import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import type { Env } from '../../config/env.js';
import type { logger as Logger } from '../logger.js';

export interface FcmProjectConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  label: string;
}

export interface FcmProjectInfo {
  projectId: string;
  label: string;
}

export interface FcmSendMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
  deepLink?: string;
}

export interface FcmSendOptions {
  projectId?: string;
}

export interface FcmPerProjectResult {
  projectId: string;
  sent: number;
  failed: number;
}

export interface FcmSendResult {
  sent: number;
  failed: number;
  perProject: FcmPerProjectResult[];
}

interface FcmProject {
  projectId: string;
  label: string;
  messaging: Messaging;
}

const CHUNK_SIZE = 500;

// Owns one firebase-admin App per configured Firebase project so a single admin
// send can fan out to several projects (employees + dealers may live in different
// projects). Credentials are never exposed beyond this class.
export class FcmProjectsService {
  private readonly projects: FcmProject[] = [];

  constructor(
    private readonly env: Env,
    private readonly log: typeof Logger
  ) {
    const configs = this.parseConfigs();
    for (const cfg of configs) {
      const messaging = this.initProject(cfg);
      if (messaging) {
        this.projects.push({ projectId: cfg.projectId, label: cfg.label, messaging });
      }
    }
  }

  private parseConfigs(): FcmProjectConfig[] {
    const raw = this.env.FCM_PROJECTS.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const configs: FcmProjectConfig[] = [];
          for (const item of parsed) {
            if (!item || typeof item !== 'object') continue;
            const o = item as Record<string, unknown>;
            const projectId = typeof o.projectId === 'string' ? o.projectId : '';
            const clientEmail = typeof o.clientEmail === 'string' ? o.clientEmail : '';
            const privateKey = typeof o.privateKey === 'string' ? o.privateKey : '';
            const label = typeof o.label === 'string' && o.label ? o.label : projectId;
            if (projectId && clientEmail && privateKey) {
              configs.push({ projectId, clientEmail, privateKey, label });
            } else {
              this.log.warn({ projectId }, 'FCM_PROJECTS entry missing projectId/clientEmail/privateKey — skipped');
            }
          }
          if (configs.length) return configs;
        } else {
          this.log.warn('FCM_PROJECTS is not a JSON array — ignoring');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.log.warn({ err: message }, 'FCM_PROJECTS is not valid JSON — falling back to legacy FCM_* vars');
      }
    }

    // Legacy single-project fallback.
    if (this.env.FCM_PROJECT_ID && this.env.FCM_CLIENT_EMAIL && this.env.FCM_PRIVATE_KEY) {
      return [
        {
          projectId: this.env.FCM_PROJECT_ID,
          clientEmail: this.env.FCM_CLIENT_EMAIL,
          privateKey: this.env.FCM_PRIVATE_KEY,
          label: this.env.FCM_PROJECT_ID,
        },
      ];
    }

    return [];
  }

  private initProject(cfg: FcmProjectConfig): Messaging | null {
    const name = `fcm-${cfg.projectId}`;
    try {
      const existing = getApps().find((a: App) => a.name === name);
      const app =
        existing ??
        initializeApp(
          {
            credential: cert({
              projectId: cfg.projectId,
              clientEmail: cfg.clientEmail,
              privateKey: cfg.privateKey.replace(/\\n/g, '\n'),
            }),
          },
          name
        );
      return getMessaging(app);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error({ projectId: cfg.projectId, err: message }, 'Failed to initialize FCM project');
      return null;
    }
  }

  listProjects(): FcmProjectInfo[] {
    return this.projects.map((p) => ({ projectId: p.projectId, label: p.label }));
  }

  private targetProjects(projectId?: string): FcmProject[] {
    if (!projectId) return this.projects;
    return this.projects.filter((p) => p.projectId === projectId);
  }

  async sendToTokens(
    tokens: string[],
    msg: FcmSendMessage,
    opts: FcmSendOptions = {}
  ): Promise<FcmSendResult> {
    if (this.projects.length === 0) {
      throw new Error('FCM is not configured (no projects in FCM_PROJECTS or legacy FCM_* vars)');
    }

    const data: Record<string, string> = { ...(msg.data ?? {}) };
    if (msg.deepLink) data.deepLink = msg.deepLink;

    if (this.env.NOTIFY_DRY_RUN) {
      const targets = this.targetProjects(opts.projectId);
      this.log.info(
        { channel: 'fcm', tokens: tokens.length, title: msg.title, projects: targets.map((t) => t.projectId) },
        'DRY RUN — push not sent'
      );
      return {
        sent: tokens.length,
        failed: 0,
        perProject: targets.map((t) => ({ projectId: t.projectId, sent: tokens.length, failed: 0 })),
      };
    }

    const targets = this.targetProjects(opts.projectId);
    if (targets.length === 0) {
      throw new Error(`FCM project not configured: ${opts.projectId ?? ''}`);
    }

    // A token is SENT if ANY targeted project succeeds for it. Tokens aren't
    // project-tagged, so this is best-effort multi-project delivery.
    const sentByIndex = new Array<boolean>(tokens.length).fill(false);
    const perProject: FcmPerProjectResult[] = [];

    for (const target of targets) {
      let projectSent = 0;
      let projectFailed = 0;

      for (let start = 0; start < tokens.length; start += CHUNK_SIZE) {
        const chunk = tokens.slice(start, start + CHUNK_SIZE);
        try {
          const response = await target.messaging.sendEachForMulticast({
            tokens: chunk,
            notification: { title: msg.title, body: msg.body },
            data,
            android: { priority: 'high' },
            apns: { payload: { aps: { sound: 'default' } } },
          });
          response.responses.forEach((r, i) => {
            if (r.success) {
              projectSent += 1;
              sentByIndex[start + i] = true;
            } else {
              projectFailed += 1;
            }
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.log.error(
            { projectId: target.projectId, err: message, chunk: chunk.length },
            'FCM multicast chunk failed'
          );
          projectFailed += chunk.length;
        }
      }

      perProject.push({ projectId: target.projectId, sent: projectSent, failed: projectFailed });
    }

    const sent = sentByIndex.filter(Boolean).length;
    return { sent, failed: tokens.length - sent, perProject };
  }
}
