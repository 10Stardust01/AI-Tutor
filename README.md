# AI Tutor

Simple Node/Express + OpenAI/Groq app to explain a topic and quiz the user.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` with your key:

```
GROQ_API_KEY=your_api_key_here
```

3. Start the app:

```bash
npm start
```

4. Open in browser:

- http://localhost:5000

## Features

- POST `/explain` -> gets explanation for chosen topic and mode.
- POST `/quiz` -> generates 3 mixed questions + answers for the topic.
- Built-in frontend in `public/index.html` makes this a usable tutor experience.

## Notes

- If using WSL: run from WSL shell to use installed Node.
- Make sure `node_modules` exists and `GROQ_API_KEY` is valid.
