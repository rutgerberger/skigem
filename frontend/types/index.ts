export interface SearchCriteria {
  country: string;
  min_slope_length_km: number;
  max_budget_per_night: number;
  lift_proximity_m: number;
  number_of_guests: number;
  additional_requirements?: string;
}

export interface Chalet {
  name: string;
  url: string;
  image_url?: string; // <-- ADDED THIS
  price_per_night?: number;
  total_price_high_season?: number;
  distance_to_lift_m?: number;
  capacity?: number;
  hidden_gem_score: number;
  reasoning: string;
  village: string;
}

export interface Resort {
  name: string;
  slope_length_km?: number;
  altitude_info?: string;
  vibe?: string;
  logistics?: string;
  avg_pass_price_eur?: number;
  chalets?: Chalet[];
}