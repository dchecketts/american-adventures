import { getParkData } from './parkService.mjs';
// Import the connection to the API.

const SAVED_PARKS_KEY = 'savedParks';
let feedbackTimerId;

// Keep visual utility classes centralized so layout/styling changes are easy.
const CLASSES = {
  sectionTitle: 'mb-2 text-xl font-semibold',
  mutedText: 'text-sm text-gray-600',
  bodyText: 'text-sm text-gray-700',
  tagList: 'flex flex-wrap gap-2',
  activityTag: 'rounded-full bg-lime-100 px-3 py-1 text-sm',
  topicTag: 'rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800',
  hoursRow: 'flex justify-between gap-3',
  entranceCard: 'mb-4 rounded-md border-l-4 border-lime-600 bg-gray-50 p-3',
  galleryCard: 'overflow-hidden rounded-md shadow-md',
  galleryImage: 'h-48 w-full object-cover transition duration-300 hover:scale-105',
  galleryCaption: 'bg-white p-3',
  actionSaved: 'bg-lime-800 text-white',
  actionUnsavedBorder: 'border-lime-800 text-lime-800 bg-white',
};

// Keep repeated HTML snippets centralized so render functions stay data-focused.
const TEMPLATES = {
  sectionTitle: (text) => `<h3 class="${CLASSES.sectionTitle}">${text}</h3>`,
  sectionTitleLarge: (text) => `<h2 class="mb-4 text-2xl font-semibold">${text}</h2>`,
  emptyMessage: (text) => `<p class="${CLASSES.mutedText}">${text}</p>`,
  feeItem: (fee) => `<li><span class="font-semibold">$${Number(fee.cost).toFixed(2)}</span> - ${fee.title}</li>`,
  activityItem: (activity) => `<li class="${CLASSES.activityTag}">${activity.name}</li>`,
  topicItem: (topic) => `<li class="${CLASSES.topicTag}">${topic.name}</li>`,
  hoursItem: (day, value) => `<li class="${CLASSES.hoursRow}"><span class="font-semibold capitalize">${day}</span><span>${value}</span></li>`,
  entranceItem: (entrance) => `
      <div class="${CLASSES.entranceCard}">
        <h4 class="font-semibold text-lime-900">${entrance.name}</h4>
        <p class="mt-1 ${CLASSES.bodyText}">${entrance.description}</p>
      </div>
    `,
  galleryItem: (img) => `
      <figure class="${CLASSES.galleryCard}">
        <img
          src="${img.url}"
          alt="${img.altText}"
          class="${CLASSES.galleryImage}"
        />
        <figcaption class="${CLASSES.galleryCaption}">
          <p class="text-sm font-semibold">${img.title}</p>
          <p class="text-xs text-gray-600">${img.caption}</p>
          <p class="mt-1 text-xs text-gray-500">Credit: ${img.credit}</p>
        </figcaption>
      </figure>
    `,
};

function parseParkStates(statesString) {
  return (statesString ?? '')
    .split(',')
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);
}

function formatStatesForDisplay(statesString) {
  return parseParkStates(statesString).join(', ');
}

// Render a simple titled section with an empty-state message.
function renderEmptySection(element, title, message) {
  element.innerHTML = `
    ${TEMPLATES.sectionTitle(title)}
    ${TEMPLATES.emptyMessage(message)}
  `;
}

function getSavedParks() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_PARKS_KEY) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function isParkSaved(parkCode) {
  return getSavedParks().includes(parkCode);
}

function setSavedButtonState(saveButton, parkCode) {
  const saved = isParkSaved(parkCode);
  saveButton.dataset.saved = String(saved);
  saveButton.setAttribute('aria-pressed', String(saved));
  saveButton.textContent = saved ? 'Saved' : 'Save';
  saveButton.classList.toggle('bg-lime-800', saved);
  saveButton.classList.toggle('text-white', saved);
  saveButton.classList.toggle('border-lime-800', !saved);
  saveButton.classList.toggle('text-lime-800', !saved);
  saveButton.classList.toggle('bg-white', !saved);
}

function toggleSavedPark(parkCode) {
  const savedParks = getSavedParks();
  const exists = savedParks.includes(parkCode);
  const nextSavedParks = exists
    ? savedParks.filter((code) => code !== parkCode)
    : [...savedParks, parkCode];

  localStorage.setItem(SAVED_PARKS_KEY, JSON.stringify(nextSavedParks));
  return !exists;
}

