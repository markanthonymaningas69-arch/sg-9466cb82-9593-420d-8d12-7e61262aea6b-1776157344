const fs = require('fs');
const path = 'src/pages/bom/[projectId].tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add states
if (!code.includes('aiPreviewMaterials')) {
  code = code.replace(
    'const [isGeneratingAi, setIsGeneratingAi] = useState<Record<string, boolean>>({});',
    `const [isGeneratingAi, setIsGeneratingAi] = useState<Record<string, boolean>>({});
  const [aiPreviewMaterials, setAiPreviewMaterials] = useState<Record<string, any[]>>({});
  const [isSavingAi, setIsSavingAi] = useState<Record<string, boolean>>({});`
  );
}

// 2. Replace handleGenerateAIMaterials and add handleApproveAIMaterials
const handleGenOld = `  const handleGenerateAIMaterials = async (scope: ScopeOfWork) => {`;
const handleGenEnd = `  const resetMaterialForm = () => {`;

if (code.includes(handleGenOld)) {
  const startIndex = code.indexOf(handleGenOld);
  const endIndex = code.indexOf(handleGenEnd);
  
  const newFns = `  const handleGenerateAIMaterials = async (scope: ScopeOfWork) => {
    const scopeId = scope.id as string;
    const prompt = aiPrompts[scopeId];
    if (!prompt?.trim()) return;

    setIsGeneratingAi(prev => ({ ...prev, [scopeId]: true }));
    try {
      const result = await bomService.fetchAIPreview(
        scope.name || "Unnamed Scope",
        (scope as any).quantity || 1,
        (scope as any).unit || "Lot",
        prompt
      );

      if (result.error) {
        alert("AI Generation Error: " + result.error);
      } else if (result.materials) {
        setAiPreviewMaterials(prev => ({ ...prev, [scopeId]: result.materials }));
      }
    } catch (err) {
      alert("Failed to generate materials: " + err.message);
    } finally {
      setIsGeneratingAi(prev => ({ ...prev, [scopeId]: false }));
    }
  };

  const handleApproveAIMaterials = async (scope: ScopeOfWork) => {
    const scopeId = scope.id as string;
    const materials = aiPreviewMaterials[scopeId];
    if (!materials || materials.length === 0) return;

    setIsSavingAi(prev => ({ ...prev, [scopeId]: true }));
    try {
      const result = await bomService.saveAIGeneratedMaterials(
        scopeId,
        scope.name || "Unnamed Scope",
        materials
      );

      if (result.error) {
        alert("Error saving materials: " + result.error);
      } else {
        setAiPreviewMaterials(prev => {
          const newState = { ...prev };
          delete newState[scopeId];
          return newState;
        });
        setAiPrompts(prev => ({ ...prev, [scopeId]: "" }));
        if (bom?.project_id) {
          await loadData(bom.project_id as string);
        }
      }
    } catch (err) {
      alert("Failed to save materials: " + err.message);
    } finally {
      setIsSavingAi(prev => ({ ...prev, [scopeId]: false }));
    }
  };

`;
  code = code.substring(0, startIndex) + newFns + code.substring(endIndex);
}

// 3. Update the UI Block
const uiBlockEnd = `                  </div>

                      <div className="flex justify-between items-start pt-2 border-t mt-2">`;

if (code.includes(uiBlockEnd)) {
  const newUi = `                  </div>

                  {aiPreviewMaterials[scope.id as string] && (
                    <div className="mt-3 border border-purple-200 dark:border-purple-800/50 rounded-md p-2 bg-white dark:bg-zinc-950">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">Preview Generated Materials ({aiPreviewMaterials[scope.id as string].length})</span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => {
                            setAiPreviewMaterials(prev => {
                              const newState = {...prev};
                              delete newState[scope.id as string];
                              return newState;
                            })
                          }}>Cancel</Button>
                          <Button size="sm" className="h-6 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => handleApproveAIMaterials(scope)} disabled={isSavingAi[scope.id as string]}>
                            {isSavingAi[scope.id as string] ? <Loader2 className="h-3 w-3 animate-spin mr-1"/> : <Plus className="h-3 w-3 mr-1" />}
                            Approve & Save
                          </Button>
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto rounded border">
                        <Table>
                          <TableHeader>
                            <TableRow className="h-6">
                              <TableHead className="py-1 text-[10px] h-6">Name</TableHead>
                              <TableHead className="py-1 text-[10px] h-6">Category</TableHead>
                              <TableHead className="py-1 text-[10px] h-6 text-right">Qty</TableHead>
                              <TableHead className="py-1 text-[10px] h-6">Unit</TableHead>
                              <TableHead className="py-1 text-[10px] h-6 text-right">Cost</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {aiPreviewMaterials[scope.id as string].map((m: any, idx: number) => (
                              <TableRow key={idx} className="h-6">
                                <TableCell className="py-1 text-[10px] font-medium">{m.name}</TableCell>
                                <TableCell className="py-1 text-[10px] text-muted-foreground">{m.category}</TableCell>
                                <TableCell className="py-1 text-[10px] text-right">{m.quantity}</TableCell>
                                <TableCell className="py-1 text-[10px]">{m.unit}</TableCell>
                                <TableCell className="py-1 text-[10px] text-right">{formatCurrency(m.unit_cost)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                      <div className="flex justify-between items-start pt-2 border-t mt-2">`;
  code = code.replace(uiBlockEnd, newUi);
}

fs.writeFileSync(path, code);
console.log('Preview UI injected successfully.');
