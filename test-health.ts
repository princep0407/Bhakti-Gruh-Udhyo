async function testHealth() {
  try {
    const response = await fetch('http://localhost:3000/api/health');
    const data = await response.json();
    console.log("Health Check Response:", data);
  } catch (error: any) {
    console.error("Health Check Failed:", error.message);
  }
}

testHealth();
