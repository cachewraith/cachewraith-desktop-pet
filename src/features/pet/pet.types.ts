export interface PetProfile {
  id: number;
  name: string;
  mood: string;
  happiness: number;
  energy: number;
  hunger: number;
  experience: number;
  level: number;
  createdAt: string;
  updatedAt: string;
  lastInteractionAt: string | null;
}

export type PetStateName =
  | 'initializing'
  | 'idle'
  | 'walking'
  | 'sleeping'
  | 'happy'
  | 'sad'
  | 'hungry'
  | 'eating'
  | 'talking'
  | 'typing'
  | 'celebrating'
  | 'dragging'
  | 'hidden';

export type ActivityType = 'feed' | 'pet' | 'chat' | 'level_up' | 'reset';

export interface Activity {
  id: number;
  activityType: string;
  details: string | null;
  experienceAwarded: number;
  createdAt: string;
}
