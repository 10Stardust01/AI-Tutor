import express from "express";
import OpenAI from "openai";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

// ✅ Root route (serves frontend)
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

// ✅ OpenAI (Groq) client
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});

// ✅ Explain route
app.post("/explain", async (req, res) => {
  try {
    const { topic, mode } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    let prompt = "";

    if (mode === "professor") {
      prompt = `Explain ${topic} like an engineering professor with clarity and structure. Avoid markdown formatting (like **bold**, *italic*), only provide plain text paragraphs.`;
    } else if (mode === "friend") {
      prompt = `Explain ${topic} in very simple, intuitive terms like a friend. Avoid markdown formatting (like **bold**, *italic*), only provide plain text paragraphs.`;
    } else if (mode === "meme") {
      prompt = `Explain ${topic} using humor and relatable memes. Avoid markdown formatting (like **bold**, *italic*), only provide plain text paragraphs.`;
    } else {
      prompt = `Explain ${topic} simply for an engineering student. Avoid markdown formatting (like **bold**, *italic*), only provide plain text paragraphs.`;
    }

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "user", content: prompt }
      ]
    });

    res.json({ text: response.choices[0].message.content });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// helper: imgflip meme generation fallback (no paid image model needed)
async function generateImgflipMeme(captionText) {
  const templates = [
    { id: '61579', top: 'Zoned out', bottom: 'Because AI did the explanation' },
    { id: '438680', top: 'The real lecture', bottom: 'AI explanation + meme in one app' },
    { id: '61520', top: 'When you ask for code', bottom: 'and also get memes' },
    { id: '61546', top: 'Uses one API for both', bottom: 'Swagger be like... 😎' }
  ];
  const template = templates[Math.floor(Math.random() * templates.length)];
  const [topText, bottomText] = captionText.split(/\n/).filter(Boolean).slice(0,2).map(t => t.trim());

  const imgflipUser = process.env.IMGFLIP_USERNAME || 'imgflip_hubot';
  const imgflipPass = process.env.IMGFLIP_PASSWORD || 'imgflip_hubot';

  const params = new URLSearchParams();
  params.append('template_id', template.id);
  params.append('username', imgflipUser);
  params.append('password', imgflipPass);
  params.append('text0', topText || template.top);
  params.append('text1', bottomText || template.bottom);

  const response = await fetch('https://api.imgflip.com/caption_image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  const data = await response.json();
  if (data?.success && data.data?.url) {
    return data.data.url;
  }
  throw new Error(data?.error_message || 'Imgflip meme generation failed');
}

// ✅ Meme route (context-aware image generation)
app.post("/meme", async (req, res) => {
  try {
    const { topic, mode } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    let descriptionPrompt;
    if (mode === "friend") {
      descriptionPrompt = `Generate a short, playful meme caption about ${topic}, as if explaining to a friend in a funny way.`;
    } else if (mode === "professor") {
      descriptionPrompt = `Generate a clever nerdy meme caption about ${topic} from an engineering professor point of view.`;
    } else if (mode === "meme") {
      descriptionPrompt = `Generate a witty meme caption about ${topic} that includes humor and a clear punchline.`;
    } else {
      descriptionPrompt = `Generate a smart meme caption about ${topic} that simplifies the idea while being humorous.`;
    }

    const captionResponse = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: descriptionPrompt }],
      max_tokens: 120
    });

    const captionText = captionResponse.choices[0].message.content.trim();

    let imageUrl = null;
    // First try native provider image generation
    try {
      const memeImage = await client.images.generate({
        model: "gpt-image-1",
        prompt: `A high-quality 1024x1024 meme-style image with text: ${captionText}`,
        size: "1024x1024"
      });

      if (memeImage?.data?.[0]?.b64_json) {
        imageUrl = `data:image/png;base64,${memeImage.data[0].b64_json}`;
      }
    } catch (innerErr) {
      console.warn("GPT image generation failed, trying Imgflip fallback:", innerErr.message || innerErr);
    }

    // Fallback to Imgflip if provider image was unavailable
    if (!imageUrl) {
      try {
        imageUrl = await generateImgflipMeme(captionText);
      } catch (imgflipErr) {
        console.warn("Imgflip fallback failed:", imgflipErr.message || imgflipErr);
        imageUrl = null; // still return caption so app remains functional
      }
    }

    res.json({ caption: captionText, image: imageUrl });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Meme generation failed" });
  }
});

// ✅ Quiz route
app.post("/quiz", async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `Create 3 questions (mix conceptual + numerical) on ${topic} with answers. Avoid markdown styling; send plain text only to be display-ready in a website UI.`
        }
      ]
    });

    res.json({ quiz: response.choices[0].message.content });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Quiz failed" });
  }
});

// ✅ Port setup (important for deployment)
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});