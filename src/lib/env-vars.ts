export function parseEnvVarsInput(raw: string): Record<string, string> {
  const envVars: Record<string, string> = {};

  for (const originalLine of raw.split(/\r?\n/)) {
    const line = originalLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const separator = line.indexOf('=');
    if (separator <= 0) {
      throw new Error(`Invalid env var line "${originalLine}". Use KEY=VALUE format.`);
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid env var key "${key}". Use letters, digits, and underscores only.`);
    }
    envVars[key] = value;
  }

  return envVars;
}
