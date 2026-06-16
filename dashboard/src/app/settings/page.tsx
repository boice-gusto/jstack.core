import { Section } from "@/components/section";

export default function SettingsPage() {
  return (
    <Section title="Settings" variant="stub">
      <p>Edit `jstack.config.json` or use `/jstack:update-config`. Dangerous keys should stay in gitignored local file.</p>
    </Section>
  );
}
