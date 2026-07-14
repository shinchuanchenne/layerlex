const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
  /\/$/,
  "",
);

export interface ApiValidationIssue {
  loc: Array<string | number>;
  msg: string;
  type?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly issues: ApiValidationIssue[];

  constructor(
    status: number,
    message: string,
    issues: ApiValidationIssue[] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

interface FastApiErrorBody {
  detail?: string | ApiValidationIssue[];
}

export async function requestApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let body: FastApiErrorBody | undefined;
    try {
      body = (await response.json()) as FastApiErrorBody;
    } catch {
      // A proxy or infrastructure error may not return JSON.
    }

    const issues = Array.isArray(body?.detail) ? body.detail : [];
    const message =
      typeof body?.detail === "string"
        ? body.detail
        : issues.length > 0
          ? "Please correct the highlighted fields."
          : "Request failed with status " + response.status + ".";
    throw new ApiError(response.status, message, issues);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function getApiErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "Something went wrong.";
  }

  if (error.issues.length === 0) {
    return error.message;
  }

  return error.issues
    .map((issue) => {
      const field = issue.loc.filter((part) => part !== "body").join(".");
      return field ? field + ": " + issue.msg : issue.msg;
    })
    .join(" ");
}

export interface HealthResponse {
  status: "ok";
  service: string;
}

export async function fetchApiHealth(): Promise<HealthResponse> {
  return requestApi<HealthResponse>("/api/v1/health");
}
