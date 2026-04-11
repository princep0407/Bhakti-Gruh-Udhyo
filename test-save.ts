async function testSave() {
  const testData = [
    {
      date: "2026-04-11",
      itemName: "Test Item",
      category: "Test Category",
      weight: 10.5,
      remarks: "Test Remark",
      createdBy: "test-uid",
      createdByName: "Test User"
    }
  ];

  try {
    const response = await fetch('http://localhost:3000/api/save-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: testData, sheetName: 'Purchases' })
    });
    const result = await response.json();
    console.log("Save Data Response:", result);
  } catch (error: any) {
    console.error("Save Data Failed:", error.message);
  }
}

testSave();
