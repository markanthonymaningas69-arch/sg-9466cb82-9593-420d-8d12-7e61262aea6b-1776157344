const fs = require('fs');
const file = 'src/pages/bom/[projectId].tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add state
if (!code.includes('const [masterItems, setMasterItems]')) {
  code = code.replace(
    'const [indirectCosts, setIndirectCosts] = useState<IndirectCost[]>([]);',
    'const [indirectCosts, setIndirectCosts] = useState<IndirectCost[]>([]);\n  const [masterItems, setMasterItems] = useState<any[]>([]);\n  const [isManualMaterial, setIsManualMaterial] = useState(false);'
  );
}

// 2. Load master items
if (!code.includes('projectService.getMasterItems()')) {
  code = code.replace(
    'const { data: projectData } = await projectService.getById(id);',
    'const [{ data: projectData }, { data: masterData }] = await Promise.all([\n      projectService.getById(id),\n      projectService.getMasterItems()\n    ]);\n    setMasterItems(masterData || []);'
  );
}

// 3. resetMaterialForm
if (!code.includes('setIsManualMaterial(false);')) {
  code = code.replace(
    /const resetMaterialForm = \(\) => \{[\s\S]*?setEditingMaterial\(null\);\n  \};/,
    `const resetMaterialForm = () => {
    setMaterialForm({
      name: "",
      description: "",
      quantity: "",
      unit: "",
      unit_selection: "",
      unit_cost: ""
    });
    setEditingMaterial(null);
    setIsManualMaterial(false);
  };`
  );
}

// 4. handleEditMaterial
if (!code.includes('setIsManualMaterial(!existsInMaster')) {
  code = code.replace(
    /const handleEditMaterial = \(material: Material\) => \{[\s\S]*?setEditingMaterial\(material\);\n  \};/,
    `const handleEditMaterial = (material: Material) => {
    setSelectedScopeId(material.scope_id as string);
    const knownUnits = ["Cu.m", "Sq.m", "Lin.m", "Pc", "Kg", "Box", "lot", "bags", "pails", "gal", "liters", "bd.ft", "sets", "pairs", "rolls", "Other"];
    const unit = material.unit || "";
    const isKnown = knownUnits.includes(unit);
    
    const existsInMaster = masterItems.some(m => m.name === (material.description || material.material_name));
    setIsManualMaterial(!existsInMaster && !!(material.description || material.material_name));

    setMaterialForm({
      name: material.material_name || "",
      description: material.description || material.material_name || "",
      quantity: material.quantity != null ? Number(material.quantity).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
      unit,
      unit_selection: isKnown ? unit : unit ? "Other" : "",
      unit_cost: material.unit_cost != null ? Number(material.unit_cost).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""
    });
    setEditingMaterial(material);
  };`
  );
}

// 5. Replace <Input> for material description
if (!code.includes('!isManualMaterial ? (')) {
  code = code.replace(
    /<Input\s+placeholder="Material description"[\s\S]*?value=\{materialForm\.description\}[\s\S]*?onChange=\{\(e\) =>\s*setMaterialForm\(\{\s*\.\.\.materialForm,\s*description:\s*e\.target\.value\s*\}\)\}\s*\/>/,
    `{!isManualMaterial ? (
                              <Select value={materialForm.description} onValueChange={(val) => {
                                if (val === "others") {
                                  setIsManualMaterial(true);
                                  setMaterialForm({ ...materialForm, description: "" });
                                } else {
                                  const item = masterItems.find(m => m.name === val);
                                  if (item) {
                                    setMaterialForm({
                                      ...materialForm,
                                      description: val,
                                      unit: item.unit,
                                      unit_selection: ["Cu.m", "Sq.m", "Lin.m", "Pc", "Kg", "Box", "lot", "bags", "pails", "gal", "liters", "bd.ft", "sets", "pairs", "rolls"].includes(item.unit) ? item.unit : "Other",
                                      unit_cost: Number(item.default_cost).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                    });
                                  } else {
                                    setMaterialForm({ ...materialForm, description: val });
                                  }
                                }
                              }}>
                                <SelectTrigger className="h-7 text-xs w-full min-w-[140px]"><SelectValue placeholder="Select catalog item" /></SelectTrigger>
                                <SelectContent>
                                  {masterItems.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                                  <SelectItem value="others" className="font-semibold text-blue-600">Others (Manual)</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="flex gap-1">
                                <Input
                                  placeholder="Material description"
                                  className="h-7 text-xs"
                                  value={materialForm.description}
                                  onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                                />
                                <Button type="button" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setIsManualMaterial(false); setMaterialForm({ ...materialForm, description: "" }); }}>List</Button>
                              </div>
                            )}`
  );
}

fs.writeFileSync(file, code);
console.log("Patch applied successfully.");
