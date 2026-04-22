const fs = require('fs');
let code = fs.readFileSync('src/pages/bom/[projectId].tsx', 'utf8');

// 1. State variables
code = code.replace(
  'const [editingScopeId, setEditingScopeId] = useState<string | null>(null);\n  const [editingScopeName, setEditingScopeName] = useState<string>("");',
  'const [editingScopeId, setEditingScopeId] = useState<string | null>(null);\n  const [editingScopeName, setEditingScopeName] = useState<string>("");\n  const [editingScopeQuantity, setEditingScopeQuantity] = useState<string>("1");\n  const [editingScopeUnit, setEditingScopeUnit] = useState<string>("lot");'
);

code = code.replace(
  'const [showScopeInput, setShowScopeInput] = useState(false);\n  const [newScopeName, setNewScopeName] = useState("");',
  'const [showScopeInput, setShowScopeInput] = useState(false);\n  const [newScopeName, setNewScopeName] = useState("");\n  const [newScopeQuantity, setNewScopeQuantity] = useState("1");\n  const [newScopeUnit, setNewScopeUnit] = useState("lot");'
);

// 2. Add Scope Button Reset
code = code.replace(
  'const handleAddScopeClick = () => {\n    setShowScopeInput(true);\n    setNewScopeName("");\n  };',
  'const handleAddScopeClick = () => {\n    setShowScopeInput(true);\n    setNewScopeName("");\n    setNewScopeQuantity("1");\n    setNewScopeUnit("lot");\n  };'
);

// 3. Save Scope Inline
code = code.replace(
  /order_number:\s*scopes\.length\s*\+\s*1\s*\}\s*as\s*Database\["public"\]\["Tables"\]\["bom_scope_of_work"\]\["Insert"\]\);/g,
  'order_number: scopes.length + 1,\n      quantity: parseFloat(newScopeQuantity) || 1,\n      unit: newScopeUnit\n    } as any);'
);

// 4. Edit Handlers
code = code.replace(
  'const handleStartEditScope = (scope: ScopeOfWork) => {\n    setEditingScopeId(scope.id as string);\n    setEditingScopeName(scope.name || "");\n  };',
  'const handleStartEditScope = (scope: ScopeOfWork) => {\n    setEditingScopeId(scope.id as string);\n    setEditingScopeName(scope.name || "");\n    setEditingScopeQuantity((scope as any).quantity != null ? String((scope as any).quantity) : "1");\n    setEditingScopeUnit((scope as any).unit || "lot");\n  };'
);

code = code.replace(
  'const handleCancelEditScope = () => {\n    setEditingScopeId(null);\n    setEditingScopeName("");\n  };',
  'const handleCancelEditScope = () => {\n    setEditingScopeId(null);\n    setEditingScopeName("");\n    setEditingScopeQuantity("1");\n    setEditingScopeUnit("lot");\n  };'
);

code = code.replace(
  /name:\s*trimmedName\s*\}\s*as\s*Database\["public"\]\["Tables"\]\["bom_scope_of_work"\]\["Update"\]\);/g,
  'name: trimmedName,\n      quantity: parseFloat(editingScopeQuantity) || 1,\n      unit: editingScopeUnit\n    } as any);'
);

// 5. Inputs in creation form (Two places!)
code = code.replace(
  /<Input\n\s*placeholder="Or enter custom scope name"\n\s*value=\{newScopeName\}\n\s*onChange=\{\(e\) => setNewScopeName\(e.target.value\)\}\n\s*onKeyDown=\{\(e\) => \{\n\s*if \(e.key === "Enter"\) \{\n\s*void handleSaveScopeInline\(\);\n\s*\}\n\s*\}\}\n\s*className="flex-1" \/>/g,
  '<Input placeholder="Or enter custom scope name" value={newScopeName} onChange={(e) => setNewScopeName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { void handleSaveScopeInline(); } }} className="flex-1" />\n                      <Input placeholder="Qty" type="number" value={newScopeQuantity} onChange={(e) => setNewScopeQuantity(e.target.value)} className="w-16" />\n                      <Input placeholder="Unit" value={newScopeUnit} onChange={(e) => setNewScopeUnit(e.target.value)} className="w-20" />'
);

// 6. Inputs in edit mode + CardTitle display
code = code.replace(
  /<Input\n\s*value=\{editingScopeName\}\n\s*onChange=\{\(e\) => setEditingScopeName\(e\.target\.value\)\}\n\s*placeholder="Scope name"\n\s*className="h-7 max-w-xs"\n\s*\/>/g,
  '<Input value={editingScopeName} onChange={(e) => setEditingScopeName(e.target.value)} placeholder="Scope name" className="h-7 max-w-xs" />\n                            <Input type="number" value={editingScopeQuantity} onChange={(e) => setEditingScopeQuantity(e.target.value)} placeholder="Qty" className="h-7 w-16" />\n                            <Input value={editingScopeUnit} onChange={(e) => setEditingScopeUnit(e.target.value)} placeholder="Unit" className="h-7 w-20" />'
);

code = code.replace(
  /<CardTitle className="text-lg">\{scope\.name\}<\/CardTitle>/g,
  '<CardTitle className="text-lg">{scope.name}</CardTitle>\n                            <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded-md border text-muted-foreground">\n                              {(scope as any).quantity != null ? (scope as any).quantity : 1} {(scope as any).unit || "lot"}\n                            </span>'
);

fs.writeFileSync('src/pages/bom/[projectId].tsx', code);
console.log('Scope of work attributes added.');
