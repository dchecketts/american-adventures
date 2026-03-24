import { getParkData } from './parkService.mjs';

// Import the connection to the API.

// Template for
function searchCardTemplate(info, highCost, lowCost) {
  return `
<a href="/park/?code=${info.parkCode}" class="w-full">
  <article
      class="transform rounded-md bg-white p-5 transition duration-300 hover:scale-110 hover:shadow-lg">
    <img src="${info.images[0].url}" alt="${info.images[0].altText}"/>
    <h3 class="font-bold text-lg">${info.fullName}</h3>
    <p class="text-sm text-gray-600">${info.states}</p>
    <p>${info.description}</p>
    <p class="font-semibold">Admission: $${highCost} - $${lowCost}</p>
  </article>
</a>`;
}

async function init() {
  const parkInfo = await getParkData('yell');
  console.log(parkInfo);
}

init();
