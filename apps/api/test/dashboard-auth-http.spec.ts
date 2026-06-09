import type { INestApplication } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough, Readable, Writable } from "node:stream";
import { createApiRuntimeConfig, type EnvironmentVariables } from "@firmcode/shared";
import { createApiApplication } from "../src/main";

const WEBHOOK_SECRET = "github_webhook_secret";
const RAW_PRIVATE_KEY = [
  "-----BEGIN RSA PRIVATE KEY-----",
  "MIIBOgIBAAJBANotARealKeyButValidPemShapeForConfigTests",
  "-----END RSA PRIVATE KEY-----"
].join("\n");

const API_ENV: EnvironmentVariables = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://firmcode:secret@localhost:5432/firmcode",
  DATABASE_SSL: "false",
  REDIS_URL: "redis://localhost:6379",
  GITHUB_APP_ID: "12345",
  GITHUB_APP_PRIVATE_KEY: RAW_PRIVATE_KEY,
  GITHUB_WEBHOOK_SECRET: WEBHOOK_SECRET,
  GITHUB_CLIENT_ID: "github_client_id",
  GITHUB_CLIENT_SECRET: "github_client_secret"
};

const FIXTURE_DIR = join(__dirname, "fixtures", "github-webhooks");

describe("dashboard auth guard HTTP integration", () => {
  const previousEnv = { ...process.env };
  let app: INestApplication;

  beforeAll(async () => {
    Object.assign(process.env, API_ENV);
    app = await createApiApplication(createApiRuntimeConfig(API_ENV));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    process.env = previousEnv;
  });

  it("rejects protected dashboard routes without a bearer token before controller logic", async () => {
    const response = await dispatchRequest(app, {
      method: "GET",
      url: "/api/repositories",
      headers: {
        "x-firmcode-user-id": "user_attacker",
        "x-firmcode-workspace-id": "00000000-0000-4000-8000-000000000101"
      }
    });

    expect(response.status).toBe(401);
  });

  it("does not auth-gate GitHub webhooks and still requires GitHub signatures", async () => {
    const rawBody = await readFile(join(FIXTURE_DIR, "pull_request.opened.json"));
    const accepted = await dispatchRequest(app, {
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "content-type": "application/json",
        "content-length": rawBody.length.toString(),
        "x-hub-signature-256": signPayload(rawBody),
        "x-github-event": "pull_request",
        "x-github-delivery": "http-no-auth"
      },
      body: rawBody
    });
    const rejected = await dispatchRequest(app, {
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "content-type": "application/json",
        "content-length": rawBody.length.toString(),
        "x-hub-signature-256": signPayload(rawBody, "wrong_secret"),
        "x-github-event": "pull_request",
        "x-github-delivery": "http-bad-signature"
      },
      body: rawBody
    });

    expect(accepted.status).toBe(202);
    expect(rejected.status).toBe(401);
  });
});

function signPayload(payload: Buffer, secret = WEBHOOK_SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

async function dispatchRequest(
  app: INestApplication,
  input: {
    readonly method: string;
    readonly url: string;
    readonly headers?: Record<string, string>;
    readonly body?: Buffer;
  }
): Promise<{ readonly status: number; readonly body: string }> {
  const expressApp = app.getHttpAdapter().getInstance() as (
    request: Readable & {
      method: string;
      url: string;
      headers: Record<string, string>;
      socket: PassThrough & { encrypted: boolean; remoteAddress: string };
    },
    response: Writable & {
      statusCode: number;
      setHeader(name: string, value: string | string[]): void;
      getHeader(name: string): string | string[] | undefined;
      removeHeader(name: string): void;
      end(chunk?: unknown): void;
    }
  ) => void;
  let requestBodySent = false;
  const request = new Readable({
    read() {
      if (requestBodySent) {
        return;
      }
      requestBodySent = true;
      this.push(input.body ?? null);
      this.push(null);
    }
  }) as Readable & {
    method: string;
    url: string;
    headers: Record<string, string>;
    socket: PassThrough & { encrypted: boolean; remoteAddress: string };
  };
  const chunks: Buffer[] = [];
  const responseHeaders = new Map<string, string | string[]>();
  let settled = false;

  request.method = input.method;
  request.url = input.url;
  request.headers = input.headers ?? {};
  const socket = new PassThrough() as PassThrough & { encrypted: boolean; remoteAddress: string };
  socket.encrypted = false;
  socket.remoteAddress = "127.0.0.1";
  request.socket = socket;

  const response = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    }
  }) as Writable & {
    statusCode: number;
    setHeader(name: string, value: string | string[]): void;
    getHeader(name: string): string | string[] | undefined;
    removeHeader(name: string): void;
    end(chunk?: unknown): void;
  };

  response.statusCode = 200;
  response.setHeader = (name, value) => responseHeaders.set(name.toLowerCase(), value);
  response.getHeader = (name) => responseHeaders.get(name.toLowerCase());
  response.removeHeader = (name) => responseHeaders.delete(name.toLowerCase());

  return new Promise((resolve, reject) => {
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve({
          status: response.statusCode,
          body: Buffer.concat(chunks).toString("utf8")
        });
      }
    };
    const originalEnd = response.end.bind(response);

    response.end = ((chunk?: unknown) => {
      if (chunk !== undefined) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      originalEnd();
      finish();
      return response;
    }) as typeof response.end;
    response.on("finish", finish);
    response.on("error", reject);
    request.on("error", reject);
    expressApp(request, response);
  });
}
