export async function syncWhenLoggedIn<T>(resource: string, payload: T) {
  const response = await fetch(`/api/workbench/${resource}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as {
    ok: boolean;
    error?: { message: string };
  };

  if (!response.ok || !body.ok) {
    throw new Error(body.error?.message ?? `Failed to sync workbench resource: ${resource}`);
  }

  return body;
}
