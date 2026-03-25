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

// Global to avoid template repetition
let lastTemplate = null;
let memeCallCount = 0;

// ✅ Root route
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

// ✅ Groq client
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});


// ==========================
// 🧠 TEMPLATE LOGIC (AGENT)
// ==========================
function getTemplateId(type) {
  const map = {
    drake: "181913649",
    distracted: "112126428",
    two_buttons: "87743020",
    success_kid: "61544",
    roll_safe: "89370399",
    futurerama: "61520",
    ancient_aliens: "101470",
    boardroom: "1035805",
    galaxy_brain: "93895088"
  };
  return map[type] || map.distracted;
}

async function generateImgflipMeme(top, bottom, templateType) {
  const imgflipUser = process.env.IMGFLIP_USERNAME || "imgflip_hubot";
  const imgflipPass = process.env.IMGFLIP_PASSWORD || "imgflip_hubot";

  const params = new URLSearchParams();
  params.append("template_id", getTemplateId(templateType));
  params.append("username", imgflipUser);
  params.append("password", imgflipPass);
  params.append("text0", top);
  params.append("text1", bottom);

  const response = await fetch("https://api.imgflip.com/caption_image", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  const data = await response.json();

  if (data?.success && data.data?.url) {
    return data.data.url;
  }

  throw new Error(data?.error_message || "Imgflip failed");
}

async function generateMemegenMeme(top, bottom, templateType) {
  const templateMap = {
    drake: "drake",
    distracted: "distracted-bf",
    two_buttons: "two-buttons",
    success_kid: "success-kid",
    roll_safe: "roll-safe",
    futurerama: "futurama-fry",
    ancient_aliens: "ancient-aliens",
    boardroom: "boardroom",
    galaxy_brain: "galaxy-brain"
  };

  const template = templateMap[templateType] || "apathy";
  const quote = (text) => encodeURIComponent(text.replace(/\s+/g, " ").trim() || "...");
  const url = `https://api.memegen.link/images/${template}/${quote(top)}/${quote(bottom)}.png`;
  return url;
}


// ==========================
// 📘 EXPLAIN ROUTE
// ==========================
app.post("/explain", async (req, res) => {
  try {
    const { topic, mode } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const modeKey = (mode || "student").toLowerCase();
    const styleMap = {
      student: "as a helpful student-friendly tutor, simple and encouraging tone",
      professor: "as a university professor, academic style with precise terms and depth",
      friend: "as an informal friendly buddy with easy analogies and jokes",
      meme: "as a meme-loving narrator with short punchy humor and visual references"
    };

    const style = styleMap[modeKey] || styleMap.student;

    const prompt = `
Explain ${topic} in a clean, structured format ${style}.

Rules:
- Use short paragraphs
- Use bullet points
- Use headings in ALL CAPS
- Keep it simple and readable

Format:

WHAT IS IT:
...

KEY POINTS:
- ...
- ...

EXAMPLE:
...
`;

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }]
    });

    res.json({ text: response.choices[0].message.content });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Explain failed" });
  }
});


