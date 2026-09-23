import { test } from "node:test";
import assert from "node:assert/strict";
import { join, publish, peersOf, totalConexoes } from "../src/lib/realtime-hub";

const coleta = () => {
  const recebido: { event: string; data: unknown }[] = [];
  return { recebido, send: (event: string, data: string) => recebido.push({ event, data: JSON.parse(data) }) };
};

test("quem entra vê a presença e os outros são avisados", () => {
  const a = coleta();
  const b = coleta();
  const sairA = join("base-1", { id: "u1", nome: "Ana" }, a.send);
  join("base-1", { id: "u2", nome: "Beto" }, b.send);

  assert.deepEqual(peersOf("base-1").map((p) => p.nome).sort(), ["Ana", "Beto"]);
  // Ana recebeu a presença ao entrar e de novo quando Beto entrou
  assert.equal(a.recebido.filter((m) => m.event === "presence").length, 2);
  sairA();
});

test("uma edição chega a todos da MESMA base e a ninguém de outra", () => {
  const dentro = coleta();
  const fora = coleta();
  join("base-A", { id: "u1", nome: "Ana" }, dentro.send);
  join("base-B", { id: "u9", nome: "Zé" }, fora.send);

  publish("base-A", "edit", { edits: [{ id: "c1", key: "cidade", value: "Curitiba" }], from: "u1" });

  assert.ok(dentro.recebido.some((m) => m.event === "edit"));
  assert.ok(!fora.recebido.some((m) => m.event === "edit"), "vazou para outra base");
});

test("sair remove da presença e avisa quem ficou", () => {
  const fica = coleta();
  join("base-2", { id: "u1", nome: "Ana" }, fica.send);
  const sai = join("base-2", { id: "u2", nome: "Beto" }, () => {});
  sai();
  sai(); // idempotente: sair duas vezes não quebra nem anuncia de novo

  assert.deepEqual(peersOf("base-2").map((p) => p.id), ["u1"]);
  const ultima = fica.recebido.filter((m) => m.event === "presence").at(-1)!.data as { id: string }[];
  assert.deepEqual(ultima.map((p) => p.id), ["u1"]);
});

test("a mesma pessoa em duas abas conta como UMA na presença", () => {
  join("base-3", { id: "u1", nome: "Ana" }, () => {});
  join("base-3", { id: "u1", nome: "Ana" }, () => {});
  assert.equal(peersOf("base-3").length, 1);
});

test("uma conexão que quebrou não impede as outras de receber", () => {
  const boa = coleta();
  join("base-4", { id: "u1", nome: "Ana" }, () => {
    throw new Error("conexão morta");
  });
  join("base-4", { id: "u2", nome: "Beto" }, boa.send);
  publish("base-4", "edit", { edits: [], from: "x" });
  assert.ok(boa.recebido.some((m) => m.event === "edit"));
});

test("sala vazia é descartada (não vaza memória)", () => {
  const antes = totalConexoes();
  const sai = join("base-5", { id: "u1", nome: "Ana" }, () => {});
  assert.equal(totalConexoes(), antes + 1);
  sai();
  assert.equal(totalConexoes(), antes);
  assert.deepEqual(peersOf("base-5"), []);
});
