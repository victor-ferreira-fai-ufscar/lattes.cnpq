"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api";
import type { ScrapeResponse } from "@/types/api";

export function IndividualSearch() {
  const [nome, setNome] = useState("");
  const [provedor, setProvedor] = useState("Google Gemini");
  const [modelo, setModelo] = useState("gemini-2.0-flash");
  const [apiKey, setApiKey] = useState("");
  const [headless, setHeadless] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.scrapeIndividual({
        nome: nome.trim(),
        provedor,
        modelo,
        api_key: apiKey || undefined,
        headless,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const handleModeloChange = (newModelo: string) => {
    setModelo(newModelo);
  };

  const handleProvedorChange = (newProvedor: string) => {
    setProvedor(newProvedor);
    if (newProvedor === "Google Gemini") {
      setModelo("gemini-2.0-flash");
    } else {
      setModelo("gpt-4o");
    }
  };

  const downloadDocx = async () => {
    if (!result?.docx_path) return;

    try {
      const blob = await apiClient.downloadFile(
        result.docx_path.split("/").pop()!,
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.nome}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert("Erro ao baixar arquivo");
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow-md"
      >
        <h2 className="text-xl font-semibold mb-4">Busca Individual</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Nome do Docente
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Neocles Juaçaba Júnior"
              className="w-full p-2 border rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Provedor IA
            </label>
            <select
              value={provedor}
              onChange={(e) => handleProvedorChange(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              <option>Google Gemini</option>
              <option>OpenAI</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Modelo</label>
            <select
              value={modelo}
              onChange={(e) => handleModeloChange(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              {provedor === "Google Gemini" ? (
                <>
                  <option>gemini-2.0-flash</option>
                  <option>gemini-1.5-pro</option>
                  <option>gemini-1.5-flash</option>
                </>
              ) : (
                <>
                  <option>gpt-4o</option>
                  <option>gpt-4o-mini</option>
                  <option>gpt-3.5-turbo</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              API Key (opcional)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Cole sua chave aqui..."
              className="w-full p-2 border rounded-md"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={headless}
              onChange={(e) => setHeadless(e.target.checked)}
            />
            <span className="text-sm">Execução silenciosa</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Processando..." : "Iniciar Busca"}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {result && !result.erro && (
        <div className="bg-green-50 border border-green-200 p-6 rounded-md">
          <h3 className="text-lg font-semibold mb-4">
            Resultado: {result.nome}
          </h3>

          {result.dados && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900">Resumo Executivo</h4>
                <p className="text-gray-700 mt-1">{result.dados.resumo}</p>
              </div>

              <div>
                <h4 className="font-medium text-gray-900">
                  Vínculo Institucional
                </h4>
                <p className="text-gray-700 mt-1">
                  {result.dados.vinculo_institucional}
                </p>
              </div>

              <div>
                <h4 className="font-medium text-gray-900">
                  Trajetória Acadêmica
                </h4>
                <div className="mt-2 space-y-1">
                  {result.dados.graduacao && (
                    <p>
                      <strong>Graduação:</strong> {result.dados.graduacao}
                    </p>
                  )}
                  {result.dados.mestrado && (
                    <p>
                      <strong>Mestrado:</strong> {result.dados.mestrado}
                    </p>
                  )}
                  {result.dados.doutorado && (
                    <p>
                      <strong>Doutorado:</strong> {result.dados.doutorado}
                    </p>
                  )}
                  {result.dados.pos_doutorado && (
                    <p>
                      <strong>Pós-Doc:</strong> {result.dados.pos_doutorado}
                    </p>
                  )}
                </div>
              </div>

              {result.docx_path && (
                <button
                  onClick={downloadDocx}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                >
                  Baixar Relatório (.docx)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