// ==========================
// 😂 MEME ROUTE (AGENT)
// ==========================
app.post("/meme", async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    // 🧠 AI ONLY GENERATES CAPTION (NO TEMPLATE)
    const prompt = `
Generate a funny meme caption in 2 lines.

Format:
TOP: <text>
BOTTOM: <text>

Topic: ${topic}
`;

    let top = "Default top text";
    let bottom = "Default bottom text";
    let captionError = null;

    try {
      const captionResponse = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 1.2
      });

      const raw = captionResponse?.choices?.[0]?.message?.content;
      console.log("RAW AI:", raw);

      if (raw && typeof raw === "string") {
        raw.split("\n").forEach(line => {
          if (line.startsWith("TOP:")) top = line.replace("TOP:", "").trim();
          if (line.startsWith("BOTTOM:")) bottom = line.replace("BOTTOM:", "").trim();
        });

        // If parsing failed, keep defaults
        if (top === "Default top text" && bottom === "Default bottom text") {
          const lines = raw.trim().split("\n").filter(Boolean);
          top = lines[0] || top;
          bottom = lines[1] || bottom;
        }

      } else {
        captionError = "Caption AI returned no text";
      }

      console.log("PARSED:", { top, bottom });

    } catch (err) {
      console.warn("Caption AI failed:", err.message || err);
      captionError = err.message || "Caption generation failed";
      top = `When ${topic} is hard`;
      bottom = "but we can still make a meme";
    }

    // 🧠 SMART TEMPLATE SELECTION (NO AI)
    function chooseTemplate(text, top, bottom) {
      const t = (text || "").toLowerCase();
      const topLower = (top || "").toLowerCase();
      const bottomLower = (bottom || "").toLowerCase();
      memeCallCount += 1;

      // If classic "When ... But ..." meme appears, avoid drake to diversify.
      if (
        topLower.includes("when") &&
        bottomLower.includes("but")
      ) {
        const nonDrake = ["distracted", "two_buttons"];
        const selected = nonDrake[memeCallCount % nonDrake.length];
        lastTemplate = selected;
        return selected;
      }

      // template score tracking for semantic match
      let drakeScore = 0;
      let distractedScore = 0;
      let twoButtonsScore = 0;

      if (t.match(/\b(when\b.*\bbut|but\b.*\bwhen)\b/)) drakeScore += 3;
      if (t.match(/\b(well|yet|still|although)\b/)) drakeScore += 1;

      if (t.match(/\b(while|meanwhile|distracted|focus|ignore|ignoring|attention)\b/)) distractedScore += 2;
      if (t.includes("instead of")) distractedScore += 2;

      if (t.match(/\b(choose|choice|option|decision|or|vs|versus)\b/)) twoButtonsScore += 2;
      if (t.match(/\b(this|that)\b/) && t.includes("or")) twoButtonsScore += 1;

      // fallback if caption is short or non-specific
      if (t.length < 20) {
        drakeScore += 1;
        distractedScore += 1;
        twoButtonsScore += 1;
      }

      // Add light randomness to keep variety
      drakeScore += Math.random() * 0.7;
      distractedScore += Math.random() * 0.7;
      twoButtonsScore += Math.random() * 0.7;

      const scores = [
        ["drake", drakeScore],
        ["distracted", distractedScore],
        ["two_buttons", twoButtonsScore]
      ];

      scores.sort((a, b) => b[1] - a[1]);
      let chosen = scores[0][0];

      // Strong drake signal (but limit 30% chance to keep variety)
      if (chosen === "drake" && Math.random() < 0.3) {
        chosen = scores[1][0] || chosen;
      }

      // Forced cycle every 4th request to avoid lock-in
      if (memeCallCount % 4 === 0) {
        const cycleTemplates = ["drake", "distracted", "two_buttons", "success_kid", "roll_safe", "futurerama"];
        chosen = cycleTemplates[(memeCallCount / 4) % cycleTemplates.length];
      }

      // Avoid same template twice in a row when possible
      if (chosen === lastTemplate) {
        chosen = scores.find(([name]) => name !== lastTemplate)?.[0] || chosen;
      }

      // Expand beyond 3 templates based on content cues
      const alternateTemplates = ["success_kid", "roll_safe", "futurerama", "ancient_aliens", "boardroom", "galaxy_brain"];
      if (memeCallCount % 5 === 0 && !alternateTemplates.includes(chosen)) {
        chosen = alternateTemplates[memeCallCount % alternateTemplates.length];
      }

      lastTemplate = chosen;
      return chosen;
    }

    const templateType = chooseTemplate(top + " " + bottom);

    console.log("FINAL TEMPLATE:", templateType);

    // 🎨 Generate meme via primary provider
    let imageUrl = null;
    let error = null;

    try {
      imageUrl = await generateImgflipMeme(top, bottom, templateType);
    } catch (e) {
      console.warn("Imgflip failed; falling back to memegen.link", e.message);
      error = e.message;
    }

    // fallback to memegen.link (no API key needed)
    if (!imageUrl) {
      try {
        imageUrl = await generateMemegenMeme(top, bottom, templateType);
        error = null;
      } catch (e) {
        console.warn("Memegen fallback failed", e.message);
        error = error ? `${error}; ${e.message}` : e.message;
      }
    }

    res.json({
      top,
      bottom,
      template: templateType,
      image: imageUrl,
      captionError,
      error
    });

  } catch (err) {
    console.error("/meme route failed:", err);
    res.status(500).json({ error: "Meme generation failed", detail: err.message || err, stack: err.stack });
  }
});

