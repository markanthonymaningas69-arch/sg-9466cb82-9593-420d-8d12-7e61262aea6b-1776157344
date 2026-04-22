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

    const systemPrompt = `You are an expert construction estimator and quantity surveyor. 
Your job is to generate a comprehensive list of required construction materials for a specific Scope of Work.

You will be given the Scope Name, the Quantity of the scope, its Unit, and a detailed Description provided by the user.
Calculate and estimate the materials required to complete the total quantity of this scope. 
Use standard construction practices, waste margins, and typical material associations.

Respond STRICTLY with a valid JSON array of objects. Do not include any markdown formatting, backticks, or explanation. Just the raw JSON array.
Each object must have exactly these keys:
- "name": (string) Standard material name (e.g., "Portland Cement Type 1")
- "category": (string) Category (e.g., "Concrete", "Finishing", "Reinforcement", "Formwork", "Masonry")
- "unit": (string) Standard unit (e.g., "Bag", "Cu.m", "Sq.m", "Kg", "Pc", "Lin.m", "Lot")
- "quantity": (number) Estimated total quantity needed for the scope
- "unit_cost": (number) Rough estimated unit cost in AED (provide a reasonable market estimate)

Example output:
[
  { "name": "Portland Cement Type 1", "category": "Concrete", "unit": "Bag", "quantity": 150, "unit_cost": 25 },
  { "name": "River Sand", "category": "Concrete", "unit": "Cu.m", "quantity": 15, "unit_cost": 65 }
]`;

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

    const materialsList = JSON.parse(cleanedJson);

    return res.status(200).json({ materials: materialsList });
  } catch (error) {
    console.error("AI Generate BOM Error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error"
    });
  }
}