const fs = require('fs');
let code = fs.readFileSync('src/pages/bom/[projectId].tsx', 'utf8');

// Update states to use 'Lot' (capitalized) to match the dropdown items
code = code.replace(/useState\("lot"\)/g, 'useState("Lot")');
code = code.replace(/useState<string>\("lot"\)/g, 'useState<string>("Lot")');
code = code.replace(/setNewScopeUnit\("lot"\)/g, 'setNewScopeUnit("Lot")');
code = code.replace(/setEditingScopeUnit\("lot"\)/g, 'setEditingScopeUnit("Lot")');
code = code.replace(/\|\| "lot"/g, '|| "Lot"');

// Replace the 'Add Scope' input with a Select dropdown
const newScopeUnitInput = `<Input placeholder="Unit" value={newScopeUnit} onChange={(e) => setNewScopeUnit(e.target.value)} className="w-20" />`;
const newScopeUnitSelect = `<Select value={newScopeUnit} onValueChange={setNewScopeUnit}>
                        <SelectTrigger className="w-24">
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {["Bag", "Bd.ft", "Box", "Cu.m", "Gal", "Kg", "Length", "Lin.m", "Liter", "Lot", "M", "Pail", "Pair", "Pc", "Roll", "Set", "Sq.m", "Unit"].map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>`;

code = code.split(newScopeUnitInput).join(newScopeUnitSelect);

// Replace the 'Edit Scope' input with a Select dropdown
const editingScopeUnitInput = `<Input value={editingScopeUnit} onChange={(e) => setEditingScopeUnit(e.target.value)} placeholder="Unit" className="h-7 w-20" />`;
const editingScopeUnitSelect = `<Select value={editingScopeUnit} onValueChange={setEditingScopeUnit}>
                              <SelectTrigger className="h-7 w-24 text-xs">
                                <SelectValue placeholder="Unit" />
                              </SelectTrigger>
                              <SelectContent>
                                {["Bag", "Bd.ft", "Box", "Cu.m", "Gal", "Kg", "Length", "Lin.m", "Liter", "Lot", "M", "Pail", "Pair", "Pc", "Roll", "Set", "Sq.m", "Unit"].map((u) => (
                                  <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>`;

code = code.split(editingScopeUnitInput).join(editingScopeUnitSelect);

fs.writeFileSync('src/pages/bom/[projectId].tsx', code);
console.log("Unit inputs successfully updated to dropdowns.");
