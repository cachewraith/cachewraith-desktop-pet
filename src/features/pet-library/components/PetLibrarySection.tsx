import { useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_QUERY,
  queryPets,
  type CategoryFilter,
  type OwnershipFilter,
  type SortMode,
} from '../services/pet-filters';
import {
  devUnlockAll,
  loadLibrary,
  resolveActivePetId,
  selectActivePet,
  toggleFavorite,
} from '../services/pet-library.service';
import { PET_CATEGORIES, type LibraryPet } from '../types/pet-library.types';
import { logger } from '../../../utils/logger';
import { PetAnimationPreview } from './PetAnimationPreview';

const FILTERS: { id: OwnershipFilter; label: string }[] = [
  { id: 'all', label: 'All pets' },
  { id: 'owned', label: 'Unlocked' },
  { id: 'locked', label: 'Locked' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'featured', label: 'Featured' },
  { id: 'new', label: 'New' },
];

function readable(value: string): string {
  return value.replace(/(^|-)\w/g, (part) => part.replace('-', '').toUpperCase());
}

function PetCard({
  pet,
  active,
  onOpen,
  onFavorite,
}: {
  pet: LibraryPet;
  active: boolean;
  onOpen: () => void;
  onFavorite: () => void;
}) {
  const { manifest, state } = pet;
  return (
    <article className={`library-card ${active ? 'library-card-active' : ''}`}>
      <button
        type="button"
        className="library-card-main"
        onClick={onOpen}
        aria-label={`Preview ${manifest.name}`}
      >
        <div className="library-card-preview">
          <PetAnimationPreview manifest={manifest} playing={active} scale={3} />
          {active && <span className="library-active-pill">Active</span>}
          {!state.unlocked && <span className="library-lock">Locked</span>}
        </div>
        <span className="library-card-title-row">
          <strong>{manifest.name}</strong>
          <span className={`library-rarity library-rarity-${manifest.rarity}`}>
            {manifest.rarity}
          </span>
        </span>
        <span className="library-card-description">{manifest.description}</span>
      </button>
      <footer className="library-card-footer">
        <span>
          #{String(manifest.number).padStart(2, '0')} · {readable(manifest.category)}
        </span>
        <button
          type="button"
          className={`library-favorite ${state.favorite ? 'library-favorite-on' : ''}`}
          aria-label={`${state.favorite ? 'Remove' : 'Add'} ${manifest.name} ${state.favorite ? 'from' : 'to'} favorites`}
          aria-pressed={state.favorite}
          onClick={onFavorite}
        >
          {state.favorite ? '♥' : '♡'}
        </button>
      </footer>
    </article>
  );
}

