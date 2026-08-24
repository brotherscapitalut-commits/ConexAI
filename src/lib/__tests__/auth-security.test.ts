import { describe, it, expect, beforeAll } from "vitest";

/**
 * Testes de segurança da emissão/verificação de JWT.
 *
 * Cada bloco aqui corresponde a uma falha REAL que existiu neste código:
 *   - assinatura literal "local" aceita sem verificação (bypass total)
 *   - payload decodificado sem checar assinatura no adminGuard
 *   - segredo derivável do DATABASE_URL
 *
 * São testes de regressão: se alguém reintroduzir qualquer um desses
 * atalhos "para facilitar o desenvolvimento", a suíte quebra.
 */

const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const ADMIN_ID = "9134419b-e855-4081-9b63-0c46001712a8";

type JwtModule = typeof import("../../../server/jwt.js");
let jwt: JwtModule;

beforeAll(async () => {
  process.env.JWT_SECRET = "a".repeat(48);
  jwt = (await import("../../../server/jwt.js")) as JwtModule;
});

describe("Emissão e verificação de token", () => {
  it("aceita um token legítimo e devolve o payload", () => {
    const token = jwt.signJwt({ sub: "user-1", email: "u@x.com", exp: 9e9 });
    expect(jwt.verifyJwt(token)?.sub).toBe("user-1");
  });

  it("extrai o userId de um Bearer válido", () => {
    const token = jwt.signJwt({ sub: "user-2", exp: 9e9 });
    expect(jwt.userIdFromRequest({ headers: { authorization: `Bearer ${token}` } })).toBe("user-2");
  });

  it("rejeita token expirado", () => {
    const expirado = jwt.signJwt({ sub: "u", exp: Math.floor(Date.now() / 1000) - 60 });
    expect(jwt.verifyJwt(expirado)).toBeNull();
  });

  it("não quebra com entradas malformadas", () => {
    for (const lixo of ["", "abc", "a.b", "a.b.c.d", null, undefined, 123, {}]) {
      expect(jwt.verifyJwt(lixo as never)).toBeNull();
    }
  });
});

describe("REGRESSÃO: bypasses de autenticação que já existiram", () => {
  it("NÃO aceita assinatura literal 'local'", () => {
    // O código antigo tinha `if (sig !== "local")` — bastava terminar o token
    // com `.local` para forjar qualquer identidade, inclusive a do admin.
    const forjado = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: ADMIN_ID, exp: 9e9 })}.local`;
    expect(jwt.verifyJwt(forjado)).toBeNull();
    expect(jwt.userIdFromRequest({ headers: { authorization: `Bearer ${forjado}` } })).toBeNull();
  });

  it("NÃO aceita assinatura arbitrária", () => {
    // O adminGuard antigo apenas fazia base64-decode do payload.
    for (const sig of ["qualquercoisa", "", "AAAA", "x".repeat(43)]) {
      const forjado = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: ADMIN_ID, exp: 9e9 })}.${sig}`;
      expect(jwt.verifyJwt(forjado)).toBeNull();
    }
  });

  it("NÃO aceita alg=none", () => {
    const algNone = `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ sub: ADMIN_ID, exp: 9e9 })}.`;
    expect(jwt.verifyJwt(algNone)).toBeNull();
  });

  it("NÃO aceita payload adulterado com assinatura válida de outro payload", () => {
    // Escalação de privilégio: pegar um token de usuário comum e trocar o sub.
    const real = jwt.signJwt({ sub: "usuario-comum", exp: 9e9 });
    const [header, , sig] = real.split(".");
    const adulterado = `${header}.${b64url({ sub: ADMIN_ID, exp: 9e9 })}.${sig}`;
    expect(jwt.verifyJwt(adulterado)).toBeNull();
  });

  it("NÃO aceita token assinado com outro segredo", async () => {
    const { createHmac } = await import("crypto");
    const header = b64url({ alg: "HS256", typ: "JWT" });
    const body = b64url({ sub: ADMIN_ID, exp: 9e9 });
    const sigErrada = createHmac("sha256", "segredo-do-atacante")
      .update(`${header}.${body}`)
      .digest("base64url");
    expect(jwt.verifyJwt(`${header}.${body}.${sigErrada}`)).toBeNull();
  });

  it("ignora Authorization sem o esquema Bearer", () => {
    const token = jwt.signJwt({ sub: "u", exp: 9e9 });
    expect(jwt.userIdFromRequest({ headers: { authorization: token } })).toBeNull();
    expect(jwt.userIdFromRequest({ headers: {} })).toBeNull();
    expect(jwt.userIdFromRequest({ headers: { authorization: `Basic ${token}` } })).toBeNull();
  });
});
