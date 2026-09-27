export interface WhatsAppOutboundInput {
  waMessageId: string | null;
  toPhone: string;
  body?: string | null;
  status?: string;
  sentBy?: string | null;
}

export interface WhatsAppConversation {
  phone: string;
  lastAt: Date;
  lastDirection: 'in' | 'out';
  lastBody: string | null;
  name?: string | null;
}

export interface WhatsAppConversationsQuery {
  limit: number;
  offset: number;
  q?: string;
}

export type WhatsAppMediaKind = 'image' | 'video' | 'audio' | 'document';

export interface WhatsAppThreadMedia {
  kind: WhatsAppMediaKind;
  url: string;
  mime?: string | null;
  name?: string | null;
}

export interface WhatsAppThreadButton {
  type: string;
  text: string;
  url?: string | null;
  phone?: string | null;
}

export interface WhatsAppThreadItem {
  direction: 'in' | 'out';
  body: string | null;
  msgType?: string | null;
  status?: string | null;
  sentBy?: string | null;
  source?: string | null;
  media?: WhatsAppThreadMedia | null;
  buttons?: WhatsAppThreadButton[];
  at: Date;
}

export interface WhatsAppThreadQuery {
  limit: number;
}

// This service does not own the WhatsApp message log — chesa_api_gateway does.
// We read its shared inbound/outbound tables (all conversations) and append our
// own sends to the shared outbound table so they show up everywhere.
export interface WhatsAppRepository {
  saveOutbound(row: WhatsAppOutboundInput): Promise<number>;
  listConversations(query: WhatsAppConversationsQuery): Promise<WhatsAppConversation[]>;
  getThread(phone: string, query: WhatsAppThreadQuery): Promise<WhatsAppThreadItem[]>;
}
