import fetch from 'node-fetch';

(async () => {
  try {
    const res = await fetch('http://localhost:5000/meme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'machine learning', mode: 'meme' })
    });
    const data = await res.text();
    console.log('status', res.status);
    console.log(data);
  } catch (err) {
    console.error(err);
  }
})();