// Since the header and footer are universal, I decided to consolidate them into a single JS file to be linked to each page

async function initHeaderFooter() {
  const header = document.querySelector('header');
  const footer = document.querySelector('footer');

  function createHeader() {
    return `
        <header>
          <h1 class="font-bold text-5xl text-center bg-lime-900 text-white p-10">American Adventures</h1>
        </header>`;
  }

  function createFooter() {
    return `
    <footer class="font-semibold text-center bg-stone-600 text-white p-5">
      <p>&copy 2026 American Adventures</p>
    </footer>`;
  }

  if (header) header.outerHTML = createHeader();
  if (footer) footer.outerHTML = createFooter();
}

initHeaderFooter();
