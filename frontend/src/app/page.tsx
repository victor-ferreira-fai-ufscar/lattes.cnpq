"use client";

import { FormEvent, useState } from "react";
import {
  getApiErrorMessage,
  scrapeCurriculo,
  type ScrapeResponse,
} from "@/lib/api";

export default function Home() {
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScrapeResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      setError("Informe o nome do docente.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await scrapeCurriculo(nomeLimpo);
      setResult(response);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <h1>Lattes CNPq</h1>
        <p>Digite o nome do docente para executar o scraping no backend.</p>

        <form onSubmit={handleSubmit} className="form">
          <label htmlFor="nome">Nome</label>
          <input
            id="nome"
            type="text"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Ex: Neocles Alves Pereira"
            autoComplete="off"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Processando..." : "Buscar currículo"}
          </button>
        </form>

        {error ? <div className="message error">{error}</div> : null}

        {result ? (
          <div className="result">
            <h2>Resultado</h2>
            <p>
              <strong>Nome:</strong> {result.nome}
            </p>
            <p>
              <strong>Última atualização:</strong>{" "}
              {new Date(result.ultima_atualizacao_curriculo).toLocaleDateString(
                "pt-BR",
              )}
            </p>
            <p>
              <strong>Arquivo:</strong> {result.arquivo_pdf}
            </p>
            <p>
              <a href={result.download_pdf_url} target="_blank" rel="noreferrer">
                Baixar PDF
              </a>
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
