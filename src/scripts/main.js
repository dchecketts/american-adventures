import { getParkData, getSearchResults } from './parkService.mjs';

const SEARCH_DEBOUNCE_MS = 200;
const SAVED_PARKS_KEY = 'savedParks';
const DEFAULT_PRICE_MAX = 200;
const DEFAULT_INITIAL_QUERY = 'park';

// Centralize classes so restyling is easy in one place.
// Any utility class that appears in templates should live here.
const CLASSES = {
  card: 'rounded-md bg-white p-5 shadow-sm transition duration-300 hover:shadow-md',
  cardLink: 'block md:flex md:gap-3',
  cardImage: 'aspect-square w-full rounded-md object-cover md:max-w-1/3',
  cardBody: 'mt-3 flex-1 md:mt-0 md:flex md:flex-col',
  cardTitle: 'text-lg font-bold',
  cardStates: 'text-sm text-gray-600',
  cardDescription: 'mt-2 text-sm text-gray-800',
  cardAdmission: 'mt-3 font-semibold',
  cardActionsRow: 'mt-4 flex justify-end gap-2',
  shareButton: 'rounded-md bg-lime-800 p-2 text-white transition hover:bg-lime-700',
  saveButtonActive: 'rounded-md border border-lime-800 bg-lime-800 p-2 text-white transition',
  saveButtonInactive: 'rounded-md border border-lime-800 bg-white p-2 text-lime-800 transition hover:bg-lime-50',
  icon: 'h-5 w-5',
  infoText: 'text-sm text-gray-600',
  sectionTitle: 'text-xl font-bold',
};

// Visual templates are centralized here so layout edits do not require changing
// search/filter business logic below.
const TEMPLATES = {
  parkCard: ({ park, isSaved, imageUrl, imageAlt, lowCost, highCost, saveIcon }) => `
  <article class="${CLASSES.card}">
    <a href="/park/?code=${park.parkCode}" class="${CLASSES.cardLink}">
      <img class="${CLASSES.cardImage}" src="${imageUrl}" alt="${imageAlt}"/>
      <div class="${CLASSES.cardBody}">
        <h3 class="${CLASSES.cardTitle}">${park.fullName}</h3>
        <p class="${CLASSES.cardStates}">${formatStatesForDisplay(park.states)}</p>
        <p class="${CLASSES.cardDescription}">${park.description}</p>
        <p class="${CLASSES.cardAdmission}">Admission: $${lowCost} - $${highCost}</p>
      </div>
    </a>
    <div class="${CLASSES.cardActionsRow}">
      <button
        type="button"
        data-action="share"
        data-park-code="${park.parkCode}"
        data-park-name="${park.fullName}"
        aria-label="Share ${park.fullName}"
        class="${CLASSES.shareButton}"
      >
        <img src="/icons/share.svg" alt="" class="${CLASSES.icon}" />
      </button>
      <button
        type="button"
        data-action="save"
        data-park-code="${park.parkCode}"
        data-park-name="${park.fullName}"
        data-saved="${String(isSaved)}"
        aria-pressed="${String(isSaved)}"
        aria-label="${isSaved ? 'Remove' : 'Save'} ${park.fullName}"
        class="${isSaved ? CLASSES.saveButtonActive : CLASSES.saveButtonInactive}"
      >
        <img src="${saveIcon}" alt="" class="${CLASSES.icon}" />
      </button>
    </div>
  </article>`,
  idleSavedSection: (cardsMarkup) => `
      <h2 class="${CLASSES.sectionTitle}">Your Saved Parks</h2>
      ${cardsMarkup}
    `,
  emptySearchPrompt: () => `<p class="${CLASSES.infoText}">Search for a park to see results.</p>`,
  noSearchMatches: () => `<p class="${CLASSES.infoText}">No parks matched your current search and filters.</p>`,
  noFilterMatches: () => `<p class="${CLASSES.infoText}">No results match your current filters.</p>`,
  savedEmpty: () => '<p class="text-sm text-gray-600">You have not saved any parks yet.</p>',
  savedLoading: () => '<p class="text-sm text-gray-600">Loading saved parks...</p>',
  savedLoadFailed: () => '<p class="text-sm text-gray-600">Saved parks could not be loaded right now.</p>',
};

