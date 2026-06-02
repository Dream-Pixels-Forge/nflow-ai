/**
 * Agent OS Layer 3: Skills Library
 * 
 * Reusable instruction sets for AI/workflows that the user does repeatedly.
 * Based on Personal Agent OS Layer 3 from Obsidian vault.
 */

export type SkillCategory = 
  | 'communication' 
  | 'analysis' 
  | 'development' 
  | 'design' 
  | 'management'
  | 'research'
  | 'automation'
  | 'custom';

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: any;
  placeholder?: string;
}

export interface SkillStep {
  id: string;
  order: number;
  action: string;
  description: string;
 工具?: string[];
  expectedOutput?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  tags: string[];
  
  // Skill Definition
  trigger: string; // What triggers this skill (e.g., "weekly status update")
  instruction: string; // The instruction template
  parameters: SkillParameter[];
  steps: SkillStep[];
  
  // Examples
  inputExample?: string;
  outputExample?: string;
  
  // Metadata
  version: string;
  author: string;
  usageCount: number;
  lastUsed?: string;
  averageRating: number;
  ratings: Array<{ rating: number; comment?: string; timestamp: string }>;
  
  createdAt: string;
  updatedAt: string;
}

export interface SkillExecution {
  id: string;
  skillId: string;
  parameters: Record<string, any>;
  input: string;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
}

/**
 * Skills Library - Manages reusable skill definitions
 */
export class SkillsLibrary {
  private skills: Map<string, Skill> = new Map();
  private executions: Map<string, SkillExecution> = new Map();
  private categoryIndex: Map<SkillCategory, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();

  constructor() {
    this.initializeCategoryIndex();
    this.initializeDefaultSkills();
  }

  /**
   * Initialize category index
   */
  private initializeCategoryIndex(): void {
    const categories: SkillCategory[] = [
      'communication', 'analysis', 'development', 'design',
      'management', 'research', 'automation', 'custom'
    ];
    categories.forEach(cat => this.categoryIndex.set(cat, new Set()));
  }

