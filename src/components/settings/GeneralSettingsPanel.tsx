import React from 'react';
import { ApiConnection } from '../../api';
import { CyanBtn, SelectInput, TextInput } from '../UI';

interface GeneralSettingsPanelProps {
  connection: ApiConnection;
  availableRegions: string[];
  onSaveConnection: (connection: ApiConnection) => void;
}

export function GeneralSettingsPanel({ connection, availableRegions, onSaveConnection }: GeneralSettingsPanelProps) {
  const [baseUrl, setBaseUrl] = React.useState(connection.baseUrl);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    setBaseUrl(connection.baseUrl);
  }, [connection.baseUrl]);

  const saveConnection = () => {
    onSaveConnection({
      baseUrl: baseUrl.trim(),
      apiKey: connection.apiKey,
      projectId: connection.projectId,
    });
    setSavedAt(new Date().toLocaleTimeString('en-GB', { hour12: false }));
  };

  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-sm uppercase tracking-tight font-normal mb-2">General</h3>
      <SelectInput label="Build Runtime" options={['Node 22', 'Node 20 (LTS)', 'Bun 1.1', 'Deno 2.0']} />

      <div className="border border-border p-5 mt-4">
        <p className="text-[10px] uppercase tracking-[0.15em] text-sub mb-4">Control Plane Connection</p>
        <div className="flex flex-col gap-4">
          <TextInput
            label="API Base URL"
            value={baseUrl}
            onChange={setBaseUrl}
            placeholder="Leave blank to use the configured production API"
          />
          <div className="border border-border px-3 py-2">
            <p className="text-[9px] uppercase tracking-[0.12em] text-muted">Tenant API Key</p>
            <p className="mt-2 text-[11px] text-sub">
              Managed by your GitHub session. The browser no longer stores or edits a shared control-plane key.
            </p>
          </div>
          <div className="border border-border px-3 py-2">
            <p className="text-[9px] uppercase tracking-[0.12em] text-muted">Default Project ID</p>
            <p className="mt-2 text-[11px] text-white break-all">{connection.projectId || 'Provisioning…'}</p>
          </div>
        </div>
        {availableRegions.length > 0 && (
          <div className="mt-4">
            <p className="text-[9px] uppercase tracking-[0.12em] text-muted mb-2">Supported Regions</p>
            <div className="flex flex-wrap gap-2">
              {availableRegions.map((region) => (
                <span key={region} className="text-[9px] uppercase tracking-[0.12em] border border-border px-2 py-1 text-sub">
                  {region}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-5">
          <span className="text-[9px] uppercase tracking-[0.12em] text-muted">{savedAt ? `Saved ${savedAt}` : 'Local browser storage'}</span>
          <CyanBtn className="w-full sm:w-auto" onClick={saveConnection}>Save Connection</CyanBtn>
        </div>
      </div>
    </div>
  );
}