const ALL_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'VI', 'GU', 'AS', 'MP'
];

const URL_PARAMS = {
  query: 'q',
  theme: 'theme',
  activity: 'activity',
  state: 'state',
  minPrice: 'minPrice',
  maxPrice: 'maxPrice'
};

// Runtime state container to keep async search/filter behavior deterministic.
const state = {
  searchQuery: '',
  allResults: [],
  savedParks: [],
  filterCatalog: [],
  pendingSearchCount: 0,
  lastFetchedQuery: null,
  priceBounds: { min: 0, max: DEFAULT_PRICE_MAX },
  activeFilters: {
    theme: '',
    activity: '',
    usState: '',
    minPrice: 0,
    maxPrice: DEFAULT_PRICE_MAX,
  }
};

let feedbackTimerId;

/** Convert strings like "world war ii" to "World War II". */
function toTitleCase(value) {
  const romanNumerals = /\b(i{1,3}|iv|v|vi{0,3}|ix|x)\b/i;
  return (value ?? '')
    .split(' ')
    .filter(Boolean)
    .map((word) => (romanNumerals.test(word) ? word.toUpperCase() : `${word[0]?.toUpperCase() ?? ''}${word.slice(1).toLowerCase()}`))
    .join(' ');
}

/** Parse NPS states field (e.g., "ID,MT,WY") into ["ID", "MT", "WY"]. */
function parseParkStates(statesString) {
  return (statesString ?? '')
    .split(',')
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);
}

/** Render states with spaces after commas for readable UI. */
function formatStatesForDisplay(statesString) {
  return parseParkStates(statesString).join(', ');
}

/** Keep a numeric value inside inclusive bounds. */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Get saved park codes from localStorage. */
function getSavedParks() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_PARKS_KEY) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

/** Check whether a park is already saved by park code. */
function isParkSaved(parkCode) {
  return getSavedParks().includes(parkCode);
}

/** Toggle saved status and persist it in localStorage. */
function toggleSavedPark(parkCode) {
  const savedParks = getSavedParks();
  const exists = savedParks.includes(parkCode);
  const nextSavedParks = exists
    ? savedParks.filter((code) => code !== parkCode)
    : [...savedParks, parkCode];

  localStorage.setItem(SAVED_PARKS_KEY, JSON.stringify(nextSavedParks));
  return !exists;
}

/** Show a short-lived feedback message near the top of the page. */
function setActionFeedback(message, isError = false) {
  const feedback = document.querySelector('#home-action-feedback');
  if (!feedback) return;

  clearTimeout(feedbackTimerId);
  feedback.textContent = message;
  feedback.classList.toggle('text-red-700', isError);
  feedback.classList.toggle('text-gray-600', !isError);

  feedbackTimerId = setTimeout(() => {
    feedback.textContent = '';
  }, 2500);
}

/** Copy plain text to clipboard with fallback for older environments. */
async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Keep going to fallback.
    }
  }

  const temporaryInput = document.createElement('textarea');
  temporaryInput.value = text;
  temporaryInput.setAttribute('readonly', '');
  temporaryInput.style.position = 'absolute';
  temporaryInput.style.left = '-9999px';
  document.body.appendChild(temporaryInput);
  temporaryInput.select();

  let copied;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  document.body.removeChild(temporaryInput);
  return copied;
}

/** Share a park URL via native share if possible, otherwise copy to clipboard. */
async function sharePark(parkCode, parkName) {
  const shareUrl = new URL(`/park/?code=${parkCode}`, window.location.origin).href;
  const shareData = { title: parkName, text: `Check out ${parkName}`, url: shareUrl };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      setActionFeedback('Shared successfully.');
      return;
    } catch (error) {
      if (error?.name === 'AbortError') {
        setActionFeedback('Share canceled.');
        return;
      }
    }
  }

  const copied = await copyTextToClipboard(shareUrl);
  setActionFeedback(copied ? 'Link copied to clipboard.' : 'Unable to share or copy link.', !copied);
}

