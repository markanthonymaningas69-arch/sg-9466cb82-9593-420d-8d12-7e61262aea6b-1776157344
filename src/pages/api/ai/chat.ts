import type { NextApiRequest, NextApiResponse } from "next";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

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
    const { message, projectData, conversationHistory } = req.body;

    if (!message || !projectData) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Build context-aware system prompt
    const systemPrompt = buildSystemPrompt(projectData);

    // Prepare messages for OpenAI
    const messages: ChatMessage[] = [
      { role: "assistant" as const, content: systemPrompt },
      ...(conversationHistory || []).map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content
      })),
      { role: "user" as const, content: message }
    ];

    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API Error:", errorData);
      throw new Error(errorData.error?.message || "OpenAI API request failed");
    }

    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content;

    if (!aiMessage) {
      throw new Error("No response from AI");
    }

    return res.status(200).json({ message: aiMessage });
  } catch (error) {
    console.error("AI Chat API Error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error"
    });
  }
}

function buildSystemPrompt(projectData: any): string {
  const { projectName, swaData, materialUsageData, scopeSpendingData, ocmData } = projectData;

  let prompt = `You are an AI assistant analyzing construction project data for "${projectName}". Provide insights, identify issues, and answer questions based on the following data:\n\n`;

  // SWA Summary
  if (swaData?.totals) {
    prompt += `PROJECT COMPLETION SUMMARY:\n`;
    prompt += `- Total Project Cost: ${formatCurrency(swaData.totals.cost)}\n`;
    prompt += `- Overall Accomplishment: ${swaData.totals.accomplishment.toFixed(2)}%\n`;
    prompt += `- Amount Completed: ${formatCurrency(swaData.totals.amountOfCompletion)}\n\n`;

    if (swaData.rows?.length > 0) {
      prompt += `SCOPE DETAILS:\n`;
      swaData.rows.slice(0, 10).forEach((scope: any) => {
        prompt += `- ${scope.name}: ${scope.completion.toFixed(1)}% complete, Cost: ${formatCurrency(scope.cost)}, Accomplishment: ${scope.accomplishment.toFixed(2)}%\n`;
      });
      prompt += `\n`;
    }
  }

  // Material Usage
  if (materialUsageData?.length > 0) {
    const overusedMaterials = materialUsageData.filter((m: any) => m.variance < 0);
    if (overusedMaterials.length > 0) {
      prompt += `MATERIAL OVERAGES (Actual > Allocated):\n`;
      overusedMaterials.slice(0, 5).forEach((m: any) => {
        prompt += `- ${m.materialName} in ${m.scopeName}: ${Math.abs(m.variance)} ${m.unit} over budget\n`;
      });
      prompt += `\n`;
    }
  }

  // Cost Overruns
  if (scopeSpendingData?.length > 0) {
    const overrunScopes = scopeSpendingData.filter((s: any) => s.totalActual > s.totalAllocated);
    if (overrunScopes.length > 0) {
      prompt += `COST OVERRUNS:\n`;
      overrunScopes.forEach((s: any) => {
        const overrun = s.totalActual - s.totalAllocated;
        prompt += `- ${s.scopeName}: ${formatCurrency(overrun)} over budget (${((overrun/s.totalAllocated)*100).toFixed(1)}%)\n`;
      });
      prompt += `\n`;
    }
  }

  // OCM Materials
  if (ocmData?.length > 0) {
    prompt += `OUT-OF-BOM MATERIALS (OCM): ${ocmData.length} items used that weren't in original BOM\n`;
    const totalOcmCost = ocmData.reduce((sum: number, item: any) => sum + (item.cost || 0), 0);
    prompt += `Total OCM Cost: ${formatCurrency(totalOcmCost)}\n\n`;
  }

  prompt += `Provide concise, actionable insights. Use bullet points for clarity. Focus on what matters most to project managers.`;

  return prompt;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(amount);
}