import React from 'react';
import { motion } from 'motion/react';

interface GhostBtnProps {
  onClick?: () => void;
  children: React.ReactNode;
  danger?: boolean;
  small?: boolean;
  className?: string;
  disabled?: boolean;
}

export const GhostBtn: React.FC<GhostBtnProps> = ({ onClick, children, danger = false, small = false, className = "", disabled = false }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={`
        border transition-all duration-150 cursor-pointer uppercase tracking-[0.15em] text-[9px] whitespace-normal sm:whitespace-nowrap
        ${small ? "px-2.5 py-1" : "px-4 py-1.5"}
        ${danger 
          ? "border-red-500/30 text-red-500/70 hover:border-red-500 hover:text-red-500" 
          : "border-border-md text-sub hover:border-white hover:text-white"}
        ${disabled ? 'opacity-40 cursor-not-allowed hover:border-border-md hover:text-sub' : ''}
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
  disabled?: boolean;
}

export const CyanBtn: React.FC<CyanBtnProps> = ({ onClick, children, className = "", disabled = false }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={`
        bg-cyan-primary hover:bg-cyan-hover text-black px-6 py-2 text-[10px] font-bold uppercase tracking-[0.15em] border-none cursor-pointer transition-colors duration-150
        ${disabled ? 'opacity-60 cursor-not-allowed hover:bg-cyan-primary' : ''}
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

interface TextInputProps {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export const TextInput: React.FC<TextInputProps> = ({ label, placeholder, defaultValue, value, onChange }) => {
  const controlledProps = value !== undefined ? { value } : { defaultValue };
  return (
    <div className="w-full">
      {label && <p className="text-[10px] uppercase tracking-[0.15em] text-sub mb-2">{label}</p>}
      <input
        {...controlledProps}
        placeholder={placeholder}
        onChange={e => onChange?.(e.target.value)}
        className="w-full bg-surface border border-border p-2.5 text-white text-xs focus:outline-1 focus:outline-cyan-primary focus:-outline-offset-1"
      />
    </div>
  );
};

interface SelectInputProps {
  label?: string;
  options: string[];
  value?: string;
  onChange?: (value: string) => void;
}

export const SelectInput: React.FC<SelectInputProps> = ({ label, options, value, onChange }) => {
  const controlledProps = value !== undefined ? { value } : {};
  return (
    <div className="w-full">
      {label && <p className="text-[10px] uppercase tracking-[0.15em] text-sub mb-2">{label}</p>}
      <select
        {...controlledProps}
        onChange={e => onChange?.(e.target.value)}
        className="w-full bg-surface border border-border p-2.5 text-white text-xs cursor-pointer focus:outline-1 focus:outline-cyan-primary focus:-outline-offset-1"
      >
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
};