/** Compute low/high admission fees from a park record. */
function getAdmissionRange(park) {
  const fees = park.entranceFees
    ?.map((fee) => Number(fee.cost))
    .filter((cost) => Number.isFinite(cost)) ?? [];

  if (!fees.length) return { low: 0, high: 0 };
  return { low: Math.min(...fees), high: Math.max(...fees) };
}

/** Check if park admission overlaps selected range by low OR high fee. */
function parkMatchesPriceRange(park, minPrice, maxPrice) {
  const { low, high } = getAdmissionRange(park);
  const lowInRange = low >= minPrice && low <= maxPrice;
  const highInRange = high >= minPrice && high <= maxPrice;
  return lowInRange || highInRange;
}

/** Calculate global min/max fee bounds for slider setup. */
function getPriceBounds(parks) {
  const source = parks.length ? parks : getFilterSourceParks();
  if (!source.length) return { min: 0, max: DEFAULT_PRICE_MAX };

  const values = source.flatMap((park) => {
    const range = getAdmissionRange(park);
    return [range.low, range.high];
  });

  const min = Math.floor(Math.min(...values));
  const max = Math.ceil(Math.max(...values));
  return {
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) && max > 1 ? max : DEFAULT_PRICE_MAX,
  };
}

/** Keep URL query params in sync with search/filter state. */
function updateUrlFromState() {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  const setOrDelete = (key, value) => {
    if (value === '' || value === null || value === undefined) {
      params.delete(key);
      return;
    }
    params.set(key, String(value));
  };

  setOrDelete(URL_PARAMS.query, state.searchQuery);
  setOrDelete(URL_PARAMS.theme, state.activeFilters.theme);
  setOrDelete(URL_PARAMS.activity, state.activeFilters.activity);
  setOrDelete(URL_PARAMS.state, state.activeFilters.usState);

  if (state.activeFilters.minPrice > state.priceBounds.min) {
    setOrDelete(URL_PARAMS.minPrice, state.activeFilters.minPrice);
  } else {
    params.delete(URL_PARAMS.minPrice);
  }

  if (state.activeFilters.maxPrice < state.priceBounds.max) {
    setOrDelete(URL_PARAMS.maxPrice, state.activeFilters.maxPrice);
  } else {
    params.delete(URL_PARAMS.maxPrice);
  }

  const nextQuery = params.toString();
  window.history.replaceState({}, '', nextQuery ? `${url.pathname}?${nextQuery}` : url.pathname);
}

/** Hydrate state from URL params on initial load. */
function hydrateStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  state.searchQuery = (params.get(URL_PARAMS.query) ?? '').trim();
  state.activeFilters.theme = (params.get(URL_PARAMS.theme) ?? '').trim().toLowerCase();
  state.activeFilters.activity = (params.get(URL_PARAMS.activity) ?? '').trim().toLowerCase();
  state.activeFilters.usState = (params.get(URL_PARAMS.state) ?? '').trim().toUpperCase();

  const minPrice = Number(params.get(URL_PARAMS.minPrice));
  const maxPrice = Number(params.get(URL_PARAMS.maxPrice));
  if (Number.isFinite(minPrice)) state.activeFilters.minPrice = minPrice;
  if (Number.isFinite(maxPrice)) state.activeFilters.maxPrice = maxPrice;
}

/** Update text label that shows selected price range. */
function updatePriceLabel() {
  const label = document.querySelector('#price-range-label');
  if (!label) return;
  label.textContent = `$${state.activeFilters.minPrice} - $${state.activeFilters.maxPrice}`;
}

/** Update dual-range slider CSS variables for highlighted band. */
function updatePriceTrack() {
  const sliderContainer = document.querySelector('#price-slider');
  if (!sliderContainer) return;

  const { min, max } = state.priceBounds;
  const span = Math.max(1, max - min);
  const minPercent = ((state.activeFilters.minPrice - min) / span) * 100;
  const maxPercent = ((state.activeFilters.maxPrice - min) / span) * 100;

  sliderContainer.style.setProperty('--min-percent', `${minPercent}%`);
  sliderContainer.style.setProperty('--max-percent', `${maxPercent}%`);
}

