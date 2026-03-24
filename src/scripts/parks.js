import { getParkData } from './parkService.mjs';
// Import the connection to the API.

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
  parkNameElement.innerHTML = parkInfo.name;
  parkDesignationElement.innerHTML = parkInfo.designation;

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
  phoneContact.innerHTML = `<a href="tel:${parkInfo.contacts.phoneNumbers[0].phoneNumber}"><img src="../public/icons/phone.svg" alt="Phone" class="bg-lime-900 text-white rounded-full p-1"></a>`;
  // Address
  const addressContact = contact.querySelector(':nth-child(2)');
  addressContact.innerHTML = `<a href="${parkInfo.directionsUrl}"><img src="../public/icons/map.svg" alt="Directions" class="bg-lime-900 text-white rounded-full p-1"></a>`;
  // Website
  const websiteContact = contact.querySelector(':nth-child(3)');
  websiteContact.innerHTML = `<a href="${parkInfo.url}"><img src="../public/icons/link.svg" alt="Website" class="bg-lime-900 text-white rounded-full p-1"></a>`;
}

init();
