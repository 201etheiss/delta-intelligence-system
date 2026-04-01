type QueryHandler = (params: unknown) => Promise<unknown>;

const queryHandlers = new Map<string, QueryHandler>();

export function registerQuery(type: string, handler: QueryHandler): void {
  queryHandlers.set(type, handler);
}

export async function executeQuery(type: string, params: unknown): Promise<unknown> {
  const handler = queryHandlers.get(type);
  if (!handler) {
    throw new Error(`No handler registered for query: ${type}`);
  }

  return handler(params);
}

export function getRegisteredQueries(): string[] {
  return Array.from(queryHandlers.keys());
}
