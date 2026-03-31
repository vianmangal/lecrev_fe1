import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ApiConnection } from './api';
import { SettingsNav } from './components/settings/SettingsNav';
import { GeneralSettingsPanel } from './components/settings/GeneralSettingsPanel';
import { SettingsPlaceholderPanel } from './components/settings/SettingsPlaceholderPanel';
import { DangerZonePanel } from './components/settings/DangerZonePanel';

interface SettingsScreenProps {
  settingsTab: string;
  setSettingsTab: (t: string) => void;
  connection: ApiConnection;
  onSaveConnection: (connection: ApiConnection) => void;
  availableRegions: string[];
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ settingsTab, setSettingsTab, connection, onSaveConnection, availableRegions }) => {
  const TABS = ['General', 'Team', 'Domains', 'API Keys', 'Danger Zone'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 flex flex-col md:flex-row gap-8 md:gap-16"
    >
      <SettingsNav tabs={TABS} activeTab={settingsTab} onSelect={setSettingsTab} />

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
              <GeneralSettingsPanel connection={connection} availableRegions={availableRegions} onSaveConnection={onSaveConnection} />
            </motion.div>
          )}
          {settingsTab === 'team' && (
            <motion.div
              key="team"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            ><SettingsPlaceholderPanel kind="team" scopeKey={connection.projectId || 'default'} /></motion.div>
          )}
          {settingsTab === 'domains' && (
            <motion.div
              key="domains"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            ><SettingsPlaceholderPanel kind="domains" scopeKey={connection.projectId || 'default'} /></motion.div>
          )}
          {settingsTab === 'api_keys' && (
            <motion.div
              key="api_keys"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            ><SettingsPlaceholderPanel kind="api_keys" /></motion.div>
          )}
          {settingsTab === 'danger_zone' && (
            <motion.div
              key="danger_zone"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            ><DangerZonePanel /></motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