// Quick test route for meme health
app.get('/meme-status', (req, res) => {
  res.json({ status: 'ok', version: '1.0', note: 'Server code updated' });
});

// Reliable fallback meme endpoint (no AI, always works)
app.post('/meme2', (req, res) => {
  const { topic } = req.body || {};
  const safeTopic = (topic || 'everything').toString();
  const top = `When you ask about ${safeTopic}`;
  const bottom = 'The meme engine delivers';
  const templateType = 'futurerama-fry';
  const imageUrl = `https://api.memegen.link/images/${templateType}/${encodeURIComponent(top)}/${encodeURIComponent(bottom)}.png`;

  res.json({ top, bottom, template: templateType, image: imageUrl, fallback: true });
});

const memeTemplates = [
  'drake',
  'distracted-bf',
  'two-buttons',
  'success-kid',
  'roll-safe',
  'futurama-fry',
  'ancient-aliens',
  'boardroom',
  'galaxy-brain',
  'aw-yeah',
  'bad-choice',
  'one-does-not-simply'
];

function createMemeForTopic(topic) {
  const safeTopic = (topic || 'everything').toString().replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 40) || 'everything';

  const tops = [
    `When you ask about ${safeTopic}`,
    `When ${safeTopic} appears in your class`,
    `When somebody says ${safeTopic} at 2AM`,
    `When ${safeTopic} is on the exam`
  ];

  const bottoms = [
    'The meme engine delivers',
    'And the code compiles',
    'Now this is actually funny',
    'This is how we learn'
  ];

  const top = tops[Math.floor(Math.random() * tops.length)];
  const bottom = bottoms[Math.floor(Math.random() * bottoms.length)];
  let template = memeTemplates[Math.floor(Math.random() * memeTemplates.length)];

  // ensure not always the same repeating pattern
  if (template === lastTemplate) {
    const alt = memeTemplates.filter(t => t !== lastTemplate);
    template = alt[Math.floor(Math.random() * alt.length)];
  }

  lastTemplate = template;

  const imageUrl = `https://api.memegen.link/images/${template}/${encodeURIComponent(top)}/${encodeURIComponent(bottom)}.png`;
  return { top, bottom, template, image: imageUrl };
}

app.post('/meme', (req, res) => {
  try {
    const topic = (req.body?.topic || 'everything').toString().trim();
    const meme = createMemeForTopic(topic);
    res.json({ ...meme, fallback: false });
  } catch (err) {
    console.error('/meme fallback failed', err);
    const fallback = createMemeForTopic('everything');
    res.json({ ...fallback, fallback: true, error: err.message || 'unknown' });
  }
});

app.post('/meme3', (req, res) => {
  try {
    const topic = (req.body?.topic || 'everything').toString().trim();
    const meme = createMemeForTopic(topic);
    res.json({ ...meme, fallback: false });
  } catch (err) {
    console.error('/meme3 fallback failed', err);
    const fallback = createMemeForTopic('everything');
    res.json({ ...fallback, fallback: true, error: err.message || 'unknown' });
  }
});

// ==========================
// 📝 QUIZ ROUTE
// ==========================
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
          content: `Create 3 questions (conceptual + numerical) on ${topic} with answers.`
        }
      ]
    });

    res.json({ quiz: response.choices[0].message.content });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Quiz failed" });
  }
});


// ==========================
// 🚀 START SERVER
// ==========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🔥 Server running on http://localhost:${PORT}`);
});