# README

This is a site for searching the NPS API to find information on different parks and activities!

## American Adventures

Search through the National Parks of the United States of America to find activities!

## TODOS

- [ ] One detailed, validated form (Search, filter options)
- [ ] Local storage (Search history)
- [ ] Fetch data from an API (NPS API)
- [ ] Drop-down menu (Filter options)
- [ ] CSS animation (Cards, drop-downs)
- [ ] Responsive design (Mobile > Desktop)
- [ ] Good UX & accesibility (Make the page capable of working if the CSS doesn't work)
- [ ] URL parameters (Click on a card and see a page all about the national park)
- [ ] Use modules (NPM, Vite, Husky)

- [ ] Build search page (Live search, filters for states)
- [ ] Build template for search result card (Display park name, a short description, states, and admission price)
- [ ] Build a page to display more information about the park (Name, description, states, admission price, full list of
      amenities, full list of activities, use the URL to store parameters, i.e. '
      american-advendures.netlify.app/?park=yell')
- [ ] JSON file listing each park's full name and the park's associated code
- [ ] JavaScript to communicate with NPS API, take user input and use async/await `fetch` to send the assosciated code
      to the API
- [x] Make info cards on search page grow on hover
- [ ] Make dropdowns move smoothly

## Features

- Vite
- Husky (See Fixes if you have issues with GitHub Desktop on Windows)
- Prettier
- Lint-staged
- Development environment commands (See Basic Commands)
- GitHub Action to deploy to GitHub Pages

## Basic Commands

- `npm run dev`: Run an instance that updates live to see what your changes to HTML, CSS, and JS do to the site.
- `npm run tidy`: Format the code with Prettier.

- `npm run dev-tailwind`: Same as the `dev` version, but for working with TailwindCSS.
- `npm run tidy-tailwind`: Same as `tidy`, but for TailwindCSS.

- `npm run build`: Bundle and build the site, as well as minimize and consolidate all CSS (Including Tailwind) and JS.

## File Organization

- CSS files are stored in **src/styles**.
- JS is stored in **src/scripts**.
- _Except_ for the homepage, each page is a folder.
- Main page folders such as "About" or "FAQ" are folders within src. Inside each folder is an index.html to create a clean URL. (i.e. example.com/about/ instead of example.com/about.html)
- Images go under **src/public/images**. Vite finds the public directory and then copies it's contents directly to the
  dist directory. Images can be linked to on a page by referring to them as if they were _directly_ in the src
  directory. This works in both `dev` commands, as well as the finalized `build`.

## Fixes

I personally like to use GitHub Desktop on Windows to manage commits instead of the terminal. As such, there's a few differences when it comes to pre-commits such as Husky. If you encounter errors as I did, below is how to fix it.

1. Confirm that Node.js is installed correctly. It should be found at C:/"Program Files"/nodejs
2. Navigate to C:/Users/[username] and find a directory named .config.
3. Create a directory named husky.
4. Create a file named init.sh, containing the line
   `export PATH="$PATH:/c/Program Files/Git/bin:/c/Program Files/nodejs"`. I used VS Code to do so. This helps GitHub
   Desktop to find where Git and Node.js are located.
5. That's it! GitHub Desktop should now be able to create and push your commits without issue now.
