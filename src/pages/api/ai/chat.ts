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
  const { 
    projectName, 
    swaData, 
    materialUsageData, 
    scopeSpendingData, 
    ocmData,
    accounting,
    personnel,
    warehouse,
    purchases,
    allProjects
  } = projectData;

  let prompt = `You are an AI assistant analyzing construction management system data. You have access to data across ALL modules:\n\n`;

  // PROJECTS OVERVIEW
  if (allProjects?.length > 0) {
    prompt += `=== PROJECTS OVERVIEW ===\n`;
    prompt += `Total Projects: ${allProjects.length}\n`;
    const activeProjects = allProjects.filter((p: any) => p.status === 'active');
    const completedProjects = allProjects.filter((p: any) => p.status === 'completed');
    prompt += `Active: ${activeProjects.length}, Completed: ${completedProjects.length}\n`;
    
    if (activeProjects.length > 0) {
      prompt += `Active Projects:\n`;
      activeProjects.slice(0, 5).forEach((p: any) => {
        prompt += `- ${p.name}: Budget ${formatCurrency(p.budget || 0)}\n`;
      });
    }
    prompt += `\n`;
  }

  // CURRENT PROJECT ANALYTICS
  if (projectName && projectName !== "All Projects") {
    prompt += `=== CURRENT PROJECT: ${projectName} ===\n\n`;
    
    if (swaData?.totals) {
      prompt += `PROJECT COMPLETION:\n`;
      prompt += `- Total Cost: ${formatCurrency(swaData.totals.cost)}\n`;
      prompt += `- Accomplishment: ${swaData.totals.accomplishment.toFixed(2)}%\n`;
      prompt += `- Completed Amount: ${formatCurrency(swaData.totals.amountOfCompletion)}\n\n`;

      if (swaData.rows?.length > 0) {
        prompt += `Scope Details:\n`;
        swaData.rows.slice(0, 5).forEach((scope: any) => {
          prompt += `- ${scope.name}: ${scope.completion.toFixed(1)}% complete, ${formatCurrency(scope.cost)}\n`;
        });
        prompt += `\n`;
      }
    }

    if (materialUsageData?.length > 0) {
      const overusedMaterials = materialUsageData.filter((m: any) => m.variance < 0);
      if (overusedMaterials.length > 0) {
        prompt += `Material Overages:\n`;
        overusedMaterials.slice(0, 5).forEach((m: any) => {
          prompt += `- ${m.materialName}: ${Math.abs(m.variance)} ${m.unit} over\n`;
        });
        prompt += `\n`;
      }
    }

    if (scopeSpendingData?.length > 0) {
      const overrunScopes = scopeSpendingData.filter((s: any) => s.totalActual > s.totalAllocated);
      if (overrunScopes.length > 0) {
        prompt += `Cost Overruns:\n`;
        overrunScopes.forEach((s: any) => {
          const overrun = s.totalActual - s.totalAllocated;
          prompt += `- ${s.scopeName}: ${formatCurrency(overrun)} over (${((overrun/s.totalAllocated)*100).toFixed(1)}%)\n`;
        });
        prompt += `\n`;
      }
    }

    if (ocmData?.length > 0) {
      const totalOcmCost = ocmData.reduce((sum: number, item: any) => sum + (item.cost || 0), 0);
      prompt += `Out-of-BOM Materials: ${ocmData.length} items, Cost: ${formatCurrency(totalOcmCost)}\n\n`;
    }
  }

  // ACCOUNTING MODULE
  if (accounting?.length > 0) {
    prompt += `=== ACCOUNTING ===\n`;
    const totalVouchers = accounting.length;
    const pendingVouchers = accounting.filter((v: any) => v.status === 'pending').length;
    const approvedVouchers = accounting.filter((v: any) => v.status === 'approved').length;
    const totalAmount = accounting.reduce((sum: number, v: any) => sum + (Number(v.amount) || 0), 0);
    
    prompt += `Total Vouchers: ${totalVouchers} (Pending: ${pendingVouchers}, Approved: ${approvedVouchers})\n`;
    prompt += `Total Voucher Amount: ${formatCurrency(totalAmount)}\n\n`;
  }

  // PERSONNEL MODULE
  if (personnel?.length > 0) {
    prompt += `=== PERSONNEL ===\n`;
    prompt += `Total Personnel: ${personnel.length}\n`;
    const activePersonnel = personnel.filter((p: any) => p.status === 'active').length;
    prompt += `Active: ${activePersonnel}\n`;
    
    const totalMonthlyCost = personnel
      .filter((p: any) => p.status === 'active')
      .reduce((sum: number, p: any) => {
        const monthlySalary = p.daily_rate ? p.daily_rate * 22 : (p.hourly_rate ? p.hourly_rate * 8 * 22 : 0);
        return sum + monthlySalary;
      }, 0);
    prompt += `Estimated Monthly Personnel Cost: ${formatCurrency(totalMonthlyCost)}\n\n`;
  }

  // WAREHOUSE MODULE
  if (warehouse?.length > 0) {
    prompt += `=== WAREHOUSE ===\n`;
    prompt += `Total Items in Inventory: ${warehouse.length}\n`;
    
    const lowStockItems = warehouse.filter((item: any) => {
      const currentStock = Number(item.quantity || 0);
      const minStock = Number(item.minimum_stock || 0);
      return currentStock <= minStock && minStock > 0;
    });
    
    if (lowStockItems.length > 0) {
      prompt += `⚠️ Low Stock Items: ${lowStockItems.length}\n`;
      lowStockItems.slice(0, 3).forEach((item: any) => {
        prompt += `- ${item.item_name}: ${item.quantity} ${item.unit} (min: ${item.minimum_stock})\n`;
      });
    }
    
    const totalInventoryValue = warehouse.reduce((sum: number, item: any) => {
      return sum + (Number(item.quantity || 0) * Number(item.unit_cost || 0));
    }, 0);
    prompt += `Total Inventory Value: ${formatCurrency(totalInventoryValue)}\n\n`;
  }

  // PURCHASING MODULE
  if (purchases?.length > 0) {
    prompt += `=== PURCHASING ===\n`;
    const recentPurchases = purchases.slice(0, 10);
    const totalPurchaseValue = recentPurchases.reduce((sum: number, p: any) => {
      return sum + (Number(p.quantity || 0) * Number(p.unit_cost || 0));
    }, 0);
    
    prompt += `Recent Purchases (last 10): ${formatCurrency(totalPurchaseValue)}\n`;
    prompt += `Total Purchase Records: ${purchases.length}\n\n`;
  }

  prompt += `===\n\n`;
  prompt += `Provide concise, actionable insights. Use bullet points for clarity. Answer questions about any module. Identify issues, trends, and recommendations.`;

  return prompt;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(amount);
}