import { v4 as uuidv4 } from 'uuid';
import { QProcessManager } from './process-manager.js';

export interface Session {
  id: string;
  processManager: QProcessManager;
  createdAt: Date;
  lastActivity: Date;
  clientInfo?: {
    userAgent?: string;
    remoteAddress?: string;
  };
}

export class SessionManager {
  private static instance: SessionManager;
  private sessions: Map<string, Session> = new Map();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private cleanupInterval: NodeJS.Timeout;

  private constructor() {
    // Start cleanup interval to remove inactive sessions
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Create a new session or return existing one
   */
  createSession(sessionId?: string, clientInfo?: Session['clientInfo']): Session {
    const id = sessionId || uuidv4();
    
    if (this.sessions.has(id)) {
      const session = this.sessions.get(id)!;
      session.lastActivity = new Date();
      return session;
    }

    const session: Session = {
      id,
      processManager: new QProcessManager(),
      createdAt: new Date(),
      lastActivity: new Date(),
      clientInfo
    };

    this.sessions.set(id, session);
    console.error(`[SessionManager] Created new session: ${id}`);
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      return session;
    }
    return null;
  }

  /**
   * Update session activity timestamp
   */
  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * Remove a session and cleanup its resources
   */
  removeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Cleanup all processes in this session
      session.processManager.cleanup();
      this.sessions.delete(sessionId);
      console.error(`[SessionManager] Removed session: ${sessionId}`);
      return true;
    }
    return false;
  }

  /**
   * Get all active sessions (for admin/monitoring)
   */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session statistics
   */
  getStats() {
    const sessions = Array.from(this.sessions.values());
    const totalProcesses = sessions.reduce((sum, session) => 
      sum + session.processManager.listProcesses().length, 0
    );

    return {
      totalSessions: sessions.length,
      totalProcesses,
      oldestSession: sessions.reduce((oldest, session) => 
        !oldest || session.createdAt < oldest.createdAt ? session : oldest, 
        null as Session | null
      )?.createdAt,
      newestSession: sessions.reduce((newest, session) => 
        !newest || session.createdAt > newest.createdAt ? session : newest,
        null as Session | null
      )?.createdAt
    };
  }

  /**
   * Cleanup inactive sessions
   */
  private cleanupInactiveSessions(): void {
    const now = new Date();
    const sessionsToRemove: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      const timeSinceActivity = now.getTime() - session.lastActivity.getTime();
      if (timeSinceActivity > this.SESSION_TIMEOUT) {
        sessionsToRemove.push(sessionId);
      }
    }

    for (const sessionId of sessionsToRemove) {
      this.removeSession(sessionId);
    }

    if (sessionsToRemove.length > 0) {
      console.error(`[SessionManager] Cleaned up ${sessionsToRemove.length} inactive sessions`);
    }
  }

  /**
   * Cleanup all sessions and stop cleanup interval
   */
  shutdown(): void {
    console.error('[SessionManager] Shutting down...');
    
    // Cleanup all sessions
    for (const sessionId of this.sessions.keys()) {
      this.removeSession(sessionId);
    }

    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
