export interface Choice {
  id: string;
  text: string;
}

export interface Position {
  x: number;
  y: number;
}

export interface Relationship {
  entity: string;
  status: string;
}

export interface GameState {
  sanity: number;
  lucidity: number;
  nostalgia: number;
  relationships: Relationship[];
  inventory?: string[];
  position: Position;
  visited?: Position[];
  mementos?: { name: string; condition: string }[];
}

export interface StoryNode {
  narrative: string;
  environment: string;
  weatherEffect: "rain" | "fog" | "fire" | "static" | "none";
  musicTone: "calm" | "tense" | "chaotic" | "mystical";
  choices: Choice[];
  gameState: GameState;
  isEnding?: boolean;
  endingBadge?: string;
}

export interface HistoryTurn {
  narrative: string;
  userChoice: string;
}

export interface StoryMeta {
  id: string;
  title: string;
  description: string;
}
