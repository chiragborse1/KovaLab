import { type Component } from "@mariozechner/pi-tui";
export type KovaHeroTool = {
    id: string;
    label: string;
    description?: string;
};
export type KovaHeroToolGroup = {
    id: string;
    label: string;
    source: "core" | "plugin" | string;
    tools: KovaHeroTool[];
};
export type KovaHeroSkill = {
    name: string;
    description?: string;
    source?: string;
    eligible?: boolean;
    disabled?: boolean;
};
export type KovaHeroState = {
    title: string;
    connection: string;
    connectionStatus: string;
    activityStatus: string;
    agentLabel: string;
    sessionLabel: string;
    modelLabel: string;
    tokenLabel: string;
    toolGroups: KovaHeroToolGroup[];
    skills: KovaHeroSkill[];
    catalogStatus?: string;
};
export declare function formatSkillSourceLabel(source?: string): string;
export declare class KovaHero implements Component {
    private state;
    setState(state: Partial<KovaHeroState>): void;
    invalidate(): void;
    render(width: number): string[];
    private renderCompact;
    private renderFull;
}