/** Sync slider DOM controls from state and clamp values safely. */
function syncPriceInputs() {
  const minInput = document.querySelector('#price-min');
  const maxInput = document.querySelector('#price-max');
  if (!minInput || !maxInput) return;

  const { min, max } = state.priceBounds;
  minInput.min = String(min);
  minInput.max = String(max);
  maxInput.min = String(min);
  maxInput.max = String(max);

  state.activeFilters.minPrice = clamp(state.activeFilters.minPrice, min, max);
  state.activeFilters.maxPrice = clamp(state.activeFilters.maxPrice, min, max);

  if (state.activeFilters.minPrice > state.activeFilters.maxPrice) {
    state.activeFilters.minPrice = state.activeFilters.maxPrice;
  }

  minInput.value = String(state.activeFilters.minPrice);
  maxInput.value = String(state.activeFilters.maxPrice);
  updatePriceLabel();
  updatePriceTrack();
}

/** Reset price filters to full current bounds. */
function applyDefaultPriceRange() {
  state.activeFilters.minPrice = state.priceBounds.min;
  state.activeFilters.maxPrice = state.priceBounds.max;
}

/** Determine whether any non-default filter is active. */
function hasActiveFilters() {
  const hasSelectionFilter = Boolean(state.activeFilters.theme)
    || Boolean(state.activeFilters.activity)
    || Boolean(state.activeFilters.usState);

  const hasPriceFilter = state.activeFilters.minPrice > state.priceBounds.min
    || state.activeFilters.maxPrice < state.priceBounds.max;

  return hasSelectionFilter || hasPriceFilter;
}

/** Build readable list of active filter phrases for context banner. */
function getActiveFilterSummaryParts() {
  const parts = [];
  if (state.activeFilters.theme) parts.push(`Theme: ${toTitleCase(state.activeFilters.theme)}`);
  if (state.activeFilters.activity) parts.push(`Activity: ${toTitleCase(state.activeFilters.activity)}`);
  if (state.activeFilters.usState) parts.push(`State: ${state.activeFilters.usState}`);

  const usingCustomPrice = state.activeFilters.minPrice > state.priceBounds.min
    || state.activeFilters.maxPrice < state.priceBounds.max;
  if (usingCustomPrice) {
    parts.push(`Admission: $${state.activeFilters.minPrice}-$${state.activeFilters.maxPrice}`);
  }
  return parts;
}

/** Render context banner for current query/filter scope. */
function renderSearchContextBanner(filteredCount, totalCount) {
  const banner = document.querySelector('#search-context-banner');
  if (!banner) return;

  const hasQuery = Boolean(state.searchQuery);
  const activeFilterParts = getActiveFilterSummaryParts();

  if (!hasQuery && !activeFilterParts.length) {
    banner.classList.add('hidden');
    banner.textContent = '';
    return;
  }

  const scope = hasQuery ? `Search: "${state.searchQuery}"` : 'Showing parks by filters';
  const countText = `Showing ${filteredCount} of ${totalCount} parks`;
  const detailText = activeFilterParts.length ? ` | ${activeFilterParts.join(' | ')}` : '';
  banner.textContent = `${scope} | ${countText}${detailText}`;
  banner.classList.remove('hidden');
}

/** Render a park card HTML block. */
function searchCardTemplate(park, isSaved = false) {
  const imageUrl = park.images?.[0]?.url ?? '';
  const imageAlt = park.images?.[0]?.altText ?? `${park.fullName} image`;
  const { low, high } = getAdmissionRange(park);
  const saveIcon = isSaved ? '/icons/save-filled.svg' : '/icons/save.svg';

  return TEMPLATES.parkCard({
    park,
    isSaved,
    imageUrl,
    imageAlt,
    lowCost: low.toFixed(2),
    highCost: high.toFixed(2),
    saveIcon,
  });
}