  /**
   * Initialize default skills
   */
  private initializeDefaultSkills(): void {
    const defaultSkills: Omit<Skill, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'averageRating' | 'ratings'>[] = [
      {
        name: 'Weekly Status Update',
        description: 'Generate a weekly status update report',
        category: 'communication',
        tags: ['status', 'report', 'weekly'],
        trigger: 'weekly status update',
        instruction: `Generate a weekly status update with the following sections:
1. **Accomplishments**: What was completed this week
2. **In Progress**: What is currently being worked on
3. **Blockers**: Any obstacles or issues
4. **Next Week**: Planned work for next week

Use a professional, concise tone. Include specific metrics where possible.`,
        parameters: [
          { name: 'weekNumber', type: 'number', description: 'Week number', required: false, defaultValue: 'current' },
          { name: 'includeMetrics', type: 'boolean', description: 'Include performance metrics', required: false, defaultValue: true }
        ],
        steps: [
          { id: 'step-1', order: 1, action: 'Gather completed tasks', description: 'Collect all tasks completed this week' },
          { id: 'step-2', order: 2, action: 'Gather in-progress tasks', description: 'Collect tasks currently being worked on' },
          { id: 'step-3', order: 3, action: 'Identify blockers', description: 'Note any obstacles or issues' },
          { id: 'step-4', order: 4, action: 'Plan next week', description: 'Outline planned work for next week' },
          { id: 'step-5', order: 5, action: 'Format report', description: 'Create professional status update' }
        ],
        inputExample: 'Generate my weekly status update',
        outputExample: `# Weekly Status Update - Week 23

## Accomplishments
- Completed authentication system redesign
- Deployed v2.1 to production
- Resolved 15 customer support tickets

## In Progress
- Payment integration (60% complete)
- Performance optimization sprint

## Blockers
- Waiting for legal review of terms of service

## Next Week
- Complete payment integration
- Start analytics dashboard`,
        version: '1.0.0',
        author: 'System'
      },
      {
        name: 'Meeting Prep',
        description: 'Prepare for a meeting with agenda and background',
        category: 'management',
        tags: ['meeting', 'prep', 'agenda'],
        trigger: 'prepare for meeting',
        instruction: `Prepare for a meeting with the following:
1. **Agenda**: Clear discussion points
2. **Background**: Relevant context and history
3. **Attendees**: Who will be there and their roles
4. **Objectives**: What we need to accomplish
5. **Questions**: Key questions to ask

Research the attendees and topic beforehand. Be thorough but concise.`,
        parameters: [
          { name: 'meetingTitle', type: 'string', description: 'Title of the meeting', required: true },
          { name: 'attendees', type: 'array', description: 'List of attendees', required: false },
          { name: 'duration', type: 'number', description: 'Meeting duration in minutes', required: false, defaultValue: 60 }
        ],
        steps: [
          { id: 'step-1', order: 1, action: 'Research attendees', description: 'Look up background on meeting attendees' },
          { id: 'step-2', order: 2, action: 'Review history', description: 'Check previous meetings and decisions' },
          { id: 'step-3', order: 3, action: 'Create agenda', description: 'Develop structured agenda' },
          { id: 'step-4', order: 4, action: 'Prepare questions', description: 'Formulate key questions to ask' }
        ],
        version: '1.0.0',
        author: 'System'
      },
      {
        name: 'Code Review',
        description: 'Perform a thorough code review',
        category: 'development',
        tags: ['code', 'review', 'quality'],
        trigger: 'review code',
        instruction: `Perform a comprehensive code review:
1. **Correctness**: Does the code do what it's supposed to?
2. **Edge Cases**: Are edge cases handled?
3. **Performance**: Any performance concerns?
4. **Security**: Any security vulnerabilities?
5. **Readability**: Is the code clear and maintainable?
6. **Tests**: Are there adequate tests?

Provide specific, actionable feedback with line references.`,
        parameters: [
          { name: 'code', type: 'string', description: 'Code to review', required: true },
          { name: 'language', type: 'string', description: 'Programming language', required: false },
          { name: 'focus', type: 'array', description: 'Specific areas to focus on', required: false }
        ],
        steps: [
          { id: 'step-1', order: 1, action: 'Read code', description: 'Read through the entire code' },
          { id: 'step-2', order: 2, action: 'Check correctness', description: 'Verify logic and functionality' },
          { id: 'step-3', order: 3, action: 'Review edge cases', description: 'Identify unhandled scenarios' },
          { id: 'step-4', order: 4, action: 'Assess performance', description: 'Look for performance issues' },
          { id: 'step-5', order: 5, action: 'Check security', description: 'Identify security concerns' },
          { id: 'step-6', order: 6, action: 'Provide feedback', description: 'Write actionable review comments' }
        ],
        version: '1.0.0',
        author: 'System'
      },
      {
        name: 'Decision Memo',
        description: 'Create a decision memo for important decisions',
        category: 'management',
        tags: ['decision', 'memo', 'analysis'],
        trigger: 'create decision memo',
        instruction: `Create a decision memo with:
1. **Context**: Background and situation
2. **Options**: Available alternatives (at least 3)
3. **Analysis**: Pros and cons of each option
4. **Recommendation**: Preferred option with rationale
5. **Risks**: Potential risks and mitigations
6. **Timeline**: Implementation timeline

Be objective and thorough in analysis.`,
        parameters: [
          { name: 'decision', type: 'string', description: 'Decision to be made', required: true },
          { name: 'context', type: 'string', description: 'Background context', required: false },
          { name: 'constraints', type: 'array', description: 'Constraints or requirements', required: false }
        ],
        steps: [
          { id: 'step-1', order: 1, action: 'Understand context', description: 'Gather background information' },
          { id: 'step-2', order: 2, action: 'Identify options', description: 'List all viable alternatives' },
          { id: 'step-3', order: 3, action: 'Analyze options', description: 'Evaluate pros and cons' },
          { id: 'step-4', order: 4, action: 'Make recommendation', description: 'Choose best option with rationale' },
          { id: 'step-5', order: 5, action: 'Document risks', description: 'Identify and mitigate risks' }
        ],
        version: '1.0.0',
        author: 'System'
      }
    ];

    defaultSkills.forEach(skill => {
      this.addSkill(skill);
    });
  }

  /**
   * Add a skill
   */
  addSkill(skillData: Omit<Skill, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'averageRating' | 'ratings'>): Skill {
    const skill: Skill = {
      ...skillData,
      id: `skill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      usageCount: 0,
      averageRating: 0,
      ratings: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.skills.set(skill.id, skill);

    // Update category index
    const categorySet = this.categoryIndex.get(skill.category) || new Set();
    categorySet.add(skill.id);
    this.categoryIndex.set(skill.category, categorySet);

    // Update tag index
    skill.tags.forEach(tag => {
      const tagSet = this.tagIndex.get(tag) || new Set();
      tagSet.add(skill.id);
      this.tagIndex.set(tag, tagSet);
    });

    return skill;
  }

  /**
   * Get a skill
   */
  getSkill(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  /**
   * Update a skill
   */
  updateSkill(id: string, updates: Partial<Omit<Skill, 'id' | 'createdAt'>>): Skill | null {
    const skill = this.skills.get(id);
    if (!skill) return null;

    Object.assign(skill, updates, { updatedAt: new Date().toISOString() });
    return skill;
  }

  /**
   * Delete a skill
   */
  deleteSkill(id: string): boolean {
    const skill = this.skills.get(id);
    if (!skill) return false;

    // Remove from indexes
    const categorySet = this.categoryIndex.get(skill.category);
    if (categorySet) categorySet.delete(id);

    skill.tags.forEach(tag => {
      const tagSet = this.tagIndex.get(tag);
      if (tagSet) tagSet.delete(id);
    });

    this.skills.delete(id);
    return true;
  }

  /**
   * Get skills by category
   */
  getSkillsByCategory(category: SkillCategory): Skill[] {
    const ids = this.categoryIndex.get(category) || new Set();
    return Array.from(ids)
      .map(id => this.skills.get(id))
      .filter((s): s is Skill => s !== undefined);
  }

  /**
   * Get skills by tag
   */
  getSkillsByTag(tag: string): Skill[] {
    const ids = this.tagIndex.get(tag) || new Set();
    return Array.from(ids)
      .map(id => this.skills.get(id))
      .filter((s): s is Skill => s !== undefined);
  }

  /**
   * Search skills
   */
  searchSkills(query: string): Skill[] {
    const lowerQuery = query.toLowerCase();

    return Array.from(this.skills.values()).filter(skill =>
      skill.name.toLowerCase().includes(lowerQuery) ||
      skill.description.toLowerCase().includes(lowerQuery) ||
      skill.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      skill.trigger.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Find skill by trigger
   */
  findByTrigger(trigger: string): Skill | undefined {
    const lowerTrigger = trigger.toLowerCase();

    return Array.from(this.skills.values()).find(skill =>
      skill.trigger.toLowerCase().includes(lowerTrigger) ||
      lowerTrigger.includes(skill.trigger.toLowerCase())
    );
  }

  /**
   * Execute a skill
   */
  executeSkill(skillId: string, parameters: Record<string, any>, input: string): SkillExecution {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill ${skillId} not found`);
    }

