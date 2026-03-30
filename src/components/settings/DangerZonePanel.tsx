import React from 'react';
import { GhostBtn } from '../UI';

const DANGER_ACTIONS = [
  { title: 'Delete All Deployments', desc: 'Permanently remove all deployment history. This action cannot be undone.' },
  { title: 'Delete Organisation', desc: 'Permanently delete this organisation, all projects, and associated data.' },
];

export function DangerZonePanel() {
  return (
    <>
      <h3 className="text-sm uppercase tracking-tight font-normal mb-8 text-red-500">Danger Zone</h3>
      {DANGER_ACTIONS.map((item) => (
        <div key={item.title} className="border border-red-500/20 p-6 mb-3">
          <p className="text-[12px] mb-2">{item.title}</p>
          <p className="text-[10px] text-sub mb-4">{item.desc}</p>
          <GhostBtn danger>{item.title}</GhostBtn>
        </div>
      ))}
    </>
  );
}