/** Debounce helper for throttling high-frequency events like typing. */
function debounce(fn, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/** Check whether one park matches all active filters. */
function parkMatchesFilters(park, filters) {
  const themeMatch = !filters.theme || (park.topics ?? []).some((topic) => topic.name.toLowerCase() === filters.theme);
  const activityMatch = !filters.activity || (park.activities ?? []).some((activity) => activity.name.toLowerCase() === filters.activity);
  // State filter matches if the selected two-letter code exists in the park's
  // comma-separated states field (e.g., Yellowstone matches ID, MT, and WY).
  const stateMatch = !filters.usState || parseParkStates(park.states).includes(filters.usState);
  const priceMatch = parkMatchesPriceRange(park, filters.minPrice, filters.maxPrice);
  return themeMatch && activityMatch && stateMatch && priceMatch;
}

/** Return filtered results excluding saved parks to avoid duplicate cards. */
function getFilteredResults() {
  // If a park is saved, we intentionally hide it from search cards so users
  // do not see the same park duplicated in both lists.
  const savedCodes = getSavedParks();
  return state.allResults.filter((park) => parkMatchesFilters(park, state.activeFilters) && !savedCodes.includes(park.parkCode));
}

/** Unique + alphabetic sort helper. */
function getUniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

/** Determine source dataset for filter options. */
function getFilterSourceParks() {
  return state.filterCatalog.length ? state.filterCatalog : state.allResults;
}

/** Rebuild filter dropdown options and keep current selections valid. */
function updateFilterOptions() {
  const themeSelect = document.querySelector('#theme-filter');
  const activitySelect = document.querySelector('#activity-filter');
  const stateSelect = document.querySelector('#state-filter');
  if (!themeSelect || !activitySelect || !stateSelect) return;

  const sourceParks = getFilterSourceParks();
  const themes = getUniqueSorted(sourceParks.flatMap((park) => (park.topics ?? []).map((topic) => topic.name.trim())).filter(Boolean));
  const activities = getUniqueSorted(sourceParks.flatMap((park) => (park.activities ?? []).map((activity) => activity.name.trim())).filter(Boolean));
  const states = getUniqueSorted([...ALL_STATE_CODES, ...sourceParks.flatMap((park) => parseParkStates(park.states))]);

  themeSelect.innerHTML = `<option value="">All themes</option>${themes.map((item) => `<option value="${item.toLowerCase()}">${item}</option>`).join('')}`;
  activitySelect.innerHTML = `<option value="">All activities</option>${activities.map((item) => `<option value="${item.toLowerCase()}">${item}</option>`).join('')}`;
  stateSelect.innerHTML = `<option value="">All states</option>${states.map((item) => `<option value="${item}">${item}</option>`).join('')}`;

  if (state.activeFilters.theme && !themes.some((item) => item.toLowerCase() === state.activeFilters.theme)) {
    state.activeFilters.theme = '';
  }
  if (state.activeFilters.activity && !activities.some((item) => item.toLowerCase() === state.activeFilters.activity)) {
    state.activeFilters.activity = '';
  }
  if (state.activeFilters.usState && !states.includes(state.activeFilters.usState)) {
    state.activeFilters.usState = '';
  }

  themeSelect.value = state.activeFilters.theme;
  activitySelect.value = state.activeFilters.activity;
  stateSelect.value = state.activeFilters.usState;

  state.priceBounds = getPriceBounds(state.allResults);
  if (!state.searchQuery && !state.allResults.length) {
    applyDefaultPriceRange();
  }
  syncPriceInputs();
}

/** Render main results area, including idle saved-park view. */
function renderSearchResults() {
  const container = document.querySelector('#search-results');
  const savedSection = document.querySelector('.saved-parks-section');
  if (!container) return;

  const isIdle = !state.searchQuery && !hasActiveFilters();
  if (isIdle && state.savedParks.length) {
    if (savedSection) savedSection.classList.add('hidden');
    renderSearchContextBanner(state.savedParks.length, state.savedParks.length);
    container.innerHTML = TEMPLATES.idleSavedSection(
      state.savedParks.map((park) => searchCardTemplate(park, true)).join('')
    );
    return;
  }

  if (savedSection) savedSection.classList.remove('hidden');

  if (!state.allResults.length) {
    renderSearchContextBanner(0, 0);
    container.innerHTML = hasActiveFilters() || state.searchQuery
      ? TEMPLATES.noSearchMatches()
      : TEMPLATES.emptySearchPrompt();
    return;
  }

  const filtered = getFilteredResults();
  renderSearchContextBanner(filtered.length, state.allResults.length);
  if (!filtered.length) {
    container.innerHTML = TEMPLATES.noFilterMatches();
    return;
  }

  container.innerHTML = filtered.map((park) => searchCardTemplate(park, isParkSaved(park.parkCode))).join('');
}

/** Render lower saved parks section and cache objects for idle view. */
async function renderSavedParks() {
  const savedContainer = document.querySelector('#saved-parks-results');
  if (!savedContainer) return;

  const savedCodes = getSavedParks();
  if (!savedCodes.length) {
    state.savedParks = [];
    savedContainer.innerHTML = TEMPLATES.savedEmpty();
    return;
  }

  savedContainer.innerHTML = TEMPLATES.savedLoading();
  const responses = await Promise.allSettled(savedCodes.map((code) => getParkData(code)));
  const parks = responses
    .filter((result) => result.status === 'fulfilled' && result.value)
    .map((result) => result.value);

  state.savedParks = parks;
  if (!parks.length) {
    savedContainer.innerHTML = TEMPLATES.savedLoadFailed();
    return;
  }

  savedContainer.innerHTML = parks.map((park) => searchCardTemplate(park, true)).join('');
}

/** Fetch park search results from API. Empty query means unscoped park list. */
async function searchParks(searchQuery) {
  return getSearchResults(searchQuery ?? '');
}

/** Preload broad dataset for filter options and initial slider bounds. */
async function preloadFilterCatalog() {
  try {
    const catalog = await getSearchResults(DEFAULT_INITIAL_QUERY);
    state.filterCatalog = Array.isArray(catalog) ? catalog : [];
  } catch (error) {
    console.warn('Filter catalog preload failed:', error);
    state.filterCatalog = [];
  }
}

/** Toggle loading indicator visibility based on active request count. */
function setSearchLoadingVisibility() {
  const loadingElement = document.querySelector('#search-loading');
  if (!loadingElement) return;

  const isLoading = state.pendingSearchCount > 0;
  loadingElement.classList.toggle('hidden', !isLoading);
  loadingElement.classList.toggle('flex', isLoading);
  loadingElement.setAttribute('aria-busy', String(isLoading));
}

function beginSearchLoading() {
  state.pendingSearchCount += 1;
  setSearchLoadingVisibility();
}

function endSearchLoading() {
  state.pendingSearchCount = Math.max(0, state.pendingSearchCount - 1);
  setSearchLoadingVisibility();
}

/** Attach filter input listeners and delegate updates through callback. */
function setupFilterControls(onFiltersChanged) {
  const themeSelect = document.querySelector('#theme-filter');
  const activitySelect = document.querySelector('#activity-filter');
  const stateSelect = document.querySelector('#state-filter');
  const minPriceInput = document.querySelector('#price-min');
  const maxPriceInput = document.querySelector('#price-max');
  const clearButton = document.querySelector('#clear-filters');
  if (!themeSelect || !activitySelect || !stateSelect || !minPriceInput || !maxPriceInput || !clearButton) return;

  themeSelect.addEventListener('change', async (event) => {
    state.activeFilters.theme = event.target.value;
    await onFiltersChanged();
  });

  activitySelect.addEventListener('change', async (event) => {
    state.activeFilters.activity = event.target.value;
    await onFiltersChanged();
  });

  stateSelect.addEventListener('change', async (event) => {
    state.activeFilters.usState = event.target.value;
    await onFiltersChanged();
  });

  minPriceInput.addEventListener('input', async (event) => {
    const value = Number(event.target.value);
    state.activeFilters.minPrice = clamp(value, state.priceBounds.min, state.activeFilters.maxPrice);
    syncPriceInputs();
    await onFiltersChanged();
  });

  maxPriceInput.addEventListener('input', async (event) => {
    const value = Number(event.target.value);
    state.activeFilters.maxPrice = clamp(value, state.activeFilters.minPrice, state.priceBounds.max);
    syncPriceInputs();
    await onFiltersChanged();
  });

  clearButton.addEventListener('click', async () => {
    state.activeFilters.theme = '';
    state.activeFilters.activity = '';
    state.activeFilters.usState = '';
    applyDefaultPriceRange();
    themeSelect.value = '';
    activitySelect.value = '';
    stateSelect.value = '';
    syncPriceInputs();
    await onFiltersChanged();
  });
}

/** Handle share/save buttons with event delegation for dynamic cards. */
function setupCardActions() {
  const searchResults = document.querySelector('#search-results');
  const savedResults = document.querySelector('#saved-parks-results');

  const handleActionClick = async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    event.preventDefault();
    const action = button.dataset.action;
    const parkCode = button.dataset.parkCode;
    const parkName = button.dataset.parkName ?? 'this park';
    if (!parkCode) return;

    if (action === 'share') {
      await sharePark(parkCode, parkName);
      return;
    }

    if (action === 'save') {
      const isNowSaved = toggleSavedPark(parkCode);
      setActionFeedback(isNowSaved ? 'Park saved.' : 'Park removed from saved list.');
      await renderSavedParks();
      renderSearchResults();
    }
  };

  searchResults?.addEventListener('click', handleActionClick);
  savedResults?.addEventListener('click', handleActionClick);
}

