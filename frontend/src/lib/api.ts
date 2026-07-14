const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface HealthResponse {
  status: "ok";
  service: string;
}

export async function fetchApiHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_URL}/api/v1/health`);

  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}`);
  }

  return response.json() as Promise<HealthResponse>;
}
