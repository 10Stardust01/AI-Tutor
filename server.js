import express from "express";
import OpenAI from "openai";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});

// ✅ Explain route with modes
app.post("/explain", async (req, res) => {
  try {
    const { topic, mode } = req.body;

    let prompt = "";

    if (mode === "professor") {
      prompt = `Explain ${topic} like an engineering professor with clarity and structure.`;
    } else if (mode === "friend") {
      prompt = `Explain ${topic} in very simple, intuitive terms like a friend.`;
    } else if (mode === "meme") {
      prompt = `Explain ${topic} using humor and relatable memes.`;
    } else {
      prompt = `Explain ${topic} simply for an engineering student.`;
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

app.post("/quiz", async (req, res) => {
  try {
    const { topic } = req.body;

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `Create 3 questions (mix conceptual + numerical) on ${topic} with answers.`
        }
      ]
    });

    res.json({ quiz: response.choices[0].message.content });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Quiz failed" });
  }
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});