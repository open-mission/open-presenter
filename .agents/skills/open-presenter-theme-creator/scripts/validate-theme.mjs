#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Uso: node validate-theme.mjs <caminho-do-arquivo.json>");
  process.exit(1);
}

try {
  const fullPath = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(fullPath, "utf-8");
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("O arquivo não contém um objeto JSON válido.");
  }

  const candidate = parsed.theme || parsed;

  if (typeof candidate.title !== "string" || !candidate.title.trim()) {
    throw new Error("Campo 'title' ausente ou vazio.");
  }

  if (!Array.isArray(candidate.elements) || candidate.elements.length === 0) {
    throw new Error("Campo 'elements' deve ser uma lista com pelo menos um elemento.");
  }

  const allowedTypes = new Set(["TEXT", "IMAGE", "VIDEO", "RECTANGLE"]);

  candidate.elements.forEach((el, idx) => {
    if (!el || typeof el !== "object") {
      throw new Error(`Elemento #${idx + 1} inválido.`);
    }
    const type = String(el.type || "").toUpperCase();
    if (!allowedTypes.has(type)) {
      throw new Error(`Elemento #${idx + 1} (${el.id || "sem id"}) tem tipo inválido '${type}'. Permitidos: ${[...allowedTypes].join(", ")}`);
    }
  });

  console.log(`✅ Sucesso! O arquivo '${path.basename(filePath)}' é um tema válido do Open Presenter.`);
  console.log(`   - Título: "${candidate.title}"`);
  console.log(`   - Categoria: ${candidate.category || "theme"}`);
  console.log(`   - Elementos (${candidate.elements.length}): ${candidate.elements.map(e => `${e.id} [${e.type}]`).join(", ")}`);
  process.exit(0);
} catch (err) {
  console.error(`❌ Erro ao validar tema: ${err.message}`);
  process.exit(1);
}
