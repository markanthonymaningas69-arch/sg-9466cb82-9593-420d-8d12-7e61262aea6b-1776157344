import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createTaskTeam,
  createTeamMember,
  getMemberDailyRate,
  type TaskTeamConfiguration,
  type TeamMemberConfiguration,
} from "@/lib/scheduleTaskConfig";
import type { ProjectManpowerCatalogItem } from "@/services/projectManpowerCatalogService";

interface TeamCompositionEditorProps {
  teams: TaskTeamConfiguration[];
  catalogItems: ProjectManpowerCatalogItem[];
  workHoursPerDay: number;
  onChange: (teams: TaskTeamConfiguration[]) => void;
}

function getSelectedCatalogId(
  member: TeamMemberConfiguration,
  catalogItems: ProjectManpowerCatalogItem[]
) {
  if (member.catalogPositionId) {
    return member.catalogPositionId;
  }

  return (
    catalogItems.find(
      (item) => item.positionName.trim().toLowerCase() === member.positionName.trim().toLowerCase()
    )?.id || ""
  );
}

function calculateTeamMemberCount(team: TaskTeamConfiguration) {
  const membersPerTeam = team.members.reduce((sum, member) => sum + (member.count || 1), 0);
  return membersPerTeam * Math.max(1, Number(team.numberOfTeams || 1));
}

function calculateTeamDailyCost(team: TaskTeamConfiguration, workHoursPerDay: number) {
  const perTeamCost = team.members.reduce(
    (total, member) => total + getMemberDailyRate(member, workHoursPerDay) * (member.count || 1),
    0
  );

  return perTeamCost * Math.max(1, Number(team.numberOfTeams || 1));
}

