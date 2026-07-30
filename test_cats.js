const axios = require('axios');

async function testCats() {
    try {
        const res = await axios.get('http://localhost:7860/api/categories', { timeout: 5000 });
        console.log("Status:", res.status);
        console.log("Categories count:", res.data?.categories?.length);
    } catch (e) {
        if (e.response) {
            console.error("Failed with status:", e.response.status);
            console.error("Data:", e.response.data);
        } else {
            console.error("Failed:", e.message);
        }
    }
}
testCats();
