// ============================================================
// Test server — boots the real Express app on an ephemeral port.
// ============================================================
import './env.ts';
import type { Server } from 'node:http';
import app from '../../src/app.ts';

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  return new Promise((resolve, reject) => {
    const server: Server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to bind ephemeral port'));
        return;
      }
      const baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve({
        baseUrl,
        close: () =>
          new Promise<void>((r) => {
            // closeAllConnections forces keep-alive connections to drop immediately
            if (typeof (server as Server & { closeAllConnections?: () => void }).closeAllConnections === 'function') {
              (server as Server & { closeAllConnections: () => void }).closeAllConnections();
            }
            server.close(() => r());
          }),
      });
    });
  });
}
