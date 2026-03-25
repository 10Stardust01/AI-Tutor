(async () => {
  try {
    const res = await fetch('http://localhost:5000/meme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'java programming' })
    });
    const body = await res.text();
    console.log('status', res.status);
    console.log('body', body);
  } catch (e) {
    console.error('error:', e);
  }
})();