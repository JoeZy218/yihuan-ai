export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  type?: 'text' | 'team' | 'materials' | 'arcdisk' | 'reject' | 'no_match';
  data?: TeamData | MaterialsData | ArcDiskData | null;
  sources?: { title: string; similarity: number }[];
  suggestions?: string[];
}

export interface TeamData {
  team: TeamMember[];
  rotation: string;
  alternatives: AlternativeMember[];
  summary: string;
}

export interface TeamMember {
  name: string;
  role: string;
  reason: string;
}

export interface AlternativeMember {
  original: string;
  alternative: string;
  reason: string;
}

export interface MaterialsData {
  character: string;
  element: string;
  rarity: string;
  ascension: {
    from: number;
    to: number;
    materials: MaterialItem[];
  };
  exp_books?: MaterialItem[];
  skills: Record<string, {
    from: number;
    to: number;
    materials: MaterialItem[];
  }>;
  total_materials: MaterialItem[];
  priority: string[];
}

export interface MaterialItem {
  name: string;
  count: number;
  source: string;
}

export interface ArcDiskData {
  character: string;
  element: string;
  role: string;
  arcdisk: {
    name: string;
    element: string;
    rarity: string;
    main_attr: string;
    sub_attr: string;
    effect: string;
    effect_desc: string;
  };
  set: {
    name: string;
    set2: string;
    set4: string;
    main_stats: Record<string, string>;
    sub_priority: string[];
    reason: string;
  };
  alternatives: {
    name: string;
    set2: string;
    set4: string;
    main_stats: Record<string, string>;
    sub_priority: string[];
    reason: string;
  }[];
  ai_analysis?: string;
}

export interface Character {
  id: string;
  name: string;
  element: string;
  role: string;
  rarity: string;
  skills: Record<string, string>;
}