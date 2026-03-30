export interface Deployment {
  id: string;
  project: string;
  branch: string;
  commit: string;
  env: 'Production' | 'Staging' | 'Preview';
  status: 'Active' | 'Building' | 'Ready' | 'Failed';
  age: string;
  region: string;
}

export interface LogEntry {
  t: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  msg: string;
}

export interface Project {
  id: string;
  name: string;
  url: string;
  status: 'Production' | 'Staging' | 'Preview';
  instances: string;
  active?: boolean;
}
