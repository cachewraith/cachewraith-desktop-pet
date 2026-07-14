/**
 * Pure filtering, searching and sorting for the Pet Library. No I/O so it
 * is fully unit-testable.
 */
import type { LibraryPet, PetCategory, PetRarity } from '../types/pet-library.types';

export type OwnershipFilter =
  'all' | 'owned' | 'locked' | 'featured' | 'new' | 'free' | 'favorites';
export type SortMode = 'featured' | 'name' | 'newest' | 'rarity' | 'recent';
export type CategoryFilter = 'all' | PetCategory;

export interface LibraryQuery {
  search: string;
  category: CategoryFilter;
  ownership: OwnershipFilter;
  sort: SortMode;
}

export const DEFAULT_QUERY: LibraryQuery = {
  search: '',
  category: 'all',
  ownership: 'all',
  sort: 'featured',
};

const RARITY_ORDER: Record<PetRarity, number> = {
  legendary: 4,
  epic: 3,
  rare: 2,
  uncommon: 1,
  common: 0,
};

export function matchesSearch(pet: LibraryPet, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const m = pet.manifest;
  return (
    m.name.toLowerCase().includes(q) ||
    m.description.toLowerCase().includes(q) ||
    m.category.includes(q) ||
    m.rarity.includes(q) ||
    m.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

export function matchesOwnership(pet: LibraryPet, filter: OwnershipFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'owned':
      return pet.state.unlocked;
    case 'locked':
      return !pet.state.unlocked;
    case 'featured':
      return pet.manifest.featured;
    case 'new':
      return pet.manifest.new;
    case 'free':
      return pet.manifest.free;
    case 'favorites':
      return pet.state.favorite;
  }
}

export function filterPets(pets: LibraryPet[], query: LibraryQuery): LibraryPet[] {
  return pets.filter(
    (pet) =>
      (query.category === 'all' || pet.manifest.category === query.category) &&
      matchesOwnership(pet, query.ownership) &&
      matchesSearch(pet, query.search)
  );
}

export function sortPets(pets: LibraryPet[], sort: SortMode): LibraryPet[] {
  const sorted = [...pets];
  switch (sort) {
    case 'featured':
      sorted.sort(
        (a, b) =>
          Number(b.manifest.featured) - Number(a.manifest.featured) ||
          a.manifest.number - b.manifest.number
      );
      break;
    case 'name':
      sorted.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
      break;
    case 'newest':
      sorted.sort(
        (a, b) =>
          Number(b.manifest.new) - Number(a.manifest.new) || b.manifest.number - a.manifest.number
      );
      break;
    case 'rarity':
      sorted.sort(
        (a, b) =>
          RARITY_ORDER[b.manifest.rarity] - RARITY_ORDER[a.manifest.rarity] ||
          a.manifest.number - b.manifest.number
      );
      break;
    case 'recent':
      sorted.sort((a, b) => {
        const ta = a.state.lastSelectedAt ?? '';
        const tb = b.state.lastSelectedAt ?? '';
        return tb.localeCompare(ta) || a.manifest.number - b.manifest.number;
      });
      break;
  }
  return sorted;
}

export function queryPets(pets: LibraryPet[], query: LibraryQuery): LibraryPet[] {
  return sortPets(filterPets(pets, query), query.sort);
}
