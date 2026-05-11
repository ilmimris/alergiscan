export type Allergen = 
  | 'Susu' 
  | 'Telur' 
  | 'Kacang' 
  | 'Kedelai' 
  | 'Gandum' 
  | 'Seafood' 
  | 'Kerang' 
  | 'Wijen';

export interface AllergenProfile {
  selected: Allergen[];
  custom?: string[];
}

export type ScanStatus = 'danger' | 'warning' | 'safe';

export interface ScanResult {
  id: string;
  timestamp: number;
  status: ScanStatus;
  ingredients: string[];
  foundAllergens: string[];
  explanation: string;
  image?: string; // Base64 preview
}
