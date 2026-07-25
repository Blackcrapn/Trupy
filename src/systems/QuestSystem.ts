import { QUESTS } from '../data/content';
import type { ObjectiveType, PlayerSave, QuestDefinition, QuestProgress, QuestStatus } from '../game/types';
import { XP_FOR_LEVEL } from '../data/content';
import { addStack, stackQuantity } from '../data/items';
import type { SaveSystem } from './SaveSystem';

export interface QuestUpdate {
  changed: boolean;
  completedObjective?: string;
  readyQuest?: QuestDefinition;
  levelUp?: number;
}

export class QuestSystem {
  constructor(private readonly saves: SaveSystem) {}

  getDefinition(id: string): QuestDefinition | undefined {
    return QUESTS.find((quest) => quest.id === id);
  }

  status(quest: QuestDefinition): QuestStatus {
    const progress = this.saves.get().questProgress[quest.id];
    if (progress) return progress.status;
    if (!quest.prerequisite) return 'available';
    return this.saves.get().questProgress[quest.prerequisite]?.status === 'completed' ? 'available' : 'completed';
  }

  isLocked(quest: QuestDefinition): boolean {
    return Boolean(quest.prerequisite && this.saves.get().questProgress[quest.prerequisite]?.status !== 'completed');
  }

  availableForNpc(npcId: string): QuestDefinition[] {
    return QUESTS.filter((quest) => quest.giver === npcId && !this.isLocked(quest) && this.status(quest) !== 'completed');
  }

  accept(id: string): boolean {
    const quest = this.getDefinition(id);
    if (!quest || this.isLocked(quest) || this.saves.get().questProgress[id]) return false;
    this.saves.mutate((save) => {
      save.questProgress[id] = { status: 'active', objectiveIndex: 0, amount: 0 };
    }, true);
    return true;
  }

  turnIn(id: string): QuestDefinition | undefined {
    const quest = this.getDefinition(id);
    const progress = this.saves.get().questProgress[id];
    if (!quest || progress?.status !== 'ready') return undefined;
    this.saves.mutate((save) => {
      progress.status = 'completed';
      save.coins += quest.reward.coins;
      save.xp += quest.reward.xp;
      save.reputation += quest.reward.reputation;
      if (quest.reward.potions) save.inventory = addStack(save.inventory, 'blood_vial', quest.reward.potions);
      for (const reward of quest.reward.items ?? []) save.inventory = addStack(save.inventory, reward.itemId, reward.quantity);
      save.potions = stackQuantity(save.inventory, 'blood_vial');
      while (save.xp >= XP_FOR_LEVEL(save.level)) {
        save.xp -= XP_FOR_LEVEL(save.level);
        save.level += 1;
        save.maxHealth += 12;
        save.health = save.maxHealth;
      }
    }, true);
    return quest;
  }

  record(type: ObjectiveType, target: string, amount = 1): QuestUpdate {
    const result: QuestUpdate = { changed: false };
    this.saves.mutate((save) => {
      for (const [id, progress] of Object.entries(save.questProgress)) {
        if (progress.status !== 'active') continue;
        const quest = this.getDefinition(id);
        const objective = quest?.objectives[progress.objectiveIndex];
        if (!quest || !objective || objective.type !== type || objective.target !== target) continue;
        progress.amount = Math.min(objective.amount, progress.amount + amount);
        result.changed = true;
        if (progress.amount >= objective.amount) {
          result.completedObjective = objective.label;
          if (progress.objectiveIndex >= quest.objectives.length - 1) {
            progress.status = 'ready';
            result.readyQuest = quest;
          } else {
            progress.objectiveIndex += 1;
            progress.amount = 0;
          }
        }
      }
    });
    return result;
  }

  getActive(): Array<{ quest: QuestDefinition; progress: QuestProgress }> {
    const save = this.saves.get();
    return Object.entries(save.questProgress)
      .filter(([, progress]) => progress.status === 'active' || progress.status === 'ready')
      .map(([id, progress]) => ({ quest: this.getDefinition(id)!, progress }))
      .filter((item) => Boolean(item.quest));
  }

  activeObjective(): { quest: QuestDefinition; progress: QuestProgress } | undefined {
    const active = this.getActive();
    return active.find((item) => item.quest.category === 'main') ?? active[0];
  }

  snapshotQuests(): Array<{ id: string; title: string; category: 'main' | 'side'; status: QuestStatus; objective?: string; amount?: number; required?: number }> {
    return QUESTS.filter((quest) => !this.isLocked(quest) || this.saves.get().questProgress[quest.id])
      .map((quest) => {
        const status = this.status(quest);
        const progress = this.saves.get().questProgress[quest.id];
        const objective = progress ? quest.objectives[progress.objectiveIndex] : undefined;
        return {
          id: quest.id,
          title: quest.title,
          category: quest.category,
          status,
          objective: objective?.label,
          amount: progress?.amount,
          required: objective?.amount,
        };
      });
  }
}
