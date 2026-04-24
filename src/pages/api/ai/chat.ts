import type { NextApiRequest, NextApiResponse } from "next";

interface ChatMessage {
  role: "system" | "user" | "assistant";
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
    const { message, projectData, conversationHistory, uiContext } = req.body;

    if (!message || !projectData) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Build context-aware system prompt
    const systemPrompt = buildSystemPrompt(projectData, uiContext);

    // Prepare messages for OpenAI
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
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

function buildSystemPrompt(projectData: any, uiContext?: { module?: string; tab?: string | null; pathname?: string; projectId?: string | null }): string {
  const projectName = projectData.projectName;
  const swaData = projectData.swaData;
  const materialUsageData = projectData.materialUsageData;
  const scopeSpendingData = projectData.scopeSpendingData;
  const ocmData = projectData.ocmData;
  const accounting = projectData.accounting;
  const ledger = projectData.ledger;
  const liquidations = projectData.liquidations;
  const personnel = projectData.personnel;
  const warehouse = projectData.warehouse;
  const purchases = projectData.purchases;
  const allProjects = projectData.allProjects || projectData.projects || [];
  const deliveries = projectData.deliveries || [];
  const materialConsumption = projectData.materialConsumption || [];
  const siteRequests = projectData.siteRequests || [];
  const cashAdvances = projectData.cashAdvances || [];
  const leaveRequests = projectData.leaveRequests || [];
  const scheduleTasks = projectData.scheduleTasks || projectData.tasks || [];
  const siteAttendance = projectData.siteAttendance || projectData.attendance || [];
  const progressUpdates = projectData.progressUpdates || projectData.progress || [];
  const bomScopes = projectData.bomScopes;
  const bomMaterials = projectData.bomMaterials;
  const bomIndirectCosts = projectData.bomIndirectCosts;
  const focusedProject = projectData.focusedProject;

  let prompt = `You are an AI assistant analyzing construction management system data. You have access to data across all modules and all major tabs in the application.\n\n`;

  // PROJECTS OVERVIEW
  if (uiContext?.module || uiContext?.tab || uiContext?.pathname) {
    prompt += `=== CURRENT USER VIEW ===\n`;
    prompt += `Module: ${uiContext.module || "Unknown"}\n`;
    prompt += `Tab: ${uiContext.tab || "Default"}\n`;
    prompt += `Path: ${uiContext.pathname || "-"}\n`;
    prompt += `Focused Project ID: ${uiContext.projectId || "All Projects"}\n`;
    if (focusedProject?.name) {
      prompt += `Focused Project Name: ${focusedProject.name}\n`;
    }
    prompt += `When the user asks about "this tab", "this module", or "current page", interpret it using this view context first.\n\n`;
  }

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
    prompt += `=== ACCOUNTING (VOUCHERS) ===\n`;
    const totalVouchers = accounting.length;
    const pendingVouchers = accounting.filter((v: any) => v.status === 'pending').length;
    const approvedVouchers = accounting.filter((v: any) => v.status === 'approved').length;
    const totalAmount = accounting.reduce((sum: number, v: any) => sum + (Number(v.amount) || 0), 0);
    
    prompt += `Total Vouchers: ${totalVouchers} (Pending: ${pendingVouchers}, Approved: ${approvedVouchers})\n`;
    prompt += `Total Voucher Amount: ${formatCurrency(totalAmount)}\n\n`;
  }

  // LEDGER / JOURNAL OPEX
  if (ledger?.length > 0) {
    prompt += `=== LEDGER & OPEX ===\n`;
    const totalDebits = ledger.filter((t: any) => t.type === 'debit').reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
    const totalCredits = ledger.filter((t: any) => t.type === 'credit').reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
    
    prompt += `Total Ledger Transactions: ${ledger.length}\n`;
    prompt += `Total Debits: ${formatCurrency(totalDebits)}\n`;
    prompt += `Total Credits: ${formatCurrency(totalCredits)}\n`;
    prompt += `Balance (Debits - Credits): ${formatCurrency(totalDebits - totalCredits)}\n\n`;
  }

  // LIQUIDATIONS
  if (liquidations?.length > 0) {
    prompt += `=== LIQUIDATIONS ===\n`;
    const pendingLiq = liquidations.filter((l: any) => l.status === 'pending').length;
    const approvedLiq = liquidations.filter((l: any) => l.status === 'approved').length;
    const totalAmount = liquidations.reduce((sum: number, l: any) => sum + (Number(l.amount) || 0), 0);
    
    prompt += `Total Liquidations: ${liquidations.length} (Pending: ${pendingLiq}, Approved: ${approvedLiq})\n`;
    prompt += `Total Liquidation Amount: ${formatCurrency(totalAmount)}\n\n`;
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

  if (scheduleTasks?.length > 0 || progressUpdates?.length > 0 || bomScopes?.length > 0) {
    prompt += `=== PROJECT MANAGER ===\n`;
    prompt += `Scheduled Tasks: ${scheduleTasks?.length || 0}\n`;
    const scheduledStatuses = Array.isArray(scheduleTasks)
      ? scheduleTasks.reduce((acc: Record<string, number>, task: any) => {
          const key = task.status || "unknown";
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})
      : {};
    const statusSummary = Object.entries(scheduledStatuses)
      .map(([status, count]) => `${status}: ${count}`)
      .join(", ");
    if (statusSummary) {
      prompt += `Task Statuses: ${statusSummary}\n`;
    }
    prompt += `BOM Scopes: ${bomScopes?.length || 0}\n`;
    prompt += `BOM Materials: ${bomMaterials?.length || 0}\n`;
    prompt += `Indirect Cost Lines: ${bomIndirectCosts?.length || 0}\n`;
    prompt += `Progress Updates: ${progressUpdates?.length || 0}\n\n`;
  }

  if (deliveries?.length > 0 || materialConsumption?.length > 0 || siteRequests?.length > 0 || siteAttendance?.length > 0) {
    prompt += `=== SITE PERSONNEL ===\n`;
    prompt += `Deliveries: ${deliveries?.length || 0}\n`;
    prompt += `Material Usage Logs: ${materialConsumption?.length || 0}\n`;
    prompt += `Site Requests: ${siteRequests?.length || 0}\n`;
    prompt += `Attendance Records: ${siteAttendance?.length || 0}\n`;

    const totalConsumedItems = Array.isArray(materialConsumption)
      ? materialConsumption.reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0)
      : 0;
    if (totalConsumedItems > 0) {
      prompt += `Total Logged Material Consumption Quantity: ${totalConsumedItems}\n`;
    }
    prompt += `\n`;
  }

  if (cashAdvances?.length > 0 || leaveRequests?.length > 0) {
    prompt += `=== HR & WORKFORCE REQUESTS ===\n`;
    prompt += `Cash Advance Requests: ${cashAdvances?.length || 0}\n`;
    prompt += `Leave Requests: ${leaveRequests?.length || 0}\n\n`;
  }

  prompt += `=== RESPONSE RULES ===\n`;
  prompt += `Ground every answer in the provided data only. If data for a requested module or tab is missing, say so clearly.\n`;
  prompt += `Use bullet points for clarity. Highlight issues, trends, risks, and recommendations.\n`;
  prompt += `When relevant, connect findings across modules such as Project Manager, Site Personnel, Warehouse, Purchasing, Accounting, HR, and Analytics.\n`;

  return prompt;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 2
  }).format(amount);
}