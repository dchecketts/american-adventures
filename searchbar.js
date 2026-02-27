async function fetchUserData(userId) {
  const url = "https://developer.nps.gov/api/v1/"
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const userData = await response.json()
    console.log('User Data:', userData);
    return userData;
  } catch (error) {
    console.error('Error fetching data:', error.message)
  }
}

  function searchList(list, q) {
    function searchCallback(item) {
      return (
        item.name.toLowerCase().includes(q.toLowerCase()) ||
        item.description.toLowerCase().includes(q.toLowerCase()) ||
        item.tags.find((tag) => tag.toLowerCase().includes(q.toLowerCase()))
      );
    }
    const filtered = list.filter(searchCallback);

    const sorted = filtered.sort((a, b) => a.location > b.budget);
    return sorted;
  }
  console.log(searchList(parks, "location"));
  console.log(searchList(parks, "budget"));

fetchUserData(1);