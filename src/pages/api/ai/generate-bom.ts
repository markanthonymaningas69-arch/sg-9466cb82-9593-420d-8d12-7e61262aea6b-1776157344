import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables in Settings → Environment."
    });
  }

  try {
    const { scopeName, description, quantity, unit } = req.body;

    if (!scopeName || !description) {
      return res.status(400).json({ error: "Missing scope name or description" });
    }

    const systemPrompt = `You are a deterministic construction quantity estimator.

OBJECTIVE:
Generate materials AND show step-by-step calculations using FIXED formulas.

STRICT RULES:

1. ALWAYS USE THESE CONSTANTS:
- CHB per sqm = 12.5 pcs
- Mortar per sqm = 0.02 m3
- Mortar ratio = 1:3 (cement:sand)
- Wastage = 5%
- 1 bag cement = 40 kg

2. DO NOT CHANGE FORMULAS
3. DO NOT INTRODUCE NEW ASSUMPTIONS
4. SAME INPUT = SAME OUTPUT

5. CALCULATION METHOD (MANDATORY):

For Masonry:

Step 1:
CHB = Area × 12.5

Step 2:
Mortar Volume = Area × 0.02

Step 3:
Cement = Mortar × (1 / (1+3))

Step 4:
Sand = Mortar × (3 / (1+3))

Step 5:
Apply Wastage:
Final = Value × 1.05

Step 6:
Rounding:
- CHB → round up
- Cement → round up (bags)
- Sand → 2 decimal places

6. OUTPUT FORMAT (STRICT JSON):

{
  "materials": [
    {
      "name": "string",
      "unit": "string",
      "quantity": number
    }
  ],
  "calculation": {
    "steps": [
      "text explanation of step 1",
      "text explanation of step 2"
    ]
  }
}

7. NO VARIATION ALLOWED
8. NO EXTRA TEXT

CRITICAL UI RULE: The "unit" MUST be chosen EXACTLY from this list: Bag, Bd.ft, Box, Cu.m, Gal, Kg, Length, Lin.m, Liter, Lot, M, Pail, Pair, Pc, Roll, Set, Sq.m, Unit.`;

    const userMessage = `
Scope Name: ${scopeName}
Total Quantity to construct: ${quantity} ${unit}
User Description: ${description}

Generate the materials list as JSON.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: 0.3,
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "OpenAI API request failed");
    }

    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content;

    if (!aiMessage) {
      throw new Error("No response from AI");
    }

    // Clean the JSON response just in case the AI added markdown blocks
    let cleanedJson = aiMessage.trim();
    if (cleanedJson.startsWith("```json")) {
      cleanedJson = cleanedJson.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (cleanedJson.startsWith("```")) {
      cleanedJson = cleanedJson.replace(/^```\n/, "").replace(/\n```$/, "");
    }

    const generatedData = JSON.parse(cleanedJson);

    // Return the full object (which includes materials and calculation steps)
    return res.status(200).json(generatedData);
  } catch (error) {
    console.error("AI Generate BOM Error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error"
    });
  }
}