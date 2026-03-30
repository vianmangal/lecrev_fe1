import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TextInput, SelectInput, CyanBtn, GhostBtn } from './components/UI';

interface SettingsScreenProps {
  settingsTab: string;
  setSettingsTab: (t: string) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ settingsTab, setSettingsTab }) => {
  const TABS = ["General", "Team", "Domains", "API Keys", "Danger Zone"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex-1 overflow-y-auto p-12 flex gap-16"
    >
      <nav className="w-40 shrink-0">
        <p className="text-[10px] uppercase tracking-[0.15em] text-sub mb-4">Settings</p>
        {TABS.map(t => {
          const key = t.toLowerCase().replace(" ", "_");
          const active = settingsTab === key;
          const isDanger = t === "Danger Zone";
          return (
            <button
              key={t}
              onClick={() => setSettingsTab(key)}
              className={`
                block w-full text-left text-[10px] uppercase tracking-[0.12em] bg-transparent border-none border-l py-2.5 pl-4 cursor-pointer transition-all duration-150
                ${active 
                  ? (isDanger ? "border-red-500 text-red-500" : "border-white text-white") 
                  : (isDanger ? "border-border text-red-500/50" : "border-border text-sub hover:text-neutral-300")}
              `}
            >
              {t}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 max-w-[520px]">
        <AnimatePresence mode="wait">
          {settingsTab === "general" && (
            <motion.div
              key="general"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex flex-col gap-6"
            >
              <h3 className="text-sm uppercase tracking-tight font-normal mb-2">General</h3>
              <TextInput label="Organisation Name" defaultValue="Lecrev" />
              <TextInput label="Default Region" defaultValue="LHR" />
              <SelectInput label="Build Runtime" options={["Node 20 (LTS)", "Node 22", "Bun 1.1", "Deno 2.0"]} />
              <div className="flex justify-end">
                <CyanBtn>Save Changes</CyanBtn>
              </div>
            </motion.div>
          )}
          {settingsTab === "team" && (
            <motion.div
              key="team"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <h3 className="text-sm uppercase tracking-tight font-normal mb-8">Team</h3>
              {[
                { name: "alex.chen", role: "Owner", since: "Jan 2024" },
                { name: "jamie.okonkwo", role: "Admin", since: "Mar 2024" },
                { name: "priya.sharma", role: "Developer", since: "Jun 2024" },
              ].map(m => (
                <div key={m.name} className="flex items-center justify-between py-3.5 border-b border-border">
                  <div>
                    <p className="text-[12px]">{m.name}</p>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-muted mt-1">{m.since}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-sub">{m.role}</span>
                    {m.role !== "Owner" && <GhostBtn small>Remove</GhostBtn>}
                  </div>
                </div>
              ))}
              <div className="mt-6"><GhostBtn>+ Invite Member</GhostBtn></div>
            </motion.div>
          )}
          {settingsTab === "domains" && (
            <motion.div
              key="domains"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <h3 className="text-sm uppercase tracking-tight font-normal mb-8">Domains</h3>
              {["lecrev.sh", "core-platform-v2.lecrev.app", "api.lecrev.sh"].map((d, i) => (
                <div key={d} className="flex items-center justify-between py-3 border-b border-border">
                  <p className="text-[12px]">{d}</p>
                  <div className="flex items-center gap-4">
                    <span className="text-[9px] uppercase tracking-[0.15em] text-cyan-primary">Verified</span>
                    {i > 0 && <GhostBtn small>Remove</GhostBtn>}
                  </div>
                </div>
              ))}
              <div className="mt-6 flex flex-col gap-3">
                <TextInput label="Add Domain" placeholder="yourdomain.com" />
                <GhostBtn>+ Add Domain</GhostBtn>
              </div>
            </motion.div>
          )}
          {settingsTab === "api_keys" && (
            <motion.div
              key="api_keys"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <h3 className="text-sm uppercase tracking-tight font-normal mb-8">API Keys</h3>
              {[
                { name: "Production Key", key: "lcr_pk_••••••••••••ab4f", created: "12 Jan 2025" },
                { name: "CI/CD Token", key: "lcr_ci_••••••••••••92e1", created: "03 Mar 2025" },
              ].map(k => (
                <div key={k.name} className="border border-border p-4 mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-[12px] mb-1">{k.name}</p>
                    <p className="text-[10px] text-sub">{k.key}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-muted">{k.created}</span>
                    <GhostBtn danger small>Revoke</GhostBtn>
                  </div>
                </div>
              ))}
              <div className="mt-4"><GhostBtn>+ Generate New Key</GhostBtn></div>
            </motion.div>
          )}
          {settingsTab === "danger_zone" && (
            <motion.div
              key="danger_zone"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <h3 className="text-sm uppercase tracking-tight font-normal mb-8 text-red-500">Danger Zone</h3>
              {[
                { title: "Delete All Deployments", desc: "Permanently remove all deployment history. This action cannot be undone." },
                { title: "Delete Organisation", desc: "Permanently delete this organisation, all projects, and associated data." },
              ].map(item => (
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
