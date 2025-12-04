export interface Country {
  id: number;
  name: string;
  isoCode: string;
  isoCode2: string;
  createdAt: string;
}

export interface Visit {
  id: number;
  countryId: number;
  country: Country;
  visitedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVisitDto {
  countryId: number;
  visitedAt?: string;
  notes?: string;
}

export interface UpdateVisitDto {
  visitedAt?: string;
  notes?: string;
}
