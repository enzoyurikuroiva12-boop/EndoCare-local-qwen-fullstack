type UserEndpointResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

type UserEndpointFetcher = (url: string, init: { headers: Record<string, string> }) => Promise<UserEndpointResponse>;
type AccountStateFetcher = (url: string, init: { method: "POST"; headers: Record<string, string>; body: string }) => Promise<UserEndpointResponse>;

export async function getSupabaseUserId(projectUrl: string, serviceRoleKey: string, accessToken: string, fetcher: UserEndpointFetcher = fetch): Promise<string | null> {
  try {
    const url = new URL("/auth/v1/user", projectUrl).toString();
    const result = await fetcher(url, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!result.ok) return null;
    const payload = await result.json();
    return payload && typeof payload === "object" && typeof (payload as { id?: unknown }).id === "string" ? (payload as { id: string }).id : null;
  } catch {
    return null;
  }
}

export async function isSupabaseAccountActive(projectUrl: string, serviceRoleKey: string, accessToken: string, fetcher: AccountStateFetcher = fetch): Promise<boolean> {
  try {
    const url = new URL("/rest/v1/rpc/is_endoacolhe_account_active", projectUrl).toString();
    const result = await fetcher(url, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!result.ok) return false;
    return (await result.json()) === true;
  } catch {
    return false;
  }
}