function PetModal({
  pet,
  active,
  onClose,
  onSelect,
  onFavorite,
}: {
  pet: LibraryPet;
  active: boolean;
  onClose: () => void;
  onSelect: () => void;
  onFavorite: () => void;
}) {
  const { manifest, state, unlockHint } = pet;
  return (
    <div className="library-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="library-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="library-modal-close"
          onClick={onClose}
          aria-label="Close preview"
        >
          ×
        </button>
        <div className="library-modal-preview">
          <PetAnimationPreview manifest={manifest} playing scale={5} />
        </div>
        <div className="library-modal-copy">
          <div className="library-modal-title-row">
            <h3 id="library-modal-title">{manifest.name}</h3>
            <span className={`library-rarity library-rarity-${manifest.rarity}`}>
              {manifest.rarity}
            </span>
          </div>
          <p>{manifest.description}</p>
          <p className="library-lore">{manifest.lore}</p>
          <dl className="library-detail-list">
            <dt>Personality</dt>
            <dd>{manifest.personality}</dd>
            <dt>Category</dt>
            <dd>{readable(manifest.category)}</dd>
          </dl>
          {!state.unlocked && (
            <p className="library-unlock-note">Locked — {unlockHint ?? 'not yet available'}.</p>
          )}
          <div className="library-modal-actions">
            <button type="button" onClick={onSelect} disabled={!state.unlocked || active}>
              {active ? 'Currently active' : state.unlocked ? `Choose ${manifest.name}` : 'Locked'}
            </button>
            <button type="button" className="library-secondary-button" onClick={onFavorite}>
              {state.favorite ? '♥ Favorited' : '♡ Favorite'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function PetLibrarySection() {
  const [pets, setPets] = useState<LibraryPet[]>([]);
  const [activeId, setActiveId] = useState('cachewraith');
  const [selected, setSelected] = useState<LibraryPet | null>(null);
  const [search, setSearch] = useState(DEFAULT_QUERY.search);
  const [category, setCategory] = useState<CategoryFilter>(DEFAULT_QUERY.category);
  const [ownership, setOwnership] = useState<OwnershipFilter>(DEFAULT_QUERY.ownership);
  const [sort, setSort] = useState<SortMode>(DEFAULT_QUERY.sort);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [next, currentId] = await Promise.all([loadLibrary(), resolveActivePetId()]);
      setPets(next);
      setActiveId(currentId);
      const selectedPet = next.find((pet) => pet.manifest.id === selected?.manifest.id);
      if (selectedPet) setSelected(selectedPet);
    } catch (error) {
      logger.error('pet-library', 'failed to load library', error);
      setMessage('Could not load the Pet Library.');
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([loadLibrary(), resolveActivePetId()])
        .then(([next, currentId]) => {
          setPets(next);
          setActiveId(currentId);
        })
        .catch((error) => {
          logger.error('pet-library', 'failed to load library', error);
          setMessage('Could not load the Pet Library.');
        });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const shown = useMemo(
    () => queryPets(pets, { search, category, ownership, sort }),
    [pets, search, category, ownership, sort]
  );
  const select = async (pet: LibraryPet) => {
    try {
      await selectActivePet(pet);
      setActiveId(pet.manifest.id);
      setSelected(null);
      setMessage(`${pet.manifest.name} is now your desktop companion.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not select this pet.');
    }
  };
  const favorite = async (pet: LibraryPet) => {
    try {
      await toggleFavorite(pet.manifest.id, !pet.state.favorite);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update favorites.');
    }
  };

  return (
    <section className="pet-library" aria-labelledby="pet-library-heading">
      <header className="library-header">
        <div>
          <h2 id="pet-library-heading">Pet Library</h2>
          <p>Choose a companion for your desktop</p>
        </div>
        <div className="library-summary">
          <strong>{pets.length} pets</strong>
          <span>
            Active:{' '}
            {pets.find((pet) => pet.manifest.id === activeId)?.manifest.name ?? 'CacheWraith'}
          </span>
        </div>
      </header>
      <div className="library-toolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search pets…"
          aria-label="Search pets"
        />
        <select
          value={ownership}
          onChange={(event) => setOwnership(event.target.value as OwnershipFilter)}
          aria-label="Filter pets"
        >
          {FILTERS.map((filter) => (
            <option key={filter.id} value={filter.id}>
              {filter.label}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortMode)}
          aria-label="Sort pets"
        >
          <option value="featured">Sort: Featured</option>
          <option value="name">Sort: Name</option>
          <option value="newest">Sort: Newest</option>
          <option value="rarity">Sort: Rarity</option>
          <option value="recent">Sort: Recently used</option>
        </select>
      </div>
      <div className="library-categories" aria-label="Pet categories">
        <button
          type="button"
          className={category === 'all' ? 'library-chip library-chip-active' : 'library-chip'}
          onClick={() => setCategory('all')}
        >
          All
        </button>
        {PET_CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            className={category === item ? 'library-chip library-chip-active' : 'library-chip'}
            onClick={() => setCategory(item)}
          >
            {readable(item)}
          </button>
        ))}
      </div>
      {message && <p className="setting-message">{message}</p>}
      <p className="library-results">
        Showing {shown.length} of {pets.length} companions
      </p>
      {shown.length ? (
        <div className="library-grid">
          {shown.map((pet) => (
            <PetCard
              key={pet.manifest.id}
              pet={pet}
              active={activeId === pet.manifest.id}
              onOpen={() => setSelected(pet)}
              onFavorite={() => void favorite(pet)}
            />
          ))}
        </div>
      ) : (
        <div className="library-empty">No pets match those filters.</div>
      )}
      {import.meta.env.DEV && (
        <button
          type="button"
          className="library-dev-unlock"
          onClick={() => void devUnlockAll().then(refresh)}
        >
          Developer: unlock all pets
        </button>
      )}
      {selected && (
        <PetModal
          pet={selected}
          active={selected.manifest.id === activeId}
          onClose={() => setSelected(null)}
          onSelect={() => void select(selected)}
          onFavorite={() => void favorite(selected)}
        />
      )}
    </section>
  );
}
