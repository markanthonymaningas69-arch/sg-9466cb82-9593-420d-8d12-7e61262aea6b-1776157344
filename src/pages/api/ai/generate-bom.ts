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

    const systemPrompt = `You are an expert construction estimator. 
            Given a scope of work, generate a structured list of materials required.
            Consider standard construction practices and waste factors.
            
            Return strictly in this JSON format:
            {
              "materials": [
                {
                  "name": "Material Name",
                  "unit": "kg|m3|pcs|lot",
                  "quantity": 100,
                  "unit_cost": 50,
                  "category": "Category Name"
                }
              ]
            }
            WARNING: "quantity" and "unit_cost" MUST be pure numbers (e.g. 50, not "50" or "$50").
            Do not include any markdown wrappers. Just return raw JSON.
            If the prompt lacks details, make standard expert assumptions based on the scope name and quantity.`;

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