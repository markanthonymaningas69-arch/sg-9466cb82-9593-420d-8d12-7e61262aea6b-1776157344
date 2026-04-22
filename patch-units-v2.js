const fs = require('fs');
const path = 'src/pages/bom/[projectId].tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add states
if (!content.includes('newScopeUnitSelection')) {
    content = content.replace(/const \[newScopeUnit, setNewScopeUnit\] = useState[^;]+;/, 'const [newScopeUnit, setNewScopeUnit] = useState("Cu.m");\n  const [newScopeUnitSelection, setNewScopeUnitSelection] = useState("Cu.m");');
    content = content.replace(/const \[editingScopeUnit, setEditingScopeUnit\] = useState[^;]+;/, 'const [editingScopeUnit, setEditingScopeUnit] = useState<string>("Cu.m");\n  const [editingScopeUnitSelection, setEditingScopeUnitSelection] = useState<string>("Cu.m");');
}

// 2. Handlers
content = content.replace(/setNewScopeUnit\([^)]+\);/g, 'setNewScopeUnit("Cu.m");\n    setNewScopeUnitSelection("Cu.m");');

if (!content.includes('["Cu.m", "Sq.m", "Lin.m", "Kg"].includes')) {
  content = content.replace(/setEditingScopeUnit\(\(scope as any\)\.unit \|\| "[^"]+"\);/, 'const u = (scope as any).unit || "Cu.m";\n    setEditingScopeUnit(u);\n    setEditingScopeUnitSelection(["Cu.m", "Sq.m", "Lin.m", "Kg"].includes(u) ? u : "Other");');
  content = content.replace(/setEditingScopeUnit\("[^"]+"\);/g, 'setEditingScopeUnit("Cu.m");\n    setEditingScopeUnitSelection("Cu.m");');
}

// 3. UI
const newScopeSelectRegex = /<Select value=\{newScopeUnit\} onValueChange=\{setNewScopeUnit\}>.*?<\/Select>/gs;
content = content.replace(newScopeSelectRegex, `<Select value={newScopeUnitSelection} onValueChange={(val) => { setNewScopeUnitSelection(val); if (val !== "Other") setNewScopeUnit(val); else setNewScopeUnit(""); }}>
                        <SelectTrigger className="w-24">
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {["Cu.m", "Sq.m", "Lin.m", "Kg", "Other"].map((u) => (
                            <SelectItem key={u} value={u}>{u === "Other" ? "Others/Input" : u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {newScopeUnitSelection === "Other" && (
                        <Input placeholder="Unit" value={newScopeUnit} onChange={(e) => setNewScopeUnit(e.target.value)} className="w-20" />
                      )}`);

const editScopeSelectRegex = /<Select value=\{editingScopeUnit\} onValueChange=\{setEditingScopeUnit\}>.*?<\/Select>/gs;
content = content.replace(editScopeSelectRegex, `<Select value={editingScopeUnitSelection} onValueChange={(val) => { setEditingScopeUnitSelection(val); if (val !== "Other") setEditingScopeUnit(val); else setEditingScopeUnit(""); }}>
                              <SelectTrigger className="h-7 w-24 text-xs">
                                <SelectValue placeholder="Unit" />
                              </SelectTrigger>
                              <SelectContent>
                                {["Cu.m", "Sq.m", "Lin.m", "Kg", "Other"].map((u) => (
                                  <SelectItem key={u} value={u} className="text-xs">{u === "Other" ? "Others/Input" : u}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {editingScopeUnitSelection === "Other" && (
                              <Input placeholder="Unit" value={editingScopeUnit} onChange={(e) => setEditingScopeUnit(e.target.value)} className="h-7 w-20 text-xs" />
                            )}`);

fs.writeFileSync(path, content);
console.log("Scope of work units updated to custom options.");
