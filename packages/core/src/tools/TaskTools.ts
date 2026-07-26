/**
 * DeepAGI Task Tools
 *
 * Port of Open-ClaudeCode TaskCreateTool, TaskGetTool, TaskUpdateTool,
 * TaskListTool, TaskStopTool, TaskOutputTool.
 * Simplified: in-memory task store (no file persistence).
 */

import { Tool } from './Tool.js'
import type { ToolUseContext } from './ToolUseContext.js'

// ============================================================================
// In-memory task store
// ============================================================================

export type Task = {
  id: string
  subject: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'deleted'
  createdAt: number
  updatedAt: number
  activeForm?: string
  output?: string
}

const tasks = new Map<string, Task>()

function createId(): string {
  return crypto.randomUUID().slice(0, 8)
}

// ============================================================================
// TaskCreateTool
// ============================================================================

export const TaskCreateTool: Tool<{ subject: string; description?: string; activeForm?: string }, Task> = {
  name: 'task_create',
  searchHint: 'create a tracked task',
  inputSchema: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: 'Brief task title in imperative form' },
      description: { type: 'string', description: 'What needs to be done' },
      activeForm: { type: 'string', description: 'Present continuous form for progress display' },
    },
    required: ['subject'],
  },
  description: () => 'Create a new tracked task in the task list',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call(args) {
    const task: Task = {
      id: createId(),
      subject: args.subject,
      description: args.description ?? '',
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      activeForm: args.activeForm,
    }
    tasks.set(task.id, task)
    return { data: task }
  },
}

// ============================================================================
// TaskGetTool
// ============================================================================

export const TaskGetTool: Tool<{ taskId: string }, Task | null> = {
  name: 'task_get',
  searchHint: 'get task details',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'ID of the task to retrieve' },
    },
    required: ['taskId'],
  },
  description: () => 'Retrieve a task by its ID with full details',
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isEnabled: () => true,
  async call(args) {
    const task = tasks.get(args.taskId) ?? null
    return { data: task }
  },
}

// ============================================================================
// TaskUpdateTool
// ============================================================================

export const TaskUpdateTool: Tool<{ taskId: string; status?: string; subject?: string; description?: string }, Task | null> = {
  name: 'task_update',
  searchHint: 'update task status',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'ID of the task to update' },
      status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'deleted'], description: 'New status' },
      subject: { type: 'string', description: 'New subject' },
      description: { type: 'string', description: 'New description' },
    },
    required: ['taskId'],
  },
  description: () => 'Update a task status, subject, or description',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  async call(args) {
    const task = tasks.get(args.taskId)
    if (!task) return { data: null }
    if (args.status) task.status = args.status as Task['status']
    if (args.subject) task.subject = args.subject
    if (args.description) task.description = args.description
    task.updatedAt = Date.now()
    return { data: task }
  },
}

// ============================================================================
// TaskListTool
// ============================================================================

export const TaskListTool: Tool<{ filter?: string }, Task[]> = {
  name: 'task_list',
  searchHint: 'list all tasks',
  inputSchema: {
    type: 'object',
    properties: {
      filter: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'all'], description: 'Filter by status' },
    },
  },
  description: () => 'List all tracked tasks',
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isEnabled: () => true,
  async call(args) {
    const all = Array.from(tasks.values())
    if (!args.filter || args.filter === 'all') return { data: all }
    return { data: all.filter(t => t.status === args.filter) }
  },
}

// ============================================================================
// TaskStopTool
// ============================================================================

export const TaskStopTool: Tool<{ taskId?: string }, boolean> = {
  name: 'task_stop',
  searchHint: 'stop a running task',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'Task ID to stop (optional — stops current task if omitted)' },
    },
  },
  description: () => 'Stop a running task',
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isEnabled: () => true,
  interruptBehavior: () => 'cancel' as const,
  async call(args) {
    if (args.taskId) {
      const task = tasks.get(args.taskId)
      if (task && task.status === 'in_progress') {
        task.status = 'completed'
        task.updatedAt = Date.now()
      }
    } else {
      // Stop all in-progress tasks
      for (const task of tasks.values()) {
        if (task.status === 'in_progress') {
          task.status = 'completed'
          task.updatedAt = Date.now()
        }
      }
    }
    return { data: true }
  },
}

// ============================================================================
// TaskOutputTool
// ============================================================================

export const TaskOutputTool: Tool<{ taskId: string }, string | null> = {
  name: 'task_output',
  searchHint: 'read task output',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'ID of the task' },
    },
    required: ['taskId'],
  },
  description: () => 'Read the output of a completed background task',
  isConcurrencySafe: () => true,
  isReadOnly: () => true,
  isEnabled: () => true,
  async call(args) {
    const task = tasks.get(args.taskId)
    return { data: task?.output ?? null }
  },
}
