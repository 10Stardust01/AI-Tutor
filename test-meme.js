(async () => {
  try {
    const res = await fetch('http://localhost:5000/meme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'machine learning' })
    });

    const data = await res.json();

    console.log('status:', res.status);
    console.log('response:', data);

  } catch (err) {
    console.error(err);
  }
})();