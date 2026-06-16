/** Placeholder for live MCP probes; doctor uses config + file presence only */
export async function pingIntegration(_name: string): Promise<boolean> {
  return true;
}
