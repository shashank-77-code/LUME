import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  Braces,
  FileCode2,
  FileSearch2,
  FolderOpen,
  GitBranch,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export interface NavigationItem {
  label: string;
  href: string;
}

export interface TrustFeature {
  label: string;
  icon: LucideIcon;
}

export interface ProcessNode {
  id: 'detect' | 'analyze' | 'transform' | 'verify';
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface WorkflowStep {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const navigationItems: readonly NavigationItem[] = [
  { label: 'How It Works', href: '#architecture' },
  { label: 'Migration Demo', href: '#demo' },
  { label: 'Migration Engine', href: '#engine' },
  { label: 'Workspace', href: '/workspace' },
];

export const trustFeatures: readonly TrustFeature[] = [
  { label: '100% Local Analysis', icon: ShieldCheck },
  { label: 'Deterministic Rules', icon: Braces },
  { label: 'Syntax Verified', icon: BadgeCheck },
  { label: 'Zero Guesswork', icon: Sparkles },
];

export const processNodes: readonly ProcessNode[] = [
  { id: 'detect', title: 'Detect', description: 'Find breaking changes', icon: FileSearch2 },
  { id: 'analyze', title: 'Analyze', description: 'Deep AST analysis', icon: GitBranch },
  { id: 'transform', title: 'Transform', description: 'Apply smart codemods', icon: FileCode2 },
  { id: 'verify', title: 'Verify', description: 'Ensure syntax safety', icon: ShieldCheck },
];

export const workflowSteps: readonly WorkflowStep[] = [
  { title: 'Repository', description: 'Upload your code', icon: FolderOpen },
  { title: 'AST Analysis', description: 'Understand structure', icon: GitBranch },
  { title: 'Rules Engine', description: 'Match and detect', icon: FileSearch2 },
  { title: 'Codemod', description: 'Transform safely', icon: Braces },
  { title: 'Verification', description: 'Verify syntax', icon: ShieldCheck },
  { title: 'Report', description: 'Export and share', icon: FileCode2 },
];