/** Main app bootstrap: hydrate, wire events, and run initial render/search. */
async function init() {
  const searchField = document.querySelector('#search');
  const searchButton = document.querySelector('#search-submit');
  if (!searchField) return;

  hydrateStateFromUrl();
  searchField.value = state.searchQuery;

  let lastRequestId = 0;

  const runSearch = async (query, requestId = 0) => {
    beginSearchLoading();
    try {
      const parks = await searchParks(query);
      if (requestId && requestId !== lastRequestId) return;

      state.allResults = parks;
      state.lastFetchedQuery = query;
      updateFilterOptions();
      renderSearchResults();
      updateUrlFromState();
    } catch (error) {
      console.error('Search failed:', error);
      state.allResults = [];
      state.lastFetchedQuery = query;
      updateFilterOptions();
      renderSearchResults();
      updateUrlFromState();
    } finally {
      endSearchLoading();
    }
  };

  const debouncedSearch = debounce((query) => {
    const requestId = ++lastRequestId;
    runSearch(query, requestId);
  }, SEARCH_DEBOUNCE_MS);

  const submitSearch = async () => {
    const query = searchField.value.trim();
    state.searchQuery = query;
    const requestId = ++lastRequestId;

    if (!query && !hasActiveFilters()) {
      state.allResults = [];
      state.lastFetchedQuery = null;
      updateFilterOptions();
      renderSearchResults();
      updateUrlFromState();
      return;
    }

    await runSearch(query, requestId);
  };

  const handleFiltersChanged = async () => {
    if (!state.searchQuery && !hasActiveFilters()) {
      state.allResults = [];
      state.lastFetchedQuery = null;
      updateFilterOptions();
      renderSearchResults();
      updateUrlFromState();
      return;
    }

    if (!state.searchQuery && hasActiveFilters()) {
      if (state.lastFetchedQuery !== '') {
        await runSearch('');
        return;
      }
      renderSearchResults();
      updateUrlFromState();
      return;
    }

    renderSearchResults();
    updateUrlFromState();
  };

  setupFilterControls(handleFiltersChanged);
  setupCardActions();
  await Promise.all([renderSavedParks(), preloadFilterCatalog()]);

  if (state.filterCatalog.length && !state.allResults.length) {
    state.priceBounds = getPriceBounds(state.filterCatalog);
    applyDefaultPriceRange();
  }

  updateFilterOptions();

  searchButton?.addEventListener('click', async (event) => {
    event.preventDefault();
    await submitSearch();
  });

  searchField.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    await submitSearch();
  });

  searchField.addEventListener('input', async (event) => {
    const query = event.target.value.trim();
    state.searchQuery = query;

    if (!query) {
      lastRequestId += 1;
      if (hasActiveFilters()) {
        await runSearch('');
      } else {
        state.allResults = [];
        state.lastFetchedQuery = null;
        updateFilterOptions();
        renderSearchResults();
        updateUrlFromState();
      }
      return;
    }

    debouncedSearch(query);
    updateUrlFromState();
  });

  if (state.searchQuery) {
    await runSearch(state.searchQuery);
  } else {
    state.searchQuery = '';
    state.allResults = [];
    updateFilterOptions();
    renderSearchResults();
    updateUrlFromState();
  }
}

init();
