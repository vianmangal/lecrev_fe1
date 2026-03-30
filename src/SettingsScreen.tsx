import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TextInput, SelectInput, CyanBtn, GhostBtn } from './components/UI';
import { ApiConnection } from './api';

interface SettingsScreenProps {
  settingsTab: string;
  setSettingsTab: (t: string) => void;
  connection: ApiConnection;
  onSaveConnection: (connection: ApiConnection) => void;
  availableRegions: string[];
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ settingsTab, setSettingsTab, connection, onSaveConnection, availableRegions }) => {
  const TABS = ['General', 'Team', 'Domains', 'API Keys', 'Danger Zone'];
  const [baseUrl, setBaseUrl] = React.useState(connection.baseUrl);
  const [apiKey, setApiKey] = React.useState(connection.apiKey);
  const [projectId, setProjectId] = React.useState(connection.projectId);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    setBaseUrl(connection.baseUrl);
    setApiKey(connection.apiKey);
    setProjectId(connection.projectId);
  }, [connection.baseUrl, connection.apiKey, connection.projectId]);

  const saveConnection = () => {
    onSaveConnection({
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      projectId: projectId.trim(),
    });
    setSavedAt(new Date().toLocaleTimeString('en-GB', { hour12: false }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 flex flex-col md:flex-row gap-8 md:gap-16"
    >
      <nav className="flex flex-row md:flex-col md:w-40 shrink-0 gap-1 md:gap-0 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
        <p className="hidden md:block text-[10px] uppercase tracking-[0.15em] text-sub mb-4">Settings</p>
        {TABS.map((t) => {
          const key = t.toLowerCase().replace(' ', '_');
          const active = settingsTab === key;
          const isDanger = t === 'Danger Zone';
          return (
            <button
              key={t}
              onClick={() => setSettingsTab(key)}
              className={`
                block shrink-0 text-left text-[10px] uppercase tracking-[0.12em] bg-transparent border-none border-l py-2.5 pl-4 cursor-pointer transition-all duration-150 whitespace-nowrap
                ${active
                  ? (isDanger ? 'border-red-500 text-red-500' : 'border-white text-white')
                  : (isDanger ? 'border-border text-red-500/50' : 'border-border text-sub hover:text-neutral-300')}
              `}
            >
              {t}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 max-w-[520px]">
        <AnimatePresence mode="wait">
          {settingsTab === 'general' && (
            <motion.div
              key="general"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex flex-col gap-6"
            >
              <h3 className="text-sm uppercase tracking-tight font-normal mb-2">General</h3>
              <SelectInput label="Build Runtime" options={['Node 22', 'Node 20 (LTS)', 'Bun 1.1', 'Deno 2.0']} />

              <div className="border border-border p-5 mt-4">
                <p className="text-[10px] uppercase tracking-[0.15em] text-sub mb-4">Control Plane Connection</p>
                <div className="flex flex-col gap-4">
                  <TextInput
                    label="API Base URL"
                    value={baseUrl}
                    onChange={setBaseUrl}
                    placeholder="Leave blank to use /v1 dev proxy"
                  />
                  <TextInput
                    label="X-API-Key"
                    value={apiKey}
                    onChange={setApiKey}
                    placeholder="API key"
                  />
                  <TextInput
                    label="Default Project ID"
                    value={projectId}
                    onChange={setProjectId}
                    placeholder="Project ID"
                  />
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
                <div className="flex items-center justify-between mt-5">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-muted">{savedAt ? `Saved ${savedAt}` : 'Local browser storage'}</span>
                  <CyanBtn onClick={saveConnection}>Save Connection</CyanBtn>
                </div>
              </div>
            </motion.div>
          )}
          {settingsTab === 'team' && (
            <motion.div
              key="team"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <h3 className="text-sm uppercase tracking-tight font-normal mb-8">Team</h3>
              <div className="flex items-center justify-center h-32 text-[11px] text-sub uppercase tracking-[0.12em] border border-border">
                No team members yet
              </div>
              <div className="mt-6"><GhostBtn>+ Invite Member</GhostBtn></div>
            </motion.div>
          )}
          {settingsTab === 'domains' && (
            <motion.div
              key="domains"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <h3 className="text-sm uppercase tracking-tight font-normal mb-8">Domains</h3>
              <div className="flex items-center justify-center h-32 text-[11px] text-sub uppercase tracking-[0.12em] border border-border mb-6">
                No domains configured
              </div>
              <div className="flex flex-col gap-3">
                <TextInput label="Add Domain" placeholder="yourdomain.com" />
                <GhostBtn>+ Add Domain</GhostBtn>
              </div>
            </motion.div>
          )}
          {settingsTab === 'api_keys' && (
            <motion.div
              key="api_keys"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <h3 className="text-sm uppercase tracking-tight font-normal mb-8">API Keys</h3>
              <div className="flex items-center justify-center h-32 text-[11px] text-sub uppercase tracking-[0.12em] border border-border mb-4">
                No API keys generated
              </div>
              <GhostBtn>+ Generate New Key</GhostBtn>
            </motion.div>
          )}
          {settingsTab === 'danger_zone' && (
            <motion.div
              key="danger_zone"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <h3 className="text-sm uppercase tracking-tight font-normal mb-8 text-red-500">Danger Zone</h3>
              {[
                { title: 'Delete All Deployments', desc: 'Permanently remove all deployment history. This action cannot be undone.' },
                { title: 'Delete Organisation', desc: 'Permanently delete this organisation, all projects, and associated data.' },
              ].map((item) => (
                <div key={item.title} className="border border-red-500/20 p-6 mb-3">
                  <p className="text-[12px] mb-2">{item.title}</p>
                  <p className="text-[10px] text-sub mb-4">{item.desc}</p>
                  <GhostBtn danger>{item.title}</GhostBtn>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
