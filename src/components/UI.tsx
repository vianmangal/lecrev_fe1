import React from 'react';
import { motion } from 'motion/react';

interface GhostBtnProps {
  onClick?: () => void;
  children: React.ReactNode;
  danger?: boolean;
  small?: boolean;
  className?: string;
}

export const GhostBtn: React.FC<GhostBtnProps> = ({ onClick, children, danger = false, small = false, className = "" }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        border transition-all duration-150 cursor-pointer uppercase tracking-[0.15em] text-[9px] whitespace-nowrap
        ${small ? "px-2.5 py-1" : "px-4 py-1.5"}
        ${danger 
          ? "border-red-500/30 text-red-500/70 hover:border-red-500 hover:text-red-500" 
          : "border-border-md text-sub hover:border-white hover:text-white"}
        ${className}
      `}
    >
      {children}
    </motion.button>
  );
};

interface CyanBtnProps {
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export const CyanBtn: React.FC<CyanBtnProps> = ({ onClick, children, className = "" }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        bg-cyan-primary hover:bg-cyan-hover text-black px-6 py-2 text-[10px] font-bold uppercase tracking-[0.15em] border-none cursor-pointer transition-colors duration-150
        ${className}
      `}
    >
      {children}
    </motion.button>
  );
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colorClass = 
    status === "Production" || status === "Active" ? "text-cyan-primary" :
    status === "Failed" ? "text-red-500" :
    status === "Building" ? "text-amber-500" :
    "text-sub";

  return (
    <span className={`text-[9px] uppercase tracking-[0.15em] ${colorClass}`}>
      {status}
    </span>
  );
};

export const TextInput: React.FC<{ label?: string; placeholder?: string; defaultValue?: string }> = ({ label, placeholder, defaultValue }) => {
  return (
    <div className="w-full">
      {label && <p className="text-[10px] uppercase tracking-[0.15em] text-sub mb-2">{label}</p>}
      <input
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full bg-surface border border-border p-2.5 text-white text-xs focus:outline-1 focus:outline-cyan-primary focus:-outline-offset-1"
      />
    </div>
  );
};

export const SelectInput: React.FC<{ label?: string; options: string[] }> = ({ label, options }) => {
  return (
    <div className="w-full">
      {label && <p className="text-[10px] uppercase tracking-[0.15em] text-sub mb-2">{label}</p>}
      <select className="w-full bg-surface border border-border p-2.5 text-white text-xs cursor-pointer focus:outline-1 focus:outline-cyan-primary focus:-outline-offset-1">
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
};