    const execution: SkillExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      skillId,
      parameters,
      input,
      status: 'pending',
      startedAt: new Date().toISOString()
    };

    this.executions.set(execution.id, execution);

    // Update skill usage
    skill.usageCount++;
    skill.lastUsed = new Date().toISOString();

    return execution;
  }

  /**
   * Complete a skill execution
   */
  completeExecution(executionId: string, output: string): SkillExecution | null {
    const execution = this.executions.get(executionId);
    if (!execution) return null;

    execution.status = 'completed';
    execution.output = output;
    execution.completedAt = new Date().toISOString();
    execution.duration = new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime();

    return execution;
  }

  /**
   * Fail a skill execution
   */
  failExecution(executionId: string, error: string): SkillExecution | null {
    const execution = this.executions.get(executionId);
    if (!execution) return null;

    execution.status = 'failed';
    execution.error = error;
    execution.completedAt = new Date().toISOString();
    execution.duration = new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime();

    return execution;
  }

  /**
   * Rate a skill
   */
  rateSkill(skillId: string, rating: number, comment?: string): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;

    skill.ratings.push({
      rating,
      comment,
      timestamp: new Date().toISOString()
    });

    // Recalculate average rating
    skill.averageRating = skill.ratings.reduce((sum, r) => sum + r.rating, 0) / skill.ratings.length;

    return true;
  }

  /**
   * Get popular skills
   */
  getPopularSkills(limit: number = 10): Skill[] {
    return Array.from(this.skills.values())
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Get top-rated skills
   */
  getTopRatedSkills(limit: number = 10): Skill[] {
    return Array.from(this.skills.values())
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, limit);
  }

  /**
   * Get recent executions
   */
  getRecentExecutions(limit: number = 10): SkillExecution[] {
    return Array.from(this.executions.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  /**
   * Export skills as JSON
   */
  exportSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Import skills from JSON
   */
  importSkills(skills: Skill[]): number {
    let imported = 0;

    skills.forEach(skill => {
      if (!this.skills.has(skill.id)) {
        this.skills.set(skill.id, skill);

        // Update indexes
        const categorySet = this.categoryIndex.get(skill.category) || new Set();
        categorySet.add(skill.id);
        this.categoryIndex.set(skill.category, categorySet);

        skill.tags.forEach(tag => {
          const tagSet = this.tagIndex.get(tag) || new Set();
          tagSet.add(skill.id);
          this.tagIndex.set(tag, tagSet);
        });

        imported++;
      }
    });

    return imported;
  }

  /**
   * Get stats
   */
  getStats(): {
    totalSkills: number;
    totalExecutions: number;
    byCategory: Record<SkillCategory, number>;
    averageRating: number;
  } {
    const skills = Array.from(this.skills.values());
    const executions = Array.from(this.executions.values());

    const byCategory: Record<SkillCategory, number> = {
      communication: 0,
      analysis: 0,
      development: 0,
      design: 0,
      management: 0,
      research: 0,
      automation: 0,
      custom: 0
    };

    skills.forEach(s => byCategory[s.category]++);

    const totalRatings = skills.reduce((sum, s) => sum + s.ratings.length, 0);
    const sumRatings = skills.reduce((sum, s) => sum + (s.averageRating * s.ratings.length), 0);

    return {
      totalSkills: skills.length,
      totalExecutions: executions.length,
      byCategory,
      averageRating: totalRatings > 0 ? sumRatings / totalRatings : 0
    };
  }

  /**
   * Clear all skills
   */
  clear(): void {
    this.skills.clear();
    this.executions.clear();
    this.categoryIndex.clear();
    this.tagIndex.clear();
    this.initializeCategoryIndex();
  }
}

// Singleton instance
export const skillsLibrary = new SkillsLibrary();
