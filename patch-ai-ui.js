const fs = require('fs');
const path = 'src/pages/bom/[projectId].tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Fix syntax error in the map function
code = code.replace(
  /<\/TableRow>\s*\n\s*}\s*\n\s*<\/TableBody>/g,
  '</TableRow>\n                  )}\n                    </TableBody>'
);

// 2. Add handleGenerateAIMaterials before resetMaterialForm
const aiFunction = `
  const handleGenerateAIMaterials = async (scope: ScopeOfWork) => {
    const scopeId = scope.id as string;
    const prompt = aiPrompts[scopeId];
    if (!prompt?.trim()) return;

    setIsGeneratingAi(prev => ({ ...prev, [scopeId]: true }));
    try {
      const result = await bomService.generateMaterialsWithAI(
        scopeId,
        scope.name || "Unnamed Scope",
        (scope as any).quantity || 1,
        (scope as any).unit || "Lot",
        prompt
      );

      if (result.error) {
        alert("AI Generation Error: " + result.error);
      } else {
        if (bom?.project_id) {
          await loadData(bom.project_id as string);
        }
        setAiPrompts(prev => ({ ...prev, [scopeId]: "" }));
      }
    } catch (err) {
      alert("Failed to generate materials: " + err.message);
    } finally {
      setIsGeneratingAi(prev => ({ ...prev, [scopeId]: false }));
    }
  };

  const resetMaterialForm`;

if (!code.includes('handleGenerateAIMaterials')) {
  code = code.replace('const resetMaterialForm', aiFunction);
}

// 3. Add UI block after the materials table block (before Labor section)
const aiUiBlock = `
                  {/* AI Generator Block */}
                  <div className="bg-purple-50/50 dark:bg-purple-950/10 p-2.5 rounded-md mt-3 mb-2 border border-purple-100 dark:border-purple-900/50">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        <h4 className="text-[11px] font-semibold text-purple-800 dark:text-purple-300 uppercase tracking-wider">AI Material Generator</h4>
                      </div>
                      <span className="text-[10px] text-muted-foreground italic">Review AI suggestions before finalizing</span>
                    </div>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Describe the scope (e.g. Reinforced concrete slab, 150mm thick with rebars...)" 
                        className="h-7 text-xs flex-1 border-purple-200 dark:border-purple-800/50 focus-visible:ring-purple-500"
                        value={aiPrompts[scope.id as string] || ""}
                        onChange={(e) => setAiPrompts({...aiPrompts, [scope.id as string]: e.target.value})}
                        disabled={isGeneratingAi[scope.id as string] || isLocked}
                        onKeyDown={(e) => { if (e.key === "Enter") handleGenerateAIMaterials(scope); }}
                      />
                      <Button 
                        size="sm" 
                        className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white px-3"
                        disabled={isGeneratingAi[scope.id as string] || isLocked || !aiPrompts[scope.id as string]?.trim()}
                        onClick={() => handleGenerateAIMaterials(scope)}
                      >
                        {isGeneratingAi[scope.id as string] ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                        {isGeneratingAi[scope.id as string] ? "Generating..." : "Generate"}
                      </Button>
                    </div>
                  </div>
`;

// Insert the AI block right before the Labor Cost section container
code = code.replace(
  /<div className="flex justify-between items-start pt-2 border-t mt-2">/g,
  aiUiBlock.replace(/\$/g, '$$$$') + '\n                      <div className="flex justify-between items-start pt-2 border-t mt-2">'
);

fs.writeFileSync(path, code);
console.log('Syntax error fixed and AI Generator UI injected successfully.');
