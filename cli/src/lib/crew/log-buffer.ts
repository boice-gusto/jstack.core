/**
 * A bounded in-memory ring buffer of recent daemon log lines, so the resident daemon can answer
 * "what have you been doing" (via `rpc-server.ts`'s `logs/recent`) without reading its own
 * launchd-redirected stdout/stderr files back off disk. Poll-based, not push/streamed: the RPC
 * transport is one request/response per connection (see rpc-server.ts's own doc comment), so a
 * client (the desktop app) asks for the last N lines on an interval rather than subscribing.
 */
export class LogBuffer {
  private readonly lines: string[] = [];

  constructor(private readonly capacity = 200) {}

  push(line: string): void {
    this.lines.push(line);
    if (this.lines.length > this.capacity) this.lines.shift();
  }

  recent(limit = 50): string[] {
    return this.lines.slice(-limit);
  }
}
