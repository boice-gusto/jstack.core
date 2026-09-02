/**
 * Shown for the brief window while App is waiting on the first `agent/list` round-trip
 * (`agents === null` in App.tsx) -- previously that gap just rendered nothing, which read as the
 * app hanging rather than starting up. A terminal-boot motif fits an agent daemon better than a
 * generic spinner: the wordmark wipes in like a typed command, then idles with a soft glow and a
 * blinking cursor until the real UI is ready to take over.
 */
export function Splash() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-black text-emerald-400">
      <pre className="jstack-splash-text m-0 whitespace-pre font-mono text-4xl font-bold tracking-[0.3em]">
        jstack<span className="jstack-splash-caret">_</span>
      </pre>
      <p className="font-mono text-xs tracking-widest text-emerald-400/50">
        connecting to agent daemon…
      </p>
    </div>
  );
}
