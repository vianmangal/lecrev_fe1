import React from 'react';
import { CyanBtn, TextInput } from '../UI';

interface ProjectSettingsPanelProps {
  name: string;
  url: string;
}

export function ProjectSettingsPanel({ name, url }: ProjectSettingsPanelProps) {
  return (
    <div className="max-w-[460px] flex flex-col gap-6">
      <TextInput label="Project Name" defaultValue={name} />
      <TextInput label="Domain" defaultValue={url} />
      <div className="flex justify-end pt-2">
        <CyanBtn>Save Changes</CyanBtn>
      </div>
    </div>
  );
}
