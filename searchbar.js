async function fetchUserData(userId) {
  const url = "https://developer.nps.gov/api/v1/"
  try {
    const response = await fetch(url);
    if (!response.ok) { // Check if the response status is okay (e.g., not 404, 500)
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const userData = await response.json()
    console.log('User Data:', userData);
    return userData;
  } catch (error) {
    console.error('Error fetching data:', error.message)
  }
}

// Call the function
fetchUserData(1);