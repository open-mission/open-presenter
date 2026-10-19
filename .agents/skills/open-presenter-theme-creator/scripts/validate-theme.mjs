#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Uso: node validate-theme.mjs <caminho-do-arquivo.json>");
  process.exit(1);
}

const allowedTypes = new Set(["TEXT", "IMAGE", "VIDEO", "RECTANGLE"]);
const allowedContexts = new Set(["rest", "music", "bible", "text"]);

function validateElements(elements, label, allowEmpty) {
  if (!Array.isArray(elements)) {
    throw new Error(`${label}: 'elements' deve ser uma lista.`);
  }
  if (!allowEmpty && elements.length === 0) {
    throw new Error(`${label}: deve conter pelo menos um elemento.`);
  }
  elements.forEach((el, idx) => {
    if (!el || typeof el !== "object") {
      throw new Error(`${label}: elemento #${idx + 1} inválido.`);
    }
    const type = String(el.type || "").toUpperCase();
    if (!allowedTypes.has(type)) {
      throw new Error(`${label}: elemento #${idx + 1} tem tipo inválido '${type}'.`);
    }
  });
}

try {
  const fullPath = path.resolve(process.cwd(), filePath);
  const parsed = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  if (!parsed || typeof parsed !== "object") {
    throw new Error("O arquivo não contém um objeto JSON válido.");
  }

  const candidate = parsed.theme || parsed;
  const version = Number(parsed.version || candidate.version || 1);
  const category = candidate.category || "theme";
  const contextsForCategory =
    category === "stage" ? allowedContexts : new Set(["music", "bible", "text"]);

  if (typeof candidate.title !== "string" || !candidate.title.trim()) {
    throw new Error("Campo 'title' ausente ou vazio.");
  }

  let contexts = [];
  if (Array.isArray(candidate.pages)) {
    if (candidate.pages.length === 0) {
      throw new Error("Campo 'pages' deve ter pelo menos uma página.");
    }
    const seen = new Set();
    candidate.pages.forEach((page, idx) => {
      if (!page || typeof page !== "object") {
        throw new Error(`Página #${idx + 1} inválida.`);
      }
      if (!contextsForCategory.has(page.context)) {
        throw new Error(
          `Página #${idx + 1}: contexto '${page.context}' inválido para a categoria '${category}'.`,
        );
      }
      if (seen.has(page.context)) {
        throw new Error(`Contexto duplicado '${page.context}'.`);
      }
      seen.add(page.context);
      contexts.push(page.context);
      validateElements(page.elements, `Página #${idx + 1}`, true);
    });
  } else {
    validateElements(candidate.elements, "Tema", false);
  }

  console.log(`✅ Sucesso! O arquivo '${path.basename(filePath)}' é um tema válido do Open Presenter.`);
  console.log(`   - Título: "${candidate.title}"`);
  console.log(`   - Versão: ${version}`);
  console.log(`   - Categoria: ${candidate.category || "theme"}`);
  if (contexts.length) {
    console.log(`   - Contextos (${contexts.length}): ${contexts.join(", ")}`);
  } else {
    console.log(`   - Elementos (${candidate.elements.length}): ${candidate.elements.map((e) => `${e.id} [${e.type}]`).join(", ")}`);
  }
  process.exit(0);
} catch (err) {
  console.error(`❌ Erro ao validar tema: ${err.message}`);
  process.exit(1);
}