export function TeamCompositionEditor({
  teams,
  catalogItems,
  workHoursPerDay,
  onChange,
}: TeamCompositionEditorProps) {
  const openCatalogView = () => {
    if (typeof document === "undefined") {
      return;
    }

    const catalogButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent?.trim().toLowerCase() === "manpower catalog");

    if (catalogButton) {
      catalogButton.click();
    }
  };

  const updateTeam = (teamId: string, updater: (team: TaskTeamConfiguration) => TaskTeamConfiguration) => {
    onChange(teams.map((team) => (team.id === teamId ? updater(team) : team)));
  };

  const addTeam = () => {
    onChange([...teams, createTaskTeam(`Team ${teams.length + 1}`, teams.length)]);
  };

  const removeTeam = (teamId: string) => {
    onChange(teams.filter((team) => team.id !== teamId));
  };

  const addMember = (teamId: string) => {
    updateTeam(teamId, (team) => ({
      ...team,
      members: [...team.members, { ...createTeamMember("", team.members.length), count: 1 }],
    }));
  };

  const removeMember = (teamId: string, memberId: string) => {
    updateTeam(teamId, (team) => ({
      ...team,
      members: team.members.filter((member) => member.id !== memberId),
    }));
  };

  const updateMember = (
    teamId: string,
    memberId: string,
    updater: (member: TeamMemberConfiguration) => TeamMemberConfiguration
  ) => {
    updateTeam(teamId, (team) => ({
      ...team,
      members: team.members.map((member) => (member.id === memberId ? updater(member) : member)),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border bg-muted/20 p-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Team Composition</h3>
          <p className="text-[11px] text-muted-foreground">
            Build task crews from this project&apos;s Manpower Catalog. Specify how many people of each position. Each team setup can be repeated using the Number of Teams field.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          <Button type="button" size="sm" variant="outline" onClick={openCatalogView}>
            Manpower Catalog
          </Button>
          <Button type="button" size="sm" onClick={addTeam}>
            <Plus className="mr-2 h-4 w-4" />
            Add Team
          </Button>
        </div>
      </div>

      {catalogItems.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Add positions in the Manpower Catalog tab first to use them in Team Composition.</p>
          <Button type="button" size="sm" variant="outline" onClick={openCatalogView}>
            Open Manpower Catalog
          </Button>
        </div>
      ) : null}

      {teams.map((team, teamIndex) => {
        const teamDailyCost = calculateTeamDailyCost(team, workHoursPerDay);
        const totalMembers = calculateTeamMemberCount(team);

        return (
          <div key={team.id} className="space-y-3 rounded-md border p-3">
            <div className="flex items-start gap-2">
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_128px]">
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs">Team Name</Label>
                  <Input
                    value={team.teamName}
                    onChange={(event) => {
                      const newName = event.target.value;
                      updateTeam(team.id, (current) => ({
                        ...current,
                        teamName: newName,
                      }));
                    }}
                    placeholder={`Team ${teamIndex + 1}`}
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5 sm:max-w-[128px]">
                  <Label className="text-xs">No. of Teams</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={team.numberOfTeams}
                    onChange={(event) => {
                      const newCount = Math.max(1, Math.round(Number(event.target.value) || 1));
                      updateTeam(team.id, (current) => ({
                        ...current,
                        numberOfTeams: newCount,
                      }));
                    }}
                    className="h-9"
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-6 h-9 w-9 shrink-0"
                onClick={() => removeTeam(team.id)}
                disabled={teams.length === 1}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs">Position - Nos - Rate</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => addMember(team.id)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Position
                </Button>
              </div>

              {team.members.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Add at least one position to this team.
                </div>
              ) : (
                <div className="space-y-2">
                  {team.members.map((member) => {
                    const matchedCatalog =
                      catalogItems.find((item) => item.id === getSelectedCatalogId(member, catalogItems)) || null;

                    return (
                      <div key={member.id} className="rounded-md border bg-muted/20 p-2">
                        <div className="grid gap-2 sm:grid-cols-[1fr_80px_110px_auto]">
                          <div className="space-y-1">
                            <Label className="text-[11px]">Position</Label>
                            <Select
                              value={getSelectedCatalogId(member, catalogItems)}
                              onValueChange={(value) => {
                                const selectedItem = catalogItems.find((item) => item.id === value);
                                if (!selectedItem) {
                                  return;
                                }

                                updateMember(team.id, member.id, (current) => ({
                                  ...current,
                                  catalogPositionId: selectedItem.id,
                                  positionName: selectedItem.positionName,
                                  rate: selectedItem.standardRate,
                                  unit: selectedItem.unit,
                                  manualRate: false,
                                  description: selectedItem.description,
                                }));
                              }}
                            >
                              <SelectTrigger className="h-8 w-full text-xs">
                                <SelectValue placeholder="Select position" />
                              </SelectTrigger>
                              <SelectContent>
                                {catalogItems.map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.positionName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px]">Nos</Label>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={member.count || 1}
                              onChange={(event) => {
                                const newCount = Math.max(1, Math.round(Number(event.target.value) || 1));
                                updateMember(team.id, member.id, (current) => ({
                                  ...current,
                                  count: newCount,
                                }));
                              }}
                              className="h-8"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px]">Rate/{member.unit === "hour" ? "Hr" : "Day"}</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={member.rate}
                              onChange={(event) => {
                                const newRate = Math.max(0, Number(event.target.value) || 0);
                                updateMember(team.id, member.id, (current) => ({
                                  ...current,
                                  rate: newRate,
                                  manualRate: true,
                                }));
                              }}
                              className="h-8"
                            />
                          </div>

                          <div className="flex items-end gap-1">
                            {matchedCatalog && member.manualRate ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2"
                                onClick={() =>
                                  updateMember(team.id, member.id, (current) => ({
                                    ...current,
                                    rate: matchedCatalog.standardRate,
                                    unit: matchedCatalog.unit,
                                    manualRate: false,
                                  }))
                                }
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeMember(team.id, member.id)}
                              disabled={team.members.length === 1}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            {member.unit === "hour" ? "Hourly" : "Daily"}
                          </Badge>
                          <span>
                            {member.count || 1} × AED {getMemberDailyRate(member, workHoursPerDay).toFixed(2)}/day = AED {(getMemberDailyRate(member, workHoursPerDay) * (member.count || 1)).toFixed(2)}/day
                          </span>
                          {member.manualRate && <Badge variant="secondary" className="h-4 px-1 text-[10px]">Manual</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid gap-2 rounded-md border bg-primary/5 p-2.5 md:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Members</p>
                <p className="mt-1 text-base font-semibold text-foreground">{totalMembers}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Daily Cost</p>
                <p className="mt-1 text-base font-semibold text-foreground">AED {teamDailyCost.toFixed(2)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}