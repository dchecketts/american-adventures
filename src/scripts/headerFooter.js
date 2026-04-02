// Since the header and footer are universal, I decided to consolidate them into a single JS file to be linked to each page

async function initHeaderFooter() {
  const header = document.querySelector('header');
  const footer = document.querySelector('footer');
  if (header) {
    header.innerHTML = `<h1 class="text-5xl font-bold"><a href="/">American Adventures</a></h1>`;
  }
  if (footer) {
    footer.innerHTML = `<p>&copy 2026 American Adventures</p>`;
  }
}

initHeaderFooter();
