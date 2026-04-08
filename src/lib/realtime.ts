// MiniMax Realtime API - WebSocket 连接管理
// 协议: OpenAI Realtime API 兼容
// 端点: wss://api.minimax.chat/ws/v1/realtime

export interface RealtimeConfig {
  apiKey: string;
  model?: string;
  instructions?: string;
  voice?: string;
  modalities?: ('text' | 'audio')[];
}

export interface RealtimeMessage {
  type: string;
  [key: string]: unknown;
}

export interface TextDeltaEvent {
  type: 'response.text.delta';
  delta: string;
  responseId: string;
}

export interface ResponseDoneEvent {
  type: 'response.done';
  response: {
    id: string;
    output: Array<{
      type: string;
      content?: Array<{ type: string; text?: string }>;
    }>;
  };
}

export type RealtimeEventHandler = (msg: RealtimeMessage) => void;

export class MiniMaxRealtimeClient {
  private ws: WebSocket | null = null;
  private config: Required<RealtimeConfig>;
  private handlers: Set<RealtimeEventHandler> = new Set();
  private messageQueue: RealtimeMessage[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;
  private sessionId: string | null = null;
  private isConnected = false;

  constructor(config: RealtimeConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'abab6.5s-chat',
      instructions: config.instructions || '你是一个乐于助人的AI助手',
      voice: config.voice || 'male-qn-qingse',
      modalities: config.modalities || ['text'],
    };
  }

  // 连接 WebSocket
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 浏览器 WebSocket 不支持自定义 Header，将 token 放在 URL query 参数中
        const wsUrl = `wss://api.minimax.chat/ws/v1/realtime?authorization=Bearer%20${encodeURIComponent(this.config.apiKey)}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('[Realtime] WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as RealtimeMessage;
            this.handleMessage(msg);
          } catch (e) {
            console.error('[Realtime] Parse error:', e);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[Realtime] WebSocket error:', error);
          this.isConnected = false;
        };

        this.ws.onclose = (event) => {
          console.log('[Realtime] WebSocket closed:', event.code, event.reason);
          this.isConnected = false;
          this.handleClose();
        };

        // 等待 session.created 后 resolve
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        const originalHandler = (msg: RealtimeMessage) => {
          if (msg.type === 'session.created') {
            clearTimeout(timeout);
            this.removeHandler(originalHandler);
            resolve();
          }
        };
        this.addHandler(originalHandler);
      } catch (error) {
        reject(error);
      }
    });
  }

  // 发送 session.update 配置
  async startSession(): Promise<void> {
    await this.sendAndWait({
      type: 'session.update',
      session: {
        modalities: this.config.modalities,
        instructions: this.config.instructions,
        voice: this.config.voice,
      },
    });
  }

  // 发送文字消息
  async sendText(text: string): Promise<void> {
    // 1. 创建对话项
    await this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text,
          },
        ],
        status: 'completed',
      },
    });

    // 2. 请求响应
    await this.send({
      type: 'response.create',
      response: {
        status: 'incomplete',
      },
    });
  }

  // 发送原始音频数据 (PCM16)
  async sendAudio(audioData: ArrayBuffer): Promise<void> {
    const base64 = this.arrayBufferToBase64(audioData);
    await this.send({
      type: 'input_audio_buffer.append',
      audio: base64,
    });
  }

  // 提交音频缓冲
  async commitAudio(): Promise<void> {
    await this.send({
      type: 'input_audio_buffer.commit',
    });
    await this.send({
      type: 'response.create',
      response: {
        status: 'incomplete',
      },
    });
  }

  // 添加事件处理器
  addHandler(handler: RealtimeEventHandler): void {
    this.handlers.add(handler);
  }

  // 移除事件处理器
  removeHandler(handler: RealtimeEventHandler): void {
    this.handlers.delete(handler);
  }

  // 断开连接
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.sessionId = null;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  isSessionConnected(): boolean {
    return this.isConnected;
  }

  // ========== 私有方法 ==========

  private handleMessage(msg: RealtimeMessage): void {
    if (msg.type === 'session.created') {
      this.sessionId = (msg.session as any)?.id || null;
      console.log('[Realtime] Session created:', this.sessionId);
    }

    if (msg.type === 'error') {
      const err = msg.error as any;
      console.error('[Realtime] Error:', err?.message, err?.code);
    }

    // 通知所有处理器
    this.handlers.forEach((handler) => {
      try {
        handler(msg);
      } catch (e) {
        console.error('[Realtime] Handler error:', e);
      }
    });
  }

  private handleClose(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `[Realtime] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})...`
      );
      setTimeout(() => this.connect(), this.reconnectDelay);
    }
  }

  private send(data: object): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const message = JSON.stringify(data);
      this.ws.send(message);
      resolve();
    });
  }

  private sendAndWait(expectedType: object): Promise<RealtimeMessage> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeHandler(handler);
        reject(new Error(`Timeout waiting for event`));
      }, 10000);

      const handler: RealtimeEventHandler = (msg) => {
        // 忽略 session.created (由 connect 处理)
        if (msg.type === 'session.created') return;
        // 忽略 error (由通用处理器处理)
        if (msg.type === 'error') return;

        clearTimeout(timeout);
        this.removeHandler(handler);
        resolve(msg);
      };

      this.addHandler(handler);
      this.send(expectedType).catch((e) => {
        clearTimeout(timeout);
        this.removeHandler(handler);
        reject(e);
      });
    });
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

// 导出单例或工厂函数
let globalClient: MiniMaxRealtimeClient | null = null;

export function getRealtimeClient(config: RealtimeConfig): MiniMaxRealtimeClient {
  if (globalClient && globalClient.isSessionConnected()) {
    globalClient.disconnect();
  }
  globalClient = new MiniMaxRealtimeClient(config);
  return globalClient;
}