function setActionFeedback(message, isError = false) {
  const feedback = document.querySelector('#action-feedback');
  if (!feedback) return;

  clearTimeout(feedbackTimerId);
  feedback.textContent = message;
  feedback.classList.toggle('text-red-700', isError);
  feedback.classList.toggle('text-gray-600', !isError);

  feedbackTimerId = setTimeout(() => {
    feedback.textContent = '';
  }, 2500);
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Continue to the fallback copy method below.
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

function initParkActions(parkInfo) {
  const shareButton = document.querySelector('#share-park');
  const saveButton = document.querySelector('#save-park');

  if (saveButton) {
    setSavedButtonState(saveButton, parkInfo.parkCode);
    saveButton.addEventListener('click', () => {
      const isNowSaved = toggleSavedPark(parkInfo.parkCode);
      setSavedButtonState(saveButton, parkInfo.parkCode);
      setActionFeedback(isNowSaved ? 'Park saved.' : 'Park removed from saved list.');
    });
  }

  if (shareButton) {
    shareButton.addEventListener('click', async () => {
      const shareUrl = window.location.href;
      const shareData = {
        title: parkInfo.fullName,
        text: `Check out ${parkInfo.fullName}`,
        url: shareUrl
      };

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
      if (copied) {
        setActionFeedback('Link copied to clipboard.');
      } else {
        setActionFeedback('Unable to share or copy link.', true);
      }
    });
  }
}

function renderAdmission(parkInfo) {
  const admissionElement = document.querySelector('#admission');
  if (!admissionElement) return;

  const fees = parkInfo.entranceFees ?? [];
  if (!fees.length) {
    renderEmptySection(admissionElement, 'Admission Fees', 'No admission fee information listed.');
    return;
  }

  const feeMarkup = fees.map((fee) => TEMPLATES.feeItem(fee)).join('');

  admissionElement.innerHTML = `
    ${TEMPLATES.sectionTitle('Admission Fees')}
    <ul class="space-y-1 text-sm text-gray-700">${feeMarkup}</ul>
  `;
}

function renderActivities(parkInfo) {
  const activitiesElement = document.querySelector('#activities');
  if (!activitiesElement) return;

  const activities = parkInfo.activities ?? [];
  if (!activities.length) {
    renderEmptySection(activitiesElement, 'Activities', 'No activities listed.');
    return;
  }

  const activityMarkup = activities.slice(0, 16).map((activity) => TEMPLATES.activityItem(activity)).join('');

  activitiesElement.innerHTML = `
    ${TEMPLATES.sectionTitle('Activities')}
    <ul class="${CLASSES.tagList} text-gray-700">${activityMarkup}</ul>
  `;
}

function renderOperatingHours(parkInfo) {
  const hoursElement = document.querySelector('#hours');
  if (!hoursElement) return;

  const hoursData = parkInfo.operatingHours?.[0];
  const standardHours = hoursData?.standardHours;
  if (!standardHours) {
    renderEmptySection(hoursElement, 'Operating Hours', 'No operating hours listed.');
    return;
  }

  const orderedDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const hoursMarkup = orderedDays.map((day) => TEMPLATES.hoursItem(day, standardHours[day])).join('');

  const description = hoursData.description ? `<p class="mb-3 text-sm text-gray-600">${hoursData.description}</p>` : '';
  hoursElement.innerHTML = `
    ${TEMPLATES.sectionTitle('Operating Hours')}
    ${description}
    <ul class="space-y-1 text-sm text-gray-700">${hoursMarkup}</ul>
  `;
}

function renderWeather(parkInfo) {
  const weatherElement = document.querySelector('#weather');
  if (!weatherElement) return;

  const weatherInfo = parkInfo.weatherInfo?.trim();
  if (!weatherInfo) {
    renderEmptySection(weatherElement, 'Weather', 'No weather information listed.');
    return;
  }

  weatherElement.innerHTML = `
    ${TEMPLATES.sectionTitle('Weather')}
    <p class="${CLASSES.bodyText}">${weatherInfo}</p>
  `;
}

function renderGallery(parkInfo) {
  const gallerySection = document.querySelector('#gallery');
  if (!gallerySection) return;

  const images = parkInfo.images ?? [];
  if (!images.length) {
    gallerySection.innerHTML = `
      ${TEMPLATES.sectionTitleLarge('Gallery')}
      ${TEMPLATES.emptyMessage('No images available.')}
    `;
    return;
  }

  const galleryGrid = images.slice(0, 9).map((img) => TEMPLATES.galleryItem(img)).join('');

  gallerySection.innerHTML = `
    ${TEMPLATES.sectionTitleLarge('Gallery')}
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">${galleryGrid}</div>
  `;
}

function renderTopics(parkInfo) {
  const topicsElement = document.querySelector('#topics');
  if (!topicsElement) return;

  const topics = parkInfo.topics ?? [];
  if (!topics.length) {
    renderEmptySection(topicsElement, 'Park Themes', 'No themes listed.');
    return;
  }

  const topicMarkup = topics.slice(0, 12).map((topic) => TEMPLATES.topicItem(topic)).join('');

  topicsElement.innerHTML = `
    ${TEMPLATES.sectionTitle('Park Themes')}
    <ul class="${CLASSES.tagList}">${topicMarkup}</ul>
  `;
}

function renderEntrances(parkInfo) {
  const entrancesElement = document.querySelector('#entrances');
  if (!entrancesElement) return;

  const entrances = parkInfo.operatingHours ?? [];
  if (!entrances.length) {
    renderEmptySection(entrancesElement, 'Entrance Stations', 'No entrance information available.');
    return;
  }

  const entranceMarkup = entrances.map((entrance) => TEMPLATES.entranceItem(entrance)).join('');

  entrancesElement.innerHTML = `
    <h3 class="mb-3 text-xl font-semibold">Entrance Stations</h3>
    <div>${entranceMarkup}</div>
  `;
}

// TODO
// 1. Get park code from URL search param - Done
// 2. Return data from API query - Done
// 3. Set default search param result - Done

async function init() {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  let parkCode = urlParams.get('code');
  if (!parkCode) {
    parkCode = 'yell';
  }

  const parkInfo = await getParkData(parkCode);
  console.log('Park Info:', parkInfo);

  // Set basic information (Page Title, Park Name)
  const titleElement = document.querySelector('title');
  titleElement.innerText = `American Adventures | ${parkInfo.fullName}`;

  // Name & Designation
  const parkNameElement = document.querySelector('#name h2');
  const parkDesignationElement = document.querySelector('#name span');
  const parkStatesElement = document.querySelector('#states');
  parkNameElement.innerHTML = parkInfo.name;
  parkDesignationElement.innerHTML = parkInfo.designation;
  if (parkStatesElement) {
    parkStatesElement.textContent = formatStatesForDisplay(parkInfo.states);
  }

  // Latitude & Longitude
  const parkLatLong = document.querySelector('#latLong');
  parkLatLong.innerHTML = `<a href="https://www.google.com/maps/search/?api=1&query=${parkInfo.latitude}%2C${parkInfo.longitude}">${parkInfo.latitude}, ${parkInfo.longitude}</a>`;

  // Description
  const parkDescriptionElement = document.querySelector('#description');
  parkDescriptionElement.innerHTML = parkInfo.description;

  // Contact
  const contact = document.querySelector('#contact');
  // Phone
  const phoneContact = contact.querySelector(':nth-child(1)');
  phoneContact.innerHTML = `<a href="tel:${parkInfo.contacts.phoneNumbers[0].phoneNumber}"><img src="/icons/phone.svg" alt="Phone" class="bg-lime-900 text-white rounded-full p-1"></a>`;
  // Address
  const addressContact = contact.querySelector(':nth-child(2)');
  addressContact.innerHTML = `<a href="${parkInfo.directionsUrl}"><img src="/icons/map.svg" alt="Directions" class="bg-lime-900 text-white rounded-full p-1"></a>`;
  // Website
  const websiteContact = contact.querySelector(':nth-child(3)');
  websiteContact.innerHTML = `<a href="${parkInfo.url}"><img src="/icons/link.svg" alt="Website" class="bg-lime-900 text-white rounded-full p-1"></a>`;

  initParkActions(parkInfo);

  // Additional details
  renderAdmission(parkInfo);
  renderActivities(parkInfo);
  renderOperatingHours(parkInfo);
  renderWeather(parkInfo);
  renderGallery(parkInfo);
  renderTopics(parkInfo);
  renderEntrances(parkInfo);
}

init();
