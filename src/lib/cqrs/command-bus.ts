import type { DomainEvent } from '@/lib/events/event-schema';
import { emitEvent } from '@/lib/events/event-store';
import type { EmitEventInput } from '@/lib/events/event-schema';

type CommandHandler = (payload: unknown) => Promise<EmitEventInput[]>;

const commandHandlers = new Map<string, CommandHandler>();

export function registerCommand(type: string, handler: CommandHandler): void {
  commandHandlers.set(type, handler);
}

export async function executeCommand(type: string, payload: unknown): Promise<DomainEvent[]> {
  const handler = commandHandlers.get(type);
  if (!handler) {
    throw new Error(`No handler registered for command: ${type}`);
  }

  const eventInputs = await handler(payload);
  const emitted: DomainEvent[] = [];

  for (const input of eventInputs) {
    const event = await emitEvent(input);
    if (event) {
      emitted.push(event);
    }
  }

  return emitted;
}

export function getRegisteredCommands(): string[] {
  return Array.from(commandHandlers.keys());
}
